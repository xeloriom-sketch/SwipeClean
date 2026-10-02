// app/(tabs)/Favorites.tsx
//
// Parti pris visuel : c'est la pile « gardée », la récompense du tri — pas un
// gestionnaire de fichiers. Les photos sont la seule couleur de l'écran, le chrome
// reste monochrome et l'accent ne désigne qu'une chose à la fois. Rien ne flotte
// au-dessus d'une photo que l'utilisateur n'a pas demandé : plus de croix noire sur
// chaque vignette, et la sélection s'exprime en estompant ce qui n'est pas choisi
// plutôt qu'en empilant des cases à cocher.
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
  SortSheet,
  type SortMode,
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

type IconName = keyof typeof Ionicons.glyphMap;

/** `all` = tous les favoris, `unfiled` = ceux rangés dans aucun dossier. */
type FolderFilter = "all" | "unfiled" | string;

const GAP = 10;
const PADDING = 14;
const COLS = 2;
const COL_W = (width - PADDING * 2 - GAP) / COLS;
const RADIUS = 16;

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

/* ---- Vignette ---- */
const FavThumb = React.memo(function FavThumb({
  item,
  selecting,
  selected,
  onPress,
  onLongPress,
}: {
  item: ItemWithHeight;
  selecting: boolean;
  selected: boolean;
  onPress: () => void;
  onLongPress: () => void;
}) {
  const scale = useSharedValue(1);
  // Pendant la sélection, ce qui n'est pas retenu s'efface : la sélection devient le
  // sujet, au lieu d'être signalée par du chrome ajouté par-dessus.
  const dim = useSharedValue(1);

  useEffect(() => {
    dim.value = withTiming(selecting && !selected ? 0.38 : 1, { duration: 180 });
  }, [selecting, selected, dim]);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: dim.value,
  }));

  return (
    <Animated.View
      style={[
        {
          width: COL_W,
          height: item.displayH,
          borderRadius: RADIUS,
          overflow: "hidden",
          backgroundColor: "#141416",
          marginBottom: GAP,
        },
        animStyle,
      ]}
    >
      <TouchableOpacity
        activeOpacity={1}
        onPress={onPress}
        onPressIn={() => { scale.value = withSpring(0.975, { damping: 20, stiffness: 420 }); }}
        onLongPress={onLongPress}
        onPressOut={() => { scale.value = withSpring(1, { damping: 20, stiffness: 420 }); }}
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
        {item.type === "video" && (
          <View style={styles.videoTag}>
            <Ionicons name="play" size={10} color="#fff" />
          </View>
        )}
        {selected && (
          <>
            <View style={styles.ring} />
            <View style={styles.check}>
              <Ionicons name="checkmark" color="#fff" size={15} />
            </View>
          </>
        )}
      </TouchableOpacity>
    </Animated.View>
  );
});

/* ---- Plein écran ---- */
const FullscreenViewer = ({
  uri,
  canShare,
  sharing,
  onShare,
  onRemove,
  onClose,
}: {
  uri: string;
  canShare: boolean;
  sharing: boolean;
  onShare: () => void;
  onRemove: () => void;
  onClose: () => void;
}) => {
  const opacity = useSharedValue(0);
  useEffect(() => { opacity.value = withTiming(1, { duration: 200 }); }, []);
  const style = useAnimatedStyle(() => ({ opacity: opacity.value }));

  const close = () => {
    opacity.value = withTiming(0, { duration: 160 }, (done) => {
      if (done) runOnJS(onClose)();
    });
  };

  return (
    <Modal transparent animationType="none" visible statusBarTranslucent>
      <Animated.View style={[styles.viewer, style]}>
        <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={close} />
        <Image source={{ uri }} style={styles.viewerImage} contentFit="contain" cachePolicy="memory" />

        <TouchableOpacity style={styles.viewerClose} onPress={close} activeOpacity={0.8}>
          <Ionicons name="close" size={22} color="#fff" />
        </TouchableOpacity>

        <View style={styles.viewerBar}>
          {canShare && (
            <TouchableOpacity
              style={styles.viewerAction}
              onPress={onShare}
              disabled={sharing}
              activeOpacity={0.8}
            >
              {sharing ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Ionicons name="share-social-outline" size={19} color="#fff" />
              )}
              <Text style={styles.viewerActionText}>Partager</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity style={styles.viewerAction} onPress={onRemove} activeOpacity={0.8}>
            <Ionicons name="heart-dislike-outline" size={19} color="#FF453A" />
            <Text style={[styles.viewerActionText, { color: "#FF453A" }]}>Retirer</Text>
          </TouchableOpacity>
        </View>
      </Animated.View>
    </Modal>
  );
};

/* ---- Écran ---- */
export default function FavoritesScreen() {
  const systemScheme = useColorScheme();
  const [images, setImages] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [darkMode, setDarkMode] = useState(systemScheme === "dark");
  const [opened, setOpened] = useState<Item | null>(null);
  const [sortMode, setSortMode] = useState<SortMode>("custom");
  const [sorting, setSorting] = useState(false);
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
    setSorting(false);
    await AsyncStorage.setItem(SORT_FAV_KEY, mode);
    if (mode === "newest" || mode === "oldest") {
      setImages((prev) =>
        [...prev].sort((a, b) => {
          const ta = a.creationTime ?? 0;
          const tb = b.creationTime ?? 0;
          return mode === "newest" ? tb - ta : ta - tb;
        })
      );
    } else if (mode === "largest") {
      setImages((prev) =>
        [...prev].sort(
          (a, b) => (b.imgW ?? 0) * (b.imgH ?? 0) - (a.imgW ?? 0) * (a.imgH ?? 0)
        )
      );
    }
  }, []);

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
    (name: string, icon: string) => {
      const editing = formFolder;
      const ids = Array.from(selectedIds);
      setFormFolder(undefined);

      if (editing) {
        updateFolders((prev) => renameFolder(prev, editing.id, name, icon));
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

      // On y range tout de suite la sélection: créer un dossier depuis « Ranger dans »
      // sans rien y mettre ne ferait rien de visible.
      let next = createFolder(folderState, name, icon);
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

  const bg = darkMode ? "#0d0d0d" : "#F7F7F5";
  const surface = darkMode ? "#1A1A1C" : "#FFFFFF";
  const fill = darkMode ? "rgba(255,255,255,0.07)" : "rgba(0,0,0,0.045)";
  const text = darkMode ? "#FFFFFF" : "#0d0d0d";
  const muted = darkMode ? "rgba(255,255,255,0.48)" : "rgba(0,0,0,0.42)";
  const hairline = darkMode ? "rgba(255,255,255,0.09)" : "rgba(0,0,0,0.07)";

  if (loading) return <AppLoader dark={darkMode} />;

  const renderThumb = (item: ItemWithHeight) => (
    <FavThumb
      key={item.id}
      item={item}
      selecting={selecting}
      selected={selectedIds.has(item.id)}
      onPress={() => (selecting ? toggleSelect(item.id) : setOpened(item))}
      onLongPress={() => {
        if (!selecting) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        toggleSelect(item.id);
      }}
    />
  );

  /** Tuile du rail de dossiers. */
  const renderTile = (
    key: string,
    icon: IconName,
    label: string,
    count: number | null,
    active: boolean,
    onPress: () => void,
    onLongPress?: () => void
  ) => (
    <TouchableOpacity
      key={key}
      activeOpacity={0.7}
      onPress={onPress}
      onLongPress={onLongPress}
      style={styles.tileWrap}
    >
      <View style={[styles.tile, { backgroundColor: active ? ACCENT : fill }]}>
        <Ionicons name={icon} size={23} color={active ? "#fff" : text} />
      </View>
      <Text
        style={[styles.tileLabel, { color: active ? ACCENT : text }]}
        numberOfLines={1}
      >
        {label}
      </Text>
      {count !== null && (
        <Text style={[styles.tileCount, { color: muted }]}>{count}</Text>
      )}
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: bg }]}>
      <StatusBar barStyle={darkMode ? "light-content" : "dark-content"} />

      {/* Ligne d'actions */}
      <View style={styles.topBar}>
        {selecting ? (
          <>
            <TouchableOpacity onPress={clearSelection} hitSlop={10} style={styles.topBtn}>
              <Text style={[styles.topAction, { color: text }]}>Annuler</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={selectAll} hitSlop={10} style={styles.topBtn}>
              <Text style={[styles.topAction, { color: ACCENT }]}>
                {selectedIds.size === visible.length ? "Aucune" : "Tout choisir"}
              </Text>
            </TouchableOpacity>
          </>
        ) : (
          <>
            <TouchableOpacity onPress={() => router.back()} hitSlop={10} style={styles.topBtn}>
              <Ionicons name="chevron-back" size={26} color={text} />
            </TouchableOpacity>
            {images.length > 0 && (
              <View style={{ flexDirection: "row", gap: 6 }}>
                <TouchableOpacity
                  onPress={() => setSorting(true)}
                  hitSlop={10}
                  style={[styles.roundBtn, { backgroundColor: fill }]}
                >
                  <Ionicons name="swap-vertical" size={18} color={text} />
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={exportToAlbum}
                  disabled={exporting}
                  hitSlop={10}
                  style={[styles.roundBtn, { backgroundColor: fill }]}
                >
                  {exporting ? (
                    <ActivityIndicator size="small" color={text} />
                  ) : (
                    <Ionicons name="download-outline" size={18} color={text} />
                  )}
                </TouchableOpacity>
              </View>
            )}
          </>
        )}
      </View>

      {/* Titre */}
      <View style={styles.titleBlock}>
        <Text style={[styles.title, { color: text }]} numberOfLines={1}>
          {selecting
            ? `${selectedIds.size} photo${selectedIds.size > 1 ? "s" : ""}`
            : activeFolder
            ? activeFolder.name
            : "Favoris"}
        </Text>
        {!selecting && visible.length > 0 && (
          <Text style={[styles.titleCount, { color: muted }]}>{visible.length}</Text>
        )}
        {selecting && <Text style={[styles.titleCount, { color: ACCENT }]}>sélectionnées</Text>}
      </View>

      {/* Rail de dossiers */}
      {images.length > 0 && !selecting && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.rail}
        >
          {renderTile("all", "images-outline", "Tous", images.length, filter === "all", () =>
            setFilter("all")
          )}
          {folderState.folders.map((f) =>
            renderTile(
              f.id,
              f.icon as IconName,
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
            renderTile(
              "unfiled",
              "remove-circle-outline",
              "Non rangées",
              counts.unfiled,
              filter === "unfiled",
              () => setFilter("unfiled")
            )}
          <TouchableOpacity
            activeOpacity={0.7}
            onPress={() => setFormFolder(null)}
            style={styles.tileWrap}
          >
            <View style={[styles.tile, styles.tileNew]}>
              <Ionicons name="add" size={23} color={ACCENT} />
            </View>
            <Text style={[styles.tileLabel, { color: ACCENT }]} numberOfLines={1}>
              Dossier
            </Text>
          </TouchableOpacity>
        </ScrollView>
      )}

      {/* Grille */}
      {visible.length > 0 ? (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[styles.grid, selecting && { paddingBottom: 124 }]}
          onScroll={onGalleryScroll}
          scrollEventThrottle={200}
        >
          <View style={styles.columns}>
            <View style={{ width: COL_W }}>{leftCol.map(renderThumb)}</View>
            <View style={{ width: COL_W }}>{rightCol.map(renderThumb)}</View>
          </View>
        </ScrollView>
      ) : (
        <View style={styles.empty}>
          <View style={[styles.emptyIcon, { backgroundColor: fill }]}>
            <Ionicons
              name={images.length > 0 ? "folder-open-outline" : "heart-outline"}
              size={26}
              color={muted}
            />
          </View>
          <Text style={[styles.emptyTitle, { color: text }]}>
            {images.length > 0 ? "Ce dossier est vide" : "Rien de gardé pour l'instant"}
          </Text>
          <Text style={[styles.emptySub, { color: muted }]}>
            {images.length > 0
              ? "Reste appuyé sur des photos, puis touche Ranger."
              : "Swipe une photo vers le haut pour la garder ici."}
          </Text>
        </View>
      )}

      {/* Barre d'actions flottante */}
      {selecting && (
        <View style={[styles.pill, { backgroundColor: surface, borderColor: hairline }]}>
          {canShare && (
            <TouchableOpacity
              style={[
                styles.pillIcon,
                { backgroundColor: fill },
                (selectedIds.size !== 1 || sharing) && { opacity: 0.4 },
              ]}
              activeOpacity={0.7}
              disabled={selectedIds.size !== 1 || sharing}
              onPress={() => {
                const id = Array.from(selectedIds)[0];
                const item = images.find((i) => i.id === id);
                if (item) handleShare(item);
              }}
            >
              {sharing ? (
                <ActivityIndicator size="small" color={text} />
              ) : (
                <Ionicons name="share-social-outline" size={19} color={text} />
              )}
            </TouchableOpacity>
          )}
          <TouchableOpacity
            style={[styles.pillIcon, { backgroundColor: "rgba(255,69,58,0.12)" }]}
            activeOpacity={0.7}
            onPress={() => removeIds(Array.from(selectedIds))}
          >
            <Ionicons name="heart-dislike-outline" size={19} color="#FF453A" />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.pillPrimary}
            activeOpacity={0.85}
            onPress={() => setPicking(true)}
          >
            <Ionicons name="folder-outline" size={17} color="#fff" />
            <Text style={styles.pillPrimaryText}>Ranger</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Plein écran */}
      {opened && (
        <FullscreenViewer
          uri={
            resolveMediaUri(opened.uri, opened.id, opened.type === "video" ? "video" : "photo") ??
            opened.uri
          }
          canShare={canShare}
          sharing={sharing}
          onShare={() => handleShare(opened)}
          onRemove={() => {
            const item = opened;
            setOpened(null);
            removeIds([item.id]);
          }}
          onClose={() => setOpened(null)}
        />
      )}

      <FolderPickSheet
        visible={picking}
        dark={darkMode}
        folders={folderState.folders}
        counts={counts.byFolder}
        currentId={commonFolder}
        count={selectedIds.size}
        onPick={handlePickFolder}
        onCreate={() => {
          setPicking(false);
          setTimeout(() => setFormFolder(null), 260);
        }}
        onClose={() => setPicking(false)}
      />

      <FolderFormSheet
        visible={formFolder !== undefined}
        dark={darkMode}
        folder={formFolder ?? null}
        onSubmit={handleSubmitFolder}
        onClose={() => setFormFolder(undefined)}
      />

      <FolderManageSheet
        visible={!!manageFolder}
        dark={darkMode}
        folder={manageFolder}
        photoCount={manageFolder ? counts.byFolder[manageFolder.id] ?? 0 : 0}
        onRename={() => {
          const target = manageFolder;
          setManageFolder(null);
          setTimeout(() => setFormFolder(target), 260);
        }}
        onDelete={handleDeleteFolder}
        onClose={() => setManageFolder(null)}
      />

      <SortSheet
        visible={sorting}
        dark={darkMode}
        mode={sortMode}
        onPick={applySort}
        onClose={() => setSorting(false)}
      />

      {popup}
    </SafeAreaView>
  );
}

// Tous les styles de texte portent un `lineHeight` explicite : sans lui, Android rogne
// le haut et le bas des glyphes hauts dans une boîte serrée.
const styles = StyleSheet.create({
  container: { flex: 1 },

  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: PADDING,
    height: 44,
  },
  topBtn: { paddingVertical: 6, paddingRight: 4 },
  topAction: { fontSize: 16, lineHeight: 22, fontWeight: "600" },
  roundBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },

  titleBlock: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: 9,
    paddingHorizontal: PADDING,
    paddingTop: 2,
    paddingBottom: 16,
  },
  title: { fontSize: 31, lineHeight: 38, fontWeight: "800", letterSpacing: -0.7, flexShrink: 1 },
  titleCount: { fontSize: 17, lineHeight: 24, fontWeight: "600" },

  rail: { paddingHorizontal: PADDING, paddingBottom: 18, gap: 12 },
  tileWrap: { width: 62, alignItems: "center" },
  tile: {
    width: 58,
    height: 58,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
  },
  tileNew: {
    backgroundColor: "transparent",
    borderWidth: 1.5,
    borderStyle: "dashed",
    borderColor: ACCENT,
  },
  tileLabel: { fontSize: 12, lineHeight: 17, fontWeight: "600", marginTop: 7 },
  tileCount: { fontSize: 11, lineHeight: 15, fontWeight: "500" },

  grid: { paddingHorizontal: PADDING, paddingBottom: 40 },
  columns: { flexDirection: "row", gap: GAP, alignItems: "flex-start" },

  videoTag: {
    position: "absolute",
    bottom: 9,
    left: 9,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: "rgba(0,0,0,0.5)",
    alignItems: "center",
    justifyContent: "center",
  },
  ring: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: RADIUS,
    borderWidth: 2.5,
    borderColor: ACCENT,
  },
  check: {
    position: "absolute",
    bottom: 9,
    right: 9,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: ACCENT,
    alignItems: "center",
    justifyContent: "center",
  },

  pill: {
    position: "absolute",
    bottom: Platform.OS === "ios" ? 30 : 22,
    alignSelf: "center",
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    padding: 7,
    borderRadius: 29,
    borderWidth: StyleSheet.hairlineWidth,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.18,
    shadowRadius: 20,
    elevation: 10,
  },
  pillIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  pillPrimary: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    height: 44,
    paddingHorizontal: 19,
    borderRadius: 22,
    backgroundColor: ACCENT,
  },
  pillPrimaryText: { color: "#fff", fontSize: 15, lineHeight: 21, fontWeight: "700" },

  empty: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 44,
    marginTop: -40,
  },
  emptyIcon: {
    width: 62,
    height: 62,
    borderRadius: 21,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 18,
  },
  emptyTitle: { fontSize: 19, lineHeight: 26, fontWeight: "700", letterSpacing: -0.3 },
  emptySub: { fontSize: 14, lineHeight: 20, textAlign: "center", marginTop: 6 },

  viewer: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.96)",
    justifyContent: "center",
    alignItems: "center",
  },
  viewerImage: { width: "100%", height: "78%" },
  viewerClose: {
    position: "absolute",
    top: Platform.OS === "ios" ? 54 : 32,
    right: 18,
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "rgba(255,255,255,0.14)",
    alignItems: "center",
    justifyContent: "center",
  },
  viewerBar: {
    position: "absolute",
    bottom: Platform.OS === "ios" ? 46 : 30,
    flexDirection: "row",
    gap: 10,
  },
  viewerAction: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    minWidth: 124,
    justifyContent: "center",
    paddingHorizontal: 20,
    height: 46,
    borderRadius: 23,
    backgroundColor: "rgba(255,255,255,0.12)",
  },
  viewerActionText: { color: "#fff", fontSize: 15, lineHeight: 21, fontWeight: "600" },
});
