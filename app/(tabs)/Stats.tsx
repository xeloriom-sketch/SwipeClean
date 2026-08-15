// app/(tabs)/Stats.tsx
import React, { useEffect, useState } from "react";
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
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";

const TRASH_KEY = "@app_trash";
const FAVORITES_KEY = "@app_favorites";
const CARD_INDEX_KEY = "@gallery_last_index_v2";
const DARK_MODE_KEY = "@app_dark_mode";

const { width } = Dimensions.get("window");

type MediaItem = { id: string; fileSize?: number; type?: string };

function formatSize(bytes: number): string {
  if (bytes >= 1_073_741_824) return `${(bytes / 1_073_741_824).toFixed(1)} Go`;
  if (bytes >= 1_048_576) return `${(bytes / 1_048_576).toFixed(0)} Mo`;
  return `${(bytes / 1024).toFixed(0)} Ko`;
}

export default function StatsScreen() {
  const [darkMode, setDarkMode] = useState(false);
  const [trashCount, setTrashCount] = useState(0);
  const [favCount, setFavCount] = useState(0);
  const [totalSwiped, setTotalSwiped] = useState(0);
  const [trashSize, setTrashSize] = useState(0);

  useEffect(() => {
    (async () => {
      const [dm, trashRaw, favRaw, indexRaw] = await Promise.all([
        AsyncStorage.getItem(DARK_MODE_KEY),
        AsyncStorage.getItem(TRASH_KEY),
        AsyncStorage.getItem(FAVORITES_KEY),
        AsyncStorage.getItem(CARD_INDEX_KEY),
      ]);
      setDarkMode(dm === "true");

      const trash: MediaItem[] = trashRaw ? JSON.parse(trashRaw) : [];
      setTrashCount(trash.length);
      setTrashSize(trash.reduce((sum, i) => sum + (i.fileSize ?? 0), 0));

      const favs: MediaItem[] = favRaw ? JSON.parse(favRaw) : [];
      setFavCount(favs.length);

      setTotalSwiped(indexRaw ? Number(indexRaw) : 0);
    })();
  }, []);

  const bg = darkMode ? "#0d0d0d" : "#F8F8F8";
  const card = darkMode ? "#1a1a1a" : "#fff";
  const text = darkMode ? "#fff" : "#0d0d0d";
  const sub = darkMode ? "rgba(255,255,255,0.45)" : "rgba(0,0,0,0.38)";
  const border = darkMode ? "rgba(255,255,255,0.07)" : "rgba(0,0,0,0.06)";

  const kept = Math.max(0, totalSwiped - trashCount - favCount);

  const stats = [
    { icon: "layers-outline", label: "Photos triées", value: totalSwiped, color: "#8B8BFF", sub: "au total" },
    { icon: "trash-outline", label: "Corbeille", value: trashCount, color: "#FF4458", sub: trashSize > 0 ? `≈ ${formatSize(trashSize)}` : "à supprimer" },
    { icon: "heart-outline", label: "Favoris", value: favCount, color: "#FF6B9D", sub: "sauvegardés" },
    { icon: "checkmark-circle-outline", label: "Gardés", value: kept, color: "#4CFF5E", sub: "conservés" },
  ];

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
        <Text style={[styles.sectionLabel, { color: sub }]}>VUE D'ENSEMBLE</Text>

        <View style={[styles.bigCard, { backgroundColor: card, borderColor: border }]}>
          <Text style={[styles.bigNumber, { color: text }]}>{totalSwiped}</Text>
          <Text style={[styles.bigLabel, { color: sub }]}>PHOTOS TRIÉES AU TOTAL</Text>
          {totalSwiped > 0 && (
            <View style={styles.barWrap}>
              {trashCount > 0 && (
                <View style={[styles.barSeg, { flex: trashCount / totalSwiped, backgroundColor: "#FF4458" }]} />
              )}
              {favCount > 0 && (
                <View style={[styles.barSeg, { flex: favCount / totalSwiped, backgroundColor: "#FF6B9D" }]} />
              )}
              {kept > 0 && (
                <View style={[styles.barSeg, { flex: kept / totalSwiped, backgroundColor: "#4CFF5E" }]} />
              )}
            </View>
          )}
          <View style={styles.barLegend}>
            <LegendDot color="#FF4458" label="Corbeille" />
            <LegendDot color="#FF6B9D" label="Favoris" />
            <LegendDot color="#4CFF5E" label="Gardés" />
          </View>
        </View>

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

        {trashSize > 0 && (
          <>
            <Text style={[styles.sectionLabel, { color: sub, marginTop: 24 }]}>ESPACE</Text>
            <View style={[styles.spaceCard, { backgroundColor: card, borderColor: border }]}>
              <Ionicons name="cloud-outline" size={32} color="#FF4458" />
              <View style={{ flex: 1 }}>
                <Text style={[styles.spaceValue, { color: text }]}>{formatSize(trashSize)}</Text>
                <Text style={[styles.spaceSub, { color: sub }]}>en attente de suppression dans la corbeille</Text>
              </View>
            </View>
          </>
        )}
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
    height: 8,
    borderRadius: 4,
    overflow: "hidden",
    gap: 2,
  },
  barSeg: { borderRadius: 4 },
  barLegend: { flexDirection: "row", gap: 16, marginTop: 12 },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 5 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendLabel: { fontSize: 11, color: "rgba(128,128,128,0.8)", fontWeight: "500" },

  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
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

  spaceCard: {
    borderRadius: 18,
    padding: 20,
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
    borderWidth: 1,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  spaceValue: { fontSize: 28, fontWeight: "800", letterSpacing: -0.8 },
  spaceSub: { fontSize: 12, marginTop: 2 },
});
