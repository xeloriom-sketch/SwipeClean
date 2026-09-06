// app/(tabs)/Duplicates.tsx
import React, { useState, useCallback, useEffect } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Dimensions,
  StatusBar,
  Platform,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as MediaLibrary from "expo-media-library";
import * as Haptics from "expo-haptics";
import { Image } from "expo-image";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { usePopup } from "../../components/Popup";
import AppLoader from "../../components/AppLoader";

const { width } = Dimensions.get("window");
const DARK_MODE_KEY = "@app_dark_mode";
const THUMB_SIZE = Math.round((width - 48) / 2.5);

type Asset = {
  id: string;
  uri: string;
  width: number;
  height: number;
  creationTime: number;
  filename: string;
  fileSize?: number;
  albums: string[]; // albums utilisateur contenant cette photo
};

type DuplicateGroup = {
  key: string;
  items: Asset[];
  totalSize: number;
  saveable: number; // bytes we'd free by keeping only 1
};

function formatBytes(b: number) {
  if (b >= 1_000_000) return `${(b / 1_000_000).toFixed(1)} Mo`;
  if (b >= 1_000) return `${Math.round(b / 1_000)} Ko`;
  return `${b} o`;
}

/* ---- Group card ---- */
function GroupCard({
  group,
  dark,
  onDelete,
}: {
  group: DuplicateGroup;
  dark: boolean;
  onDelete: (group: DuplicateGroup, keepIds: string[]) => void;
}) {
  // Par défaut : premier item coché (à garder), reste non coché (à supprimer)
  const [keptIds, setKeptIds] = useState<Set<string>>(new Set([group.items[0].id]));

  const bg = dark ? "#1e1e1e" : "#f2f2f7";
  const textColor = dark ? "#fff" : "#000";
  const subColor = dark ? "rgba(255,255,255,0.5)" : "rgba(0,0,0,0.4)";
  const toDeleteCount = group.items.filter((i) => !keptIds.has(i.id)).length;

  const toggle = (id: string) => {
    setKeptIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        // Ne pas tout décocher
        if (next.size <= 1) return prev;
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  return (
    <View style={[styles.groupCard, { backgroundColor: bg }]}>

      {/* Hint */}
      <Text style={[styles.groupHint, { color: subColor }]}>
        ✓ = garder · coche plusieurs si besoin
      </Text>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 14 }}>
        <View style={{ flexDirection: "row", gap: 10, paddingHorizontal: 14 }}>
          {group.items.map((item, i) => {
            const isKept = keptIds.has(item.id);
            const albumLabel = item.albums.length > 0 ? item.albums[0] : null;
            return (
              <TouchableOpacity
                key={item.id}
                activeOpacity={0.8}
                onPress={() => toggle(item.id)}
                style={{ width: THUMB_SIZE }}
              >
                <View style={{ position: "relative" }}>
                  <Image
                    source={{ uri: item.uri }}
                    style={{
                      width: THUMB_SIZE,
                      height: THUMB_SIZE,
                      borderRadius: 12,
                      backgroundColor: "#333",
                    }}
                    contentFit="cover"
                    cachePolicy="memory-disk"
                    recyclingKey={item.id}
                  />

                  {/* Overlay rouge si à supprimer */}
                  {!isKept && <View style={styles.dimOverlay} />}

                  {/* Bordure bleue si à garder */}
                  {isKept && <View style={styles.selectedBorder} />}

                  {/* Cercle check/croix */}
                  <View style={[styles.checkCircle, isKept ? styles.checkCircleActive : styles.checkCircleDelete]}>
                    <Ionicons
                      name={isKept ? "checkmark" : "close"}
                      size={12}
                      color="#fff"
                    />
                  </View>

                  {/* Badge "récent" sur le 1er */}
                  {i === 0 && (
                    <View style={styles.bestBadge}>
                      <Text style={styles.bestBadgeText}>Récent</Text>
                    </View>
                  )}
                </View>

                {/* Album badge sous la photo */}
                <View style={styles.albumBadgeWrap}>
                  {albumLabel ? (
                    <>
                      <Ionicons name="folder-outline" size={10} color={isKept ? "#007AFF" : subColor} />
                      <Text
                        style={[styles.albumBadgeText, { color: isKept ? "#007AFF" : subColor }]}
                        numberOfLines={1}
                      >
                        {albumLabel}
                      </Text>
                    </>
                  ) : (
                    <Text style={[styles.albumBadgeText, { color: subColor }]} numberOfLines={1}>
                      Pellicule
                    </Text>
                  )}
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
      </ScrollView>

      <View style={styles.groupFooter}>
        <View>
          <Text style={[styles.groupCount, { color: textColor }]}>
            {keptIds.size} gardée{keptIds.size > 1 ? "s" : ""} · {toDeleteCount} supprimée{toDeleteCount > 1 ? "s" : ""}
          </Text>
          <Text style={[styles.groupSave, { color: subColor }]}>
            {group.items.length} photos similaires
          </Text>
        </View>
        <TouchableOpacity
          style={[styles.deleteGroupBtn, toDeleteCount === 0 && { opacity: 0.35 }]}
          onPress={() => toDeleteCount > 0 && onDelete(group, [...keptIds])}
          activeOpacity={0.75}
          disabled={toDeleteCount === 0}
        >
          <Ionicons name="trash-outline" size={15} color="#fff" style={{ marginRight: 5 }} />
          <Text style={styles.deleteGroupBtnText}>
            {toDeleteCount === 0 ? "Tout gardé" : `Supprimer ${toDeleteCount}`}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

/* ---- Screen ---- */
export default function DuplicatesScreen() {
  const [darkMode, setDarkMode] = useState(false);
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [scanStep, setScanStep] = useState("Chargement des photos…");
  const [groups, setGroups] = useState<DuplicateGroup[] | null>(null);
  const { popup, showPopup } = usePopup(darkMode);

  React.useEffect(() => {
    AsyncStorage.getItem(DARK_MODE_KEY).then((v) => {
      if (v !== null) setDarkMode(v === "true");
      setLoading(false);
    });
  }, []);

  const cancelRef = React.useRef(false);

  const scan = useCallback(async () => {
    cancelRef.current = false;
    setScanning(true);
    setProgress(0);
    setScanStep("Chargement des photos…");
    setGroups(null);

    try {
      const { status } = await MediaLibrary.requestPermissionsAsync();
      if (status !== "granted") {
        showPopup({
          icon: "🔒",
          title: "Permission requise",
          message: "Autorise l'accès à la photothèque pour scanner les doublons.",
          buttons: [{ text: "OK", style: "default" }],
        });
        setScanning(false);
        return;
      }

      // 1. Charger toutes les photos en pagination (batch 1000 pour aller vite)
      const allAssets: MediaLibrary.Asset[] = [];
      let hasNext = true;
      let after: string | undefined;

      while (hasNext) {
        const page = await MediaLibrary.getAssetsAsync({
          mediaType: "photo",
          first: 1000,
          after,
          sortBy: [[MediaLibrary.SortBy.creationTime, false]], // false = desc, récent en premier sur iOS et Android
        });
        allAssets.push(...page.assets);
        hasNext = page.hasNextPage;
        after = page.endCursor;
        setProgress(0.7 * Math.min(allAssets.length / Math.max(page.totalCount, 1), 1));
        if (cancelRef.current) return;
      }

      if (allAssets.length === 0) {
        setGroups([]);
        setScanning(false);
        return;
      }

      setProgress(0.72);
      setScanStep("Chargement des albums…");

      // 2. Charger les albums utilisateur et construire le reverse map photoId → albums
      //    Permet d'afficher dans quel dossier se trouve chaque doublon
      const albumMap = new Map<string, string[]>();
      try {
        const albums = await MediaLibrary.getAlbumsAsync({ includeSmartAlbums: false });
        if (!cancelRef.current) {
          await Promise.all(
            albums.map(async (album) => {
              try {
                let hasNextAlbum = true;
                let albumAfter: string | undefined;
                while (hasNextAlbum) {
                  if (cancelRef.current) return; // arrêt si l'écran est démonté
                  const page = await MediaLibrary.getAssetsAsync({
                    album,
                    first: 2000,
                    after: albumAfter,
                  });
                  for (const asset of page.assets) {
                    const arr = albumMap.get(asset.id) ?? [];
                    if (!arr.includes(album.title)) arr.push(album.title);
                    albumMap.set(asset.id, arr);
                  }
                  hasNextAlbum = page.hasNextPage;
                  albumAfter = page.endCursor;
                }
              } catch {}
            })
          );
        }
      } catch {}

      if (cancelRef.current) return;
      setProgress(0.82);
      setScanStep("Analyse des doublons…");

      // 3. Grouper par dimensions + fenêtre d'1 seconde — 100% synchrone, zéro appel réseau
      const buckets = new Map<string, MediaLibrary.Asset[]>();
      for (const asset of allAssets) {
        const key = `${asset.width}x${asset.height}_${Math.floor(asset.creationTime / 1000)}`;
        const arr = buckets.get(key) ?? [];
        arr.push(asset);
        buckets.set(key, arr);
      }

      setProgress(0.88);

      // 4. Garder uniquement les groupes avec 2+ photos
      const candidates = [...buckets.entries()].filter(([, arr]) => arr.length >= 2);

      if (candidates.length === 0) {
        setGroups([]);
        setScanning(false);
        return;
      }

      // 5. Construire les groupes directement depuis les données déjà chargées
      //    (pas de getAssetInfoAsync ni FileSystem → résultat immédiat)
      const result: DuplicateGroup[] = candidates.map(([key, assets]) => {
        const items: Asset[] = assets.map((a) => ({
          id: a.id,
          uri: a.uri,          // expo-image gère ph:// et content:// nativement
          width: a.width,
          height: a.height,
          creationTime: a.creationTime,
          filename: a.filename,
          albums: albumMap.get(a.id) ?? [],
        }));
        // Le premier est le plus récent (tri par creationTime desc depuis MediaLibrary)
        return { key, items, totalSize: 0, saveable: 0 };
      });

      // Trier par nombre de doublons décroissant
      result.sort((a, b) => b.items.length - a.items.length);

      setGroups(result);
    } catch {
      showPopup({
        icon: "⚠️",
        title: "Erreur",
        message: "Impossible de scanner la photothèque.",
        buttons: [{ text: "OK", style: "default" }],
      });
    } finally {
      if (!cancelRef.current) {
        setScanning(false);
        setProgress(1);
      }
    }
  }, [showPopup]);

  // Annuler le scan si l'écran est démonté pendant le scan
  useEffect(() => () => { cancelRef.current = true; }, []);

  const deleteGroup = useCallback(
    (group: DuplicateGroup, keepIds: string[]) => {
      const keepSet = new Set(keepIds);
      const toDelete = group.items.filter((a) => !keepSet.has(a.id));
      if (toDelete.length === 0) return;
      showPopup({
        icon: "🗑️",
        title: "Supprimer les doublons ?",
        message: `Garder ${keepIds.length} photo${keepIds.length > 1 ? "s" : ""} et supprimer ${toDelete.length} doublon${toDelete.length > 1 ? "s" : ""}. Cette action est irréversible.`,
        buttons: [
          { text: "Annuler", style: "cancel" },
          {
            text: `Supprimer ${toDelete.length}`,
            style: "destructive",
            onPress: async () => {
              try {
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
                await MediaLibrary.deleteAssetsAsync(toDelete.map((a) => a.id));
                setGroups((prev) => prev?.filter((g) => g.key !== group.key) ?? null);
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              } catch {
                showPopup({
                  icon: "⚠️",
                  title: "Erreur",
                  message: "Impossible de supprimer les photos.",
                  buttons: [{ text: "OK", style: "default" }],
                });
              }
            },
          },
        ],
      });
    },
    [showPopup]
  );

  const deleteAll = useCallback(() => {
    if (!groups || groups.length === 0) return;
    const total = groups.reduce((s, g) => s + g.items.length - 1, 0);
    showPopup({
      icon: "🗑️",
      title: "Supprimer tous les doublons ?",
      message: `Garder la photo la plus récente de chaque groupe et supprimer ${total} photo${total > 1 ? "s" : ""}. Cette action est irréversible.`,
      buttons: [
        { text: "Annuler", style: "cancel" },
        {
          text: `Supprimer ${total}`,
          style: "destructive",
          onPress: async () => {
            try {
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
              const ids = groups.flatMap((g) => g.items.slice(1).map((a) => a.id)); // garde le 1er de chaque groupe
              await MediaLibrary.deleteAssetsAsync(ids);
              setGroups([]);
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              showPopup({
                icon: "✅",
                title: "Terminé !",
                message: `${total} doublon${total > 1 ? "s" : ""} supprimé${total > 1 ? "s" : ""} avec succès.`,
                buttons: [{ text: "Super !", style: "default" }],
              });
            } catch {
              showPopup({
                icon: "⚠️",
                title: "Erreur",
                message: "Certaines suppressions ont échoué.",
                buttons: [{ text: "OK", style: "default" }],
              });
            }
          },
        },
      ],
    });
  }, [groups, showPopup]);

  if (loading) return <AppLoader dark={darkMode} />;

  const bg = darkMode ? "#0d0d0d" : "#f8f8f8";
  const textColor = darkMode ? "#fff" : "#000";
  const subColor = darkMode ? "rgba(255,255,255,0.45)" : "rgba(0,0,0,0.38)";

  const totalGroups = groups?.length ?? 0;
  const totalDups = groups?.reduce((s, g) => s + g.items.length - 1, 0) ?? 0;
  const totalDeletable = groups?.reduce((s, g) => s + g.items.length - 1, 0) ?? 0;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: bg }]}>
      <StatusBar barStyle={darkMode ? "light-content" : "dark-content"} />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => router.back()}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Ionicons name="chevron-back" size={28} color={textColor} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: textColor }]}>Doublons</Text>
        {groups && groups.length > 0 ? (
          <TouchableOpacity
            onPress={deleteAll}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name="trash-outline" size={24} color="#FF3B30" />
          </TouchableOpacity>
        ) : (
          <View style={{ width: 28 }} />
        )}
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 48, flexGrow: 1 }}
      >
        {/* Scan area */}
        {groups === null && !scanning && (
          <View style={styles.scanArea}>
            <View style={[styles.scanIcon, { backgroundColor: darkMode ? "#1e1e1e" : "#efefef" }]}>
              <Ionicons name="copy-outline" size={48} color={darkMode ? "rgba(255,255,255,0.35)" : "rgba(0,0,0,0.2)"} />
            </View>
            <Text style={[styles.scanTitle, { color: textColor }]}>
              Trouver les doublons
            </Text>
            <Text style={[styles.scanSub, { color: subColor }]}>
              Analyse ta photothèque et regroupe les photos identiques pour libérer de l'espace.
            </Text>
            <TouchableOpacity style={styles.scanBtn} onPress={scan} activeOpacity={0.82}>
              <Ionicons name="search" size={18} color="#fff" style={{ marginRight: 8 }} />
              <Text style={styles.scanBtnText}>Scanner</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Scanning progress */}
        {scanning && (
          <View style={styles.scanArea}>
            <ActivityIndicator size="large" color="#007AFF" />
            <Text style={[styles.scanTitle, { color: textColor, marginTop: 20 }]}>
              Analyse en cours…
            </Text>
            <Text style={[styles.scanSub, { color: subColor, marginBottom: 4 }]}>
              {scanStep}
            </Text>
            <View style={[styles.progressTrack, { backgroundColor: darkMode ? "#2c2c2e" : "#e0e0e0" }]}>
              <View style={[styles.progressBar, { width: `${Math.round(progress * 100)}%` }]} />
            </View>
            <Text style={[styles.scanSub, { color: subColor }]}>
              {Math.round(progress * 100)}%
            </Text>
          </View>
        )}

        {/* Results */}
        {groups !== null && !scanning && (
          <>
            {/* Stats */}
            <View style={[styles.statsRow, { borderColor: darkMode ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.08)" }]}>
              <View style={styles.statItem}>
                <Text style={[styles.statValue, { color: textColor }]}>{totalGroups}</Text>
                <Text style={[styles.statLabel, { color: subColor }]}>Groupes</Text>
              </View>
              <View style={[styles.statSep, { backgroundColor: darkMode ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.1)" }]} />
              <View style={styles.statItem}>
                <Text style={[styles.statValue, { color: textColor }]}>{totalDups}</Text>
                <Text style={[styles.statLabel, { color: subColor }]}>Doublons</Text>
              </View>
              <View style={[styles.statSep, { backgroundColor: darkMode ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.1)" }]} />
              <View style={styles.statItem}>
                <Text style={[styles.statValue, { color: "#34C759" }]}>{totalDeletable}</Text>
                <Text style={[styles.statLabel, { color: subColor }]}>Supprimables</Text>
              </View>
            </View>

            {groups.length === 0 ? (
              <View style={styles.emptyArea}>
                <Text style={{ fontSize: 48 }}>✨</Text>
                <Text style={[styles.scanTitle, { color: textColor }]}>Aucun doublon !</Text>
                <Text style={[styles.scanSub, { color: subColor }]}>
                  Ta photothèque est déjà bien rangée.
                </Text>
                <TouchableOpacity
                  style={[styles.scanBtn, { marginTop: 20, backgroundColor: darkMode ? "#2c2c2e" : "#e0e0e0" }]}
                  onPress={scan}
                  activeOpacity={0.82}
                >
                  <Ionicons name="refresh" size={18} color={textColor} style={{ marginRight: 8 }} />
                  <Text style={[styles.scanBtnText, { color: textColor }]}>Rescanner</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View style={{ gap: 12, paddingHorizontal: 16, paddingTop: 12 }}>
                {groups.map((g) => (
                  <GroupCard
                    key={g.key}
                    group={g}
                    dark={darkMode}
                    onDelete={deleteGroup}
                  />
                ))}
              </View>
            )}
          </>
        )}
      </ScrollView>

      {popup}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },

  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: Platform.OS === "ios" ? 10 : 14,
  },
  headerTitle: { fontSize: 20, fontWeight: "700" },

  scanArea: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 40,
    paddingTop: 60,
    gap: 14,
  },
  scanIcon: {
    width: 100,
    height: 100,
    borderRadius: 30,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 8,
  },
  scanTitle: { fontSize: 22, fontWeight: "700", textAlign: "center" },
  scanSub: { fontSize: 14, textAlign: "center", lineHeight: 21 },
  scanBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#007AFF",
    paddingVertical: 14,
    paddingHorizontal: 28,
    borderRadius: 16,
    marginTop: 10,
  },
  scanBtnText: { color: "#fff", fontSize: 16, fontWeight: "700" },

  progressTrack: {
    width: "70%",
    height: 6,
    borderRadius: 3,
    overflow: "hidden",
  },
  progressBar: {
    height: "100%",
    backgroundColor: "#007AFF",
    borderRadius: 3,
  },

  statsRow: {
    flexDirection: "row",
    marginHorizontal: 16,
    marginTop: 12,
    borderWidth: 1,
    borderRadius: 16,
    overflow: "hidden",
  },
  statItem: { flex: 1, alignItems: "center", paddingVertical: 14 },
  statValue: { fontSize: 20, fontWeight: "700" },
  statLabel: { fontSize: 11, marginTop: 2 },
  statSep: { width: 1 },

  groupCard: {
    borderRadius: 18,
    paddingTop: 14,
    paddingBottom: 14,
    overflow: "hidden",
  },
  groupFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 14,
    paddingTop: 4,
  },
  groupCount: { fontSize: 15, fontWeight: "700" },
  groupSave: { fontSize: 12, marginTop: 2 },
  deleteGroupBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FF3B30",
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 12,
  },
  deleteGroupBtnText: { color: "#fff", fontSize: 13, fontWeight: "700" },

  groupHint: {
    fontSize: 12,
    paddingHorizontal: 14,
    marginBottom: 10,
    marginTop: 4,
  },

  dimOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.42)",
    borderRadius: 12,
  },
  selectedBorder: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 12,
    borderWidth: 3,
    borderColor: "#007AFF",
  },
  checkCircle: {
    position: "absolute",
    top: 7,
    right: 7,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: "rgba(0,0,0,0.35)",
    borderWidth: 1.5,
    borderColor: "rgba(255,255,255,0.5)",
    justifyContent: "center",
    alignItems: "center",
  },
  checkCircleActive: {
    backgroundColor: "#34C759",
    borderColor: "#34C759",
  },
  checkCircleDelete: {
    backgroundColor: "#FF3B30",
    borderColor: "#FF3B30",
  },

  bestBadge: {
    position: "absolute",
    top: 6,
    left: 6,
    backgroundColor: "#34C759",
    borderRadius: 8,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  bestBadgeText: { color: "#fff", fontSize: 10, fontWeight: "700" },

  sizeBadge: {
    position: "absolute",
    bottom: 6,
    right: 6,
    backgroundColor: "rgba(0,0,0,0.55)",
    borderRadius: 8,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  sizeBadgeText: { color: "#fff", fontSize: 10 },

  albumBadgeWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    marginTop: 5,
    paddingHorizontal: 2,
  },
  albumBadgeText: {
    fontSize: 11,
    fontWeight: "500",
    flexShrink: 1,
  },

  emptyArea: {
    alignItems: "center",
    paddingTop: 60,
    paddingHorizontal: 40,
    gap: 12,
  },
});
