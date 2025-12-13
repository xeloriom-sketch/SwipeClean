//app/(tabs)/Gallery/[id].tsx
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  Dimensions,
  StyleSheet,
  TouchableOpacity,
  Platform,
  UIManager,
  StatusBar,
  Pressable,
} from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import * as MediaLibrary from "expo-media-library";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Ionicons } from "@expo/vector-icons";
import Svg, { Path } from "react-native-svg";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { BlurView } from "expo-blur";
import { Image } from "expo-image";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  runOnJS,
  interpolate,
  Extrapolate,
} from "react-native-reanimated";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import * as Haptics from "expo-haptics";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");

const TRASH_KEY = "@app_trash";
const FAVORITES_KEY = "@app_favorites";
const DARK_MODE_KEY = "@app_dark_mode";
const VIBRATE_KEY = "@app_vibrate_swipe";
const BATCH_SIZE = 40;
const PRELOAD_THRESHOLD = 5;


const isTablet = SCREEN_WIDTH >= 768;
const RESPONSIVE = {
  cardWidth: SCREEN_WIDTH * 0.9,
  cardHeight: SCREEN_HEIGHT * 0.7,
  cardRadius: 24,
  iconXL: isTablet ? 100 : 80,
};

if (Platform.OS === "android" && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

type MediaItem = {
  id: string;
  uri: string | null;
  type: "photo";
  createdAt: number;
  width?: number;
  height?: number;
};

type SwipeDirection = "left" | "right" | "top" | null;

/* ---------- SVG icons ---------- */
const StarMenuIcon = ({ size = 40, darkMode }: { size?: number; darkMode: boolean }) => (
  <Svg width={size} height={size} viewBox="0 0 36 37" fill="none">
    <Path
      fillRule="evenodd"
      clipRule="evenodd"
      d="M35.9666 28.55V31.8834H27.6334V28.55H35.9666ZM25.9666 28.55V31.8834H22.6334V28.55H25.9666ZM15.9695 0L20.4109 10.6783L31.939 11.6025L23.1558 19.1263L23.8134 21.8833H20.9666L20.9695 25.2104V27.4013L15.9695 24.3474L6.09977 30.3758L8.7832 19.1263L0 11.6025L11.5281 10.6783L15.9695 0ZM35.9666 23.55V26.8834H27.6334V23.55H35.9666ZM25.9666 23.55V26.8834H22.6334V23.55H25.9666ZM35.9666 33.55V36.8834H27.6334V33.55H35.9666ZM25.9666 33.55V36.8834H22.6334V33.55H25.9666Z"
      fill={darkMode ? "#E0E0E0" : "#000"}
    />
  </Svg>
);

const BackArrowIcon = ({ size = 32, darkMode }: { size?: number; darkMode: boolean }) => (
  <Svg width={size} height={size} viewBox="0 0 32 32" fill="none">
    <Path
      d="M20 8L12 16L20 24"
      stroke={darkMode ? "#E0E0E0" : "#000"}
      strokeWidth="3"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </Svg>
);

const ReloadMenuIcon = ({ size = 40, darkMode }: { size?: number; darkMode: boolean }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path
      fillRule="evenodd"
      clipRule="evenodd"
      d="M12 3.99998C14.1 3.99998 16.1 4.79998 17.6 6.29998C20.7 9.39998 20.7 14.5 17.6 17.6C15.8 19.5 13.3 20.2 10.9 19.9L11.4 17.9C13.1 18.1 14.9 17.5 16.2 16.2C18.5 13.9 18.5 10.1 16.2 7.69998C15.1 6.59998 13.5 5.99998 12 5.99998V10.6L7.00003 5.59998L12 0.599976V3.99998ZM6.30003 17.6C3.70003 15 3.30003 11 5.10003 7.89998L6.60003 9.39997C5.50003 11.6 5.90003 14.4 7.80003 16.2C8.30003 16.7 8.90003 17.1 9.60003 17.4L9.00003 19.4C8.00003 19 7.10003 18.4 6.30003 17.6Z"
      fill={darkMode ? "#E0E0E0" : "#000"}
    />
  </Svg>
);

const TrashXIcon = ({ size = 40, darkMode }: { size?: number; darkMode: boolean }) => (
  <Svg width={size} height={size} viewBox="0 0 40 40" fill="none">
    <Path d="M15.4167 5C15.4167 4.66848 15.5484 4.35054 15.7828 4.11612C16.0172 3.8817 16.3352 3.75 16.6667 3.75H23.3334C23.6649 3.75 23.9828 3.8817 24.2173 4.11612C24.4517 4.35054 24.5834 4.66848 24.5834 5V6.25H31.6667C31.9982 6.25 32.3162 6.3817 32.5506 6.61612C32.785 6.85054 32.9167 7.16848 32.9167 7.5C32.9167 7.83152 32.785 8.14946 32.5506 8.38388C32.3162 8.6183 31.9982 8.75 31.6667 8.75H8.33337C8.00185 8.75 7.68391 8.6183 7.44949 8.38388C7.21507 8.14946 7.08337 7.83152 7.08337 7.5C7.08337 7.16848 7.21507 6.85054 7.44949 6.61612C7.68391 6.3817 8.00185 6.25 8.33337 6.25H15.4167V5Z" fill={darkMode ? "#fff" : "#000"} />
    <Path
      fillRule="evenodd"
      clipRule="evenodd"
      d="M10.3999 13.2417C10.4225 13.0378 10.5195 12.8493 10.6723 12.7125C10.8252 12.5756 11.0231 12.5 11.2283 12.5H28.7716C28.9768 12.5 29.1747 12.5756 29.3275 12.7125C29.4804 12.8493 29.5774 13.0378 29.5999 13.2417L29.9333 16.2433C30.5351 21.655 30.5351 27.1167 29.9333 32.5283L29.8999 32.8233C29.7942 33.7816 29.3719 34.6771 28.7 35.3684C28.028 36.0597 27.1448 36.5071 26.1899 36.64C22.0833 37.2147 17.9166 37.2147 13.8099 36.64C12.8548 36.5075 11.9711 36.0602 11.2989 35.3689C10.6266 34.6776 10.2041 33.7818 10.0983 32.8233L10.0649 32.5283C9.46322 27.1172 9.46322 21.6561 10.0649 16.245L10.3999 13.2417ZM24.2166 20.7833C24.4507 21.0177 24.5822 21.3354 24.5822 21.6667C24.5822 21.9979 24.4507 22.3156 24.2166 22.55L21.7666 25L24.2166 27.45C24.3394 27.5644 24.4379 27.7024 24.5062 27.8558C24.5746 28.0091 24.6113 28.1746 24.6113 28.3425C24.6172 28.5103 24.5863 28.677 24.5235 28.8327C24.4606 28.9883 24.367 29.1297 24.2483 29.2484C24.1296 29.3671 23.9883 29.4607 23.8326 29.5235C23.677 29.5864 23.5102 29.6173 23.3424 29.6143C23.1746 29.6114 23.009 29.5746 22.8557 29.5063C22.7024 29.438 22.5644 29.3395 22.4499 29.2167L19.9999 26.7667L17.5499 29.2167C17.4355 29.3395 17.2975 29.438 17.1442 29.5063C16.9908 29.5746 16.8253 29.6114 16.6575 29.6143C16.4896 29.6173 16.3229 29.5864 16.1673 29.5235C16.0116 29.4607 15.8702 29.3671 15.7515 29.2484C15.6328 29.1297 15.5393 28.9883 15.4764 28.8327C15.4135 28.677 15.3827 28.5103 15.3856 28.3425C15.3827 28.1746 15.4253 28.0091 15.4936 27.8558C15.562 27.7024 15.6605 27.5644 15.7833 27.45L18.2333 25L15.7833 22.55C15.6605 22.4356 15.562 22.2976 15.4936 22.1442C15.4253 21.9909 15.3886 21.8254 15.3856 21.6575C15.3827 21.4897 15.4135 21.323 15.4764 21.1673C15.5393 21.0117 15.6328 20.8703 15.7515 20.7516C15.8702 20.6329 16.0116 20.5393 16.1673 20.4765C16.3229 20.4136 16.4896 20.3827 16.6575 20.3857C16.8253 20.3886 16.9908 20.4254 17.1442 20.4937C17.2975 20.562 17.4355 20.6605 17.5499 20.7833L19.9999 23.2333L22.4499 20.7833C22.6843 20.5492 23.002 20.4178 23.3333 20.4178C23.6645 20.4178 23.9822 20.5492 24.2166 20.7833Z"
      fill={darkMode ? "#E0E0E0" : "#000"}
    />
  </Svg>
);

/* ---------- logger ---------- */
const logger = {
  info: (msg: string, data?: any) => __DEV__ && console.log(`ℹ️ ${msg}`, data || ""),
  error: (msg: string, err?: any) => console.error(`❌ ${msg}`, err || ""),
};

/* ---------- Loader ---------- */
const FancyLoader = () => {
  const [darkMode, setDarkMode] = useState(false);

  useEffect(() => {
    (async () => {
      const dm = await AsyncStorage.getItem(DARK_MODE_KEY);
      if (dm !== null) setDarkMode(dm === "true");
    })();
  }, []);

  return (
    <View style={StyleSheet.absoluteFill}>
      {/* Background gradient adaptatif */}
      <LinearGradient
        colors={
          darkMode
            ? ["#0d0d0d", "#121212", "#1c1c1c"] // 🌙 MODE SOMBRE
            : ["#ffffff", "#f0f4f8", "#e2e8f0"] // ☀️ MODE CLAIR
        }
        style={StyleSheet.absoluteFill}
      />

      {/* Contenu */}
      <View style={styles.loadingContent}>
        <Ionicons
          name="images"
          size={60}
          color={darkMode ? "#4DA3FF" : "#00BBFF"} // couleur icône adaptative
          style={{ marginBottom: 20 }}
        />
        <Text
          style={[
            styles.loadingText,
            { color: darkMode ? "#e6e6e6" : "#333" }, // texte adaptatif
          ]}
        >
          Organisation de vos souvenirs...
        </Text>
      </View>
    </View>
  );
};


/* ---------- MediaCard (memo) ---------- */
const MediaCard = React.memo(function MediaCard({ item }: { item: MediaItem }) {
  useEffect(() => {
    if (item.uri) Image.prefetch(item.uri); // précharge la prochaine image
  }, [item.uri]);

  return (
    <View style={styles.card}>
      {item.uri ? (
        <Image
          source={{ uri: item.uri }}
          style={styles.media}
          contentFit="cover"
          transition={0} // éviter transition animée qui clignote
          cachePolicy="memory" // uniquement en mémoire
          priority="high"
        />
      ) : (
        <View style={styles.mediaError}>
          <Ionicons name="image-off" size={RESPONSIVE.iconXL} color="rgba(255,255,255,0.3)" />
          <Text style={styles.errorText}>Photo non disponible</Text>
        </View>
      )}
    </View>
  );
});

/* ---------- Composant de carte animée individuelle ---------- */
const SwipeableCard = ({
  item,
  onSwipe,
  isTop
}: {
  item: MediaItem;
  onSwipe: (direction: Exclude<SwipeDirection, null>) => void;
  isTop: boolean;
}) => {
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const swipeDir = useSharedValue<SwipeDirection>(null);

  const SWIPE_THRESHOLD_X = SCREEN_WIDTH * 0.25;
  const SWIPE_THRESHOLD_Y = SCREEN_HEIGHT * 0.15;

  const cardStyle = useAnimatedStyle(() => {
    if (!isTop) {
        return {
          zIndex: 5,
          opacity: 1,
        };
      }

    const rotate = interpolate(
      translateX.value,
      [-SCREEN_WIDTH, 0, SCREEN_WIDTH],
      [-20, 0, 20],
      Extrapolate.CLAMP
    );

    return {
      transform: [
        { translateX: translateX.value },
        { translateY: translateY.value },
        { rotate: `${rotate}deg` }
      ],
      zIndex: 10,
      opacity: 1
    };
  });

  const overlayStyle = (dir: "left" | "right" | "top") =>
    useAnimatedStyle(() => {
      if (!isTop) return { opacity: 0 };
      let op = 0;
      if (dir === "left" && translateX.value < -SWIPE_THRESHOLD_X * 0.3 && Math.abs(translateY.value) < SWIPE_THRESHOLD_Y * 0.3)
        op = interpolate(translateX.value, [-SCREEN_WIDTH, -SWIPE_THRESHOLD_X * 0.3, 0], [1, 0.8, 0], Extrapolate.CLAMP);
      if (dir === "right" && translateX.value > SWIPE_THRESHOLD_X * 0.3 && Math.abs(translateY.value) < SWIPE_THRESHOLD_Y * 0.3)
        op = interpolate(translateX.value, [0, SWIPE_THRESHOLD_X * 0.3, SCREEN_WIDTH], [0, 0.8, 1], Extrapolate.CLAMP);
      if (dir === "top" && translateY.value < -SWIPE_THRESHOLD_Y * 0.3 && Math.abs(translateX.value) < SWIPE_THRESHOLD_X * 0.3)
        op = interpolate(translateY.value, [-SCREEN_HEIGHT, -SWIPE_THRESHOLD_Y * 0.3, 0], [1, 0.8, 0], Extrapolate.CLAMP);
      return { opacity: op };
    });

  const leftOverlayStyle = overlayStyle("left");
  const rightOverlayStyle = overlayStyle("right");
  const topOverlayStyle = overlayStyle("top");

  const panGesture = Gesture.Pan()
    .enabled(isTop)
    .onUpdate((e) => {
      translateX.value = e.translationX;
      translateY.value = e.translationY;

      if (e.translationY < -SWIPE_THRESHOLD_Y) swipeDir.value = "top";
      else if (e.translationX < -SWIPE_THRESHOLD_X) swipeDir.value = "left";
      else if (e.translationX > SWIPE_THRESHOLD_X) swipeDir.value = "right";
      else swipeDir.value = null;
    })
    .onEnd(() => {
      const triggerSwipe = (dx: number, dy: number, dir: Exclude<SwipeDirection, null>) => {
        if (dx !== 0) translateX.value = withTiming(dx * 1.5, { duration: 300 }, (finished) => finished && runOnJS(onSwipe)(dir));
        if (dy !== 0) translateY.value = withTiming(dy * 1.5, { duration: 300 }, (finished) => finished && runOnJS(onSwipe)(dir));
      };

      if (swipeDir.value === "left") triggerSwipe(-SCREEN_WIDTH, 0, "left");
      else if (swipeDir.value === "right") triggerSwipe(SCREEN_WIDTH, 0, "right");
      else if (swipeDir.value === "top") triggerSwipe(0, -SCREEN_HEIGHT, "top");
      else {
        translateX.value = withSpring(0, { damping: 20, stiffness: 300 });
        translateY.value = withSpring(0, { damping: 20, stiffness: 300 });
        swipeDir.value = null;
      }
    })
    .runOnJS(true);

  return (
    <GestureDetector gesture={panGesture}>
      <Animated.View style={[styles.cardWrapper, cardStyle]} renderToHardwareTextureAndroid>
        <MediaCard item={item} />
        {isTop && (
          <>
            <Animated.View style={[styles.overlayCenter, leftOverlayStyle]} pointerEvents="none">
              <View style={[styles.overlayCircle, { backgroundColor: "rgba(255, 68, 88, 0.9)" }]}>
                <Ionicons name="close" size={60} color="#FFF" />
              </View>
            </Animated.View>
            <Animated.View style={[styles.overlayCenter, rightOverlayStyle]} pointerEvents="none">
              <View style={[styles.overlayCircle, { backgroundColor: "rgba(76, 255, 94, 0.9)" }]}>
                <Ionicons name="heart" size={60} color="#FFF" />
              </View>
            </Animated.View>
            <Animated.View style={[styles.overlayCenter, topOverlayStyle]} pointerEvents="none">
              <View style={[styles.overlayCircle, { backgroundColor: "rgba(0, 212, 255, 0.9)" }]}>
                <Ionicons name="star" size={60} color="#FFF" />
              </View>
            </Animated.View>
          </>
        )}
      </Animated.View>
    </GestureDetector>
  );
};

/* ---------- Main component ---------- */
export default function GalleryScreen() {
  const { id } = useLocalSearchParams();
  console.log("Gallery ID:", id);
  const CARD_INDEX_KEY = `@gallery_last_index_v2_${id}`;

  const [assets, setAssets] = useState<MediaItem[]>([]);
  const [cursor, setCursor] = useState<string | undefined>(undefined);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(true);
  const isFetching = useRef(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const trashCache = useRef<Set<string>>(new Set());
  const containerOpacity = useSharedValue(0);
  const containerScale = useSharedValue(0.98);
  const [menuOpen, setMenuOpen] = useState(false);
  const toggleMenu = () => setMenuOpen(v => !v);
  const closeMenu = () => setMenuOpen(false);
  const [darkMode, setDarkMode] = useState(false);
  const [vibrateSwipe, setVibrateSwipe] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const savedDarkMode = await AsyncStorage.getItem(DARK_MODE_KEY);
        if (savedDarkMode !== null) setDarkMode(savedDarkMode === "true");

        const savedVibrate = await AsyncStorage.getItem(VIBRATE_KEY);
        if (savedVibrate !== null) setVibrateSwipe(savedVibrate === "true");
      } catch (err) {
        console.log("Erreur lecture preferences:", err);
      }
    })();
  }, []);

  const toggleDarkMode = async () => {
    try {
      const newValue = !darkMode;
      setDarkMode(newValue);
      await AsyncStorage.setItem(DARK_MODE_KEY, newValue.toString());
    } catch (err) {
      console.log("Erreur sauvegarde Dark Mode:", err);
    }
  };

  const toggleVibrate = async () => {
    try {
      const newValue = !vibrateSwipe;
      setVibrateSwipe(newValue);
      await AsyncStorage.setItem(VIBRATE_KEY, newValue.toString());
    } catch (err) {
      console.log("Erreur sauvegarde Vibration:", err);
    }
  };

  useEffect(() => {
    (async () => {
      try {
        const trashRaw = await AsyncStorage.getItem(TRASH_KEY);
        if (trashRaw) {
          const parsed: MediaItem[] = JSON.parse(trashRaw);
          parsed.forEach((t) => trashCache.current.add(t.id));
        }
        const saved = await AsyncStorage.getItem(CARD_INDEX_KEY);
        const idx = saved ? Number(saved) : 0;
        setCurrentIndex(idx);
        await fetchAssets();
        await new Promise((r) => setTimeout(r, 350));
      } catch (err) {
        logger.error("init err", err);
      } finally {
        setLoading(false);
        containerOpacity.value = withTiming(1, { duration: 600 });
        containerScale.value = withSpring(1, { damping: 15 });
      }
    })();
  }, []);

  const fetchAssets = useCallback(
    async (force = false) => {
      if (isFetching.current || (!hasMore && !force)) return;
      isFetching.current = true;

      try {
        const { status } = await MediaLibrary.requestPermissionsAsync();
        if (status !== "granted") {
          isFetching.current = false;
          return;
        }

        const res = await MediaLibrary.getAssetsAsync({
          mediaType: ["photo"],
          first: BATCH_SIZE,
          after: cursor,
          sortBy: [["creationTime", false]],
          album: id as string,
        });

        const items: MediaItem[] = [];

        await Promise.allSettled(
          res.assets.map(async (asset) => {
            if (trashCache.current.has(asset.id)) return null;

            try {
              const info = await MediaLibrary.getAssetInfoAsync(asset.id);

              // FIX Android/iOS : utiliser uri qui fonctionne sur les 2 plateformes
              const imageUri =
                Platform.OS === "android"
                  ? info.uri
                  : info.localUri || info.uri;

              return {
                id: asset.id,
                uri: imageUri || null,
                type: "photo",
                createdAt: asset.creationTime,
                width: asset.width,
                height: asset.height,
              } as MediaItem;
            } catch {
              return null;
            }
          })
        ).then((results) => {
          results.forEach((r) => {
            if (r.status === "fulfilled" && r.value) items.push(r.value);
          });
        });

        setAssets((prev) => {
          const map = new Map(prev.map((p) => [p.id, p]));
          for (const it of items) {
            if (!map.has(it.id)) map.set(it.id, it);
          }
          return Array.from(map.values());
        });
        setCursor(res.endCursor);
        setHasMore(res.hasNextPage);
      } catch (err) {
        logger.error("Erreur fetchAssets", err);
      } finally {
        isFetching.current = false;
      }
    },
    [cursor, hasMore, id]
  );

  useEffect(() => {
    if (assets.length - currentIndex <= PRELOAD_THRESHOLD && hasMore) {
      fetchAssets();
    }
  }, [assets.length, currentIndex, hasMore, fetchAssets]);

  const persistIndex = useCallback(async (idx: number) => {
    try {
      await AsyncStorage.setItem(CARD_INDEX_KEY, String(idx));
    } catch (err) {
      logger.error("persistIndex", err);
    }
  }, [CARD_INDEX_KEY]);

  const addToTrashJS = useCallback(async (item: MediaItem) => {
    try {
      const raw = await AsyncStorage.getItem(TRASH_KEY);
      const arr: MediaItem[] = raw ? JSON.parse(raw) : [];
      await AsyncStorage.setItem(TRASH_KEY, JSON.stringify([item, ...arr].slice(0, 1000)));
    } catch (err) {
      logger.error("addToTrashJS", err);
    }
  }, []);

  const addToFavoritesJS = useCallback(async (item: MediaItem) => {
    try {
      const raw = await AsyncStorage.getItem(FAVORITES_KEY);
      const arr: MediaItem[] = raw ? JSON.parse(raw) : [];
      if (!arr.some((f: MediaItem) => f.id === item.id)) {
        await AsyncStorage.setItem(FAVORITES_KEY, JSON.stringify([item, ...arr].slice(0, 1000)));
      }
    } catch (err) {
      logger.error("addToFavoritesJS", err);
    }
  }, []);

  const handleSwipe = useCallback(
    async (direction: Exclude<SwipeDirection, null>) => {
      const item = assets[currentIndex];
      if (!item) return;

      // Vibrer si activé
      if (vibrateSwipe) {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      }

      if (direction === "left") {
        trashCache.current.add(item.id);
        await addToTrashJS(item);
      } else if (direction === "top") {
        await addToFavoritesJS(item);
      }

      const newIndex = currentIndex + 1;

      // FIX 100% : attendre fin animation avant changement carte
      setTimeout(() => {
        setCurrentIndex(newIndex);
        persistIndex(newIndex);
      }, 1); // 300ms (withTiming) + 20ms marge
    },
    [currentIndex, assets, vibrateSwipe, addToTrashJS, addToFavoritesJS, persistIndex]
  );

  const resetGallery = useCallback(async () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    await AsyncStorage.removeItem(CARD_INDEX_KEY);
    setCurrentIndex(0);
    trashCache.current.clear();
  }, [CARD_INDEX_KEY]);

  const swipeLeft = () => handleSwipe("left");
  const swipeRight = () => handleSwipe("right");
  const swipeTop = () => handleSwipe("top");

  const mainAnimatedStyle = useAnimatedStyle(() => ({
    opacity: containerOpacity.value,
    transform: [{ scale: containerScale.value }],
  }));

  if (loading) return <FancyLoader />;

  if (assets.length === 0)
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: darkMode ? "#121212" : "#fff" }]}>
        <View style={styles.emptyContainer}>
          <Ionicons name="images-outline" size={80} color="rgba(0,0,0,0.2)" />
          <Text style={styles.emptyText}>Aucune photo disponible</Text>
        </View>
      </SafeAreaView>
    );

  const topCard = assets[currentIndex];
  const bottomCard = assets[currentIndex + 1];

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: darkMode ? "#121212" : "#fff" }]}>
      <StatusBar barStyle="dark-content" />

      {/* ================= HEADER ================= */}
      <View style={styles.header}>
        {/* Bouton retour */}
        <TouchableOpacity style={styles.headerBtn} onPress={() => router.back()}>
          <BackArrowIcon size={36} darkMode={darkMode} />
        </TouchableOpacity>

        {/* Étoile centrée */}
        <View style={{ position: "absolute", left: 0, right: 0, alignItems: "center" }}>
          <TouchableOpacity
            onPress={() => router.push("/Favorites")}
            style={styles.headerBtn}
          >
            <Ionicons name="star" size={34} color={darkMode ? "#E0E0E0" : "#000"} />
          </TouchableOpacity>
        </View>

        {/* Reset et Corbeille à droite */}
        <View style={{ flexDirection: "row", alignItems: "center" }}>
          <TouchableOpacity
            style={styles.headerBtn}
            onPress={resetGallery}
          >
            <ReloadMenuIcon size={34} darkMode={darkMode} />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.headerBtn}
            onPress={() => router.push("/Trash")}
          >
            <TrashXIcon size={34} darkMode={darkMode} />
          </TouchableOpacity>
        </View>
      </View>

      {/* ================= DROPDOWN MENU ================= */}
      {menuOpen && (
        <Pressable style={styles.menuOverlay} onPress={closeMenu}>
          <View style={[styles.menuPanel, { backgroundColor: darkMode ? "#0a0a0a" : "#fff" }]}>

            {/* Item Gallery */}
            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => {
                closeMenu();
                router.push("/Gallery");
              }}
            >
              <Ionicons name="images-outline" size={20} color={darkMode ? "#E0E0E0" : "#000"} />
              <Text style={[styles.menuText, { color: darkMode ? "#E0E0E0" : "#000" }]}>Gallery</Text>
            </TouchableOpacity>

            {/* Item Paramètres */}
            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => {
                closeMenu();
                router.push("/Settings");
              }}
            >
              <Ionicons name="settings-outline" size={20} color={darkMode ? "#E0E0E0" : "#000"} />
              <Text style={[styles.menuText, { color: darkMode ? "#E0E0E0" : "#000" }]}>Paramètres</Text>
            </TouchableOpacity>

          </View>
        </Pressable>
      )}

      {/* ================= MAIN UI ================= */}
      <Animated.View style={[styles.innerContainer, mainAnimatedStyle]}>

        <View style={styles.swiperContainer}>
          <View style={styles.stackWrap}>
            {bottomCard && (
              <SwipeableCard
                key={bottomCard.id}
                item={bottomCard}
                onSwipe={handleSwipe}
                isTop={false}
              />
            )}
            {topCard && (
              <SwipeableCard
                key={topCard.id}
                item={topCard}
                onSwipe={handleSwipe}
                isTop={true}
              />
            )}
          </View>
        </View>

        {/* ================= ACTION BUTTONS ================= */}
        <View style={styles.globalActions}>
          <TouchableOpacity onPress={swipeLeft} activeOpacity={0.85} style={styles.cardActionBtn}>
            <View style={styles.btnNopeContainer}>
              <View style={styles.btnNopeBackground}>
                <BlurView intensity={50} tint="light" style={StyleSheet.absoluteFill} />
              </View>
              <View style={styles.btnNope}>
                <Ionicons name="close" size={40} color="white" />
              </View>
            </View>
          </TouchableOpacity>

          <TouchableOpacity onPress={swipeTop} activeOpacity={0.85} style={styles.cardActionBtn}>
            <LinearGradient
              colors={["#00BBFF", "#007099"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.btnSuper}
            >
              <Ionicons name="star" size={20} color="#fff" />
            </LinearGradient>
          </TouchableOpacity>

          <TouchableOpacity onPress={swipeRight} activeOpacity={0.85} style={styles.cardActionBtn}>
            <View style={styles.btnLike}>
              <Ionicons name="heart" size={30} color="white" />
            </View>
          </TouchableOpacity>
        </View>

      </Animated.View>
    </SafeAreaView>
  );
}

/* ---------- styles ---------- */
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#121212" },
  innerContainer: { flex: 1, paddingHorizontal: 12, paddingBottom: 12 },
  loadingContent: { flex: 1, justifyContent: "center", alignItems: "center", zIndex: 10 },
  loadingText: { color: "#555", fontSize: 16, fontWeight: "600", letterSpacing: 0.5 },
  emptyContainer: { flex: 1, justifyContent: "center", alignItems: "center" },
  emptyText: { color: "rgba(0,0,0,0.5)", fontSize: 16, marginTop: 12 },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 8,
    marginBottom: 4,
    zIndex: 20
  },
  headerBtn: { padding: 4 },

  swiperContainer: {
    flex: 1,
    marginTop: 4,
    marginBottom: 8,
    alignItems: "center",
    justifyContent: "center"
  },
  stackWrap: {
    width: RESPONSIVE.cardWidth,
    height: RESPONSIVE.cardHeight + 20,
    alignItems: "center",
    justifyContent: "center"
  },
  cardWrapper: {
    position: "absolute",
    width: RESPONSIVE.cardWidth,
    height: RESPONSIVE.cardHeight,
    borderRadius: RESPONSIVE.cardRadius,
    overflow: "hidden",
    backgroundColor: "#0a0a0a",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 4,
  },
  card: { flex: 1, backgroundColor: "#0a0a0a" },

  mediaContainer: { flex: 1, backgroundColor: "#000" },
  media: { width: "100%", height: "100%" },
  mediaError: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#1a1a1a"
  },
  errorText: { color: "rgba(255,255,255,0.5)", fontSize: 14, marginTop: 12 },

  globalActions: {
    flexDirection: "row",
    justifyContent: "space-evenly",
    alignItems: "center",
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginTop: 4
  },
  cardActionBtn: {
    width: SCREEN_WIDTH * 0.22,
    maxWidth: 70,
    height: 70,
    borderRadius: 100,
    justifyContent: "center",
    alignItems: "center"
  },
  btnNopeBackground: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "red",
    borderRadius: 100,
    overflow: "hidden",
    justifyContent: "center",
    alignItems: "center",
  },
  btnNopeContainer: {
    justifyContent: "center",
    alignItems: "center",
    width: "120%",
    height: "120%"
  },
  btnNope: {
    justifyContent: "center",
    alignItems: "center",
    width: "100%",
    height: "100%",
  },
  btnSuper: {
    width: 60,
    height: 60,
    borderRadius: 100,
    backgroundColor: "#00B8E6",
    justifyContent: "center",
    alignItems: "center"
  },
  btnLike: {
    width: "120%",
    height: "120%",
    borderRadius: 100,
    backgroundColor: "green",
    justifyContent: "center",
    alignItems: "center"
  },

  // Overlays centrés
  overlayCenter: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: "center",
    alignItems: "center",
    zIndex: 15,
  },
  overlayCircle: {
    width: 120,
    height: 120,
    borderRadius: 60,
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },

  // ==================== Dropdown Menu Styles ====================
  menuOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.2)",
    zIndex: 30,
    justifyContent: "flex-start",
    alignItems: "flex-start",
  },

  menuPanel: {
    marginTop: 120,
    marginLeft: 12,
    backgroundColor: "#fff",
    borderRadius: 12,
    paddingVertical: 8,
    paddingHorizontal: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 8,
    minWidth: 150,
  },

  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    paddingHorizontal: 12,
  },

  menuText: {
    marginLeft: 8,
    fontSize: 16,
    color: "#000",
    fontWeight: "500",
  },
})