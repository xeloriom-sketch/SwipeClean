// app/(tabs)/Favorites.tsx
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  StatusBar,
  Dimensions,
  TouchableOpacity,
  ScrollView,
  Platform,
  Modal,
  useColorScheme,
  ActivityIndicator,
} from "react-native";
import { usePopup } from "../../components/Popup";
import { SafeAreaView } from "react-native-safe-area-context";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import { Image } from "expo-image";
import * as MediaLibrary from "expo-media-library";
import AppLoader from "../../components/AppLoader";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSpring,
  runOnJS,
} from "react-native-reanimated";

const { width } = Dimensions.get("window");
const FAVORITES_KEY = "@app_favorites";
const DARK_MODE_KEY = "@app_dark_mode";
const SORT_FAV_KEY = "@app_fav_sort";

type SortMode = "custom" | "newest" | "oldest" | "largest";

const GAP = 8;
const PADDING = 10;
const COLS = 2;
const COL_W = (width - PADDING * 2 - GAP) / COLS;

type Item = {
  id: string;
  uri: string;
  type?: "photo" | "video";
  imgW?: number;
  imgH?: number;
  creationTime?: number;
};

type ItemWithHeight = Item & { displayH: number };

/* ---- Masonry split: greedy shortest-column ---- */
function splitMasonry(items: ItemWithHeight[]): [ItemWithHeight[], ItemWithHeight[]] {
  const left: ItemWithHeight[] = [];
  const right: ItemWithHeight[] = [];
  let leftH = 0;
  let rightH = 0;
  for (const item of items) {
    if (leftH <= rightH) {
      left.push(item);
      leftH += item.displayH + GAP;
    } else {
      right.push(item);
      rightH += item.displayH + GAP;
    }
  }
  return [left, right];
}

/* ---- Animated thumb ---- */
const FavThumb = React.memo(function FavThumb({
  item,
  onPress,
  onRemove,
}: {
  item: ItemWithHeight;
  onPress: () => void;
  onRemove: () => void;
}) {
  const scale = useSharedValue(1);
  const animStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  return (
    <Animated.View style={[{ width: COL_W, height: item.displayH, borderRadius: 14, overflow: "hidden", backgroundColor: "#111", marginBottom: GAP }, animStyle]}>
      <TouchableOpacity
        activeOpacity={1}
        onPress={onPress}
        onLongPress={() => { scale.value = withSpring(0.96, { damping: 18, stiffness: 400 }); }}
        onPressOut={() => { scale.value = withSpring(1, { damping: 18, stiffness: 400 }); }}
        style={StyleSheet.absoluteFill}
      >
        <Image
          source={{ uri: item.uri }}
          style={{ width: "100%", height: "100%" }}
          contentFit="cover"
          cachePolicy="memory-disk"
          recyclingKey={item.id}
        />
        {item.type === "video" && (
          <View style={styles.videoTag}>
            <Ionicons name="videocam" size={11} color="#fff" />
          </View>
        )}
      </TouchableOpacity>
      <TouchableOpacity
        style={styles.deleteBtn}
        onPress={onRemove}
        hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
        activeOpacity={0.7}
      >
        <Ionicons name="close" color="#fff" size={14} />
      </TouchableOpacity>
    </Animated.View>
  );
});

/* ---- Fullscreen viewer ---- */
const FullscreenViewer = ({ uri, onClose }: { uri: string; onClose: () => void }) => {
  const opacity = useSharedValue(0);
  useEffect(() => { opacity.value = withTiming(1, { duration: 220 }); }, []);
  const style = useAnimatedStyle(() => ({ opacity: opacity.value }));

  const close = () => {
    opacity.value = withTiming(0, { duration: 180 }, (done) => {
      if (done) runOnJS(onClose)();
    });
  };

  return (
    <Modal transparent animationType="none" visible statusBarTranslucent>
      <Animated.View style={[styles.fullscreenContainer, style]}>
        <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={close} />
        <Image
          source={{ uri }}
          style={styles.fullscreenImage}
          contentFit="contain"
          cachePolicy="memory"
        />
        <TouchableOpacity style={styles.fullscreenClose} onPress={close}>
          <Ionicons name="close-circle" size={36} color="#fff" />
        </TouchableOpacity>
      </Animated.View>
    </Modal>
  );
};

/* ---- Screen ---- */
export default function FavoritesScreen() {
  const systemScheme = useColorScheme();
  const [images, setImages] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [darkMode, setDarkMode] = useState(systemScheme === "dark");
  const [selectedUri, setSelectedUri] = useState<string | null>(null);
  const [sortMode, setSortMode] = useState<SortMode>("custom");
  const [showSortSheet, setShowSortSheet] = useState(false);
  const { popup, showPopup } = usePopup(darkMode);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [raw, dark, sort] = await Promise.all([
          AsyncStorage.getItem(FAVORITES_KEY),
          AsyncStorage.getItem(DARK_MODE_KEY),
          AsyncStorage.getItem(SORT_FAV_KEY),
        ]);
        if (cancelled) return;
        setDarkMode(dark === "true");
        if (sort) setSortMode(sort as SortMode);
        let parsed: Item[] = [];
        try { parsed = raw ? JSON.parse(raw) : []; } catch { parsed = []; }

        const enriched = await Promise.all(
          parsed.map(async (item) => {
            if (item.imgW && item.imgH && item.creationTime) return item;
            try {
              const info = await MediaLibrary.getAssetInfoAsync(item.id);
              return { ...item, imgW: info.width, imgH: info.height, creationTime: info.creationTime };
            } catch {
              return item;
            }
          })
        );
        if (cancelled) return;
        setImages(enriched);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const applySort = useCallback(async (mode: SortMode) => {
    setSortMode(mode);
    await AsyncStorage.setItem(SORT_FAV_KEY, mode);
    setShowSortSheet(false);
    if (mode === "newest" || mode === "oldest") {
      setImages((prev) => {
        const sorted = [...prev].sort((a, b) => {
          const ta = a.creationTime ?? 0;
          const tb = b.creationTime ?? 0;
          return mode === "newest" ? tb - ta : ta - tb;
        });
        return sorted;
      });
    } else if (mode === "largest") {
      setImages((prev) => {
        const sorted = [...prev].sort((a, b) => {
          const sa = (a.imgW ?? 0) * (a.imgH ?? 0);
          const sb = (b.imgW ?? 0) * (b.imgH ?? 0);
          return sb - sa;
        });
        return sorted;
      });
    }
  }, []);

  const sortLabel: Record<SortMode, string> = {
    custom: "Personnalisé",
    newest: "Plus récent",
    oldest: "Plus ancien",
    largest: "Plus grand",
  };

  const itemsWithHeight = useMemo<ItemWithHeight[]>(() => {
    return images.map((item) => {
      const ratio = item.imgW && item.imgH ? item.imgH / item.imgW : 1.3;
      // Clamp: portrait max 2.2×, landscape min 0.55× to keep things reasonable
      const clamped = Math.min(Math.max(ratio, 0.55), 2.2);
      return { ...item, displayH: Math.round(COL_W * clamped) };
    });
  }, [images]);

  const [leftCol, rightCol] = useMemo(() => splitMasonry(itemsWithHeight), [itemsWithHeight]);

  const handleRemove = useCallback((item: Item) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setImages((prev) => {
      const updated = prev.filter((i) => i.id !== item.id);
      AsyncStorage.setItem(FAVORITES_KEY, JSON.stringify(updated)).catch(() => {});
      return updated;
    });
  }, []);

  const exportToAlbum = useCallback(async () => {
    if (images.length === 0) return;
    setExporting(true);
    try {
      const { status } = await MediaLibrary.requestPermissionsAsync();
      if (status !== "granted") {
        showPopup({ icon: "🔒", title: "Permission requise", message: "Autoriser l'accès à la photothèque pour exporter.", buttons: [{ text: "OK", style: "default" }] });
        return;
      }
      const albumName = "SwipeClean — Favoris";
      const ids = images.map((i) => i.id);
      let album = await MediaLibrary.getAlbumAsync(albumName);
      if (!album) {
        album = await MediaLibrary.createAlbumAsync(albumName, ids[0], false);
        if (ids.length > 1) await MediaLibrary.addAssetsToAlbumAsync(ids.slice(1), album.id, false);
      } else {
        await MediaLibrary.addAssetsToAlbumAsync(ids, album.id, false);
      }
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      showPopup({ icon: "✅", title: "Exporté !", message: `${ids.length} photo${ids.length > 1 ? "s" : ""} ajoutée${ids.length > 1 ? "s" : ""} dans l'album "${albumName}".`, buttons: [{ text: "Super !", style: "default" }] });
    } catch {
      showPopup({ icon: "⚠️", title: "Erreur", message: "Impossible d'exporter les favoris.", buttons: [{ text: "OK", style: "default" }] });
    } finally {
      setExporting(false);
    }
  }, [images]);

  const bg = darkMode ? "#0d0d0d" : "#F8F8F8";
  const textColor = darkMode ? "#fff" : "#0d0d0d";
  const subColor = darkMode ? "rgba(255,255,255,0.45)" : "rgba(0,0,0,0.38)";

  if (loading) return <AppLoader dark={darkMode} />;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: bg }]}>
      <StatusBar barStyle={darkMode ? "light-content" : "dark-content"} />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.headerBtn}
          onPress={() => router.back()}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Ionicons name="chevron-back" size={28} color={textColor} />
        </TouchableOpacity>

        <View style={styles.titleWrap}>
          <Text style={[styles.title, { color: textColor }]}>Favoris</Text>
          {images.length > 0 && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{images.length}</Text>
            </View>
          )}
        </View>

        {images.length > 0 ? (
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <TouchableOpacity
              style={styles.headerBtn}
              onPress={() => setShowSortSheet(true)}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons name="swap-vertical-outline" size={22} color={textColor} />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.headerBtn}
              onPress={exportToAlbum}
              disabled={exporting}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              {exporting ? (
                <ActivityIndicator size="small" color={textColor} />
              ) : (
                <Ionicons name="share-outline" size={26} color={textColor} />
              )}
            </TouchableOpacity>
          </View>
        ) : (
          <View style={{ width: 36 }} />
        )}
      </View>

      {/* Masonry grid */}
      {images.length > 0 ? (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.gallery}
        >
          <View style={styles.columns}>
            {/* Left column */}
            <View style={{ width: COL_W }}>
              {leftCol.map((item) => (
                <FavThumb
                  key={item.id}
                  item={item}
                  onPress={() => setSelectedUri(item.uri)}
                  onRemove={() => handleRemove(item)}
                />
              ))}
            </View>

            {/* Right column */}
            <View style={{ width: COL_W }}>
              {rightCol.map((item) => (
                <FavThumb
                  key={item.id}
                  item={item}
                  onPress={() => setSelectedUri(item.uri)}
                  onRemove={() => handleRemove(item)}
                />
              ))}
            </View>
          </View>
        </ScrollView>
      ) : (
        <View style={styles.empty}>
          <Ionicons
            name="heart-outline"
            size={72}
            color={darkMode ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.1)"}
          />
          <Text style={[styles.emptyTitle, { color: textColor }]}>Aucun favori</Text>
          <Text style={[styles.emptySub, { color: subColor }]}>
            Swipez vers le haut pour ajouter
          </Text>
        </View>
      )}

      {/* Fullscreen */}
      {selectedUri && (
        <FullscreenViewer uri={selectedUri} onClose={() => setSelectedUri(null)} />
      )}

      {/* Sort bottom sheet */}
      <Modal
        transparent
        visible={showSortSheet}
        animationType="slide"
        onRequestClose={() => setShowSortSheet(false)}
      >
        <TouchableOpacity
          style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.35)" }}
          activeOpacity={1}
          onPress={() => setShowSortSheet(false)}
        />
        <View style={[styles.sortSheet, { backgroundColor: darkMode ? "#1c1c1e" : "#fff" }]}>
          <View style={styles.sortHandle} />
          <Text style={[styles.sortTitle, { color: darkMode ? "#fff" : "#000" }]}>Trier les favoris</Text>
          {(["custom", "newest", "oldest", "largest"] as SortMode[]).map((mode) => (
            <TouchableOpacity
              key={mode}
              style={styles.sortOption}
              onPress={() => applySort(mode)}
              activeOpacity={0.7}
            >
              <Text style={[styles.sortOptionText, { color: darkMode ? "#fff" : "#000" }, sortMode === mode && { color: "#007AFF" }]}>
                {sortLabel[mode]}
              </Text>
              {sortMode === mode && <Ionicons name="checkmark" size={20} color="#007AFF" />}
            </TouchableOpacity>
          ))}
          <View style={{ height: 24 }} />
        </View>
      </Modal>

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
  headerBtn: { padding: 4 },
  titleWrap: { flexDirection: "row", alignItems: "center", gap: 8 },
  title: { fontSize: 20, fontWeight: "700", letterSpacing: 0.2 },
  badge: {
    backgroundColor: "#E53935",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  badgeText: { color: "#fff", fontSize: 12, fontWeight: "700" },

  gallery: {
    paddingHorizontal: PADDING,
    paddingTop: PADDING,
    paddingBottom: 48,
  },
  columns: {
    flexDirection: "row",
    gap: GAP,
    alignItems: "flex-start",
  },

  videoTag: {
    position: "absolute",
    bottom: 8,
    left: 8,
    backgroundColor: "rgba(0,0,0,0.55)",
    borderRadius: 8,
    padding: 4,
  },
  deleteBtn: {
    position: "absolute",
    top: 8,
    right: 8,
    backgroundColor: "rgba(0,0,0,0.55)",
    width: 26,
    height: 26,
    borderRadius: 13,
    justifyContent: "center",
    alignItems: "center",
  },

  empty: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 40,
    gap: 10,
  },
  emptyTitle: { fontSize: 20, fontWeight: "700", marginTop: 8 },
  emptySub: { fontSize: 14, textAlign: "center", lineHeight: 20 },

  fullscreenContainer: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.92)",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 999,
  },
  fullscreenImage: {
    width: "92%",
    height: "80%",
    borderRadius: 14,
  },
  fullscreenClose: {
    position: "absolute",
    top: Platform.OS === "ios" ? 56 : 36,
    right: 20,
  },

  sortSheet: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 12,
    paddingHorizontal: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 8,
  },
  sortHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: "rgba(128,128,128,0.35)",
    alignSelf: "center",
    marginBottom: 16,
  },
  sortTitle: {
    fontSize: 17,
    fontWeight: "700",
    marginBottom: 12,
  },
  sortOption: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "rgba(128,128,128,0.2)",
  },
  sortOptionText: {
    fontSize: 16,
  },
});
