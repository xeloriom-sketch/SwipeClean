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
  type NativeScrollEvent,
  type NativeSyntheticEvent,
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
import { resolveMediaUri } from "../../utils/mediaUri";
import { isShareSupported, shareMedia } from "../../utils/shareMedia";
import {
  ACCENT,
  FolderFormSheet,
  FolderManageSheet,
  FolderPickSheet,
} from "../../components/FavFolderSheets";
import {
  EMPTY_FOLDERS,
  MAX_FOLDERS,
  countByFolder,
  createFolder,
  deleteFolder,
  loadFavFolders,
  moveItems,
  pruneAssignments,
  renameFolder,
  saveFavFolders,
  type FavFolder,
  type FavFoldersState,
} from "../../utils/favFolders";
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

/** `all` = tous les favoris, `unfiled` = ceux rangés dans aucun dossier. */
type FolderFilter = "all" | "unfiled" | string;

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
  folderEmoji,
  selecting,
  selected,
  onPress,
  onLongPress,
  onRemove,
}: {
  item: ItemWithHeight;
  folderEmoji?: string;
  selecting: boolean;
  selected: boolean;
  onPress: () => void;
  onLongPress: () => void;
  onRemove: () => void;
}) {
  const scale = useSharedValue(1);
  const animStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  return (
    <Animated.View
      style={[
        { width: COL_W, height: item.displayH, borderRadius: 14, overflow: "hidden", backgroundColor: "#111", marginBottom: GAP },
        selected && { borderWidth: 3, borderColor: ACCENT },
        animStyle,
      ]}
    >
      <TouchableOpacity
        activeOpacity={1}
        onPress={onPress}
        onPressIn={() => { scale.value = withSpring(0.97, { damping: 18, stiffness: 400 }); }}
        onLongPress={onLongPress}
        onPressOut={() => { scale.value = withSpring(1, { damping: 18, stiffness: 400 }); }}
        style={StyleSheet.absoluteFill}
      >
        <Image
          source={{
            uri:
              resolveMediaUri(item.uri, item.id, item.type === "video" ? "video" : "photo") ??
              item.uri,
          }}
          style={{ width: "100%", height: "100%" }}
          contentFit="cover"
          cachePolicy="memory-disk"
          recyclingKey={item.id}
        />
        {selected && <View style={styles.selectedVeil} />}
        {item.type === "video" && (
          <View style={styles.videoTag}>
            <Ionicons name="videocam" size={11} color="#fff" />
          </View>
        )}
        {folderEmoji ? (
          <View style={styles.folderTag}>
            <Text style={styles.folderTagText}>{folderEmoji}</Text>
          </View>
        ) : null}
      </TouchableOpacity>

      {selecting ? (
        <View style={[styles.checkBadge, selected && { backgroundColor: ACCENT, borderColor: ACCENT }]}>
          {selected && <Ionicons name="checkmark" color="#fff" size={15} />}
        </View>
      ) : (
        <TouchableOpacity
          style={styles.deleteBtn}
          onPress={onRemove}
          hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
          activeOpacity={0.7}
        >
          <Ionicons name="close" color="#fff" size={14} />
        </TouchableOpacity>
      )}
    </Animated.View>
  );
});

/* ---- Fullscreen viewer ---- */
const FullscreenViewer = ({
  uri,
  canShare,
  sharing,
  onShare,
  onClose,
}: {
  uri: string;
  canShare: boolean;
  sharing: boolean;
  onShare: () => void;
  onClose: () => void;
}) => {
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
        {canShare && (
          <TouchableOpacity
            style={styles.fullscreenShare}
            onPress={onShare}
            disabled={sharing}
            activeOpacity={0.8}
          >
            {sharing ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <>
                <Ionicons name="share-social" size={18} color="#fff" />
                <Text style={styles.fullscreenShareText}>Partager</Text>
              </>
            )}
          </TouchableOpacity>
        )}
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
  const [selected, setSelected] = useState<Item | null>(null);
  const [sortMode, setSortMode] = useState<SortMode>("custom");
  const [showSortSheet, setShowSortSheet] = useState(false);
  const { popup, showPopup } = usePopup(darkMode);

  /* Dossiers */
  const [folderState, setFolderState] = useState<FavFoldersState>(EMPTY_FOLDERS);
  const [filter, setFilter] = useState<FolderFilter>("all");
  /** `undefined` = fermé, `null` = création, sinon renommage. */
  const [formFolder, setFormFolder] = useState<FavFolder | null | undefined>(undefined);
  const [manageFolder, setManageFolder] = useState<FavFolder | null>(null);

  /* Sélection multiple */
  const [picking, setPicking] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const selecting = selectedIds.size > 0;

  /* Partage */
  const [canShare, setCanShare] = useState(false);
  const [sharing, setSharing] = useState(false);

  useEffect(() => {
    isShareSupported().then(setCanShare);
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [raw, dark, sort, folders] = await Promise.all([
          AsyncStorage.getItem(FAVORITES_KEY),
          AsyncStorage.getItem(DARK_MODE_KEY),
          AsyncStorage.getItem(SORT_FAV_KEY),
          loadFavFolders(),
        ]);
        if (cancelled) return;
        setDarkMode(dark === "true");
        if (sort) setSortMode(sort as SortMode);
        let parsed: Item[] = [];
        try { parsed = raw ? JSON.parse(raw) : []; } catch { parsed = []; }

        // Une photo retirée des favoris hors de cet écran laisse une affectation
        // orpheline: on nettoie au chargement.
        const pruned = pruneAssignments(folders, parsed.map((i) => i.id));
        setFolderState(pruned);
        if (pruned !== folders) saveFavFolders(pruned);

        // Jusqu'à 1000 favoris: un Promise.all sur toute la liste lançait autant
        // d'appels natifs concurrents et saturait le dispatcher d'expo-media-library.
        let missing = 0;
        const enrich = async (item: Item): Promise<Item> => {
          if (item.imgW && item.imgH && item.creationTime) return item;
          missing++;
          try {
            const info = await MediaLibrary.getAssetInfoAsync(item.id);
            return { ...item, imgW: info.width, imgH: info.height, creationTime: info.creationTime };
          } catch {
            return item;
          }
        };
        const enriched: Item[] = [];
        for (let i = 0; i < parsed.length; i += 20) {
          if (cancelled) return;
          enriched.push(...(await Promise.all(parsed.slice(i, i + 20).map(enrich))));
        }
        if (cancelled) return;
        setImages(enriched);
        // Les dimensions sont réécrites dans la clé des favoris: sans ça, chaque
        // ouverture de l'écran relançait un getAssetInfoAsync par photo — le gros du
        // temps de chargement, et pour rien puisque rien ne change.
        if (missing > 0) {
          AsyncStorage.setItem(FAVORITES_KEY, JSON.stringify(enriched)).catch(() => {});
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  /** Toute mutation des dossiers passe par ici: un seul point d'écriture. */
  const updateFolders = useCallback(
    (fn: (prev: FavFoldersState) => FavFoldersState) => {
      setFolderState((prev) => {
        const next = fn(prev);
        saveFavFolders(next);
        return next;
      });
    },
    []
  );

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

  const visible = useMemo<ItemWithHeight[]>(() => {
    if (filter === "all") return itemsWithHeight;
    if (filter === "unfiled") return itemsWithHeight.filter((i) => !folderState.assign[i.id]);
    return itemsWithHeight.filter((i) => folderState.assign[i.id] === filter);
  }, [itemsWithHeight, filter, folderState.assign]);

  const counts = useMemo(
    () => countByFolder(folderState, images.map((i) => i.id)),
    [folderState, images]
  );

  // Le masonry vit dans un ScrollView (non virtualisé): monter 1000 vignettes d'un
  // coup décode autant de bitmaps -> OOM Android. On monte par paliers au scroll.
  const PAGE = 40;
  const [visibleCount, setVisibleCount] = useState(PAGE);

  useEffect(() => {
    setVisibleCount(PAGE);
  }, [visible.length, filter]);

  const [leftCol, rightCol] = useMemo(
    () => splitMasonry(visible.slice(0, visibleCount)),
    [visible, visibleCount]
  );

  const onGalleryScroll = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      const { layoutMeasurement, contentOffset, contentSize } = e.nativeEvent;
      if (layoutMeasurement.height + contentOffset.y >= contentSize.height - 600) {
        setVisibleCount((c) => (c >= visible.length ? c : c + PAGE));
      }
    },
    [visible.length]
  );

  /* ---- Sélection ---- */
  const toggleSelect = useCallback((id: string) => {
    Haptics.selectionAsync();
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const clearSelection = useCallback(() => setSelectedIds(new Set()), []);

  const selectAll = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedIds((prev) =>
      prev.size === visible.length ? new Set() : new Set(visible.map((i) => i.id))
    );
  }, [visible]);

  const removeIds = useCallback(
    (ids: string[]) => {
      const dropped = new Set(ids);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      setImages((prev) => {
        const updated = prev.filter((i) => !dropped.has(i.id));
        AsyncStorage.setItem(FAVORITES_KEY, JSON.stringify(updated)).catch(() => {});
        return updated;
      });
      updateFolders((prev) => moveItems(prev, ids, null));
      clearSelection();
    },
    [clearSelection, updateFolders]
  );

  /* ---- Partage ---- */
  const handleShare = useCallback(
    async (item: Item) => {
      if (sharing) return;
      setSharing(true);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      const result = await shareMedia(
        item.id,
        item.type === "video" ? "video" : "photo",
        item.uri
      );
      setSharing(false);
      if (result === "unavailable") {
        setCanShare(false);
        showPopup({
          icon: "📤",
          title: "Bientôt disponible",
          message: "Le partage arrive avec la prochaine version de l'app.",
          buttons: [{ text: "OK", style: "default" }],
        });
      } else if (result === "error") {
        showPopup({
          icon: "⚠️",
          title: "Partage impossible",
          message: "Ce média n'est pas accessible depuis le stockage de l'appareil.",
          buttons: [{ text: "OK", style: "default" }],
        });
      }
    },
    [sharing, showPopup]
  );

  /* ---- Dossiers ---- */
  /** Dossier commun à la sélection, `null` si elle est partagée entre plusieurs. */
  const commonFolder = useMemo(() => {
    let common: string | null = null;
    let first = true;
    for (const id of selectedIds) {
      const folderId = folderState.assign[id] ?? null;
      if (first) {
        common = folderId;
        first = false;
      } else if (common !== folderId) return null;
    }
    return common;
  }, [selectedIds, folderState.assign]);

  const handlePickFolder = useCallback(
    (folderId: string | null) => {
      const ids = Array.from(selectedIds);
      setPicking(false);
      if (ids.length === 0) return;
      updateFolders((prev) => moveItems(prev, ids, folderId));
      clearSelection();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    },
    [selectedIds, clearSelection, updateFolders]
  );

  const handleSubmitFolder = useCallback(
    (name: string, emoji: string) => {
      const editing = formFolder;
      const ids = Array.from(selectedIds);
      setFormFolder(undefined);

      if (editing) {
        updateFolders((prev) => renameFolder(prev, editing.id, name, emoji));
        return;
      }
      if (folderState.folders.length >= MAX_FOLDERS) {
        showPopup({
          icon: "📁",
          title: "Trop de dossiers",
          message: `Maximum ${MAX_FOLDERS} dossiers.`,
          buttons: [{ text: "OK", style: "default" }],
        });
        return;
      }

      // On y range tout de suite la sélection: créer un dossier depuis « Déplacer »
      // sans rien y mettre ne ferait rien de visible.
      let next = createFolder(folderState, name, emoji);
      const created = next.folders[next.folders.length - 1];
      if (ids.length > 0) {
        next = moveItems(next, ids, created.id);
        clearSelection();
        setFilter(created.id);
      }
      updateFolders(() => next);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    },
    [clearSelection, folderState, formFolder, selectedIds, showPopup, updateFolders]
  );

  const handleDeleteFolder = useCallback(() => {
    const target = manageFolder;
    setManageFolder(null);
    if (!target) return;
    // Enchaîner deux Modal dans la même frame fait clignoter l'animation sur Android
    // et déclenche un warning de présentation concurrente sur iOS.
    setTimeout(
      () =>
        showPopup({
          icon: "🗑️",
          title: `Supprimer « ${target.name} » ?`,
          message: "Les photos restent dans tes favoris, elles redeviennent simplement non rangées.",
          buttons: [
            { text: "Annuler", style: "cancel" },
            {
              text: "Supprimer",
              style: "destructive",
              onPress: () => {
                updateFolders((prev) => deleteFolder(prev, target.id));
                setFilter((f) => (f === target.id ? "all" : f));
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
              },
            },
          ],
        }),
      260
    );
  }, [manageFolder, showPopup, updateFolders]);

  const activeFolder = useMemo(
    () => folderState.folders.find((f) => f.id === filter) ?? null,
    [folderState.folders, filter]
  );

  const exportToAlbum = useCallback(async () => {
    if (visible.length === 0) return;
    setExporting(true);
    try {
      const { status } = await MediaLibrary.requestPermissionsAsync();
      if (status !== "granted") {
        showPopup({ icon: "🔒", title: "Permission requise", message: "Autoriser l'accès à la photothèque pour exporter.", buttons: [{ text: "OK", style: "default" }] });
        return;
      }
      const albumName = activeFolder
        ? `SwipeClean — ${activeFolder.name}`
        : "SwipeClean — Favoris";
      const ids = visible.map((i) => i.id);
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
  }, [visible, activeFolder, showPopup]);

  const bg = darkMode ? "#0d0d0d" : "#F8F8F8";
  const textColor = darkMode ? "#fff" : "#0d0d0d";
  const subColor = darkMode ? "rgba(255,255,255,0.45)" : "rgba(0,0,0,0.38)";
  const chipBg = darkMode ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.05)";

  if (loading) return <AppLoader dark={darkMode} />;

  const renderThumb = (item: ItemWithHeight) => (
    <FavThumb
      key={item.id}
      item={item}
      folderEmoji={
        filter === "all"
          ? folderState.folders.find((f) => f.id === folderState.assign[item.id])?.emoji
          : undefined
      }
      selecting={selecting}
      selected={selectedIds.has(item.id)}
      onPress={() => (selecting ? toggleSelect(item.id) : setSelected(item))}
      onLongPress={() => {
        if (!selecting) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        toggleSelect(item.id);
      }}
      onRemove={() => removeIds([item.id])}
    />
  );

  const renderChip = (
    key: string,
    emoji: string | null,
    label: string,
    count: number | null,
    active: boolean,
    onPress: () => void,
    onLongPress?: () => void
  ) => (
    <TouchableOpacity
      key={key}
      activeOpacity={0.75}
      onPress={onPress}
      onLongPress={onLongPress}
      style={[styles.chip, { backgroundColor: active ? ACCENT : chipBg }]}
    >
      {emoji ? <Text style={styles.chipEmoji}>{emoji}</Text> : null}
      <Text
        style={[styles.chipText, { color: active ? "#fff" : textColor }]}
        numberOfLines={1}
      >
        {label}
      </Text>
      {count !== null && (
        <Text
          style={[
            styles.chipCount,
            { color: active ? "rgba(255,255,255,0.75)" : subColor },
          ]}
        >
          {count}
        </Text>
      )}
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: bg }]}>
      <StatusBar barStyle={darkMode ? "light-content" : "dark-content"} />

      {/* Header */}
      {selecting ? (
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.headerBtn}
            onPress={clearSelection}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Text style={[styles.headerAction, { color: textColor }]}>Annuler</Text>
          </TouchableOpacity>
          <Text style={[styles.title, { color: textColor }]}>
            {selectedIds.size} sélectionnée{selectedIds.size > 1 ? "s" : ""}
          </Text>
          <TouchableOpacity
            style={styles.headerBtn}
            onPress={selectAll}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Text style={[styles.headerAction, { color: ACCENT }]}>
              {selectedIds.size === visible.length ? "Aucune" : "Tout"}
            </Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.headerBtn}
            onPress={() => router.back()}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name="chevron-back" size={28} color={textColor} />
          </TouchableOpacity>

          <View style={styles.titleWrap}>
            <Text style={[styles.title, { color: textColor }]} numberOfLines={1}>
              {activeFolder ? activeFolder.name : "Favoris"}
            </Text>
            {visible.length > 0 && (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{visible.length}</Text>
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
                  <Ionicons name="download-outline" size={25} color={textColor} />
                )}
              </TouchableOpacity>
            </View>
          ) : (
            <View style={{ width: 36 }} />
          )}
        </View>
      )}

      {/* Dossiers */}
      {images.length > 0 && !selecting && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chipRow}
        >
          {renderChip("all", null, "Tous", images.length, filter === "all", () => setFilter("all"))}
          {folderState.folders.map((f) =>
            renderChip(
              f.id,
              f.emoji,
              f.name,
              counts.byFolder[f.id] ?? 0,
              filter === f.id,
              () => setFilter(f.id),
              () => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setManageFolder(f);
              }
            )
          )}
          {folderState.folders.length > 0 &&
            counts.unfiled > 0 &&
            renderChip(
              "unfiled",
              null,
              "Non rangées",
              counts.unfiled,
              filter === "unfiled",
              () => setFilter("unfiled")
            )}
          <TouchableOpacity
            activeOpacity={0.75}
            onPress={() => setFormFolder(null)}
            style={[styles.chip, { backgroundColor: chipBg }]}
          >
            <Ionicons name="add" size={16} color={textColor} />
            <Text style={[styles.chipText, { color: textColor }]}>Dossier</Text>
          </TouchableOpacity>
        </ScrollView>
      )}

      {/* Masonry grid */}
      {visible.length > 0 ? (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[styles.gallery, selecting && { paddingBottom: 120 }]}
          onScroll={onGalleryScroll}
          scrollEventThrottle={200}
        >
          <View style={styles.columns}>
            <View style={{ width: COL_W }}>{leftCol.map(renderThumb)}</View>
            <View style={{ width: COL_W }}>{rightCol.map(renderThumb)}</View>
          </View>
        </ScrollView>
      ) : images.length > 0 ? (
        <View style={styles.empty}>
          <Ionicons
            name="folder-open-outline"
            size={64}
            color={darkMode ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.1)"}
          />
          <Text style={[styles.emptyTitle, { color: textColor }]}>Dossier vide</Text>
          <Text style={[styles.emptySub, { color: subColor }]}>
            Appui long sur des photos puis « Déplacer » pour les ranger ici
          </Text>
        </View>
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

      {/* Barre d'actions de la sélection */}
      {selecting && (
        <View
          style={[
            styles.actionBar,
            {
              backgroundColor: darkMode ? "rgba(28,28,30,0.97)" : "rgba(255,255,255,0.97)",
              borderTopColor: darkMode ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.08)",
            },
          ]}
        >
          <TouchableOpacity style={styles.actionBtn} activeOpacity={0.7} onPress={() => setPicking(true)}>
            <Ionicons name="folder-outline" size={23} color={ACCENT} />
            <Text style={[styles.actionLabel, { color: ACCENT }]}>Déplacer</Text>
          </TouchableOpacity>

          {canShare && (
            <TouchableOpacity
              style={[styles.actionBtn, selectedIds.size !== 1 && { opacity: 0.35 }]}
              activeOpacity={0.7}
              disabled={selectedIds.size !== 1 || sharing}
              onPress={() => {
                const id = Array.from(selectedIds)[0];
                const item = images.find((i) => i.id === id);
                if (item) handleShare(item);
              }}
            >
              {sharing ? (
                <ActivityIndicator size="small" color={textColor} />
              ) : (
                <Ionicons name="share-social-outline" size={23} color={textColor} />
              )}
              <Text style={[styles.actionLabel, { color: textColor }]}>Partager</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity
            style={styles.actionBtn}
            activeOpacity={0.7}
            onPress={() => removeIds(Array.from(selectedIds))}
          >
            <Ionicons name="heart-dislike-outline" size={23} color="#FF3B30" />
            <Text style={[styles.actionLabel, { color: "#FF3B30" }]}>Retirer</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Fullscreen */}
      {selected && (
        <FullscreenViewer
          uri={
            resolveMediaUri(
              selected.uri,
              selected.id,
              selected.type === "video" ? "video" : "photo"
            ) ?? selected.uri
          }
          canShare={canShare}
          sharing={sharing}
          onShare={() => handleShare(selected)}
          onClose={() => setSelected(null)}
        />
      )}

      {/* Choix du dossier */}
      <FolderPickSheet
        visible={picking}
        dark={darkMode}
        folders={folderState.folders}
        currentId={commonFolder}
        count={selectedIds.size}
        onPick={handlePickFolder}
        onCreate={() => {
          setPicking(false);
          setTimeout(() => setFormFolder(null), 260);
        }}
        onClose={() => setPicking(false)}
      />

      {/* Création / renommage */}
      <FolderFormSheet
        visible={formFolder !== undefined}
        dark={darkMode}
        folder={formFolder ?? null}
        onSubmit={handleSubmitFolder}
        onClose={() => setFormFolder(undefined)}
      />

      {/* Gestion d'un dossier */}
      <FolderManageSheet
        visible={!!manageFolder}
        dark={darkMode}
        folder={manageFolder}
        onRename={() => {
          const target = manageFolder;
          setManageFolder(null);
          setTimeout(() => setFormFolder(target), 260);
        }}
        onDelete={handleDeleteFolder}
        onClose={() => setManageFolder(null)}
      />

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
              <Text style={[styles.sortOptionText, { color: darkMode ? "#fff" : "#000" }, sortMode === mode && { color: ACCENT }]}>
                {sortLabel[mode]}
              </Text>
              {sortMode === mode && <Ionicons name="checkmark" size={20} color={ACCENT} />}
            </TouchableOpacity>
          ))}
          <View style={{ height: 24 }} />
        </View>
      </Modal>

      {popup}
    </SafeAreaView>
  );
}

// Les styles de texte portent tous un `lineHeight` explicite: sans lui, Android rogne
// le haut et le bas des glyphes hauts (accents, emojis) dans une boîte serrée.
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
  headerAction: { fontSize: 16, lineHeight: 22, fontWeight: "600" },
  titleWrap: { flexDirection: "row", alignItems: "center", gap: 8, flexShrink: 1 },
  title: { fontSize: 20, lineHeight: 27, fontWeight: "700", letterSpacing: 0.2 },
  badge: {
    backgroundColor: "#E53935",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  badgeText: { color: "#fff", fontSize: 12, lineHeight: 16, fontWeight: "700" },

  chipRow: {
    paddingHorizontal: PADDING + 2,
    paddingBottom: 10,
    gap: 8,
    alignItems: "center",
  },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 13,
    paddingVertical: 9,
    borderRadius: 19,
    maxWidth: width * 0.6,
  },
  chipEmoji: { fontSize: 14, lineHeight: 20 },
  chipText: { fontSize: 14, lineHeight: 20, fontWeight: "600" },
  chipCount: { fontSize: 12, lineHeight: 20, fontWeight: "600" },

  gallery: {
    paddingHorizontal: PADDING,
    paddingTop: 2,
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
  folderTag: {
    position: "absolute",
    bottom: 8,
    right: 8,
    backgroundColor: "rgba(0,0,0,0.55)",
    borderRadius: 10,
    paddingHorizontal: 5,
    paddingVertical: 2,
  },
  folderTagText: { fontSize: 12, lineHeight: 17 },
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
  selectedVeil: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(30,176,173,0.22)",
  },
  checkBadge: {
    position: "absolute",
    top: 8,
    right: 8,
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.9)",
    backgroundColor: "rgba(0,0,0,0.35)",
    justifyContent: "center",
    alignItems: "center",
  },

  actionBar: {
    flexDirection: "row",
    justifyContent: "space-around",
    alignItems: "center",
    paddingTop: 12,
    paddingBottom: Platform.OS === "ios" ? 18 : 14,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  actionBtn: { alignItems: "center", gap: 4, minWidth: 76, paddingVertical: 2 },
  actionLabel: { fontSize: 12, lineHeight: 17, fontWeight: "600" },

  empty: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 40,
    gap: 10,
  },
  emptyTitle: { fontSize: 20, lineHeight: 27, fontWeight: "700", marginTop: 8 },
  emptySub: { fontSize: 14, lineHeight: 20, textAlign: "center" },

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
  fullscreenShare: {
    position: "absolute",
    bottom: Platform.OS === "ios" ? 52 : 36,
    alignSelf: "center",
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    minWidth: 140,
    justifyContent: "center",
    paddingHorizontal: 22,
    paddingVertical: 12,
    borderRadius: 24,
    backgroundColor: "rgba(255,255,255,0.16)",
  },
  fullscreenShareText: { color: "#fff", fontSize: 15, lineHeight: 21, fontWeight: "600" },

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
    lineHeight: 24,
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
    lineHeight: 22,
  },
});
