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
  Linking,
  Modal,
  AppState,
} from "react-native";
import { usePopup } from "../../components/Popup";
import { router, useFocusEffect } from "expo-router";
import * as MediaLibrary from "expo-media-library";
import * as FileSystem from "expo-file-system";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Ionicons } from "@expo/vector-icons";
import Svg, { Path } from "react-native-svg";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { BlurView } from "expo-blur";
import { Image } from "expo-image";
import { Audio, InterruptionModeAndroid, InterruptionModeIOS } from "expo-av";
import * as Notifications from "expo-notifications";
import AppLoader from "../../components/AppLoader";
import { WhatsNewModal, NewBadge, shouldShowWhatsNew, markWhatsNewSeen } from "../../components/WhatsNew";
import { checkSwipeMilestones, checkAndUnlock, checkNightSwipe, checkFavMilestones, type Achievement } from "../../utils/achievements";
import { recordSwipe as recordSwipeStat } from "../../utils/swipeStats";
import { devLog } from "../../utils/devLogger";
import { resolveMediaUri } from "../../utils/mediaUri";
import { queueWrite, flushWrites } from "../../utils/storageQueue";
import { initAds, onSwipeForAd } from "../../utils/ads";
import SwipeCoach from "../../components/SwipeCoach";
import { INITIAL_COACH, advanceCoach, isExpected, type CoachState } from "../../utils/coach";

// react-native-video requires a native build — not available in Expo Go
let VideoPlayer: React.ComponentType<any> | null = null;
let ResizeMode: { COVER: string } = { COVER: "cover" };
// Android: SurfaceView (défaut de react-native-video) ne supporte ni borderRadius,
// ni overflow:hidden, ni les transforms du parent animé -> carte noire pendant le swipe.
// TextureView est composé normalement dans la hiérarchie de vues.
let VideoViewType: { TEXTURE: any; SURFACE: any } = { TEXTURE: 2, SURFACE: 1 };
try {
  const rnv = require("react-native-video");
  if (rnv && rnv.default) {
    VideoPlayer = rnv.default;
    ResizeMode = rnv.ResizeMode ?? { COVER: "cover" };
    VideoViewType = rnv.ViewType ?? VideoViewType;
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
import { Gesture, GestureDetector, GestureHandlerRootView } from "react-native-gesture-handler";
import * as Haptics from "expo-haptics";
import { deleteAssetsInBatches } from "../../utils/mediaDelete";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");
const BTN_SIZE = Math.min(Math.round(SCREEN_WIDTH * 0.16), 66);
const BTN_ICON = Math.round(BTN_SIZE * 0.52);

const REVIEW_PROMPTED_KEY = "@app_review_prompted";
const TRASH_KEY = "@app_trash";
const FAVORITES_KEY = "@app_favorites";
const KEPT_KEY = "@app_kept";
/** Hérité: un index dans la pile filtrée, plus jamais restauré (voir le bootstrap). */
const CARD_INDEX_KEY = "@gallery_last_index_v2";
/** Nombre de swipes sur la vie de l'install — les paliers de succès sont exacts. */
const TOTAL_SWIPES_KEY = "@app_swipes_total";
const DARK_MODE_KEY = "@app_dark_mode";
const VIBRATE_KEY = "@app_vibrate_swipe";
const ONBOARDED_KEY = "@app_onboarded";
const SORT_KEY = "@app_sort_order";
const SOUND_KEY = "@app_sound";
const AUTO_DARK_KEY = "@app_dark_auto";
const AUTO_TRASH_DAYS_KEY = "@app_auto_trash_days";
// Plafonds de persistance. Ils existent pour que le JSON réécrit à chaque swipe ne
// grossisse pas sans fin, mais l'éviction doit rester cohérente: un id évincé d'une
// liste doit sortir du cache correspondant, sinon la photo devient invisible *et*
// inatteignable (ni dans la pile, ni dans la corbeille).
const TRASH_CAP = 1000;
// Un favori évincé est une perte d'intention pure, sans aucun moyen de la récupérer:
// le plafond est donc large, et les objets stockés sont petits.
const FAV_CAP = 5000;
const KEPT_CAP = 10000;

const BATCH_SIZE = 60;
const PRELOAD_THRESHOLD = 10;
// Plafond d'un seul appel à `fetchAssets`, pour ne pas bloquer sur une photothèque de
// 50 000 médias déjà triés. Au-delà, `fetchTick` reprend là où le curseur s'est arrêté.
const MAX_PAGES_PER_FETCH = 25;
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

// Écran non focalisé ou app en arrière-plan: ExoPlayer continuerait à décoder
// (batterie, chauffe, son audible si l'utilisateur avait démuté).
function useScreenActive() {
  const [active, setActive] = useState(true);
  const focusedRef = useRef(true);
  const appActiveRef = useRef(AppState.currentState === "active");
  const sync = useCallback(() => {
    setActive(focusedRef.current && appActiveRef.current);
  }, []);

  useEffect(() => {
    const sub = AppState.addEventListener("change", (st) => {
      appActiveRef.current = st === "active";
      sync();
    });
    return () => sub.remove();
  }, [sync]);

  useFocusEffect(
    useCallback(() => {
      focusedRef.current = true;
      sync();
      return () => {
        focusedRef.current = false;
        sync();
      };
    }, [sync])
  );

  return active;
}

const FancyLoader = ({ dark }: { dark: boolean }) => <AppLoader dark={dark} />;

/* ---- MediaCard ---- */
const MediaCard = React.memo(function MediaCard({
  item,
  isTop,
}: {
  item: MediaItem;
  isTop: boolean;
}) {
  const [isMuted, setIsMuted] = useState(true);
  const [videoFailed, setVideoFailed] = useState(false);
  const screenActive = useScreenActive();

  useEffect(() => {
    setIsMuted(true);
    setVideoFailed(false);
  }, [item.id]);

  // log hors phase de rendu: devLog notifie ses abonnés de façon synchrone
  // (Settings.tsx fait un setState) -> setState pendant le rendu d'un autre composant.
  useEffect(() => {
    if (item.type === "video") {
      devLog(
        "Video",
        `Rendu vidéo id=${item.id} uri=${item.uri?.slice(0, 60)} player=${VideoPlayer ? "OK" : "NULL"}`,
        VideoPlayer ? "info" : "warn"
      );
    }
  }, [item.id, item.type, item.uri]);

  const resolvedUri = resolveMediaUri(item.uri, item.id, item.type);

  if (!resolvedUri) {
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
    const videoPlaceholder = (
      <View style={[styles.media, { backgroundColor: "#111", justifyContent: "center", alignItems: "center" }]}>
        <Ionicons name="play-circle-outline" size={64} color="rgba(255,255,255,0.4)" />
        <Text style={{ color: "rgba(255,255,255,0.4)", marginTop: 8, fontSize: 13 }}>Vidéo</Text>
      </View>
    );
    // Un seul ExoPlayer monté à la fois: la carte du dessous garderait un décodeur
    // matériel + une surface alloués, et beaucoup d'appareils n'en exposent qu'un ou deux.
    const Player = VideoPlayer;
    const canPlay = Player && isTop && screenActive && !videoFailed;
    return (
      <View style={styles.card}>
        {canPlay ? (
          <VideoErrorBoundary
            uri={item.uri ?? undefined}
            fallback={videoPlaceholder}
          >
            <Player
              source={{ uri: resolvedUri }}
              style={styles.media}
              resizeMode={ResizeMode.COVER}
              repeat
              muted={isMuted}
              paused={!isTop || !screenActive}
              viewType={VideoViewType.TEXTURE}
              playInBackground={false}
              playWhenInactive={false}
              disableFocus
              bufferConfig={{
                minBufferMs: 2000,
                maxBufferMs: 5000,
                bufferForPlaybackMs: 1000,
                bufferForPlaybackAfterRebufferMs: 1500,
              }}
              onError={(e: any) => {
                devLog("Video", `onError id=${item.id}: ${JSON.stringify(e?.error ?? e)}`, "error");
                setVideoFailed(true);
              }}
            />
          </VideoErrorBoundary>
        ) : (
          videoPlaceholder
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
      <Image
        source={{ uri: resolvedUri }}
        style={[StyleSheet.absoluteFill, styles.media]}
        contentFit="cover"
        transition={isTop ? 0 : 180}
        cachePolicy="memory-disk"
        priority="high"
        recyclingKey={item.id}
      />
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
  onDoubleTap?: () => void;
}>(function SwipeableCard({ item, onSwipe, isTop, stackProgress, onDoubleTap }, ref) {
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const swipeDir = useSharedValue<SwipeDirection>(null);
  const cardScale = useSharedValue(1);
  const mountProgress = useSharedValue(0);

  useEffect(() => {
    if (isTop) {
      mountProgress.value = 1;
    } else {
      mountProgress.value = withSpring(1, { damping: 32, stiffness: 80, mass: 1.2 });
    }
  }, []);

  // Verrou « cette carte ne part qu'une fois ». Gauche/droite animent `translateX`
  // quand haut/bas animent `translateY`: deux axes distincts, donc deux animations qui
  // ne s'annulent pas. Appuyer sur ✕ puis sur ★ en moins de 400 ms (les boutons sont
  // voisins) faisait aboutir les deux, et `onSwipe` partait deux fois sur la même
  // photo — qui atterrissait à la fois dans la corbeille et dans les favoris.
  const committed = useSharedValue(false);

  const SWIPE_THRESHOLD_X = SCREEN_WIDTH * 0.25;

  /** Envoie la carte hors écran puis valide le swipe, une seule fois. */
  const flyOff = useCallback(
    (direction: Exclude<SwipeDirection, null>) => {
      "worklet";
      if (committed.value) return;
      committed.value = true;

      const duration = direction === "bottom" ? 380 : 400;
      const config = { duration, easing: Easing.in(Easing.quad) } as const;
      const settle = (done?: boolean) => {
        "worklet";
        if (!done) return;
        runOnJS(onSwipe)(direction);
        // Pas de `withDelay` ici: `stackProgress` est partagé avec la carte suivante,
        // et un délai de 60 ms écrasait la montée de celle-ci en swipe rapide — la
        // carte du dessous retombait à 0.95 puis « popait ».
        stackProgress.value = 0;
      };

      stackProgress.value = withTiming(1, { duration });
      if (direction === "left") {
        translateX.value = withTiming(-SCREEN_WIDTH * 1.5, config, settle);
      } else if (direction === "right") {
        translateX.value = withTiming(SCREEN_WIDTH * 1.5, config, settle);
      } else if (direction === "top") {
        translateY.value = withTiming(-SCREEN_HEIGHT * 1.5, config, settle);
      } else {
        translateY.value = withTiming(SCREEN_HEIGHT * 1.5, config, settle);
      }
    },
    [committed, onSwipe, stackProgress, translateX, translateY]
  );
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
        { scale: (0.94 + 0.06 * mountProgress.value) * cardScale.value },
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

  const panGesture = Gesture.Pan()
    .enabled(isTop)
    .onUpdate((e) => {
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
    .onEnd((_e, success) => {
      // `onEnd` est aussi appelé sur CANCELLED/FAILED (interstitiel qui s'ouvre, appel
      // entrant, volet de notifications). Comme `swipeDir` est déjà positionné dès le
      // franchissement du seuil dans `onUpdate`, l'ignorer faisait partir la carte et
      // validait le swipe sans que le doigt ait été relâché en zone de validation.
      if (!success || swipeDir.value === null) {
        translateX.value = withSpring(0, { damping: 26, stiffness: 140 });
        translateY.value = withSpring(0, { damping: 26, stiffness: 140 });
        stackProgress.value = withSpring(0, { damping: 26, stiffness: 140 });
        swipeDir.value = null;
        return;
      }
      flyOff(swipeDir.value);
    });

  // Double-tap : ouvre le fullscreen. Tap simple : effet rebond.
  const lastTapTime = useRef(0);
  const handleTapJS = () => {
    const now = Date.now();
    if (onDoubleTap && now - lastTapTime.current < 300) {
      onDoubleTap();
      lastTapTime.current = 0;
    } else {
      lastTapTime.current = now;
    }
  };

  const tapGesture = Gesture.Tap()
    .enabled(isTop)
    .maxDuration(350)
    .onEnd((_e, success) => {
      if (!success) return;
      // Animation sur le thread UI — instantanée sur iOS et Android
      cardScale.value = withSequence(
        withTiming(0.88, { duration: 55 }),
        withSpring(1, { damping: 7, stiffness: 220, mass: 0.8 })
      );
      runOnJS(handleTapJS)();
    });

  const combinedGesture = Gesture.Simultaneous(tapGesture, panGesture);

  useImperativeHandle(ref, () => ({
    triggerSwipe: (direction) => {
      flyOff(direction);
    },
  }));

  return (
    <GestureDetector gesture={combinedGesture}>
      <Animated.View
        style={[styles.cardWrapper, cardStyle]}
        renderToHardwareTextureAndroid={item.type !== "video"}
      >
        <MediaCard item={item} isTop={isTop} />
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

// Le store est module-level: sans garde, chaque remontage de l'écran recrée
// trois Audio.Sound par-dessus les précédents sans les décharger
// -> fuite cumulative de MediaPlayer côté Android.
let soundsInitialized = false;

async function initSounds() {
  if (soundsInitialized) return;
  soundsInitialized = true;
  try {
    await Promise.all(
      (Object.keys(soundSources) as Array<"delete" | "keep" | "star">).map(async (k) => {
        if (preloadedSounds[k]) return;
        const { sound } = await Audio.Sound.createAsync(soundSources[k], { volume: 0.85 });
        preloadedSounds[k] = sound;
      })
    );
  } catch {
    soundsInitialized = false;
  }
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


/* ---- FullscreenViewer ---- */
function FullscreenViewer({ uri, onClose }: { uri: string; onClose: () => void }) {
  const scale = useSharedValue(1);
  const savedScale = useSharedValue(1);
  const panX = useSharedValue(0);
  const panY = useSharedValue(0);
  const isZoomed = useSharedValue(false);

  const pinch = Gesture.Pinch()
    .onUpdate((e) => {
      const next = Math.min(Math.max(savedScale.value * e.scale, 1), 5);
      scale.value = next;
      isZoomed.value = next > 1.05;
    })
    .onEnd(() => {
      if (scale.value < 1.15) {
        scale.value = withSpring(1, { damping: 15 });
        panX.value = withSpring(0, { damping: 15 });
        panY.value = withSpring(0, { damping: 15 });
        savedScale.value = 1;
        isZoomed.value = false;
      } else {
        savedScale.value = scale.value;
      }
    });

  const pan = Gesture.Pan()
    .onUpdate((e) => {
      if (!isZoomed.value) return;
      panX.value = e.translationX / Math.max(scale.value, 1);
      panY.value = e.translationY / Math.max(scale.value, 1);
    })
    .onEnd(() => {
      if (!isZoomed.value) return;
      panX.value = withSpring(panX.value, { damping: 18 });
      panY.value = withSpring(panY.value, { damping: 18 });
    });

  const tap = Gesture.Tap()
    .maxDuration(250)
    .onEnd((_e, success) => {
      if (success) runOnJS(onClose)();
    });

  const combined = Gesture.Simultaneous(tap, pinch, pan);

  const imgStyle = useAnimatedStyle(() => ({
    transform: [
      { scale: scale.value },
      { translateX: panX.value },
      { translateY: panY.value },
    ],
  }));

  return (
    <GestureDetector gesture={combined}>
      <Animated.View style={styles.fullscreenOverlay}>
        <Animated.View style={[{ width: "100%", height: "100%" }, imgStyle]}>
          <Image
            source={{ uri }}
            style={styles.fullscreenImage}
            contentFit="contain"
            transition={180}
            cachePolicy="memory"
          />
        </Animated.View>
      </Animated.View>
    </GestureDetector>
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
  const insets = useSafeAreaInsets();
  const [assets, setAssets] = useState<MediaItem[]>([]);
  const [hasMore, setHasMore] = useState(true);
  const [fetchTick, setFetchTick] = useState(0);
  // Rien ne doit être chargé avant que la corbeille et les « gardées » soient en
  // mémoire: la première page partait sans filtre, et des photos déjà triées
  // revenaient dans la pile. Invisible tant que l'index restauré les sautait, bien
  // visible maintenant que la reprise se fait à l'index 0.
  const [cachesReady, setCachesReady] = useState(false);
  const [permissionDenied, setPermissionDenied] = useState(false);
  /** `step: null` = pas de tutoriel en cours (cas de loin le plus courant). */
  const [coach, setCoach] = useState<CoachState>({ step: null, attempts: 0 });
  const cursorRef = useRef<string | undefined>(undefined);
  const hasMoreRef = useRef(true);
  const trashRef = useRef<Array<MediaItem & { trashedAt?: number }>>([]);
  const favoritesRef = useRef<MediaItem[]>([]);
  const [loading, setLoading] = useState(true);
  const isFetching = useRef(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const trashCache = useRef<Set<string>>(new Set());
  const keptCache = useRef<Set<string>>(new Set());
  const keptListRef = useRef<string[]>([]); // miroir en mémoire pour éviter les races AsyncStorage
  const fetchedIds = useRef<Set<string>>(new Set());
  const totalSwipesRef = useRef(0);
  /** Incrémenté par tout ce qui vide la pile: un fetch en vol devient périmé. */
  const fetchGeneration = useRef(0);
  const persistTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (persistTimer.current) clearTimeout(persistTimer.current);
      // `flushWrites` couvre maintenant aussi le compteur de swipes, passé par la file.
      flushWrites();
    },
    []
  );
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
  const { popup, showPopup } = usePopup(darkMode);
  const [showWhatsNew, setShowWhatsNew] = useState(false);
  const [whatsNewBadge, setWhatsNewBadge] = useState(false);
  const [fullscreenUri, setFullscreenUri] = useState<string | null>(null);

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

  // Check for new version on mount → show badge + auto-show modal
  useEffect(() => {
    let t: ReturnType<typeof setTimeout> | null = null;
    shouldShowWhatsNew().then((show) => {
      if (show) {
        setWhatsNewBadge(true);
        t = setTimeout(() => setShowWhatsNew(true), 1200);
      }
    });
    return () => { if (t !== null) clearTimeout(t); };
  }, []);

  const skipCoach = useCallback(() => {
    setCoach({ step: null, attempts: 0 });
    AsyncStorage.setItem(ONBOARDED_KEY, "true").catch(() => {});
  }, []);

  const handleOpenWhatsNew = () => {
    setShowWhatsNew(true);
    setWhatsNewBadge(false);
  };

  const handleCloseWhatsNew = () => {
    setShowWhatsNew(false);
    setWhatsNewBadge(false);
    markWhatsNewSeen();
  };

  // Re-read sort order when returning from Settings and reset gallery instantly
  useFocusEffect(
    useCallback(() => {
      (async () => {
        try {
          const so = await AsyncStorage.getItem(SORT_KEY);
          const newVal = so === "oldest";
          if (newVal === sortOldest) return;
          setSortOldest(newVal);
          fetchGeneration.current++;
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

  // Corbeille et favoris sont écrits par d'autres écrans (Trash.tsx, Favorites.tsx),
  // et comme la navigation est un `push`, cet écran n'est jamais démonté: ses refs
  // restaient figées sur l'état du démarrage. Vider la corbeille puis revenir swiper
  // réécrivait donc l'ancienne liste par-dessus — la corbeille vidée se repeuplait de
  // photos qui n'existaient plus. Même chose pour un favori retiré, qui revenait.
  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      (async () => {
        try {
          const [trashRaw, favRaw] = await AsyncStorage.multiGet([TRASH_KEY, FAVORITES_KEY]);
          if (cancelled) return;

          const parse = <T,>(raw: string | null, fallback: T): T => {
            if (!raw) return fallback;
            try {
              return (JSON.parse(raw) as T) ?? fallback;
            } catch {
              return fallback;
            }
          };

          const trash = parse<Array<MediaItem & { trashedAt?: number }>>(trashRaw[1], []);
          if (Array.isArray(trash)) {
            trashRef.current = trash;
            trashCache.current = new Set(trash.map((t) => t.id));
            setTrashCount(trash.length);
            Notifications.setBadgeCountAsync(trash.length).catch(() => {});
          }

          const favs = parse<MediaItem[]>(favRaw[1], []);
          if (Array.isArray(favs)) favoritesRef.current = favs;

          // « Revoir le tutoriel » efface la clé puis revient ici. L'écran étant déjà
          // monté, le bootstrap ne rejoue pas: c'est donc au retour de focus de
          // relancer le tutoriel.
          const onboarded = await AsyncStorage.getItem(ONBOARDED_KEY);
          if (!cancelled && !onboarded) setCoach(INITIAL_COACH);
        } catch {}
      })();
      return () => {
        cancelled = true;
      };
    }, [])
  );

  // Auto dark mode — sync to system scheme when enabled
  useEffect(() => {
    if (darkAuto) setDarkMode(systemScheme === "dark");
  }, [systemScheme, darkAuto]);

  // Audio mode — play sounds even when iOS silent switch is off, preload sounds
  useEffect(() => {
    Audio.setAudioModeAsync({
      playsInSilentModeIOS: true,
      staysActiveInBackground: false,
      shouldDuckAndroid: true,
      interruptionModeAndroid: InterruptionModeAndroid.DuckOthers,
      interruptionModeIOS: InterruptionModeIOS.MixWithOthers,
    })
      .then(() => initSounds())
      .catch(() => {});
    initAds();
    // Pas de unloadAsync ici: preloadedSounds survit au composant (module-level),
    // le décharger au démontage rendait l'écran muet après un retour sur l'écran.
  }, []);

  // Bootstrap
  useEffect(() => {
    const t0 = Date.now();
    (async () => {
      try {
        // Premier lancement: on ne quitte plus l'écran. Le tutoriel se joue ici même,
        // sur la vraie carte et les vraies photos — c'est décidé plus bas, une fois
        // qu'on sait s'il y a bien quelque chose à trier.
        const onboarded = await AsyncStorage.getItem(ONBOARDED_KEY);
        const needsCoach = !onboarded;

        // Auto-empty trash if configured
        const [trashRaw, autoTrashRaw, favRaw, keptRaw] = await Promise.all([
          AsyncStorage.getItem(TRASH_KEY),
          AsyncStorage.getItem(AUTO_TRASH_DAYS_KEY),
          AsyncStorage.getItem(FAVORITES_KEY),
          AsyncStorage.getItem(KEPT_KEY),
        ]);
        const safeParse = <T,>(raw: string | null, fallback: T): T => {
          if (!raw) return fallback;
          try {
            const v = JSON.parse(raw);
            return v ?? fallback;
          } catch {
            return fallback;
          }
        };

        favoritesRef.current = safeParse(favRaw, favoritesRef.current);
        const keptArr = safeParse<string[]>(keptRaw, []);
        if (Array.isArray(keptArr)) {
          keptListRef.current = keptArr;
          keptArr.forEach(id => keptCache.current.add(id));
        }
        const autoTrashDays = autoTrashRaw ? Number(autoTrashRaw) : 0;

        let trashArr = safeParse<Array<MediaItem & { trashedAt?: number }>>(trashRaw, []);
        if (Array.isArray(trashArr)) {
          let expiredIds: string[] = [];

          if (autoTrashDays > 0) {
            const cutoff = Date.now() - autoTrashDays * 24 * 60 * 60 * 1000;
            expiredIds = trashArr.filter((i) => i.trashedAt && i.trashedAt < cutoff).map((i) => i.id);
            if (expiredIds.length > 0) {
              trashArr = trashArr.filter((i) => !i.trashedAt || i.trashedAt >= cutoff);
              await AsyncStorage.setItem(TRASH_KEY, JSON.stringify(trashArr));
            }
          }

          trashArr.forEach((t) => trashCache.current.add(t.id));
          trashRef.current = trashArr;
          setTrashCount(trashArr.length);
          Notifications.setBadgeCountAsync(trashArr.length).catch(() => {});

          // La purge ouvre une boîte de dialogue système Android qui passe l'app en
          // arrière-plan: la déclencher pendant le splash rendait l'Activity éligible
          // à la destruction avant même le premier rendu.
          if (expiredIds.length > 0) {
            setTimeout(() => {
              deleteAssetsInBatches(expiredIds).catch(() => {});
            }, 3000);
          }
        }
        // `currentIndex` indexe `assets`, qui *exclut* déjà tout ce qui est trié
        // (keptCache + trashCache). Le restaurer d'une session à l'autre le faisait
        // pointer dans le vide: quelqu'un ayant trié 350 photos repartait à l'index 350
        // d'une liste qui n'en contenait plus que quelques dizaines — carte du dessus
        // `undefined`, `hasMore` encore vrai, donc l'écran de chargement à vie. La bonne
        // position de reprise est toujours 0.
        //
        // L'ancienne clé ne servait que de compteur de swipes pour les succès: on la
        // récupère une fois dans un compteur à vie dédié, puis on l'oublie.
        const [totalRaw, legacyIndexRaw] = await Promise.all([
          AsyncStorage.getItem(TOTAL_SWIPES_KEY),
          AsyncStorage.getItem(CARD_INDEX_KEY),
        ]);
        if (totalRaw !== null) {
          totalSwipesRef.current = Number(totalRaw) || 0;
        } else if (legacyIndexRaw !== null) {
          totalSwipesRef.current = Number(legacyIndexRaw) || 0;
          AsyncStorage.setItem(TOTAL_SWIPES_KEY, String(totalSwipesRef.current)).catch(() => {});
        }
        // Les caches sont peuplés: le chargement peut filtrer correctement.
        setCachesReady(true);
        const loaded = await fetchAssets();

        if (needsCoach) {
          // Repli vers l'ancien tutoriel illustré quand il n'y a rien à montrer: accès
          // refusé, ou galerie vide. Apprendre sur sa propre photo suppose d'en avoir
          // une.
          if (loaded > 0) {
            setCoach(INITIAL_COACH);
            // Quelqu'un qui installe aujourd'hui n'a pas de « nouveautés » à découvrir:
            // la liste serait son premier écran, par-dessus le tutoriel.
            markWhatsNewSeen();
            setShowWhatsNew(false);
            setWhatsNewBadge(false);
          } else {
            router.replace("/Onboarding");
            return;
          }
        }
        const elapsed = Date.now() - t0;
        if (elapsed < SPLASH_MIN_MS) {
          await new Promise((r) => setTimeout(r, SPLASH_MIN_MS - elapsed));
        }
      } catch (err) {
        logger.error("init", err);
      } finally {
        // Filet: si le bootstrap a échoué avant de l'armer, on débloque quand même le
        // chargement. Mieux vaut filtrer de façon imparfaite que rester sur le loader.
        setCachesReady(true);
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
    async (force = false): Promise<number> => {
      // Renvoie le nombre de cartes obtenues: le bootstrap s'en sert pour savoir s'il y
      // a de quoi jouer le tutoriel sur de vraies photos.
      if (isFetching.current || (!hasMoreRef.current && !force)) return 0;
      isFetching.current = true;
      // `fetchTick` ne doit repartir que si le curseur a bougé. Sinon une permission
      // refusée ou un `getAssetsAsync` qui échoue relancerait l'effet de préchargement
      // en boucle, sans attente et sans fin.
      let advanced = false;
      const gen = ++fetchGeneration.current;
      try {
        if (!permGranted.current) {
          const { status } = await MediaLibrary.requestPermissionsAsync();
          if (status !== "granted") {
            // Sans cet état, le rendu tombait sur `hasMore === true` et affichait le
            // chargement à vie: ni message, ni bouton, et `permGranted` n'étant jamais
            // réévalué il fallait tuer l'app même après avoir accordé l'accès.
            setPermissionDenied(true);
            return 0;
          }
          permGranted.current = true;
          setPermissionDenied(false);
        }

        // Une page entièrement déjà triée (keptCache / trashCache) ne produisait aucune
        // carte, donc aucun changement de `assets.length` — et c'est ce changement qui
        // relançait la page suivante. Le chargement s'arrêtait là, pour de bon: écran de
        // chargement infini chez qui a déjà trié sa photothèque, et plusieurs secondes
        // d'attente chez les autres (une page par aller-retour de rendu). On enchaîne
        // donc les pages ici jusqu'à obtenir une carte, ou jusqu'au bout de la
        // photothèque — un `finally` libère `isFetching` dans tous les cas.
        const items: MediaItem[] = [];
        let endCursor = cursorRef.current;
        let hasNextPage = true;
        let pages = 0;

        // `fetchedIds` n'est alimenté qu'une fois le résultat retenu (plus bas): un
        // chargement périmé marquerait sinon comme « déjà vues » des photos qu'il vient
        // de jeter, et elles manqueraient dans le nouvel ordre de tri.
        const seen = new Set<string>();

        while (items.length === 0 && hasNextPage && pages < MAX_PAGES_PER_FETCH) {
          if (gen !== fetchGeneration.current) break;
          pages++;
          const res = await MediaLibrary.getAssetsAsync({
            mediaType: ["photo", "video"],
            first: BATCH_SIZE,
            after: endCursor,
            sortBy: [["creationTime", sortOldest]],
          });

          // Zéro appel async par photo — expo-image 3.x gère ph:// nativement sur iOS
          for (const asset of res.assets) {
            if (trashCache.current.has(asset.id) || keptCache.current.has(asset.id) || fetchedIds.current.has(asset.id) || seen.has(asset.id)) continue;
            seen.add(asset.id);
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

          endCursor = res.endCursor;
          hasNextPage = res.hasNextPage;
        }

        if (pages > 1) {
          devLog("Fetch", `${pages} pages parcourues pour ${items.length} carte(s)`, "info");
        }

        // Un changement d'ordre de tri (ou un reset) vide la pile et remet le curseur à
        // zéro pendant que cette boucle tourne: jusqu'à 25 allers-retours, soit une
        // fenêtre large. Sans ce contrôle, la requête périmée réécrivait le curseur et
        // réinjectait des photos dans l'ancien ordre dans une pile qu'on vient de vider.
        if (gen !== fetchGeneration.current) {
          devLog("Fetch", "résultat périmé ignoré (tri changé pendant le chargement)", "warn");
          return 0;
        }

        if (items.length > 0) {
          items.forEach((it) => fetchedIds.current.add(it.id));
          setAssets((prev) => {
            const map = new Map(prev.map((p) => [p.id, p]));
            items.forEach((it) => !map.has(it.id) && map.set(it.id, it));
            return Array.from(map.values());
          });
        }
        cursorRef.current = endCursor;
        hasMoreRef.current = hasNextPage;
        setHasMore(hasNextPage);
        advanced = true;
        return items.length;
      } catch (err: any) {
        logger.error("fetchAssets", err);
        devLog("Fetch", `fetchAssets FAILED: ${err?.message ?? err}`, "error");
        return 0;
      } finally {
        isFetching.current = false;
        // Fait repasser l'effet de préchargement même quand la page n'a rien donné:
        // `assets.length` seul ne bouge pas, et c'était là tout le problème. Mais
        // seulement si le curseur a avancé — pas sur un échec, qui bouclerait sans fin.
        if (advanced) setFetchTick((t) => t + 1);
      }
    },
    [sortOldest]
  );

  useEffect(() => {
    if (!cachesReady) return;
    if ((assets.length - currentIndex <= PRELOAD_THRESHOLD || currentIndex >= assets.length) && hasMore) {
      fetchAssets();
    }
  }, [assets.length, currentIndex, hasMore, fetchAssets, fetchTick, cachesReady]);

  // La valeur est relue dans le timer, jamais capturée: le bootstrap restaure le
  // compteur de façon asynchrone, et un swipe arrivé avant cette restauration aurait
  // sinon écrit « 1 » par-dessus un total de plusieurs centaines.
  // Relance une demande d'accès. Utilisé par le bouton « Réessayer » et au retour sur
  // l'écran: quelqu'un qui accorde l'accès dans les réglages système doit retrouver sa
  // photothèque en revenant, sans avoir à tuer l'app.
  const resumeAfterPermission = useCallback(() => {
    permGranted.current = true;
    setPermissionDenied(false);
    hasMoreRef.current = true;
    setHasMore(true);
    fetchAssets(true);
  }, [fetchAssets]);

  /** Bouton « Réessayer »: peut ouvrir la boîte de dialogue système. */
  const retryPermission = useCallback(async () => {
    const { status } = await MediaLibrary.requestPermissionsAsync();
    if (status === "granted") resumeAfterPermission();
  }, [resumeAfterPermission]);

  /** Retour sur l'écran: on se contente de relire le statut, sans rien demander. */
  useFocusEffect(
    useCallback(() => {
      if (!permissionDenied) return;
      MediaLibrary.getPermissionsAsync()
        .then(({ status }) => {
          if (status === "granted") resumeAfterPermission();
        })
        .catch(() => {});
    }, [permissionDenied, resumeAfterPermission])
  );

  // Passe par `storageQueue`: son listener AppState vide la file au passage en
  // arrière-plan. Avec un `setItem` direct et son debounce, Android pouvait tuer le
  // process avant l'échéance — et comme les paliers de succès testent une égalité
  // exacte, un palier perdu l'était définitivement.
  const persistTotalSwipes = useCallback(() => {
    queueWrite(TOTAL_SWIPES_KEY, totalSwipesRef.current);
  }, []);

  const addToTrash = useCallback((item: MediaItem) => {
    // Dédoublonnage, comme `addToFavorites` et `addToKept` le font déjà: sans lui, une
    // photo pouvait figurer deux fois dans la corbeille et y être comptée deux fois.
    if (trashRef.current.some((t) => t.id === item.id)) return;
    const entry = { ...item, trashedAt: Date.now() };
    const next = [entry, ...trashRef.current];
    // L'entrée évincée garde sinon son id dans `trashCache`: la photo n'est alors ni
    // dans la corbeille, ni supprimée, ni re-proposée au tri — définitivement perdue de
    // vue. On la relâche pour qu'elle revienne dans la pile.
    for (const evicted of next.slice(TRASH_CAP)) trashCache.current.delete(evicted.id);
    trashRef.current = next.slice(0, TRASH_CAP);
    setTrashCount(trashRef.current.length);
    queueWrite(TRASH_KEY, trashRef.current);
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
                queueWrite(TRASH_KEY, trashRef.current);
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
    favoritesRef.current = [item, ...favoritesRef.current].slice(0, FAV_CAP);
    AsyncStorage.setItem(FAVORITES_KEY, JSON.stringify(favoritesRef.current)).catch(() => {});
  }, []);

  const addToKept = useCallback((id: string) => {
    if (keptCache.current.has(id)) return;
    keptCache.current.add(id);
    // Écriture depuis le miroir mémoire — évite les races read-modify-write sur swipes rapides
    if (!keptListRef.current.includes(id)) {
      const next = [id, ...keptListRef.current];
      // Le `Set` en mémoire était illimité alors que seuls 10 000 ids étaient
      // persistés: au redémarrage, les plus anciennes « gardées » repassaient à trier.
      // On évince des deux côtés pour que la session et le disque disent la même chose.
      for (const evicted of next.slice(KEPT_CAP)) keptCache.current.delete(evicted);
      keptListRef.current = next.slice(0, KEPT_CAP);
      queueWrite(KEPT_KEY, keptListRef.current);
    }
  }, []);

  const removeFromKept = useCallback((id: string) => {
    keptCache.current.delete(id);
    keptListRef.current = keptListRef.current.filter(i => i !== id);
    queueWrite(KEPT_KEY, keptListRef.current);
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
      recordSwipeStat(item.fileSize, direction).catch(() => {});
      onSwipeForAd();
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

      // Compteur à vie, pas l'index de la pile: les paliers de succès testent une
      // égalité exacte, et l'index repart de 0 à chaque session depuis qu'il ne
      // compte plus que les photos restant à trier.
      // Le tutoriel se nourrit des vrais swipes: il n'y a pas de geste de
      // démonstration, c'est le geste réel sur la photo réelle qui fait avancer.
      if (coach.step !== null) {
        const good = isExpected(coach, direction);
        if (good) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        const next = advanceCoach(coach, direction);
        setCoach(next);
        if (next.step === null) AsyncStorage.setItem(ONBOARDED_KEY, "true").catch(() => {});
      }

      totalSwipesRef.current += 1;
      const newSwipeTotal = totalSwipesRef.current;
      persistTotalSwipes();
      setTimeout(() => {
        checkSwipeMilestones(newSwipeTotal).then(showAchievement);
        checkNightSwipe().then(showAchievement);
      }, 0);

      setCurrentIndex(currentIndex + 1);

      // Demande de review après 10 swipes (iOS uniquement, une seule fois)
      if (Platform.OS === "ios" && newSwipeTotal === 10) {
        setTimeout(async () => {
          try {
            const already = await AsyncStorage.getItem(REVIEW_PROMPTED_KEY);
            if (already) return;
            await AsyncStorage.setItem(REVIEW_PROMPTED_KEY, "1");
            showPopup({
              icon: "⭐",
              title: "Tu aimes SwipeClean ?",
              message: "Ça prend 30 secondes et ça aide vraiment l'app à grandir 🙏",
              buttons: [
                { text: "Plus tard", style: "cancel" },
                {
                  text: "Noter l'app",
                  style: "default",
                  onPress: () => Linking.openURL("itms-apps://itunes.apple.com/app/id6802313349?action=write-review"),
                },
              ],
            });
          } catch {}
        }, 1500);
      }
    },
    [currentIndex, assets, triggerHaptics, addToTrash, addToFavorites, addToKept, persistTotalSwipes, soundEnabled, coach]
  );

  const handleUndo = useCallback(() => {
    if (!lastSwipe || currentIndex === 0) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const { item, direction } = lastSwipe;
    if (direction === "left") {
      trashCache.current.delete(item.id);
      trashRef.current = trashRef.current.filter((i) => i.id !== item.id);
      setTrashCount(trashRef.current.length);
      queueWrite(TRASH_KEY, trashRef.current);
      Notifications.setBadgeCountAsync(trashRef.current.length).catch(() => {});
    } else if (direction === "right") {
      removeFromKept(item.id);
    } else if (direction === "top") {
      favoritesRef.current = favoritesRef.current.filter((i) => i.id !== item.id);
      AsyncStorage.setItem(FAVORITES_KEY, JSON.stringify(favoritesRef.current)).catch(() => {});
      removeFromKept(item.id);
    }
    setCurrentIndex(currentIndex - 1);
    // Annuler un swipe doit aussi décompter le palier, sinon un aller-retour sur la
    // même photo gonfle le total.
    totalSwipesRef.current = Math.max(0, totalSwipesRef.current - 1);
    persistTotalSwipes();
    setLastSwipe(null);
  }, [lastSwipe, currentIndex, persistTotalSwipes]);

  const resetGallery = useCallback(async () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    // Recommencer le tri ne remet pas à zéro les succès ni les statistiques: on ne
    // touche donc ni au compteur à vie, ni à l'ancienne clé qui lui sert de repli
    // tant que le bootstrap ne l'a pas migrée.
    await AsyncStorage.removeItem(KEPT_KEY);
    fetchGeneration.current++;
    stackProgress.value = 0;
    // La corbeille n'est pas concernée par « recommencer le tri »: on la re-sème depuis
    // `trashRef` au lieu de vider le cache. Le vider remettait les photos en attente de
    // suppression dans la pile — et comme `addToTrash` ne dédoublonne pas, un nouveau
    // swipe à gauche les y ajoutait une seconde fois.
    trashCache.current = new Set(trashRef.current.map((t) => t.id));
    keptCache.current.clear();
    keptListRef.current = [];
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
    fetchGeneration.current++;
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

  // Précharger les prochaines cartes en mémoire pour éviter les écrans noirs (surtout iOS).
  // Android: Image.prefetch passe par GlideUrl, qui attend une URL http -> MalformedURLException
  // sur file:// et content://, et décoderait la photo en pleine résolution si ça passait.
  // Le pré-décodage JSX plus bas couvre les deux plateformes.
  useEffect(() => {
    if (Platform.OS !== "ios") return;
    for (let i = 0; i <= 3; i++) {
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

  if (permissionDenied) {
    return (
      <SafeAreaView
        style={[styles.container, { backgroundColor: darkMode ? "#121212" : "#F5F5F5" }]}
      >
        <View style={styles.emptyContainer}>
          <Ionicons
            name="images-outline"
            size={72}
            color={darkMode ? "rgba(255,255,255,0.35)" : "rgba(0,0,0,0.3)"}
          />
          <Text style={[styles.emptyText, { color: darkMode ? "#fff" : "#000", marginTop: 16 }]}>
            Accès aux photos refusé
          </Text>
          <Text
            style={{
              color: darkMode ? "rgba(255,255,255,0.45)" : "rgba(0,0,0,0.4)",
              fontSize: 15,
              lineHeight: 21,
              marginTop: 8,
              textAlign: "center",
            }}
          >
            SwipeClean a besoin de voir ta photothèque pour t&apos;aider à la trier. Rien
            n&apos;est envoyé nulle part : tout reste sur ton téléphone.
          </Text>
          <TouchableOpacity onPress={retryPermission} activeOpacity={0.85} style={{ marginTop: 28 }}>
            <View style={styles.resetBtnGradient}>
              <Text style={styles.resetBtnText}>Réessayer</Text>
            </View>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => Linking.openSettings()} activeOpacity={0.7} style={{ marginTop: 14 }}>
            <Text style={{ color: darkMode ? "rgba(255,255,255,0.5)" : "rgba(0,0,0,0.45)", fontSize: 14 }}>
              Ouvrir les réglages
            </Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

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
            <View>
              <Ionicons name="menu" size={34} color={darkMode ? "#E0E0E0" : "#000"} />
              <NewBadge visible={whatsNewBadge} />
            </View>
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
                setMenuOpen(false);
                handleOpenWhatsNew();
              }}
            >
              <View style={{ position: "relative" }}>
                <Ionicons name="gift-outline" size={20} color={darkMode ? "#E0E0E0" : "#000"} />
                {whatsNewBadge && (
                  <View style={{ position: "absolute", top: -3, right: -3, width: 8, height: 8, borderRadius: 4, backgroundColor: "#FF3B30" }} />
                )}
              </View>
              <Text style={[styles.menuText, { color: darkMode ? "#E0E0E0" : "#000" }]}>
                Nouveautés
              </Text>
            </TouchableOpacity>

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
                router.push("/(tabs)/Duplicates");
                setMenuOpen(false);
              }}
            >
              <Ionicons name="copy-outline" size={20} color={darkMode ? "#E0E0E0" : "#000"} />
              <Text style={[styles.menuText, { color: darkMode ? "#E0E0E0" : "#000" }]}>
                Doublons
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
            {/* Pré-décodage des prochaines cartes pour éviter l'écran noir au swipe rapide.
                opacity/zIndex n'empêchent pas le décodage: 8 bitmaps à la taille de la carte
                = ~50 Mo de heap, reconstruits à chaque swipe -> OOM sur milieu de gamme.
                Fenêtre réduite à 2 et décodage en basse résolution. */}
            {assets.slice(currentIndex + 2, currentIndex + 4).map(asset =>
              asset?.uri && asset.type === "photo" ? (
                <Image
                  key={`pre_${asset.id}`}
                  source={{ uri: resolveMediaUri(asset.uri, asset.id, "photo") ?? asset.uri }}
                  style={{ position: "absolute", width: 1, height: 1, opacity: 0, zIndex: -1 }}
                  allowDownscaling
                  cachePolicy="disk"
                  priority="low"
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
                // FullscreenViewer rend toujours un <Image>: sur une vidéo l'overlay
                // était noir et sans indication de sortie.
                onDoubleTap={
                  topCard.type === "photo"
                    ? () => setFullscreenUri(topCard.uri)
                    : undefined
                }
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

      {popup}

      <SwipeCoach
        state={coach}
        darkMode={darkMode}
        topInset={insets.top}
        bottomInset={insets.bottom}
        onSkip={skipCoach}
      />

      <WhatsNewModal
        visible={showWhatsNew && coach.step === null}
        dark={darkMode}
        onClose={handleCloseWhatsNew}
      />

      {/* Fullscreen viewer — double-tap on swipe card. Tap = close, pinch = zoom */}
      <Modal
        visible={fullscreenUri !== null}
        transparent
        animationType="fade"
        statusBarTranslucent
        onRequestClose={() => setFullscreenUri(null)}
      >
        {/* Android: un Modal RN est une fenêtre séparée, hors du GestureHandlerRootView
            racine — sans ce wrapper, pinch/pan/tap-to-close ne reçoivent aucun touch
            et l'utilisateur se retrouve coincé dans l'overlay. */}
        <GestureHandlerRootView style={{ flex: 1 }}>
          {fullscreenUri ? (
            <FullscreenViewer uri={fullscreenUri} onClose={() => setFullscreenUri(null)} />
          ) : null}
        </GestureHandlerRootView>
      </Modal>
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

  fullscreenOverlay: {
    flex: 1,
    backgroundColor: "#000",
    justifyContent: "center",
    alignItems: "center",
  },
  fullscreenImage: {
    width: "100%",
    height: "100%",
  },
});


// Constantes stables pour éviter que React.memo soit annulé par des arrays inline
const ACTION_BTN_DELETE = [styles.actionBtn, styles.actionBtnDelete];
const ACTION_BTN_STAR   = [styles.actionBtn, styles.actionBtnStar];
const ACTION_BTN_KEEP   = [styles.actionBtn, styles.actionBtnKeep];
