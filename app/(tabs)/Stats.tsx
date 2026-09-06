// app/(tabs)/Stats.tsx
import React, { useState, useCallback, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  StatusBar,
  Platform,
  Dimensions,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as MediaLibrary from "expo-media-library";
import * as FileSystem from "expo-file-system";
import { Ionicons } from "@expo/vector-icons";
import { router, useFocusEffect } from "expo-router";
import Svg, { Rect, Text as SvgText } from "react-native-svg";
import {
  getWeeklyStats,
  getStreak,
  getWeeklyTotals,
  type DayStatEntry,
  type WeeklyTotals,
} from "../../utils/swipeStats";

const TRASH_KEY = "@app_trash";
const FAVORITES_KEY = "@app_favorites";
const CARD_INDEX_KEY = "@gallery_last_index_v2";
const DARK_MODE_KEY = "@app_dark_mode";
const FREED_SIZE_KEY = "@app_freed_bytes";
const DELETED_COUNT_KEY = "@app_deleted_count";

const { width } = Dimensions.get("window");

type MediaItem = { id: string; fileSize?: number; type?: string };

const CHART_W = width - 64;
const CHART_H = 120;
const BAR_GAP = 6;

function WeeklyBarChart({ data, dark }: { data: DayStatEntry[]; dark: boolean }) {
  if (data.length === 0) {
    return (
      <View style={{ height: CHART_H, justifyContent: "center", alignItems: "center" }}>
        <Text style={{ color: dark ? "rgba(255,255,255,0.3)" : "rgba(0,0,0,0.25)", fontSize: 13 }}>
          Swipe des photos pour voir ton activité ici
        </Text>
      </View>
    );
  }

  const maxMB = Math.max(...data.map((d) => d.deletedMB), 0.01);
  const barW = (CHART_W - BAR_GAP * (data.length - 1)) / data.length;
  const today = new Date().toISOString().slice(0, 10);

  return (
    <Svg width={CHART_W} height={CHART_H + 24}>
      {data.map((d, i) => {
        const barH = Math.max((d.deletedMB / maxMB) * CHART_H * 0.85, d.deletedMB > 0 ? 4 : 2);
        const x = i * (barW + BAR_GAP);
        const y = CHART_H - barH;
        const isToday = d.date === today;
        const color = isToday ? "#8B8BFF" : d.deletedMB > 0 ? "#5AC8FA" : (dark ? "#2a2a2a" : "#e8e8e8");
        const labelColor = isToday ? "#8B8BFF" : (dark ? "rgba(255,255,255,0.4)" : "rgba(0,0,0,0.35)");
        return (
          <React.Fragment key={d.date}>
            <Rect
              x={x}
              y={y}
              width={barW}
              height={barH}
              rx={barW / 3}
              fill={color}
            />
            <SvgText
              x={x + barW / 2}
              y={CHART_H + 16}
              textAnchor="middle"
              fontSize={11}
              fontWeight={isToday ? "700" : "500"}
              fill={labelColor}
            >
              {d.label}
            </SvgText>
          </React.Fragment>
        );
      })}
    </Svg>
  );
}

function formatSize(bytes: number): string {
  if (bytes >= 1_073_741_824) return `${(bytes / 1_073_741_824).toFixed(1)} Go`;
  if (bytes >= 1_048_576) return `${(bytes / 1_048_576).toFixed(0)} Mo`;
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(0)} Ko`;
  return `${bytes} o`;
}

export default function StatsScreen() {
  const [darkMode, setDarkMode] = useState(false);
  const [trashCount, setTrashCount] = useState(0);
  const [favCount, setFavCount] = useState(0);
  const [totalSwiped, setTotalSwiped] = useState(0);
  const [trashSize, setTrashSize] = useState(0);
  const [freedSize, setFreedSize] = useState(0);
  const [deletedCount, setDeletedCount] = useState(0);
  const [sizeLoading, setSizeLoading] = useState(true);
  const [libraryCount, setLibraryCount] = useState(0);
  const cachedTrashSize = useRef<{ count: number; size: number } | null>(null);

  const [weeklyStats, setWeeklyStats] = useState<DayStatEntry[]>([]);
  const [streak, setStreak] = useState(0);
  const [weeklyTotals, setWeeklyTotals] = useState<WeeklyTotals | null>(null);

  const loadData = useCallback(async () => {
    try {
    const [dm, trashRaw, favRaw, indexRaw, freedRaw, deletedRaw] = await Promise.all([
      AsyncStorage.getItem(DARK_MODE_KEY),
      AsyncStorage.getItem(TRASH_KEY),
      AsyncStorage.getItem(FAVORITES_KEY),
      AsyncStorage.getItem(CARD_INDEX_KEY),
      AsyncStorage.getItem(FREED_SIZE_KEY),
      AsyncStorage.getItem(DELETED_COUNT_KEY),
    ]);

    setDarkMode(dm === "true");
    const trash: MediaItem[] = trashRaw ? JSON.parse(trashRaw) : [];
    setTrashCount(trash.length);
    const favs: MediaItem[] = favRaw ? JSON.parse(favRaw) : [];
    setFavCount(favs.length);
    setTotalSwiped(indexRaw ? Number(indexRaw) : 0);
    setFreedSize(freedRaw ? Number(freedRaw) : 0);
    setDeletedCount(deletedRaw ? Number(deletedRaw) : 0);

    // Weekly swipe activity stats
    const [ws, st, wt] = await Promise.all([
      getWeeklyStats(),
      getStreak(),
      getWeeklyTotals(),
    ]);
    setWeeklyStats(ws);
    setStreak(st);
    setWeeklyTotals(wt);

    // Nombre total de photos dans la bibliothèque
    try {
      const res = await MediaLibrary.getAssetsAsync({ mediaType: "photo", first: 1 });
      setLibraryCount(res.totalCount ?? 0);
    } catch {}

    // Cache par count pour éviter 200 appels getAssetInfoAsync à chaque navigation
    if (cachedTrashSize.current && cachedTrashSize.current.count === trash.length) {
      setTrashSize(cachedTrashSize.current.size);
      setSizeLoading(false);
      return;
    }

    setSizeLoading(true);
    const known = trash.reduce((s, i) => s + (i.fileSize ?? 0), 0);
    const missing = trash.filter(i => !i.fileSize || i.fileSize === 0).slice(0, 200);
    let fetched = 0;
    if (missing.length > 0) {
      const results = await Promise.allSettled(
        missing.map(async (item): Promise<number> => {
          try {
            const info = await MediaLibrary.getAssetInfoAsync(item.id);
            const localUri = info.localUri;
            if (localUri && !localUri.startsWith("ph://")) {
              const sz = new FileSystem.File(localUri).size;
              if (sz > 0) return sz;
            }
          } catch {}
          return 0;
        })
      );
      fetched = results.reduce((s, r) => s + (r.status === "fulfilled" ? r.value : 0), 0);
    }
    const total = known + fetched;
    cachedTrashSize.current = { count: trash.length, size: total };
    setTrashSize(total);
    } catch {
      // Ne pas bloquer l'UI si une erreur survient
    } finally {
      setSizeLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { loadData(); }, [loadData]));

  const bg = darkMode ? "#0d0d0d" : "#F2F2F7";
  const card = darkMode ? "#1a1a1a" : "#fff";
  const text = darkMode ? "#fff" : "#0d0d0d";
  const sub = darkMode ? "rgba(255,255,255,0.45)" : "rgba(0,0,0,0.38)";
  const border = darkMode ? "rgba(255,255,255,0.07)" : "rgba(0,0,0,0.06)";

  const kept = Math.max(0, totalSwiped - trashCount - favCount);

  const stats = [
    { icon: "layers-outline",          label: "Triées",      value: totalSwiped,   color: "#8B8BFF", sub: "au total" },
    { icon: "images-outline",          label: "Bibliothèque",value: libraryCount,  color: "#5AC8FA", sub: "photos sur l'appareil" },
    { icon: "trash-outline",           label: "Corbeille",   value: trashCount,    color: "#FF4458", sub: sizeLoading ? "…" : trashSize > 0 ? `≈ ${formatSize(trashSize)}` : "à supprimer" },
    { icon: "star-outline",            label: "Favoris",     value: favCount,      color: "#FFD60A", sub: "étoilées ⭐" },
    { icon: "heart-outline",           label: "Gardées",     value: kept,          color: "#4CFF5E", sub: "conservées ❤️" },
    { icon: "checkmark-circle-outline",label: "Supprimées",  value: deletedCount,  color: "#FF9500", sub: freedSize > 0 ? formatSize(freedSize) + " libérés" : "définitivement" },
  ];

  // Texte principal de la carte "espace libéré"
  const freedLabel = freedSize > 0
    ? formatSize(freedSize)
    : deletedCount > 0
      ? `${deletedCount} photo${deletedCount > 1 ? "s" : ""}`
      : "0";

  const freedSub = freedSize > 0
    ? `${deletedCount > 0 ? `${deletedCount} photo${deletedCount > 1 ? "s" : ""} supprimées` : "espace récupéré"} définitivement`
    : deletedCount > 0
      ? "supprimées définitivement de l'appareil"
      : "Supprimez des photos depuis la corbeille";

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: bg }]}>
      <StatusBar barStyle={darkMode ? "light-content" : "dark-content"} />

      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={28} color={text} />
        </TouchableOpacity>
        <Text style={[styles.title, { color: text }]}>Statistiques</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>

        {/* ACTIVITÉ HEBDOMADAIRE */}
        <Text style={[styles.sectionLabel, { color: sub }]}>ACTIVITÉ — 7 DERNIERS JOURS</Text>
        <View style={[styles.bigCard, { backgroundColor: card, borderColor: border, paddingHorizontal: 16, paddingVertical: 20 }]}>
          <WeeklyBarChart data={weeklyStats} dark={darkMode} />
        </View>

        {/* STREAK + COMPARAISON SEMAINE */}
        <View style={styles.rowCards}>
          {/* Streak */}
          <View style={[styles.halfCard, { backgroundColor: card, borderColor: border }]}>
            <Text style={{ fontSize: 36 }}>🔥</Text>
            <Text style={[styles.bigNumber, { fontSize: 40, lineHeight: 44 }, { color: streak > 0 ? "#FF9500" : (darkMode ? "#555" : "#ccc") }]}>
              {streak}
            </Text>
            <Text style={[styles.statLabel, { color: text, marginTop: 2 }]}>
              jour{streak !== 1 ? "s" : ""} de suite
            </Text>
            <Text style={[styles.statSub, { color: sub, marginTop: 2 }]}>
              {streak === 0 ? "Swipe aujourd'hui !" : streak === 1 ? "Bonne reprise !" : "Continue comme ça !"}
            </Text>
          </View>

          {/* Comparaison semaine */}
          <View style={[styles.halfCard, { backgroundColor: card, borderColor: border }]}>
            <Ionicons name="trending-up-outline" size={28} color="#8B8BFF" />
            <Text style={[styles.bigNumber, { fontSize: 28, lineHeight: 34, color: text, marginTop: 6 }]}>
              {weeklyTotals ? weeklyTotals.thisWeek.swipedCount.toLocaleString("fr-FR") : "—"}
            </Text>
            <Text style={[styles.statLabel, { color: text, marginTop: 2 }]}>
              photos triées
            </Text>
            {weeklyTotals && weeklyTotals.lastWeek.swipedCount > 0 && (
              <Text style={[styles.statSub, { color: sub, marginTop: 2 }]}>
                {weeklyTotals.thisWeek.swipedCount >= weeklyTotals.lastWeek.swipedCount
                  ? `+${weeklyTotals.thisWeek.swipedCount - weeklyTotals.lastWeek.swipedCount} vs sem. passée`
                  : `-${weeklyTotals.lastWeek.swipedCount - weeklyTotals.thisWeek.swipedCount} vs sem. passée`}
              </Text>
            )}
            {weeklyTotals && weeklyTotals.lastWeek.swipedCount === 0 && (
              <Text style={[styles.statSub, { color: sub, marginTop: 2 }]}>cette semaine</Text>
            )}
          </View>
        </View>

        {/* Mo libérés cette semaine */}
        {weeklyTotals && weeklyTotals.thisWeek.deletedMB > 0 && (
          <View style={[styles.freedCard, { backgroundColor: card, borderColor: "rgba(138,139,255,0.25)", marginBottom: 20 }]}>
            <View style={[styles.freedIcon, { backgroundColor: "rgba(138,139,255,0.12)" }]}>
              <Ionicons name="bar-chart" size={36} color="#8B8BFF" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.freedValue, { color: "#8B8BFF", fontSize: 28 }]}>
                {weeklyTotals.thisWeek.deletedMB >= 1000
                  ? `${(weeklyTotals.thisWeek.deletedMB / 1024).toFixed(1)} Go`
                  : `${weeklyTotals.thisWeek.deletedMB.toFixed(0)} Mo`}
              </Text>
              <Text style={[styles.freedLabel, { color: text }]}>supprimés cette semaine</Text>
              {weeklyTotals.lastWeek.deletedMB > 0 && (
                <Text style={[styles.freedSub, { color: sub }]}>
                  {weeklyTotals.thisWeek.deletedMB >= weeklyTotals.lastWeek.deletedMB
                    ? `+${(weeklyTotals.thisWeek.deletedMB - weeklyTotals.lastWeek.deletedMB).toFixed(0)} Mo vs sem. passée`
                    : `-${(weeklyTotals.lastWeek.deletedMB - weeklyTotals.thisWeek.deletedMB).toFixed(0)} Mo vs sem. passée`}
                </Text>
              )}
            </View>
          </View>
        )}

        {/* VUE D'ENSEMBLE */}
        <Text style={[styles.sectionLabel, { color: sub }]}>VUE D'ENSEMBLE</Text>
        <View style={[styles.bigCard, { backgroundColor: card, borderColor: border }]}>
          <Text style={[styles.bigNumber, { color: text }]}>{totalSwiped.toLocaleString("fr-FR")}</Text>
          <Text style={[styles.bigLabel, { color: sub }]}>PHOTOS TRIÉES AU TOTAL</Text>
          {totalSwiped > 0 && (
            <View style={styles.barWrap}>
              {trashCount > 0 && <View style={[styles.barSeg, { flex: trashCount / totalSwiped, backgroundColor: "#FF4458" }]} />}
              {favCount > 0   && <View style={[styles.barSeg, { flex: favCount   / totalSwiped, backgroundColor: "#FFD60A" }]} />}
              {kept > 0       && <View style={[styles.barSeg, { flex: kept       / totalSwiped, backgroundColor: "#4CFF5E" }]} />}
            </View>
          )}
          {totalSwiped === 0 && (
            <Text style={[styles.bigLabel, { color: sub, marginTop: 8, marginBottom: 0 }]}>
              Commencez à swiper pour voir vos stats !
            </Text>
          )}
          <View style={styles.barLegend}>
            <LegendDot color="#FF4458" label="Corbeille" />
            <LegendDot color="#FFD60A" label="Favoris" />
            <LegendDot color="#4CFF5E" label="Gardées" />
          </View>
        </View>

        {/* DÉTAIL */}
        <Text style={[styles.sectionLabel, { color: sub, marginTop: 24 }]}>DÉTAIL</Text>
        <View style={styles.grid}>
          {stats.map((s) => (
            <View key={s.label} style={[styles.statCard, { backgroundColor: card, borderColor: border }]}>
              <View style={[styles.statIconWrap, { backgroundColor: s.color + "22" }]}>
                <Ionicons name={s.icon as any} size={22} color={s.color} />
              </View>
              <Text style={[styles.statValue, { color: text }]}>{s.value.toLocaleString("fr-FR")}</Text>
              <Text style={[styles.statLabel, { color: text }]}>{s.label}</Text>
              <Text style={[styles.statSub, { color: sub }]}>{s.sub}</Text>
            </View>
          ))}
        </View>

        {/* STOCKAGE LIBÉRÉ */}
        <Text style={[styles.sectionLabel, { color: sub, marginTop: 24 }]}>STOCKAGE</Text>

        {/* Carte verte : espace récupéré définitivement */}
        <View style={[styles.freedCard, { backgroundColor: card, borderColor: freedSize > 0 ? "rgba(76,255,94,0.25)" : border }]}>
          <View style={[styles.freedIcon, { backgroundColor: (freedSize > 0 || deletedCount > 0) ? "rgba(76,255,94,0.15)" : "rgba(128,128,128,0.1)" }]}>
            <Ionicons
              name={deletedCount > 0 ? "checkmark-circle" : "checkmark-circle-outline"}
              size={40}
              color={(freedSize > 0 || deletedCount > 0) ? "#4CFF5E" : (darkMode ? "#444" : "#ccc")}
            />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.freedValue, { color: (freedSize > 0 || deletedCount > 0) ? "#4CFF5E" : (darkMode ? "#555" : "#bbb") }]}>
              {freedLabel}
            </Text>
            <Text style={[styles.freedLabel, { color: text }]}>
              {freedSize > 0 ? "récupérés définitivement" : deletedCount > 0 ? "supprimées définitivement" : "espace récupéré"}
            </Text>
            <Text style={[styles.freedSub, { color: sub }]}>{freedSub}</Text>
          </View>
        </View>

        {/* Carte rouge : photos en attente dans la corbeille */}
        <View style={[styles.trashCard, { backgroundColor: card, borderColor: trashCount > 0 ? "rgba(255,68,88,0.2)" : border }]}>
          <View style={[styles.trashIcon, { backgroundColor: trashCount > 0 ? "rgba(255,68,88,0.12)" : "rgba(128,128,128,0.08)" }]}>
            <Ionicons name="trash-outline" size={32} color={trashCount > 0 ? "#FF4458" : (darkMode ? "#444" : "#ccc")} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.trashValue, { color: trashCount > 0 ? "#FF4458" : (darkMode ? "#555" : "#bbb") }]}>
              {trashCount > 0
                ? (sizeLoading ? "…" : trashSize > 0 ? formatSize(trashSize) : `${trashCount} photos`)
                : "Corbeille vide"}
            </Text>
            <Text style={[styles.freedLabel, { color: text }]}>
              {trashCount > 0 ? "en attente dans la corbeille" : "rien à supprimer"}
            </Text>
            <Text style={[styles.freedSub, { color: sub }]}>
              {trashCount > 0
                ? `${trashCount} photo${trashCount > 1 ? "s" : ""} — videz pour libérer cet espace`
                : "Swipez à gauche pour mettre des photos ici"}
            </Text>
          </View>
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}

const LegendDot = ({ color, label }: { color: string; label: string }) => (
  <View style={styles.legendItem}>
    <View style={[styles.legendDot, { backgroundColor: color }]} />
    <Text style={styles.legendLabel}>{label}</Text>
  </View>
);

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: Platform.OS === "ios" ? 10 : 14,
  },
  backBtn: { padding: 4 },
  title: { fontSize: 20, fontWeight: "700" },

  content: { paddingHorizontal: 16, paddingBottom: 48 },
  sectionLabel: { fontSize: 11, fontWeight: "700", letterSpacing: 0.8, marginBottom: 10 },

  bigCard: {
    borderRadius: 20,
    padding: 24,
    alignItems: "center",
    borderWidth: 1,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  bigNumber: { fontSize: 64, fontWeight: "800", letterSpacing: -2, lineHeight: 72 },
  bigLabel: { fontSize: 11, fontWeight: "700", letterSpacing: 0.8, marginTop: 4, marginBottom: 20 },
  barWrap: {
    flexDirection: "row",
    width: "100%",
    height: 10,
    borderRadius: 5,
    overflow: "hidden",
    gap: 2,
    marginBottom: 4,
  },
  barSeg: { borderRadius: 5 },
  barLegend: { flexDirection: "row", gap: 16, marginTop: 12 },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 5 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendLabel: { fontSize: 11, color: "rgba(128,128,128,0.8)", fontWeight: "500" },

  rowCards: {
    flexDirection: "row",
    gap: 12,
    marginTop: 12,
    marginBottom: 12,
  },
  halfCard: {
    flex: 1,
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
    gap: 2,
  },

  grid: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  statCard: {
    width: (width - 44) / 2,
    borderRadius: 18,
    padding: 18,
    borderWidth: 1,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  statIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 12,
  },
  statValue: { fontSize: 32, fontWeight: "800", letterSpacing: -1 },
  statLabel: { fontSize: 13, fontWeight: "600", marginTop: 4 },
  statSub: { fontSize: 11, marginTop: 2 },

  freedCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
    borderRadius: 20,
    padding: 20,
    borderWidth: 1.5,
    marginBottom: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  freedIcon: {
    width: 64,
    height: 64,
    borderRadius: 18,
    justifyContent: "center",
    alignItems: "center",
  },
  freedValue: { fontSize: 36, fontWeight: "800", letterSpacing: -1.5, lineHeight: 40 },
  freedLabel: { fontSize: 13, fontWeight: "600", marginTop: 3 },
  freedSub: { fontSize: 11, marginTop: 3, lineHeight: 15 },

  trashCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
    borderRadius: 18,
    padding: 18,
    borderWidth: 1,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  trashIcon: {
    width: 56,
    height: 56,
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
  },
  trashValue: { fontSize: 28, fontWeight: "800", letterSpacing: -0.8, lineHeight: 32 },
});
