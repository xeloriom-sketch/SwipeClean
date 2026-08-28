// app/(tabs)/index.tsx
import React, { useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from "react";
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
  Alert,
  Linking,
} from "react-native";
import { router, useFocusEffect } from "expo-router";
import * as MediaLibrary from "expo-media-library";
import * as FileSystem from "expo-file-system";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Ionicons } from "@expo/vector-icons";
import Svg, { Path } from "react-native-svg";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { BlurView } from "expo-blur";
import { Image } from "expo-image";
import { Audio } from "expo-av";
import * as Notifications from "expo-notifications";
import AppLoader from "../../components/AppLoader";
import { checkSwipeMilestones, checkAndUnlock, checkNightSwipe, checkFavMilestones, type Achievement } from "../../utils/achievements";
import { devLog } from "../../utils/devLogger";

// react-native-video requires a native build — not available in Expo Go
let VideoPlayer: React.ComponentType<any> | null = null;
let ResizeMode: { COVER: string } = { COVER: "cover" };
try {
  const rnv = require("react-native-video");
  if (rnv && rnv.default) {
    VideoPlayer = rnv.default;
    ResizeMode = rnv.ResizeMode ?? { COVER: "cover" };
    devLog("Video", "VideoPlayer chargé OK", "info");
  } else {
    devLog("Video", "require OK mais rnv.default est null", "warn");
  }
} catch (e: any) {
  devLog("Video", `require react-native-video FAILED: ${e?.message ?? e}`, "error");
}

class VideoErrorBoundary extends React.Component<
  { fallback: React.ReactNode; children: React.ReactNode; uri?: string },
  { hasError: boolean }
> {
  state = { hasError: false };
  static getDerivedStateFromError(e: any) {
    devLog("Video", `VideoErrorBoundary: ${e?.message ?? e}`, "error");
    return { hasError: true };
  }
  render() {
    return this.state.hasError ? this.props.fallback : this.props.children;
  }
}
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  withDelay,
  withSequence,
  runOnJS,
  interpolate,
  Extrapolate,
  SharedValue,
  Easing,
} from "react-native-reanimated";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import * as Haptics from "expo-haptics";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");
const BTN_SIZE = Math.min(Math.round(SCREEN_WIDTH * 0.16), 66);
const BTN_ICON = Math.round(BTN_SIZE * 0.52);

const REVIEW_PROMPTED_KEY = "@app_review_prompted";
const TRASH_KEY = "@app_trash";
const FAVORITES_KEY = "@app_favorites";
const KEPT_KEY = "@app_kept";
const CARD_INDEX_KEY = "@gallery_last_index_v2";
const DARK_MODE_KEY = "@app_dark_mode";
const VIBRATE_KEY = "@app_vibrate_swipe";
const ONBOARDED_KEY = "@app_onboarded";
const SORT_KEY = "@app_sort_order";
const SOUND_KEY = "@app_sound";
const AUTO_DARK_KEY = "@app_dark_auto";
const AUTO_TRASH_DAYS_KEY = "@app_auto_trash_days";
const BATCH_SIZE = 60;
const PRELOAD_THRESHOLD = 10;
const SPLASH_MIN_MS = 0;

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
  type: "photo" | "video";
  createdAt: number;
  width?: number;
  height?: number;
  duration?: number;
  fileSize?: number;
};

type SwipeDirection = "left" | "right" | "top" | "bottom" | null;
type SwipeableCardRef = { triggerSwipe: (direction: Exclude<SwipeDirection, null>) => void };

/* ---- SVG Icons ---- */
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
    <Path
      d="M15.4167 5C15.4167 4.66848 15.5484 4.35054 15.7828 4.11612C16.0172 3.8817 16.3352 3.75 16.6667 3.75H23.3334C23.6649 3.75 23.9828 3.8817 24.2173 4.11612C24.4517 4.35054 24.5834 4.66848 24.5834 5V6.25H31.6667C31.9982 6.25 32.3162 6.3817 32.5506 6.61612C32.785 6.85054 32.9167 7.16848 32.9167 7.5C32.9167 7.83152 32.785 8.14946 32.5506 8.38388C32.3162 8.6183 31.9982 8.75 31.6667 8.75H8.33337C8.00185 8.75 7.68391 8.6183 7.44949 8.38388C7.21507 8.14946 7.08337 7.83152 7.08337 7.5C7.08337 7.16848 7.21507 6.85054 7.44949 6.61612C7.68391 6.3817 8.00185 6.25 8.33337 6.25H15.4167V5Z"
      fill={darkMode ? "#fff" : "#000"}
    />
    <Path
      fillRule="evenodd"
      clipRule="evenodd"
      d="M10.3999 13.2417C10.4225 13.0378 10.5195 12.8493 10.6723 12.7125C10.8252 12.5756 11.0231 12.5 11.2283 12.5H28.7716C28.9768 12.5 29.1747 12.5756 29.3275 12.7125C29.4804 12.8493 29.5774 13.0378 29.5999 13.2417L29.9333 16.2433C30.5351 21.655 30.5351 27.1167 29.9333 32.5283L29.8999 32.8233C29.7942 33.7816 29.3719 34.6771 28.7 35.3684C28.028 36.0597 27.1448 36.5071 26.1899 36.64C22.0833 37.2147 17.9166 37.2147 13.8099 36.64C12.8548 36.5075 11.9711 36.0602 11.2989 35.3689C10.6266 34.6776 10.2041 33.7818 10.0983 32.8233L10.0649 32.5283C9.46322 27.1172 9.46322 21.6561 10.0649 16.245L10.3999 13.2417ZM24.2166 20.7833C24.4507 21.0177 24.5822 21.3354 24.5822 21.6667C24.5822 21.9979 24.4507 22.3156 24.2166 22.55L21.7666 25L24.2166 27.45C24.4507 27.6844 24.5822 28.0021 24.5822 28.3333C24.5822 28.6646 24.4507 28.9823 24.2166 29.2167C23.9822 29.4508 23.6645 29.5822 23.3333 29.5822C23.002 29.5822 22.6843 29.4508 22.4499 29.2167L19.9999 26.7667L17.5499 29.2167C17.3155 29.4508 16.9978 29.5822 16.6666 29.5822C16.3353 29.5822 16.0176 29.4508 15.7833 29.2167C15.5492 28.9823 15.4177 28.6646 15.4177 28.3333C15.4177 28.0021 15.5492 27.6844 15.7833 27.45L18.2333 25L15.7833 22.55C15.5492 22.3156 15.4177 21.9979 15.4177 21.6667C15.4177 21.3354 15.5492 21.0177 15.7833 20.7833C16.0176 20.5492 16.3353 20.4178 16.6666 20.4178C16.9978 20.4178 17.3155 20.5492 17.5499 20.7833L19.9999 23.2333L22.4499 20.7833C22.6843 20.5492 23.002 20.4178 23.3333 20.4178C23.6645 20.4178 23.9822 20.5492 24.2166 20.7833Z"
      fill={darkMode ? "#E0E0E0" : "#000"}
    />
  </Svg>
);


const logger = {
  info: (msg: string, data?: any) => __DEV__ && console.log(`ℹ️ ${msg}`, data ?? ""),
  error: (msg: string, err?: any) => console.error(`❌ ${msg}`, err ?? ""),
};

const formatDuration = (seconds: number): string => {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
};

const FancyLoader = ({ dark }: { dark: boolean }) => <AppLoader dark={dark} />;

/* ---- MediaCard ---- */
const MediaCard = React.memo(function MediaCard({
  item,
  isTop,
  imageScale,
  imagePanX,
  imagePanY,
}: {
  item: MediaItem;
  isTop: boolean;
  imageScale: SharedValue<number>;
  imagePanX: SharedValue<number>;
  imagePanY: SharedValue<number>;
}) {
  const [isMuted, setIsMuted] = useState(true);

  const zoomStyle = useAnimatedStyle(() => ({
    transform: [
      { scale: imageScale.value },
      { translateX: imagePanX.value },
      { translateY: imagePanY.value },
    ],
  }));

  useEffect(() => {
    setIsMuted(true);
  }, [item.id]);

  if (!item.uri) {
    return (
      <View style={[styles.card, styles.mediaError]}>
        <Ionicons
          name="alert-circle-outline"
          size={RESPONSIVE.iconXL}
          color="rgba(255,255,255,0.3)"
        />
        <Text style={styles.errorText}>Média non disponible</Text>
      </View>
    );
  }

  if (item.type === "video") {
    devLog("Video", `Rendu vidéo id=${item.id} uri=${item.uri?.slice(0, 60)} player=${VideoPlayer ? "OK" : "NULL"}`, VideoPlayer ? "info" : "warn");
    return (
      <View style={styles.card}>
        {VideoPlayer ? (
          <VideoErrorBoundary
            uri={item.uri ?? undefined}
            fallback={
              <View style={[styles.media, { backgroundColor: "#111", justifyContent: "center", alignItems: "center" }]}>
                <Ionicons name="play-circle-outline" size={64} color="rgba(255,255,255,0.4)" />
                <Text style={{ color: "rgba(255,255,255,0.4)", marginTop: 8, fontSize: 13 }}>Vidéo</Text>
              </View>
            }
          >
            <VideoPlayer
              source={{ uri: item.uri }}
              style={styles.media}
              resizeMode={ResizeMode.COVER}
              repeat
              muted={isMuted}
              paused={!isTop}
            />
          </VideoErrorBoundary>
        ) : (
          <View style={[styles.media, { backgroundColor: "#111", justifyContent: "center", alignItems: "center" }]}>
            <Ionicons name="play-circle-outline" size={64} color="rgba(255,255,255,0.4)" />
            <Text style={{ color: "rgba(255,255,255,0.4)", marginTop: 8, fontSize: 13 }}>Vidéo</Text>
          </View>
        )}
        {item.duration != null && (
          <View style={styles.videoBadge}>
            <Ionicons name="videocam" size={11} color="#fff" />
            <Text style={styles.videoBadgeText}>
              {formatDuration(item.duration)}
            </Text>
          </View>
        )}
        {isTop && (
          <TouchableOpacity
            style={styles.muteBtn}
            onPress={() => setIsMuted((m) => !m)}
            activeOpacity={0.8}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          >
            <BlurView
              intensity={50}
              tint="dark"
              style={StyleSheet.absoluteFill}
            />
            <Ionicons
              name={isMuted ? "volume-mute" : "volume-high"}
              size={16}
              color="#fff"
            />
          </TouchableOpacity>
        )}
      </View>
    );
  }

  const dateStr = new Date(item.createdAt).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" });
  const dimsStr = item.width && item.height ? `${item.width}×${item.height}` : "";
  const sizeStr = item.fileSize ? `${(item.fileSize / 1_048_576).toFixed(1)} Mo` : "";

  return (
    <View style={styles.card}>
      <Animated.View style={[StyleSheet.absoluteFill, zoomStyle]}>
        <Image
          source={{ uri: item.uri }}
          style={styles.media}
          contentFit="cover"
          transition={isTop ? 0 : 180}
          cachePolicy="memory-disk"
          priority="high"
          recyclingKey={item.id}
        />
      </Animated.View>
      <LinearGradient
        colors={["transparent", "rgba(0,0,0,0.55)"]}
        style={styles.photoInfoGradient}
        pointerEvents="none"
      >
        <Text style={styles.photoInfoDate}>{dateStr}</Text>
        <Text style={styles.photoInfoSub}>
          {[dimsStr, sizeStr].filter(Boolean).join("  ·  ")}
        </Text>
      </LinearGradient>
    </View>
  );
});

/* ---- SwipeableCard ---- */
const SwipeableCard = React.forwardRef<SwipeableCardRef, {
  item: MediaItem;
  onSwipe: (direction: Exclude<SwipeDirection, null>) => void;
  isTop: boolean;
  stackProgress: SharedValue<number>;
}>(function SwipeableCard({ item, onSwipe, isTop, stackProgress }, ref) {
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const swipeDir = useSharedValue<SwipeDirection>(null);
  const imageScale = useSharedValue(1);
  const imagePanX = useSharedValue(0);
  const imagePanY = useSharedValue(0);
  const isZoomedIn = useSharedValue(false);
  const savedScale = useSharedValue(1);
  const mountProgress = useSharedValue(0);

  useEffect(() => {
    if (isTop) {
      mountProgress.value = 1;
    } else {
      mountProgress.value = withSpring(1, { damping: 32, stiffness: 80, mass: 1.2 });
    }
  }, []);

  const SWIPE_THRESHOLD_X = SCREEN_WIDTH * 0.25;
  const SWIPE_THRESHOLD_Y = SCREEN_HEIGHT * 0.15;

  const cardStyle = useAnimatedStyle(() => {
    if (!isTop) {
      const s = interpolate(stackProgress.value, [0, 1], [0.95, 1.0], Extrapolate.CLAMP);
      const mp = mountProgress.value;
      return {
        transform: [
          { translateY: 30 * (1 - mp) },
          { scale: s * (0.87 + 0.13 * mp) },
        ],
        opacity: mp * 0.82,
        zIndex: 5,
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
        { rotate: `${rotate}deg` },
        { scale: 0.94 + 0.06 * mountProgress.value },
      ],
      zIndex: 10,
      opacity: 1,
    };
  });

  const leftOverlayStyle = useAnimatedStyle(() => {
    if (!isTop) return { opacity: 0 };
    if (
      translateX.value < -SWIPE_THRESHOLD_X * 0.3 &&
      Math.abs(translateY.value) < SWIPE_THRESHOLD_Y * 0.5
    ) {
      return {
        opacity: interpolate(
          translateX.value,
          [-SCREEN_WIDTH, -SWIPE_THRESHOLD_X * 0.3, 0],
          [1, 0.7, 0],
          Extrapolate.CLAMP
        ),
      };
    }
    return { opacity: 0 };
  });

  const rightOverlayStyle = useAnimatedStyle(() => {
    if (!isTop) return { opacity: 0 };
    if (
      translateX.value > SWIPE_THRESHOLD_X * 0.3 &&
      Math.abs(translateY.value) < SWIPE_THRESHOLD_Y * 0.5
    ) {
      return {
        opacity: interpolate(
          translateX.value,
          [0, SWIPE_THRESHOLD_X * 0.3, SCREEN_WIDTH],
          [0, 0.7, 1],
          Extrapolate.CLAMP
        ),
      };
    }
    return { opacity: 0 };
  });

  const topOverlayStyle = useAnimatedStyle(() => {
    if (!isTop) return { opacity: 0 };
    if (
      translateY.value < -SWIPE_THRESHOLD_Y * 0.3 &&
      Math.abs(translateX.value) < SWIPE_THRESHOLD_X * 0.5
    ) {
      return {
        opacity: interpolate(
          translateY.value,
          [-SCREEN_HEIGHT, -SWIPE_THRESHOLD_Y * 0.3, 0],
          [1, 0.7, 0],
          Extrapolate.CLAMP
        ),
      };
    }
    return { opacity: 0 };
  });

  const bottomOverlayStyle = useAnimatedStyle(() => {
    if (!isTop) return { opacity: 0 };
    if (
      translateY.value > SWIPE_THRESHOLD_Y * 0.3 &&
      Math.abs(translateX.value) < SWIPE_THRESHOLD_X * 0.5
    ) {
      return {
        opacity: interpolate(
          translateY.value,
          [0, SWIPE_THRESHOLD_Y * 0.3, SCREEN_HEIGHT],
          [0, 0.7, 1],
          Extrapolate.CLAMP
        ),
      };
    }
    return { opacity: 0 };
  });

  const pinchGesture = Gesture.Pinch()
    .onUpdate((e) => {
      const next = Math.min(Math.max(savedScale.value * e.scale, 1), 4);
      imageScale.value = next;
      isZoomedIn.value = next > 1.05;
    })
    .onEnd(() => {
      if (imageScale.value < 1.15) {
        imageScale.value = withSpring(1, { damping: 15 });
        imagePanX.value = withSpring(0, { damping: 15 });
        imagePanY.value = withSpring(0, { damping: 15 });
        savedScale.value = 1;
        isZoomedIn.value = false;
      } else {
        savedScale.value = imageScale.value;
      }
    });

  const panGesture = Gesture.Pan()
    .enabled(isTop)
    .onUpdate((e) => {
      if (isZoomedIn.value) {
        imagePanX.value = e.translationX / Math.max(imageScale.value, 1);
        imagePanY.value = e.translationY / Math.max(imageScale.value, 1);
        return;
      }
      translateX.value = e.translationX;
      translateY.value = e.translationY;

      const dist = Math.sqrt(e.translationX ** 2 + e.translationY ** 2);
      stackProgress.value = Math.min(dist / (SCREEN_WIDTH * 0.4), 1);

      if (
        e.translationY < -SWIPE_THRESHOLD_Y &&
        Math.abs(e.translationX) < SWIPE_THRESHOLD_X
      ) {
        swipeDir.value = "top";
      } else if (
        e.translationY > SWIPE_THRESHOLD_Y &&
        Math.abs(e.translationX) < SWIPE_THRESHOLD_X
      ) {
        swipeDir.value = "bottom";
      } else if (e.translationX < -SWIPE_THRESHOLD_X) {
        swipeDir.value = "left";
      } else if (e.translationX > SWIPE_THRESHOLD_X) {
        swipeDir.value = "right";
      } else {
        swipeDir.value = null;
      }
    })
    .onEnd(() => {
      if (isZoomedIn.value) {
        imagePanX.value = withSpring(imagePanX.value, { damping: 18 });
        imagePanY.value = withSpring(imagePanY.value, { damping: 18 });
        return;
      }
      const FLYOFF = { duration: 400, easing: Easing.in(Easing.quad) } as const;
      if (swipeDir.value === "left") {
        stackProgress.value = withTiming(1, { duration: 400 });
        translateX.value = withTiming(-SCREEN_WIDTH * 1.5, FLYOFF, (done) => {
          if (done) {
            runOnJS(onSwipe)("left");
            stackProgress.value = withDelay(60, withTiming(0, { duration: 1 }));
          }
        });
      } else if (swipeDir.value === "right") {
        stackProgress.value = withTiming(1, { duration: 400 });
        translateX.value = withTiming(SCREEN_WIDTH * 1.5, FLYOFF, (done) => {
          if (done) {
            runOnJS(onSwipe)("right");
            stackProgress.value = withDelay(60, withTiming(0, { duration: 1 }));
          }
        });
      } else if (swipeDir.value === "top") {
        stackProgress.value = withTiming(1, { duration: 400 });
        translateY.value = withTiming(-SCREEN_HEIGHT * 1.5, FLYOFF, (done) => {
          if (done) {
            runOnJS(onSwipe)("top");
            stackProgress.value = withDelay(60, withTiming(0, { duration: 1 }));
          }
        });
      } else if (swipeDir.value === "bottom") {
        stackProgress.value = withTiming(1, { duration: 380 });
        translateY.value = withTiming(SCREEN_HEIGHT * 1.5, { duration: 380, easing: Easing.in(Easing.quad) }, (done) => {
          if (done) {
            runOnJS(onSwipe)("bottom");
            stackProgress.value = withDelay(60, withTiming(0, { duration: 1 }));
          }
        });
      } else {
        translateX.value = withSpring(0, { damping: 26, stiffness: 140 });
        translateY.value = withSpring(0, { damping: 26, stiffness: 140 });
        stackProgress.value = withSpring(0, { damping: 26, stiffness: 140 });
        swipeDir.value = null;
      }
    });

  const combinedGesture = Gesture.Simultaneous(panGesture, pinchGesture);

  useImperativeHandle(ref, () => ({
    triggerSwipe: (direction) => {
      const FLYOFF = { duration: 400, easing: Easing.in(Easing.quad) } as const;
      if (direction === "left") {
        stackProgress.value = withTiming(1, { duration: 400 });
        translateX.value = withTiming(-SCREEN_WIDTH * 1.5, FLYOFF, (done) => {
          if (done) {
            runOnJS(onSwipe)("left");
            stackProgress.value = withDelay(60, withTiming(0, { duration: 1 }));
          }
        });
      } else if (direction === "right") {
        stackProgress.value = withTiming(1, { duration: 400 });
        translateX.value = withTiming(SCREEN_WIDTH * 1.5, FLYOFF, (done) => {
          if (done) {
            runOnJS(onSwipe)("right");
            stackProgress.value = withDelay(60, withTiming(0, { duration: 1 }));
          }
        });
      } else if (direction === "top") {
        stackProgress.value = withTiming(1, { duration: 400 });
        translateY.value = withTiming(-SCREEN_HEIGHT * 1.5, FLYOFF, (done) => {
          if (done) {
            runOnJS(onSwipe)("top");
            stackProgress.value = withDelay(60, withTiming(0, { duration: 1 }));
          }
        });
      } else if (direction === "bottom") {
        stackProgress.value = withTiming(1, { duration: 380 });
        translateY.value = withTiming(SCREEN_HEIGHT * 1.5, { duration: 380, easing: Easing.in(Easing.quad) }, (done) => {
          if (done) {
            runOnJS(onSwipe)("bottom");
            stackProgress.value = withDelay(60, withTiming(0, { duration: 1 }));
          }
        });
      }
    },
  }));

  return (
    <GestureDetector gesture={combinedGesture}>
      <Animated.View
        style={[styles.cardWrapper, cardStyle]}
        renderToHardwareTextureAndroid
      >
        <MediaCard item={item} isTop={isTop} imageScale={imageScale} imagePanX={imagePanX} imagePanY={imagePanY} />
        {isTop && (
          <>
            <Animated.View
              style={[styles.overlayCenter, leftOverlayStyle]}
              pointerEvents="none"
            >
              <View
                style={[
                  styles.overlayCircle,
                  { backgroundColor: "rgba(255, 68, 88, 0.92)" },
                ]}
              >
                <Ionicons name="close" size={60} color="#FFF" />
              </View>
            </Animated.View>
            <Animated.View
              style={[styles.overlayCenter, rightOverlayStyle]}
              pointerEvents="none"
            >
              <View
                style={[
                  styles.overlayCircle,
                  { backgroundColor: "rgba(76, 255, 94, 0.92)" },
                ]}
              >
                <Ionicons name="heart" size={60} color="#FFF" />
              </View>
            </Animated.View>
            <Animated.View
              style={[styles.overlayCenter, topOverlayStyle]}
              pointerEvents="none"
            >
              <View style={[styles.overlayCircle, { backgroundColor: "rgba(0, 180, 230, 0.92)" }]}>
                <Ionicons name="star" size={60} color="#FFF" />
              </View>
            </Animated.View>
            <Animated.View
              style={[styles.overlayCenter, bottomOverlayStyle]}
              pointerEvents="none"
            >
              <View style={[styles.overlayCircle, { backgroundColor: "rgba(110, 110, 120, 0.92)" }]}>
                <Ionicons name="play-skip-forward" size={52} color="#FFF" />
              </View>
            </Animated.View>
          </>
        )}
      </Animated.View>
    </GestureDetector>
  );
});

/* ---- Sound engine ---- */
const soundSources = {
  delete: require("../../assets/sounds/swipe-delete.wav"),
  keep: require("../../assets/sounds/swipe-keep.wav"),
  star: require("../../assets/sounds/swipe-star.wav"),
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

/* ---- Animated action button ---- */
const AnimatedActionBtn = React.memo(function AnimatedActionBtn({
  onPress,
  btnStyle,
  iconName,
  iconSize,
  iconColor,
}: {
  onPress: () => void;
  btnStyle: object | object[];
  iconName: string;
  iconSize: number;
  iconColor: string;
}) {
  const sc = useSharedValue(1);
  const animStyle = useAnimatedStyle(() => ({ transform: [{ scale: sc.value }] }));
  return (
    <Animated.View style={[btnStyle, animStyle]}>
      <TouchableOpacity
        onPress={onPress}
        onPressIn={() => { sc.value = withSpring(0.88, { damping: 18, stiffness: 300 }); }}
        onPressOut={() => { sc.value = withSpring(1, { damping: 22, stiffness: 200 }); }}
        activeOpacity={1}
        style={{ flex: 1, justifyContent: "center", alignItems: "center" }}
      >
        <Ionicons name={iconName as any} size={iconSize} color={iconColor} />
      </TouchableOpacity>
    </Animated.View>
  );
});

async function playSwipeSound(type: "delete" | "keep" | "star") {
  try {
    const sound = preloadedSounds[type];
    if (!sound) return;
    await sound.setPositionAsync(0);
    await sound.playAsync();
  } catch {}
}

/* ---- Confetti ---- */
const CONFETTI_COLORS = ["#FF4458","#4CFF5E","#00C9FF","#FFD60A","#FF9F0A","#BF5AF2","#FF6B6B","#4ECDC4"];

type ParticleCfg = { x: number; color: string; size: number; duration: number; delay: number; spin: number; drift: number };

const ConfettiParticle = React.memo(function ConfettiParticle({ x, color, size, duration, delay, spin, drift }: ParticleCfg) {
  const y = useSharedValue(-20);
  const rot = useSharedValue(spin);
  const op = useSharedValue(0);

  useEffect(() => {
    y.value = withDelay(delay, withTiming(SCREEN_HEIGHT + 60, { duration }));
    rot.value = withDelay(delay, withTiming(spin + 720, { duration }));
    op.value = withDelay(delay, withSequence(
      withTiming(1, { duration: 80 }),
      withTiming(1, { duration: duration - 160 }),
      withTiming(0, { duration: 80 })
    ));
  }, []);

  const style = useAnimatedStyle(() => ({
    transform: [
      { translateX: x + drift * (y.value / SCREEN_HEIGHT) },
      { translateY: y.value },
      { rotate: `${rot.value}deg` },
    ],
    opacity: op.value,
  }));

  return (
    <Animated.View
      style={[{ position: "absolute", top: 0, left: 0, width: size, height: size * 0.55, backgroundColor: color, borderRadius: 2 }, style]}
    />
  );
});

function Confetti({ active }: { active: boolean }) {
  const particles = useMemo<ParticleCfg[]>(() =>
    Array.from({ length: 40 }, () => ({
      x: Math.random() * SCREEN_WIDTH,
      color: CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)],
      size: 6 + Math.random() * 9,
      duration: 2200 + Math.random() * 2000,
      delay: Math.random() * 1600,
      spin: Math.random() * 360,
      drift: (Math.random() - 0.5) * 130,
    })),
  []);

  if (!active) return null;
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {particles.map((p, i) => <ConfettiParticle key={i} {...p} />)}
    </View>
  );
}


function fireAchievementNotif(a: Achievement) {
  Notifications.scheduleNotificationAsync({
    content: {
      title: `Succès débloqué !`,
      body: `${a.title} — ${a.desc}`,
    },
    trigger: null,
  }).catch(() => {});
}

/* ---- GalleryScreen ---- */
export default function GalleryScreen() {
  const [assets, setAssets] = useState<MediaItem[]>([]);
  const [hasMore, setHasMore] = useState(true);
  const cursorRef = useRef<string | undefined>(undefined);
  const hasMoreRef = useRef(true);
  const trashRef = useRef<Array<MediaItem & { trashedAt?: number }>>([]);
  const favoritesRef = useRef<MediaItem[]>([]);
  const [loading, setLoading] = useState(true);
  const isFetching = useRef(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const trashCache = useRef<Set<string>>(new Set());
  const keptCache = useRef<Set<string>>(new Set());
  const fetchedIds = useRef<Set<string>>(new Set());
  const persistTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const permGranted = useRef(false);
  const containerOpacity = useSharedValue(0);
  const containerScale = useSharedValue(0.98);
  const stackProgress = useSharedValue(0);
  const systemScheme = useColorScheme();
  const [menuOpen, setMenuOpen] = useState(false);
  const [darkMode, setDarkMode] = useState(systemScheme === "dark");
  const [vibrateSwipe, setVibrateSwipe] = useState(true);
  const [sortOldest, setSortOldest] = useState(false);
  const [trashCount, setTrashCount] = useState(0);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [darkAuto, setDarkAuto] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);
  const [lastSwipe, setLastSwipe] = useState<{ item: MediaItem; direction: Exclude<SwipeDirection, null> } | null>(null);
  const topCardRef = useRef<SwipeableCardRef>(null);

  // Load preferences
  useEffect(() => {
    (async () => {
      try {
        const [dm, vb, so, snd, dkAuto] = await Promise.all([
          AsyncStorage.getItem(DARK_MODE_KEY),
          AsyncStorage.getItem(VIBRATE_KEY),
          AsyncStorage.getItem(SORT_KEY),
          AsyncStorage.getItem(SOUND_KEY),
          AsyncStorage.getItem(AUTO_DARK_KEY),
        ]);
        if (dm !== null) setDarkMode(dm === "true");
        if (vb !== null) setVibrateSwipe(vb === "true");
        if (so !== null) setSortOldest(so === "oldest");
        if (snd !== null) setSoundEnabled(snd !== "false");
        if (dkAuto !== null) setDarkAuto(dkAuto === "true");
      } catch {}
    })();
  }, []);

  // Re-read sort order when returning from Settings and reset gallery instantly
  useFocusEffect(
    useCallback(() => {
      (async () => {
        try {
          const so = await AsyncStorage.getItem(SORT_KEY);
          const newVal = so === "oldest";
          if (newVal === sortOldest) return;
          setSortOldest(newVal);
          setAssets([]);
          setCurrentIndex(0);
          setHasMore(true);
          cursorRef.current = undefined;
          hasMoreRef.current = true;
          fetchedIds.current.clear();
          isFetching.current = false;
        } catch {}
      })();
    }, [sortOldest])
  );

  // Auto dark mode — sync to system scheme when enabled
  useEffect(() => {
    if (darkAuto) setDarkMode(systemScheme === "dark");
  }, [systemScheme, darkAuto]);

  // Audio mode — play sounds even when iOS silent switch is off, preload sounds
  useEffect(() => {
    Audio.setAudioModeAsync({ playsInSilentModeIOS: true })
      .then(() => initSounds())
      .catch(() => {});
    return () => {
      Object.values(preloadedSounds).forEach((s) => s?.unloadAsync().catch(() => {}));
    };
  }, []);

  // Bootstrap
  useEffect(() => {
    const t0 = Date.now();
    (async () => {
      try {
        // First launch → onboarding
        const onboarded = await AsyncStorage.getItem(ONBOARDED_KEY);
        if (!onboarded) {
          router.replace("/Onboarding");
          return;
        }

        // Auto-empty trash if configured
        const [trashRaw, autoTrashRaw, favRaw, keptRaw] = await Promise.all([
          AsyncStorage.getItem(TRASH_KEY),
          AsyncStorage.getItem(AUTO_TRASH_DAYS_KEY),
          AsyncStorage.getItem(FAVORITES_KEY),
          AsyncStorage.getItem(KEPT_KEY),
        ]);
        if (favRaw) favoritesRef.current = JSON.parse(favRaw);
        if (keptRaw) (JSON.parse(keptRaw) as string[]).forEach(id => keptCache.current.add(id));
        const autoTrashDays = autoTrashRaw ? Number(autoTrashRaw) : 0;

        if (trashRaw) {
          let trashArr = JSON.parse(trashRaw) as Array<MediaItem & { trashedAt?: number }>;

          if (autoTrashDays > 0) {
            const cutoff = Date.now() - autoTrashDays * 24 * 60 * 60 * 1000;
            const toDelete = trashArr.filter((i) => i.trashedAt && i.trashedAt < cutoff);
            if (toDelete.length > 0) {
              try {
                await MediaLibrary.deleteAssetsAsync(toDelete.map((i) => i.id));
              } catch {}
              trashArr = trashArr.filter((i) => !i.trashedAt || i.trashedAt >= cutoff);
              await AsyncStorage.setItem(TRASH_KEY, JSON.stringify(trashArr));
            }
          }

          trashArr.forEach((t) => trashCache.current.add(t.id));
          trashRef.current = trashArr;
          setTrashCount(trashArr.length);
          Notifications.setBadgeCountAsync(trashArr.length).catch(() => {});
        }
        const saved = await AsyncStorage.getItem(CARD_INDEX_KEY);
        if (saved) setCurrentIndex(Number(saved));
        await fetchAssets();
        const elapsed = Date.now() - t0;
        if (elapsed < SPLASH_MIN_MS) {
          await new Promise((r) => setTimeout(r, SPLASH_MIN_MS - elapsed));
        }
      } catch (err) {
        logger.error("init", err);
      } finally {
        setLoading(false);
        containerOpacity.value = withTiming(1, { duration: 600, easing: Easing.out(Easing.cubic) });
        containerScale.value = withSpring(1, { damping: 28, stiffness: 90, mass: 1.1 });
      }
    })();
  }, []);

  // Android only: creationTime may be in seconds (not ms), and DATE_TAKEN in
  // MediaStore is often corrupted for transferred/old files (1900, 1980…).
  // iOS always returns correct ms timestamps — do not alter them.
  const resolveMediaDate = (creationTime: number, modificationTime: number): number => {
    if (Platform.OS !== "android") return creationTime;
    const toMs = (t: number) => (t > 0 && t < 1e10 ? t * 1000 : t);
    const isPlausible = (ms: number) => new Date(ms).getFullYear() >= 2000;
    const primary = toMs(creationTime);
    if (isPlausible(primary)) return primary;
    const fallback = toMs(modificationTime);
    if (isPlausible(fallback)) return fallback;
    return Date.now();
  };

  const fetchAssets = useCallback(
    async (force = false) => {
      if (isFetching.current || (!hasMoreRef.current && !force)) return;
      isFetching.current = true;
      try {
        if (!permGranted.current) {
          const { status } = await MediaLibrary.requestPermissionsAsync();
          if (status !== "granted") return;
          permGranted.current = true;
        }

        const res = await MediaLibrary.getAssetsAsync({
          mediaType: ["photo", "video"],
          first: BATCH_SIZE,
          after: cursorRef.current,
          sortBy: [["creationTime", sortOldest]],
        });

        // Zéro appel async par photo — expo-image 3.x gère ph:// nativement sur iOS
        const items: MediaItem[] = [];
        for (const asset of res.assets) {
          if (trashCache.current.has(asset.id) || keptCache.current.has(asset.id) || fetchedIds.current.has(asset.id)) continue;
          fetchedIds.current.add(asset.id);
          items.push({
            id: asset.id,
            uri: asset.uri || null,
            type: asset.mediaType === "video" ? "video" : "photo",
            createdAt: resolveMediaDate(asset.creationTime, asset.modificationTime),
            width: asset.width,
            height: asset.height,
            duration: asset.duration,
            fileSize: undefined,
          });
        }

        setAssets((prev) => {
          const map = new Map(prev.map((p) => [p.id, p]));
          items.forEach((it) => !map.has(it.id) && map.set(it.id, it));
          return Array.from(map.values());
        });
        cursorRef.current = res.endCursor;
        hasMoreRef.current = res.hasNextPage;
        setHasMore(res.hasNextPage);
      } catch (err: any) {
        logger.error("fetchAssets", err);
        devLog("Fetch", `fetchAssets FAILED: ${err?.message ?? err}`, "error");
      } finally {
        isFetching.current = false;
      }
    },
    [sortOldest]
  );

  useEffect(() => {
    if ((assets.length - currentIndex <= PRELOAD_THRESHOLD || currentIndex >= assets.length) && hasMore) {
      fetchAssets();
    }
  }, [assets.length, currentIndex, hasMore, fetchAssets]);

  const persistIndex = useCallback((idx: number) => {
    if (persistTimer.current) clearTimeout(persistTimer.current);
    persistTimer.current = setTimeout(() => {
      AsyncStorage.setItem(CARD_INDEX_KEY, String(idx)).catch(() => {});
    }, 800);
  }, []);

  const addToTrash = useCallback((item: MediaItem) => {
    const entry = { ...item, trashedAt: Date.now() };
    trashRef.current = [entry, ...trashRef.current].slice(0, 1000);
    setTrashCount(trashRef.current.length);
    AsyncStorage.setItem(TRASH_KEY, JSON.stringify(trashRef.current)).catch(() => {});
    Notifications.setBadgeCountAsync(trashRef.current.length).catch(() => {});

    // Lazy fetch taille en arrière-plan (ne bloque pas l'animation de swipe)
    if (!item.fileSize) {
      (async () => {
        try {
          const info = await MediaLibrary.getAssetInfoAsync(item.id);
          const localUri = info.localUri;
          if (localUri && !localUri.startsWith("ph://")) {
            const size = new FileSystem.File(localUri).size;
            if (size > 0) {
              const idx = trashRef.current.findIndex((e) => e.id === item.id);
              if (idx >= 0) {
                trashRef.current[idx] = { ...trashRef.current[idx], fileSize: size };
                AsyncStorage.setItem(TRASH_KEY, JSON.stringify(trashRef.current)).catch(() => {});
                devLog("Trash", `fileSize lazy=${(size / 1048576).toFixed(2)}Mo id=${item.id}`, "info");
              }
            }
          }
        } catch {}
      })();
    }
  }, []);

  const addToFavorites = useCallback((item: MediaItem) => {
    if (favoritesRef.current.some((f) => f.id === item.id)) return;
    favoritesRef.current = [item, ...favoritesRef.current].slice(0, 1000);
    AsyncStorage.setItem(FAVORITES_KEY, JSON.stringify(favoritesRef.current)).catch(() => {});
  }, []);

  const addToKept = useCallback((id: string) => {
    if (keptCache.current.has(id)) return;
    keptCache.current.add(id);
    AsyncStorage.getItem(KEPT_KEY).then(raw => {
      const arr: string[] = raw ? JSON.parse(raw) : [];
      if (!arr.includes(id)) {
        arr.unshift(id);
        AsyncStorage.setItem(KEPT_KEY, JSON.stringify(arr.slice(0, 10000))).catch(() => {});
      }
    }).catch(() => {});
  }, []);

  const removeFromKept = useCallback((id: string) => {
    keptCache.current.delete(id);
    AsyncStorage.getItem(KEPT_KEY).then(raw => {
      const arr: string[] = raw ? JSON.parse(raw) : [];
      AsyncStorage.setItem(KEPT_KEY, JSON.stringify(arr.filter(i => i !== id))).catch(() => {});
    }).catch(() => {});
  }, []);

  const triggerHaptics = useCallback(
    (direction: Exclude<SwipeDirection, null>) => {
      if (!vibrateSwipe) return;
      if (direction === "left") {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
      } else if (direction === "right") {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        setTimeout(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light), 90);
      } else if (direction === "top") {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } else if (direction === "bottom") {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }
    },
    [vibrateSwipe]
  );

  const handleSwipe = useCallback(
    async (direction: Exclude<SwipeDirection, null>) => {
      const item = assets[currentIndex];
      if (!item) return;

      triggerHaptics(direction);
      devLog("Swipe", `dir=${direction} type=${item.type} id=${item.id} size=${item.fileSize ?? "?"}`, "info");
      if (soundEnabled && direction !== "bottom") {
        playSwipeSound(direction === "left" ? "delete" : direction === "right" ? "keep" : "star");
      }

      const showAchievement = (a: Achievement | null) => {
        if (!a) return;
        fireAchievementNotif(a);
      };

      setLastSwipe({ item, direction });

      if (direction === "left") {
        trashCache.current.add(item.id);
        addToTrash(item);
        setTimeout(() => checkAndUnlock("first_trash").then(showAchievement), 0);
      } else if (direction === "right") {
        addToKept(item.id);
      } else if (direction === "top") {
        const isDup = favoritesRef.current.some((f) => f.id === item.id);
        const newTotal = isDup ? favoritesRef.current.length : favoritesRef.current.length + 1;
        addToFavorites(item);
        addToKept(item.id);
        setTimeout(() => checkFavMilestones(newTotal).then(showAchievement), 0);
      }

      const newSwipeTotal = currentIndex + 1;
      setTimeout(() => {
        checkSwipeMilestones(newSwipeTotal).then(showAchievement);
        checkNightSwipe().then(showAchievement);
      }, 0);

      const newIndex = currentIndex + 1;
      setCurrentIndex(newIndex);
      persistIndex(newIndex);

      // Demande de review après 10 swipes (iOS uniquement, une seule fois)
      if (Platform.OS === "ios" && newSwipeTotal === 10) {
        setTimeout(async () => {
          try {
            const already = await AsyncStorage.getItem(REVIEW_PROMPTED_KEY);
            if (already) return;
            await AsyncStorage.setItem(REVIEW_PROMPTED_KEY, "1");
            Alert.alert(
              "Tu aimes SwipeClean ? ⭐",
              "Ça prend 30 secondes et ça aide vraiment l'app à grandir 🙏",
              [
                { text: "Plus tard", style: "cancel" },
                {
                  text: "Noter l'app",
                  onPress: () => {
                    Linking.openURL("itms-apps://itunes.apple.com/app/id6802313349?action=write-review");
                  },
                },
              ]
            );
          } catch {}
        }, 1500);
      }
    },
    [currentIndex, assets, triggerHaptics, addToTrash, addToFavorites, addToKept, persistIndex, soundEnabled]
  );

  const handleUndo = useCallback(() => {
    if (!lastSwipe || currentIndex === 0) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const { item, direction } = lastSwipe;
    if (direction === "left") {
      trashCache.current.delete(item.id);
      trashRef.current = trashRef.current.filter((i) => i.id !== item.id);
      setTrashCount(trashRef.current.length);
      AsyncStorage.setItem(TRASH_KEY, JSON.stringify(trashRef.current)).catch(() => {});
      Notifications.setBadgeCountAsync(trashRef.current.length).catch(() => {});
    } else if (direction === "right") {
      removeFromKept(item.id);
    } else if (direction === "top") {
      favoritesRef.current = favoritesRef.current.filter((i) => i.id !== item.id);
      AsyncStorage.setItem(FAVORITES_KEY, JSON.stringify(favoritesRef.current)).catch(() => {});
      removeFromKept(item.id);
    }
    const newIndex = currentIndex - 1;
    setCurrentIndex(newIndex);
    persistIndex(newIndex);
    setLastSwipe(null);
  }, [lastSwipe, currentIndex, persistIndex]);

  const resetGallery = useCallback(async () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    await AsyncStorage.multiRemove([CARD_INDEX_KEY, KEPT_KEY]);
    stackProgress.value = 0;
    trashCache.current.clear();
    keptCache.current.clear();
    fetchedIds.current.clear();
    cursorRef.current = undefined;
    hasMoreRef.current = true;
    isFetching.current = false;
    setAssets([]);
    setHasMore(true);
    setCurrentIndex(0);
    setLastSwipe(null);
  }, []);

  const handleSortToggle = useCallback(() => {
    const newSort = !sortOldest;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSortOldest(newSort);
    setAssets([]);
    setCurrentIndex(0);
    setHasMore(true);
    setLastSwipe(null);
    cursorRef.current = undefined;
    hasMoreRef.current = true;
    fetchedIds.current.clear();
    isFetching.current = false;
    stackProgress.value = 0;
    AsyncStorage.setItem(SORT_KEY, newSort ? "oldest" : "newest").catch(() => {});
  }, [sortOldest]);

  // Précharger les prochaines cartes en mémoire pour éviter les écrans noirs (surtout iOS)
  useEffect(() => {
    for (let i = 0; i <= 8; i++) {
      const next = assets[currentIndex + i];
      if (next?.uri && next.type === "photo") {
        Image.prefetch(next.uri, { cachePolicy: "memory-disk" }).catch(() => {});
      }
    }
  }, [currentIndex, assets]);

  const mainAnimatedStyle = useAnimatedStyle(() => ({
    opacity: containerOpacity.value,
    transform: [{ scale: containerScale.value }],
  }));

  if (loading) return <FancyLoader dark={darkMode} />;

  const topCard = assets[currentIndex];
  const bottomCard = assets[currentIndex + 1];

  if (!topCard) {
    if (hasMore || isFetching.current) return <FancyLoader dark={darkMode} />;
    return (
      <SafeAreaView
        style={[
          styles.container,
          { backgroundColor: darkMode ? "#121212" : "#F5F5F5" },
        ]}
        onLayout={() => setShowConfetti(true)}
      >
        <Confetti active={showConfetti} />
        <View style={styles.emptyContainer}>
          <Ionicons
            name="checkmark-circle"
            size={90}
            color={darkMode ? "rgba(76,255,94,0.6)" : "rgba(76,200,94,0.5)"}
          />
          <Text
            style={[
              styles.emptyText,
              { color: darkMode ? "#fff" : "#000", marginTop: 16 },
            ]}
          >
            Tout est traité !
          </Text>
          <Text style={{ color: darkMode ? "rgba(255,255,255,0.45)" : "rgba(0,0,0,0.4)", fontSize: 15, marginTop: 8, textAlign: "center" }}>
            {trashCount > 0 ? `${trashCount} photo${trashCount > 1 ? "s" : ""} dans la corbeille` : "Aucune photo à supprimer"}
          </Text>
          <TouchableOpacity
            onPress={resetGallery}
            activeOpacity={0.85}
            style={{ marginTop: 28 }}
          >
            <View style={styles.resetBtnGradient}>
              <Text style={styles.resetBtnText}>Recommencer depuis le début</Text>
            </View>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView
      style={[
        styles.container,
        { backgroundColor: darkMode ? "#121212" : "#F5F5F5" },
      ]}
    >
      <StatusBar barStyle={darkMode ? "light-content" : "dark-content"} />

      {/* HEADER */}
      <View style={styles.header}>
        <View style={{ flexDirection: "row", alignItems: "center" }}>
          <TouchableOpacity
            onPress={() => setMenuOpen((v) => !v)}
            style={styles.headerBtn}
          >
            <Ionicons name="menu" size={34} color={darkMode ? "#E0E0E0" : "#000"} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.headerBtn} onPress={handleSortToggle}>
            <Ionicons
              name={sortOldest ? "arrow-up-outline" : "arrow-down-outline"}
              size={34}
              color={sortOldest ? "#00C9FF" : (darkMode ? "#E0E0E0" : "#000")}
            />
          </TouchableOpacity>
        </View>

        <View
          style={{ position: "absolute", left: 0, right: 0, alignItems: "center" }}
        >
          <TouchableOpacity
            onPress={() => router.push("/Favorites")}
            style={styles.headerBtn}
          >
            <Ionicons
              name="star"
              size={34}
              color={darkMode ? "#E0E0E0" : "#000"}
            />
          </TouchableOpacity>
        </View>

        <View style={{ flexDirection: "row", alignItems: "center" }}>
          {lastSwipe && (
            <TouchableOpacity style={styles.headerBtn} onPress={handleUndo}>
              <Ionicons name="arrow-undo" size={28} color={darkMode ? "#E0E0E0" : "#000"} />
            </TouchableOpacity>
          )}
          <TouchableOpacity style={styles.headerBtn} onPress={resetGallery}>
            <ReloadMenuIcon size={34} darkMode={darkMode} />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.headerBtn}
            onPress={() => router.push("/Trash")}
          >
            <View>
              <TrashXIcon size={34} darkMode={darkMode} />
              {trashCount > 0 && (
                <View style={styles.trashBadge}>
                  <Text style={styles.trashBadgeText}>
                    {trashCount > 99 ? "99+" : trashCount}
                  </Text>
                </View>
              )}
            </View>
          </TouchableOpacity>
        </View>
      </View>

      {/* DROPDOWN MENU */}
      {menuOpen && (
        <Pressable
          style={styles.menuOverlay}
          onPress={() => setMenuOpen(false)}
        >
          <View
            style={[
              styles.menuPanel,
              { backgroundColor: darkMode ? "#1a1a1a" : "#fff" },
            ]}
          >
            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => {
                router.push("/Gallery");
                setMenuOpen(false);
              }}
            >
              <Ionicons
                name="images-outline"
                size={20}
                color={darkMode ? "#E0E0E0" : "#000"}
              />
              <Text
                style={[
                  styles.menuText,
                  { color: darkMode ? "#E0E0E0" : "#000" },
                ]}
              >
                Gallery
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => {
                router.push("/Stats");
                setMenuOpen(false);
              }}
            >
              <Ionicons
                name="bar-chart-outline"
                size={20}
                color={darkMode ? "#E0E0E0" : "#000"}
              />
              <Text style={[styles.menuText, { color: darkMode ? "#E0E0E0" : "#000" }]}>
                Statistiques
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => {
                router.push("/Achievements" as any);
                setMenuOpen(false);
              }}
            >
              <Ionicons
                name="trophy-outline"
                size={20}
                color={darkMode ? "#E0E0E0" : "#000"}
              />
              <Text style={[styles.menuText, { color: darkMode ? "#E0E0E0" : "#000" }]}>
                Succès
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => {
                router.push("/Settings");
                setMenuOpen(false);
              }}
            >
              <Ionicons
                name="settings-outline"
                size={20}
                color={darkMode ? "#E0E0E0" : "#000"}
              />
              <Text
                style={[
                  styles.menuText,
                  { color: darkMode ? "#E0E0E0" : "#000" },
                ]}
              >
                Paramètres
              </Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      )}

      {/* MAIN */}
      <Animated.View style={[styles.innerContainer, mainAnimatedStyle]}>
        {/* Card stack */}
        <View style={styles.swiperContainer}>
          <View style={styles.stackWrap}>
            {/* Pré-décodage des prochaines cartes en mémoire pour éviter l'écran noir au swipe rapide */}
            {assets.slice(currentIndex + 2, currentIndex + 10).map(asset =>
              asset?.uri && asset.type === "photo" ? (
                <Image
                  key={`pre_${asset.id}`}
                  source={{ uri: asset.uri }}
                  style={{ position: "absolute", width: RESPONSIVE.cardWidth, height: RESPONSIVE.cardHeight, opacity: 0.01, zIndex: -1 }}
                  cachePolicy="memory"
                  priority="high"
                />
              ) : null
            )}
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
                ref={topCardRef}
                key={topCard.id}
                item={topCard}
                onSwipe={handleSwipe}
                isTop
                stackProgress={stackProgress}
              />
            )}
          </View>
        </View>

        {/* ACTION BUTTONS */}
        <View style={styles.globalActions}>
          <AnimatedActionBtn
            onPress={() => topCardRef.current?.triggerSwipe("left")}
            btnStyle={ACTION_BTN_DELETE}
            iconName="close"
            iconSize={BTN_ICON}
            iconColor="#FF4458"
          />
          <AnimatedActionBtn
            onPress={() => topCardRef.current?.triggerSwipe("top")}
            btnStyle={ACTION_BTN_STAR}
            iconName="star"
            iconSize={BTN_ICON - 6}
            iconColor="#00C9FF"
          />
          <AnimatedActionBtn
            onPress={() => topCardRef.current?.triggerSwipe("right")}
            btnStyle={ACTION_BTN_KEEP}
            iconName="heart"
            iconSize={BTN_ICON - 4}
            iconColor="#4CFF5E"
          />
        </View>
      </Animated.View>

    </SafeAreaView>
  );
}

/* ---- Styles ---- */
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#121212" },
  innerContainer: { flex: 1, paddingHorizontal: 12, paddingBottom: 12 },

  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 32,
  },
  emptyText: { fontSize: 20, fontWeight: "700", textAlign: "center" },
  resetBtnGradient: {
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

  typeBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "rgba(255,255,255,0.08)",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  typeBadgeText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#FFFFFF",
    letterSpacing: 0.3,
  },

  swiperContainer: {
    flex: 1,
    marginTop: 4,
    marginBottom: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  stackWrap: {
    width: RESPONSIVE.cardWidth,
    height: RESPONSIVE.cardHeight + 20,
    alignItems: "center",
    justifyContent: "center",
  },
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
  mediaError: {
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#1a1a1a",
  },
  errorText: { color: "rgba(255,255,255,0.45)", fontSize: 14, marginTop: 12 },

  videoBadge: {
    position: "absolute",
    bottom: 12,
    left: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "rgba(0,0,0,0.55)",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
  },
  videoBadgeText: {
    color: "#fff",
    fontSize: 11,
    fontWeight: "600",
  },
  muteBtn: {
    position: "absolute",
    bottom: 12,
    right: 12,
    width: 34,
    height: 34,
    borderRadius: 17,
    overflow: "hidden",
    justifyContent: "center",
    alignItems: "center",
  },

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
  actionBtnDelete: {
    borderColor: "#FF4458",
    backgroundColor: "rgba(255,68,88,0.15)",
    width: BTN_SIZE,
    height: BTN_SIZE,
  },
  actionBtnStar: {
    borderColor: "#00C9FF",
    backgroundColor: "rgba(0,201,255,0.12)",
    width: Math.round(BTN_SIZE * 0.82),
    height: Math.round(BTN_SIZE * 0.82),
    borderRadius: Math.round(BTN_SIZE * 0.41),
  },
  actionBtnKeep: {
    borderColor: "#4CFF5E",
    backgroundColor: "rgba(76,255,94,0.12)",
    width: BTN_SIZE,
    height: BTN_SIZE,
  },

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
    borderRadius: 14,
    paddingVertical: 8,
    paddingHorizontal: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.22,
    shadowRadius: 10,
    elevation: 10,
    minWidth: 160,
  },
  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 14,
    gap: 10,
  },
  menuText: { fontSize: 16, fontWeight: "500" },

  appNameContainer: {
    position: "absolute",
    bottom: 50,
    width: "100%",
    alignItems: "center",
  },

  progressRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 4,
    marginBottom: 6,
    height: 22,
  },
  progressTrack: {
    flex: 1,
    height: 3,
    borderRadius: 2,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    borderRadius: 2,
  },
  progressCountText: {
    fontSize: 11,
    fontWeight: "600",
    letterSpacing: 0.3,
    minWidth: 54,
    textAlign: "right",
  },

  photoInfoGradient: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 14,
    paddingBottom: 14,
    paddingTop: 40,
  },
  photoInfoDate: {
    color: "#fff",
    fontSize: 13,
    fontWeight: "600",
    letterSpacing: 0.1,
  },
  photoInfoSub: {
    color: "rgba(255,255,255,0.65)",
    fontSize: 11,
    marginTop: 2,
  },

  trashBadge: {
    position: "absolute",
    top: -2,
    right: -2,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: "#FF4458",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 3,
  },
  trashBadgeText: {
    color: "#fff",
    fontSize: 9,
    fontWeight: "800",
  },

});

// Constantes stables pour éviter que React.memo soit annulé par des arrays inline
const ACTION_BTN_DELETE = [styles.actionBtn, styles.actionBtnDelete];
const ACTION_BTN_STAR   = [styles.actionBtn, styles.actionBtnStar];
const ACTION_BTN_KEEP   = [styles.actionBtn, styles.actionBtnKeep];
