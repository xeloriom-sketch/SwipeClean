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
  useColorScheme,
  InteractionManager,
} from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import * as MediaLibrary from "expo-media-library";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Ionicons } from "@expo/vector-icons";
import Svg, { Path } from "react-native-svg";
import { SafeAreaView } from "react-native-safe-area-context";
import { BlurView } from "expo-blur";
import { Image } from "expo-image";
import { Audio } from "expo-av";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  runOnJS,
  interpolate,
  Extrapolate,
  SharedValue,
} from "react-native-reanimated";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import * as Haptics from "expo-haptics";
import AppLoader from "../../../components/AppLoader";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");
const BTN_SIZE = Math.min(Math.round(SCREEN_WIDTH * 0.16), 66);
const BTN_ICON = Math.round(BTN_SIZE * 0.52);

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
    <Path fillRule="evenodd" clipRule="evenodd" d="M10.3999 13.2417C10.4225 13.0378 10.5195 12.8493 10.6723 12.7125C10.8252 12.5756 11.0231 12.5 11.2283 12.5H28.7716C28.9768 12.5 29.1747 12.5756 29.3275 12.7125C29.4804 12.8493 29.5774 13.0378 29.5999 13.2417L29.9333 16.2433C30.5351 21.655 30.5351 27.1167 29.9333 32.5283L29.8999 32.8233C29.7942 33.7816 29.3719 34.6771 28.7 35.3684C28.028 36.0597 27.1448 36.5071 26.1899 36.64C22.0833 37.2147 17.9166 37.2147 13.8099 36.64C12.8548 36.5075 11.9711 36.0602 11.2989 35.3689C10.6266 34.6776 10.2041 33.7818 10.0983 32.8233L10.0649 32.5283C9.46322 27.1172 9.46322 21.6561 10.0649 16.245L10.3999 13.2417ZM24.2166 20.7833C24.4507 21.0177 24.5822 21.3354 24.5822 21.6667C24.5822 21.9979 24.4507 22.3156 24.2166 22.55L21.7666 25L24.2166 27.45C24.3394 27.5644 24.4379 27.7024 24.5062 27.8558C24.5746 28.0091 24.6113 28.1746 24.6113 28.3425C24.6172 28.5103 24.5863 28.677 24.5235 28.8327C24.4606 28.9883 24.367 29.1297 24.2483 29.2484C24.1296 29.3671 23.9883 29.4607 23.8326 29.5235C23.677 29.5864 23.5102 29.6173 23.3424 29.6143C23.1746 29.6114 23.009 29.5746 22.8557 29.5063C22.7024 29.438 22.5644 29.3395 22.4499 29.2167L19.9999 26.7667L17.5499 29.2167C17.4355 29.3395 17.2975 29.438 17.1442 29.5063C16.9908 29.5746 16.8253 29.6114 16.6575 29.6143C16.4896 29.6173 16.3229 29.5864 16.1673 29.5235C16.0116 29.4607 15.8702 29.3671 15.7515 29.2484C15.6328 29.1297 15.5393 28.9883 15.4764 28.8327C15.4135 28.677 15.3827 28.5103 15.3856 28.3425C15.3827 28.1746 15.4253 28.0091 15.4936 27.8558C15.562 27.7024 15.6605 27.5644 15.7833 27.45L18.2333 25L15.7833 22.55C15.6605 22.4356 15.562 22.2976 15.4936 22.1442C15.4253 21.9909 15.3886 21.8254 15.3856 21.6575C15.3827 21.4897 15.4135 21.323 15.4764 21.1673C15.5393 21.0117 15.6328 20.8703 15.7515 20.7516C15.8702 20.6329 16.0116 20.5393 16.1673 20.4765C16.3229 20.4136 16.4896 20.3827 16.6575 20.3857C16.8253 20.3886 16.9908 20.4254 17.1442 20.4937C17.2975 20.562 17.4355 20.6605 17.5499 20.7833L19.9999 23.2333L22.4499 20.7833C22.6843 20.5492 23.002 20.4178 23.3333 20.4178C23.6645 20.4178 23.9822 20.5492 24.2166 20.7833Z" fill={darkMode ? "#E0E0E0" : "#000"} />
  </Svg>
);

/* ---------- Sound engine ---------- */
const soundSources = {
  delete: require("../../../assets/sounds/swipe-delete.wav"),
  keep:   require("../../../assets/sounds/swipe-keep.wav"),
  star:   require("../../../assets/sounds/swipe-star.wav"),
};

const preloadedSounds: Partial<Record<"delete" | "keep" | "star", Audio.Sound>> = {};

async function initSounds() {
  try {
    await Promise.all(
      (Object.keys(soundSources) as Array<"delete" | "keep" | "star">).map(async (k) => {
        const { sound } = await Audio.Sound.createAsync(soundSources[k], { volume: 0.85 });
        preloadedSounds[k] = sound;
      })
    );
  } catch {}
}

async function playSwipeSound(type: "delete" | "keep" | "star") {
  try {
    const sound = preloadedSounds[type];
    if (!sound) return;
    await sound.setPositionAsync(0);
    await sound.playAsync();
  } catch {}
}

/* ---------- MediaCard ---------- */
const MediaCard = React.memo(function MediaCard({ item }: { item: MediaItem }) {
  useEffect(() => {
    if (item.uri) Image.prefetch(item.uri);
  }, [item.uri]);

  return (
    <View style={styles.card}>
      {item.uri ? (
        <Image
          source={{ uri: item.uri }}
          style={styles.media}
          contentFit="cover"
          transition={0}
          cachePolicy="memory"
          priority="high"
        />
      ) : (
        <View style={[styles.card, styles.mediaError]}>
          <Ionicons name="alert-circle-outline" size={RESPONSIVE.iconXL} color="rgba(255,255,255,0.3)" />
        </View>
      )}
    </View>
  );
});

/* ---------- SwipeableCard ---------- */
const SwipeableCard = ({
  item,
  onSwipe,
  isTop,
  stackProgress,
}: {
  item: MediaItem;
  onSwipe: (direction: Exclude<SwipeDirection, null>) => void;
  isTop: boolean;
  stackProgress: SharedValue<number>;
}) => {
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const swipeDir = useSharedValue<SwipeDirection>(null);

  const SWIPE_THRESHOLD_X = SCREEN_WIDTH * 0.25;
  const SWIPE_THRESHOLD_Y = SCREEN_HEIGHT * 0.15;

  const cardStyle = useAnimatedStyle(() => {
    if (!isTop) {
      const s = interpolate(stackProgress.value, [0, 1], [0.95, 1.0], Extrapolate.CLAMP);
      const op = interpolate(stackProgress.value, [0, 1], [0.75, 1.0], Extrapolate.CLAMP);
      return { transform: [{ scale: s }], opacity: op, zIndex: 5 };
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
        { rotate: `${rotate}deg` },
      ],
      zIndex: 10,
      opacity: 1,
    };
  });

  const leftOverlayStyle = useAnimatedStyle(() => {
    if (!isTop) return { opacity: 0 };
    if (translateX.value < -SWIPE_THRESHOLD_X * 0.3 && Math.abs(translateY.value) < SWIPE_THRESHOLD_Y * 0.5)
      return { opacity: interpolate(translateX.value, [-SCREEN_WIDTH, -SWIPE_THRESHOLD_X * 0.3, 0], [1, 0.7, 0], Extrapolate.CLAMP) };
    return { opacity: 0 };
  });

  const rightOverlayStyle = useAnimatedStyle(() => {
    if (!isTop) return { opacity: 0 };
    if (translateX.value > SWIPE_THRESHOLD_X * 0.3 && Math.abs(translateY.value) < SWIPE_THRESHOLD_Y * 0.5)
      return { opacity: interpolate(translateX.value, [0, SWIPE_THRESHOLD_X * 0.3, SCREEN_WIDTH], [0, 0.7, 1], Extrapolate.CLAMP) };
    return { opacity: 0 };
  });

  const topOverlayStyle = useAnimatedStyle(() => {
    if (!isTop) return { opacity: 0 };
    if (translateY.value < -SWIPE_THRESHOLD_Y * 0.3 && Math.abs(translateX.value) < SWIPE_THRESHOLD_X * 0.5)
      return { opacity: interpolate(translateY.value, [-SCREEN_HEIGHT, -SWIPE_THRESHOLD_Y * 0.3, 0], [1, 0.7, 0], Extrapolate.CLAMP) };
    return { opacity: 0 };
  });

  const panGesture = Gesture.Pan()
    .enabled(isTop)
    .onUpdate((e) => {
      translateX.value = e.translationX;
      translateY.value = e.translationY;
      const dist = Math.sqrt(e.translationX ** 2 + e.translationY ** 2);
      stackProgress.value = Math.min(dist / (SCREEN_WIDTH * 0.4), 1);
      if (e.translationY < -SWIPE_THRESHOLD_Y && Math.abs(e.translationX) < SWIPE_THRESHOLD_X)
        swipeDir.value = "top";
      else if (e.translationX < -SWIPE_THRESHOLD_X) swipeDir.value = "left";
      else if (e.translationX > SWIPE_THRESHOLD_X) swipeDir.value = "right";
      else swipeDir.value = null;
    })
    .onEnd(() => {
      if (swipeDir.value === "left") {
        stackProgress.value = withTiming(1, { duration: 320 });
        translateX.value = withTiming(-SCREEN_WIDTH * 1.5, { duration: 320 }, (done) => {
          if (done) runOnJS(onSwipe)("left");
        });
      } else if (swipeDir.value === "right") {
        stackProgress.value = withTiming(1, { duration: 320 });
        translateX.value = withTiming(SCREEN_WIDTH * 1.5, { duration: 320 }, (done) => {
          if (done) runOnJS(onSwipe)("right");
        });
      } else if (swipeDir.value === "top") {
        stackProgress.value = withTiming(1, { duration: 320 });
        translateY.value = withTiming(-SCREEN_HEIGHT * 1.5, { duration: 320 }, (done) => {
          if (done) runOnJS(onSwipe)("top");
        });
      } else {
        translateX.value = withSpring(0, { damping: 18, stiffness: 260 });
        translateY.value = withSpring(0, { damping: 18, stiffness: 260 });
        stackProgress.value = withSpring(0, { damping: 18, stiffness: 260 });
        swipeDir.value = null;
      }
    });

  return (
    <GestureDetector gesture={panGesture}>
      <Animated.View style={[styles.cardWrapper, cardStyle]} renderToHardwareTextureAndroid>
        <MediaCard item={item} />
        {isTop && (
          <>
            <Animated.View style={[styles.overlayCenter, leftOverlayStyle]} pointerEvents="none">
              <View style={[styles.overlayCircle, { backgroundColor: "rgba(255, 68, 88, 0.92)" }]}>
                <Ionicons name="close" size={60} color="#FFF" />
              </View>
            </Animated.View>
            <Animated.View style={[styles.overlayCenter, rightOverlayStyle]} pointerEvents="none">
              <View style={[styles.overlayCircle, { backgroundColor: "rgba(76, 255, 94, 0.92)" }]}>
                <Ionicons name="heart" size={60} color="#FFF" />
              </View>
            </Animated.View>
            <Animated.View style={[styles.overlayCenter, topOverlayStyle]} pointerEvents="none">
              <View style={[styles.overlayCircle, { backgroundColor: "rgba(0, 180, 230, 0.92)" }]}>
                <Ionicons name="star" size={60} color="#FFF" />
              </View>
            </Animated.View>
          </>
        )}
      </Animated.View>
    </GestureDetector>
  );
};

/* ---------- Main screen ---------- */
export default function GalleryIdScreen() {
  const { id } = useLocalSearchParams();
  const CARD_INDEX_KEY = `@gallery_last_index_v2_${id}`;

  const systemScheme = useColorScheme();
  const [assets, setAssets] = useState<MediaItem[]>([]);
  const [cursor, setCursor] = useState<string | undefined>(undefined);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(true);
  const isFetching = useRef(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const trashCache = useRef<Set<string>>(new Set());
  const containerOpacity = useSharedValue(0);
  const containerScale = useSharedValue(0.98);
  const stackProgress = useSharedValue(0);
  const [menuOpen, setMenuOpen] = useState(false);
  const [darkMode, setDarkMode] = useState(systemScheme === "dark");
  const [vibrateSwipe, setVibrateSwipe] = useState(true);

  // Audio mode — preload sounds
  useEffect(() => {
    Audio.setAudioModeAsync({ playsInSilentModeIOS: true })
      .then(() => initSounds())
      .catch(() => {});
  }, []);

  // Load preferences
  useEffect(() => {
    (async () => {
      try {
        const [dm, vb] = await Promise.all([
          AsyncStorage.getItem(DARK_MODE_KEY),
          AsyncStorage.getItem(VIBRATE_KEY),
        ]);
        if (dm !== null) setDarkMode(dm === "true");
        if (vb !== null) setVibrateSwipe(vb === "true");
      } catch {}
    })();
  }, []);

  const fetchAssets = useCallback(
    async (force = false) => {
      if (isFetching.current || (!hasMore && !force)) return;
      isFetching.current = true;
      try {
        const { status } = await MediaLibrary.requestPermissionsAsync();
        if (status !== "granted") return;
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
              const uri = Platform.OS === "android" ? info.uri : info.localUri || info.uri;
              return { id: asset.id, uri: uri || null, type: "photo", createdAt: asset.creationTime, width: asset.width, height: asset.height } as MediaItem;
            } catch { return null; }
          })
        ).then((results) => {
          results.forEach((r) => r.status === "fulfilled" && r.value && items.push(r.value));
        });
        setAssets((prev) => {
          const map = new Map(prev.map((p) => [p.id, p]));
          items.forEach((it) => !map.has(it.id) && map.set(it.id, it));
          return Array.from(map.values());
        });
        setCursor(res.endCursor);
        setHasMore(res.hasNextPage);
      } catch {}
      finally { isFetching.current = false; }
    },
    [cursor, hasMore, id]
  );

  // Bootstrap
  useEffect(() => {
    (async () => {
      try {
        const trashRaw = await AsyncStorage.getItem(TRASH_KEY);
        if (trashRaw) (JSON.parse(trashRaw) as MediaItem[]).forEach((t) => trashCache.current.add(t.id));
        const saved = await AsyncStorage.getItem(CARD_INDEX_KEY);
        if (saved) setCurrentIndex(Number(saved));
        await fetchAssets();
      } catch {}
      finally {
        setLoading(false);
        containerOpacity.value = withTiming(1, { duration: 500 });
        containerScale.value = withSpring(1, { damping: 15 });
      }
    })();
  }, []);

  // Preload
  useEffect(() => {
    if ((assets.length - currentIndex <= PRELOAD_THRESHOLD || currentIndex >= assets.length) && hasMore) {
      fetchAssets();
    }
  }, [assets.length, currentIndex, hasMore, fetchAssets]);

  const persistIndex = useCallback(async (idx: number) => {
    try { await AsyncStorage.setItem(CARD_INDEX_KEY, String(idx)); } catch {}
  }, [CARD_INDEX_KEY]);

  const addToTrash = useCallback(async (item: MediaItem) => {
    try {
      const raw = await AsyncStorage.getItem(TRASH_KEY);
      const arr: MediaItem[] = raw ? JSON.parse(raw) : [];
      await AsyncStorage.setItem(TRASH_KEY, JSON.stringify([item, ...arr].slice(0, 1000)));
    } catch {}
  }, []);

  const addToFavorites = useCallback(async (item: MediaItem) => {
    try {
      const raw = await AsyncStorage.getItem(FAVORITES_KEY);
      const arr: MediaItem[] = raw ? JSON.parse(raw) : [];
      if (!arr.some((f) => f.id === item.id))
        await AsyncStorage.setItem(FAVORITES_KEY, JSON.stringify([item, ...arr].slice(0, 1000)));
    } catch {}
  }, []);

  const triggerHaptics = useCallback((direction: Exclude<SwipeDirection, null>) => {
    if (!vibrateSwipe) return;
    if (direction === "left") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    else if (direction === "right") { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setTimeout(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light), 90); }
    else Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }, [vibrateSwipe]);

  const handleSwipe = useCallback(async (direction: Exclude<SwipeDirection, null>) => {
    const item = assets[currentIndex];
    if (!item) return;
    triggerHaptics(direction);
    playSwipeSound(direction === "left" ? "delete" : direction === "right" ? "keep" : "star");
    if (direction === "left") { trashCache.current.add(item.id); addToTrash(item); }
    else if (direction === "top") { addToFavorites(item); }
    const newIndex = currentIndex + 1;
    setCurrentIndex(newIndex);
    persistIndex(newIndex);
    InteractionManager.runAfterInteractions(() => { stackProgress.value = 0; });
  }, [currentIndex, assets, triggerHaptics, addToTrash, addToFavorites, persistIndex]);

  const resetGallery = useCallback(async () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    await AsyncStorage.removeItem(CARD_INDEX_KEY);
    stackProgress.value = 0;
    trashCache.current.clear();
    setAssets([]);
    setCursor(undefined);
    setHasMore(true);
    setCurrentIndex(0);
  }, [CARD_INDEX_KEY]);

  const mainAnimatedStyle = useAnimatedStyle(() => ({
    opacity: containerOpacity.value,
    transform: [{ scale: containerScale.value }],
  }));

  if (loading) return <AppLoader dark={darkMode} />;

  const topCard = assets[currentIndex];
  const bottomCard = assets[currentIndex + 1];

  if (!topCard) {
    if (hasMore) return <AppLoader dark={darkMode} />;
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: darkMode ? "#121212" : "#F5F5F5" }]}>
        <View style={styles.emptyContainer}>
          <Ionicons name="checkmark-circle" size={90} color="rgba(255,255,255,0.4)" />
          <Text style={[styles.emptyText, { color: darkMode ? "#fff" : "#000", marginTop: 16 }]}>
            Tout est traité !
          </Text>
          <TouchableOpacity onPress={resetGallery} activeOpacity={0.85} style={{ marginTop: 28 }}>
            <View style={styles.resetBtn}>
              <Text style={styles.resetBtnText}>Recommencer depuis le début</Text>
            </View>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: darkMode ? "#121212" : "#F5F5F5" }]}>
      <StatusBar barStyle={darkMode ? "light-content" : "dark-content"} />

      {/* HEADER */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.headerBtn} onPress={() => router.back()}>
          <BackArrowIcon size={36} darkMode={darkMode} />
        </TouchableOpacity>

        <View style={{ position: "absolute", left: 0, right: 0, alignItems: "center" }}>
          <TouchableOpacity onPress={() => router.push("/Favorites")} style={styles.headerBtn}>
            <Ionicons name="star" size={34} color={darkMode ? "#E0E0E0" : "#000"} />
          </TouchableOpacity>
        </View>

        <View style={{ flexDirection: "row", alignItems: "center" }}>
          <TouchableOpacity style={styles.headerBtn} onPress={resetGallery}>
            <ReloadMenuIcon size={34} darkMode={darkMode} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.headerBtn} onPress={() => router.push("/Trash")}>
            <TrashXIcon size={34} darkMode={darkMode} />
          </TouchableOpacity>
        </View>
      </View>

      {/* MAIN */}
      <Animated.View style={[styles.innerContainer, mainAnimatedStyle]}>
        <View style={{ height: 8 }} />

        {/* Card stack */}
        <View style={styles.swiperContainer}>
          <View style={styles.stackWrap}>
            {bottomCard && (
              <SwipeableCard
                key={bottomCard.id}
                item={bottomCard}
                onSwipe={handleSwipe}
                isTop={false}
                stackProgress={stackProgress}
              />
            )}
            {topCard && (
              <SwipeableCard
                key={topCard.id}
                item={topCard}
                onSwipe={handleSwipe}
                isTop={true}
                stackProgress={stackProgress}
              />
            )}
          </View>
        </View>

        {/* ACTION BUTTONS */}
        <View style={styles.globalActions}>
          <TouchableOpacity
            onPress={() => handleSwipe("left")}
            activeOpacity={0.7}
            style={[styles.actionBtn, styles.actionBtnDelete]}
          >
            <Ionicons name="close" size={BTN_ICON} color="#FF4458" />
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => handleSwipe("top")}
            activeOpacity={0.7}
            style={[styles.actionBtn, styles.actionBtnStar]}
          >
            <Ionicons name="star" size={BTN_ICON - 6} color="#00C9FF" />
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => handleSwipe("right")}
            activeOpacity={0.7}
            style={[styles.actionBtn, styles.actionBtnKeep]}
          >
            <Ionicons name="heart" size={BTN_ICON - 4} color="#4CFF5E" />
          </TouchableOpacity>
        </View>
      </Animated.View>
    </SafeAreaView>
  );
}

/* ---------- Styles ---------- */
const styles = StyleSheet.create({
  container: { flex: 1 },
  innerContainer: { flex: 1, paddingHorizontal: 12, paddingBottom: 12 },

  emptyContainer: { flex: 1, justifyContent: "center", alignItems: "center", paddingHorizontal: 32 },
  emptyText: { fontSize: 20, fontWeight: "700", textAlign: "center" },
  resetBtn: {
    paddingHorizontal: 28,
    paddingVertical: 14,
    borderRadius: 30,
    backgroundColor: "#1a1a1a",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.2)",
  },
  resetBtnText: { color: "#fff", fontSize: 16, fontWeight: "700" },

  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 8,
    marginBottom: 4,
    zIndex: 20,
  },
  headerBtn: { padding: 4 },

  swiperContainer: { flex: 1, marginTop: 4, marginBottom: 8, alignItems: "center", justifyContent: "center" },
  stackWrap: { width: RESPONSIVE.cardWidth, height: RESPONSIVE.cardHeight + 20, alignItems: "center", justifyContent: "center" },
  cardWrapper: {
    position: "absolute",
    width: RESPONSIVE.cardWidth,
    height: RESPONSIVE.cardHeight,
    borderRadius: RESPONSIVE.cardRadius,
    overflow: "hidden",
    backgroundColor: "#0a0a0a",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.18,
    shadowRadius: 12,
    elevation: 6,
  },
  card: { flex: 1, backgroundColor: "#0a0a0a" },
  media: { width: "100%", height: "100%" },
  mediaError: { justifyContent: "center", alignItems: "center", backgroundColor: "#1a1a1a" },

  globalActions: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: Math.round(SCREEN_WIDTH * 0.08),
    paddingVertical: Platform.OS === "ios" ? 12 : 8,
    paddingHorizontal: 16,
    marginTop: 4,
  },
  actionBtn: {
    width: BTN_SIZE,
    height: BTN_SIZE,
    borderRadius: BTN_SIZE / 2,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1.5,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
    backgroundColor: "rgba(10,10,10,0.82)",
  },
  actionBtnDelete: { borderColor: "#FF4458", backgroundColor: "rgba(255,68,88,0.15)" },
  actionBtnStar: { borderColor: "#00C9FF", backgroundColor: "rgba(0,201,255,0.12)", width: Math.round(BTN_SIZE * 0.82), height: Math.round(BTN_SIZE * 0.82), borderRadius: Math.round(BTN_SIZE * 0.41) },
  actionBtnKeep: { borderColor: "#4CFF5E", backgroundColor: "rgba(76,255,94,0.12)" },

  overlayCenter: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, justifyContent: "center", alignItems: "center", zIndex: 15 },
  overlayCircle: { width: 120, height: 120, borderRadius: 60, justifyContent: "center", alignItems: "center", shadowColor: "#000", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 8 },
});
