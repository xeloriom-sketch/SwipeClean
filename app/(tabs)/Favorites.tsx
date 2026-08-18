// app/(tabs)/Favorites.tsx
import React, { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  StatusBar,
  Dimensions,
  TouchableOpacity,
  FlatList,
  Platform,
  useColorScheme,
  Alert,
  ActivityIndicator,
} from "react-native";
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

const COLS = 2;
const GAP = 10;
const ITEM_W = (width - GAP * (COLS + 1)) / COLS;
const ITEM_H = ITEM_W * 1.4;

type Item = { id: string; uri: string; type?: "photo" | "video" };

/* ---- Animated thumb ---- */
const FavThumb = React.memo(function FavThumb({
  item,
  onPress,
  onRemove,
}: {
  item: Item;
  onPress: () => void;
  onRemove: () => void;
}) {
  const scale = useSharedValue(1);
  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePressIn = () => {
    scale.value = withSpring(0.96, { damping: 18, stiffness: 400 });
  };
  const handlePressOut = () => {
    scale.value = withSpring(1, { damping: 18, stiffness: 400 });
  };

  return (
    <Animated.View style={[styles.item, animStyle]}>
      <TouchableOpacity
        activeOpacity={1}
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        style={StyleSheet.absoluteFill}
      >
        <Image
          source={{ uri: item.uri }}
          style={styles.image}
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
const FullscreenViewer = ({
  uri,
  onClose,
}: {
  uri: string;
  onClose: () => void;
}) => {
  const opacity = useSharedValue(0);
  useEffect(() => {
    opacity.value = withTiming(1, { duration: 220 });
  }, []);
  const style = useAnimatedStyle(() => ({ opacity: opacity.value }));

  const close = () => {
    opacity.value = withTiming(0, { duration: 180 }, (done) => {
      if (done) runOnJS(onClose)();
    });
  };

  return (
    <Animated.View style={[styles.fullscreenContainer, style]}>
      <TouchableOpacity
        style={StyleSheet.absoluteFill}
        activeOpacity={1}
        onPress={close}
      />
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

  useEffect(() => {
    (async () => {
      const [raw, dark] = await Promise.all([
        AsyncStorage.getItem(FAVORITES_KEY),
        AsyncStorage.getItem(DARK_MODE_KEY),
      ]);
      setDarkMode(dark === "true");
      setImages(raw ? JSON.parse(raw) : []);
      setLoading(false);
    })();
  }, []);

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
        Alert.alert("Permission requise", "Autoriser l'accès à la photothèque pour exporter.");
        return;
      }
      const albumName = "SwipeClean — Favoris";
      const ids = images.map((i) => i.id);
      let album = await MediaLibrary.getAlbumAsync(albumName);
      if (!album) {
        album = await MediaLibrary.createAlbumAsync(albumName, ids[0], false);
        if (ids.length > 1) {
          await MediaLibrary.addAssetsToAlbumAsync(ids.slice(1), album.id, false);
        }
      } else {
        await MediaLibrary.addAssetsToAlbumAsync(ids, album.id, false);
      }
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert("Exporté !", `${ids.length} photo${ids.length > 1 ? "s" : ""} ajoutée${ids.length > 1 ? "s" : ""} dans l'album "${albumName}".`);
    } catch {
      Alert.alert("Erreur", "Impossible d'exporter les favoris.");
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
        ) : (
          <View style={{ width: 36 }} />
        )}
      </View>

      {/* Grid */}
      {images.length > 0 ? (
        <FlatList
          data={images}
          numColumns={COLS}
          keyExtractor={(item) => item.id}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.gallery}
          columnWrapperStyle={styles.row}
          ItemSeparatorComponent={() => <View style={{ height: GAP }} />}
          renderItem={({ item }) => (
            <FavThumb
              item={item}
              onPress={() => setSelectedUri(item.uri)}
              onRemove={() => handleRemove(item)}
            />
          )}
        />
      ) : (
        <View style={styles.empty}>
          <Ionicons
            name="heart-outline"
            size={72}
            color={darkMode ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.1)"}
          />
          <Text style={[styles.emptyTitle, { color: textColor }]}>
            Aucun favori
          </Text>
          <Text style={[styles.emptySub, { color: subColor }]}>
            Swipez vers le haut pour ajouter
          </Text>
        </View>
      )}

      {/* Fullscreen */}
      {selectedUri && (
        <FullscreenViewer
          uri={selectedUri}
          onClose={() => setSelectedUri(null)}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  row: { gap: GAP },

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
    paddingHorizontal: GAP,
    paddingTop: GAP,
    paddingBottom: 48,
  },
  item: {
    width: ITEM_W,
    height: ITEM_H,
    borderRadius: 16,
    overflow: "hidden",
    backgroundColor: "#111",
  },
  image: { width: "100%", height: "100%" },

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
});
