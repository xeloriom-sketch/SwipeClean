// app/(tabs)/Onboarding.tsx
import React, { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  StatusBar,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  withSequence,
  withRepeat,
  withDelay,
  cancelAnimation,
  runOnJS,
} from "react-native-reanimated";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { router } from "expo-router";
import * as Haptics from "expo-haptics";

const { width, height } = Dimensions.get("window");
const ONBOARDED_KEY = "@app_onboarded";

const CARD_W = width * 0.75;
const CARD_H = CARD_W * 1.36;

type Dir = "left" | "right" | "up" | "down" | "trash" | "duplicates" | "doubletap";

const PHOTOS = [
  require("../../assets/images/onboarding_1.jpg"), // montagne — swipe gauche
  require("../../assets/images/onboarding_2.jpg"), // nature — swipe droite
  require("../../assets/images/onboarding_3.jpg"), // paysage — favoris
  require("../../assets/images/onboarding_4.jpg"), // beau — passer
  require("../../assets/images/onboarding_5.jpg"), // photo — corbeille
  require("../../assets/images/onboarding_6.jpg"), // portrait — doublons
];

const STEPS = [
  {
    key: "delete",
    dir: "left" as Dir,
    color: "#FF3B5C",
    dark: "#1C0008",
    cardTop: "#1a0510" as const,
    cardBot: "#0f1d3a" as const,
    label: "SWIPE GAUCHE",
    title: "Direction\nla corbeille.",
    desc: "Pas de suppression immédiate — récupérez toujours vos photos depuis la Corbeille.",
    icon: "trash-outline" as const,
    image: PHOTOS[0],
  },
  {
    key: "keep",
    dir: "right" as Dir,
    color: "#30D158",
    dark: "#001408",
    cardTop: "#0a1f14" as const,
    cardBot: "#1f5c40" as const,
    label: "SWIPE DROITE",
    title: "Gardez ce\nqui compte.",
    desc: "La photo reste dans votre galerie, intacte. Vos souvenirs sont préservés.",
    icon: "heart" as const,
    image: PHOTOS[1],
  },
  {
    key: "star",
    dir: "up" as Dir,
    color: "#0A84FF",
    dark: "#00061A",
    cardTop: "#00061a" as const,
    cardBot: "#1a2d4a" as const,
    label: "SWIPE HAUT",
    title: "Créez vos\nfavoris.",
    desc: "Épinglez vos meilleures photos. Retrouvez-les instantanément dans l'onglet Favoris.",
    icon: "star" as const,
    image: PHOTOS[2],
  },
  {
    key: "skip",
    dir: "down" as Dir,
    color: "#BF5AF2",
    dark: "#0D0014",
    cardTop: "#0d0014" as const,
    cardBot: "#2d1a4a" as const,
    label: "SWIPE BAS",
    title: "Passez si\nvous hésitez.",
    desc: "Pas sûr ? Glissez vers le bas pour décider plus tard. Aucune décision forcée.",
    icon: "play-skip-forward" as const,
    image: PHOTOS[3],
  },
  {
    key: "trash",
    dir: "trash" as Dir,
    color: "#FF9500",
    dark: "#1A0A00",
    cardTop: "#1a0a00" as const,
    cardBot: "#4a2800" as const,
    label: "LA CORBEILLE",
    title: "Vous gardez\nle contrôle.",
    desc: "Sélectionnez des photos, puis restaurez ou supprimez-les définitivement.",
    icon: "trash" as const,
    image: PHOTOS[4],
  },
  {
    key: "doubletap",
    dir: "doubletap" as Dir,
    color: "#FFD60A",
    dark: "#1A1400",
    cardTop: "#1a1400" as const,
    cardBot: "#3a2e00" as const,
    label: "DOUBLE TAP",
    title: "Agrandis\nla photo.",
    desc: "Double-tapez sur une photo pour l'afficher en plein écran. Pincez pour zoomer, tapez pour fermer.",
    icon: "expand-outline" as const,
    image: PHOTOS[4],
  },
  {
    key: "duplicates",
    dir: "duplicates" as Dir,
    color: "#BF5AF2",
    dark: "#0D0014",
    cardTop: "#0d0014" as const,
    cardBot: "#2d1a4a" as const,
    label: "LES DOUBLONS",
    title: "Trouvez les\ncopies cachées.",
    desc: "SwipeClean détecte automatiquement vos photos en double. Supprimez-les facilement depuis le menu Doublons.",
    icon: "copy-outline" as const,
    image: PHOTOS[5],
  },
];

/* ─── Pulsing arrow hint ───────────────────────────────────── */
function ArrowHint({ dir, color }: { dir: Dir; color: string }) {
  const op = useSharedValue(0.25);
  const shift = useSharedValue(0);

  useEffect(() => {
    op.value = withRepeat(
      withSequence(withTiming(1, { duration: 600 }), withTiming(0.25, { duration: 600 })),
      -1, false
    );
    shift.value = withRepeat(
      withSequence(withTiming(10, { duration: 600 }), withTiming(0, { duration: 600 })),
      -1, false
    );
    return () => { cancelAnimation(op); cancelAnimation(shift); };
  }, [dir]);

  const s = useAnimatedStyle(() => ({
    opacity: op.value,
    transform: [
      { translateX: dir === "left" ? -shift.value : dir === "right" ? shift.value : 0 },
      { translateY: dir === "up" ? -shift.value : dir === "down" ? shift.value : 0 },
    ],
  }));

  const iconName =
    dir === "left" ? "arrow-back" :
    dir === "right" ? "arrow-forward" :
    dir === "up" ? "arrow-up" : "arrow-down";

  const label =
    dir === "left" ? "Glissez à gauche" :
    dir === "right" ? "Glissez à droite" :
    dir === "up" ? "Glissez vers le haut" : "Glissez vers le bas";

  return (
    <Animated.View style={[arrowStyles.row, s]}>
      {(dir === "left" || dir === "up") && (
        <Ionicons name={iconName as any} size={20} color={color} />
      )}
      <Text style={[arrowStyles.label, { color }]}>{label}</Text>
      {(dir === "right" || dir === "down") && (
        <Ionicons name={iconName as any} size={20} color={color} />
      )}
    </Animated.View>
  );
}

/* ─── Swipe card (interactive) ─────────────────────────────── */
function SwipeCard({ step, onDone }: { step: typeof STEPS[0]; onDone: () => void }) {
  const tx = useSharedValue(0);
  const ty = useSharedValue(0);
  const rot = useSharedValue(0);
  const ovOp = useSharedValue(0);
  const sc = useSharedValue(1);
  const burstSc = useSharedValue(0.5);
  const burstOp = useSharedValue(0);
  const [done, setDone] = useState(false);

  const THR = 72;
  const VTHR = 480;

  useEffect(() => {
    tx.value = 0; ty.value = 0; rot.value = 0;
    ovOp.value = 0; sc.value = 1;
    burstSc.value = 0.5; burstOp.value = 0;
    setDone(false);
  }, [step.key]);

  const celebrate = () => {
    "worklet";
    burstSc.value = withTiming(2.2, { duration: 400 });
    burstOp.value = withSequence(
      withTiming(0.7, { duration: 80 }),
      withDelay(100, withTiming(0, { duration: 300 }))
    );
  };

  const complete = useCallback(() => {
    setDone(true);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setTimeout(onDone, 700);
  }, [onDone]);

  const snap = (dx: number, dy: number) => {
    "worklet";
    celebrate();
    const tx2 = dx < 0 ? -width * 1.4 : dx > 0 ? width * 1.4 : 0;
    const ty2 = dy < 0 ? -height * 0.9 : dy > 0 ? height * 0.9 : 0;
    tx.value = withTiming(tx2, { duration: 290 });
    ty.value = withTiming(ty2, { duration: 290 }, () => runOnJS(complete)());
    sc.value = withTiming(0.82, { duration: 180 });
  };

  const pan = Gesture.Pan()
    .onUpdate((e) => {
      const x = e.translationX, y = e.translationY;
      if (step.dir === "left" && x < 0) {
        tx.value = x; rot.value = x * 0.035;
        ovOp.value = Math.min(1, Math.abs(x) / THR);
      } else if (step.dir === "right" && x > 0) {
        tx.value = x; rot.value = x * 0.035;
        ovOp.value = Math.min(1, Math.abs(x) / THR);
      } else if (step.dir === "up" && y < 0) {
        ty.value = y;
        ovOp.value = Math.min(1, Math.abs(y) / THR);
      } else if (step.dir === "down" && y > 0) {
        ty.value = y;
        ovOp.value = Math.min(1, Math.abs(y) / THR);
      }
    })
    .onEnd((e) => {
      const x = e.translationX, y = e.translationY;
      const vx = e.velocityX, vy = e.velocityY;
      const go =
        (step.dir === "left"  && (x < -THR || vx < -VTHR)) ||
        (step.dir === "right" && (x >  THR || vx >  VTHR)) ||
        (step.dir === "up"    && (y < -THR || vy < -VTHR)) ||
        (step.dir === "down"  && (y >  THR || vy >  VTHR));

      if (go) {
        const dx = step.dir === "left" ? -1 : step.dir === "right" ? 1 : 0;
        const dy = step.dir === "up"   ? -1 : step.dir === "down"  ? 1 : 0;
        snap(dx, dy);
      } else {
        tx.value = withSpring(0, { damping: 14, stiffness: 180 });
        ty.value = withSpring(0, { damping: 14, stiffness: 180 });
        rot.value = withSpring(0);
        ovOp.value = withTiming(0, { duration: 200 });
      }
    });

  const cardStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: tx.value },
      { translateY: ty.value },
      { rotate: `${rot.value}deg` },
      { scale: sc.value },
    ],
  }));
  const overlayStyle = useAnimatedStyle(() => ({ opacity: ovOp.value }));
  const burstStyle = useAnimatedStyle(() => ({
    transform: [{ scale: burstSc.value }],
    opacity: burstOp.value,
  }));

  return (
    <View style={cardStyles.wrapper}>
      {/* Success burst ring */}
      <Animated.View
        pointerEvents="none"
        style={[cardStyles.burst, { borderColor: step.color }, burstStyle]}
      />

      <GestureDetector gesture={pan}>
        <Animated.View style={[cardStyles.card, cardStyle]}>
          {/* Vraie photo */}
          <Image
            source={step.image}
            style={StyleSheet.absoluteFill}
            contentFit="cover"
            cachePolicy="memory"
          />
          {/* Dégradé bas pour l'icône */}
          <LinearGradient
            colors={["transparent", "rgba(0,0,0,0.55)"]}
            style={cardStyles.photoGradient}
            pointerEvents="none"
          />
          {/* Direction icon */}
          <View style={[cardStyles.iconBadge, { backgroundColor: step.color + "CC" }]}>
            <Ionicons name={step.icon} size={28} color="#fff" />
          </View>
          {/* Gesture overlay */}
          <Animated.View style={[cardStyles.overlay, { backgroundColor: step.color + "D0" }, overlayStyle]}>
            <Ionicons name={step.icon} size={52} color="#fff" />
            <Text style={cardStyles.overlayText}>{step.title.replace("\n", " ")}</Text>
          </Animated.View>
        </Animated.View>
      </GestureDetector>

      <View style={cardStyles.hintRow}>
        {done ? (
          <>
            <Ionicons name="checkmark-circle" size={16} color={step.color} />
            <Text style={[cardStyles.hintText, { color: step.color }]}>Parfait !</Text>
          </>
        ) : (
          <ArrowHint dir={step.dir} color={step.color} />
        )}
      </View>
    </View>
  );
}

/* ─── Trash interactive demo ───────────────────────────────── */
const TRASH_PHOTOS = [
  require("../../assets/images/onboarding_1.jpg"),
  require("../../assets/images/onboarding_3.jpg"),
  require("../../assets/images/onboarding_4.jpg"),
  require("../../assets/images/onboarding_2.jpg"),
];

function TrashDemo({ color, onDone }: { color: string; onDone: () => void }) {
  const [selected, setSelected] = useState<number[]>([]);
  const [acted, setActed] = useState(false);

  const toggle = (i: number) => {
    Haptics.selectionAsync();
    setSelected((p) => (p.includes(i) ? p.filter((x) => x !== i) : [...p, i]));
  };

  const doRestore = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setActed(true);
    setTimeout(onDone, 600);
  };

  const doDelete = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    setActed(true);
    setTimeout(onDone, 600);
  };

  const GSIZE = (width * 0.84 - 16) / 3;

  return (
    <View style={trashStyles.shell}>
      <View style={trashStyles.header}>
        <Ionicons name="trash-outline" size={16} color="rgba(255,255,255,0.45)" />
        <Text style={trashStyles.headerTxt}>Corbeille · 4 photos</Text>
      </View>

      <View style={trashStyles.grid}>
        {[0, 1, 2, 3].map((i) => {
          const sel = selected.includes(i);
          return (
            <TouchableOpacity key={i} onPress={() => !acted && toggle(i)} activeOpacity={0.8}>
              <View style={[trashStyles.photo, { width: GSIZE, height: GSIZE }]}>
                <Image
                  source={TRASH_PHOTOS[i]}
                  style={StyleSheet.absoluteFill}
                  contentFit="cover"
                  cachePolicy="memory"
                />
                {sel && (
                  <View style={[trashStyles.selOver, { borderColor: color }]}>
                    <View style={[trashStyles.check, { backgroundColor: color }]}>
                      <Ionicons name="checkmark" size={11} color="#fff" />
                    </View>
                  </View>
                )}
              </View>
            </TouchableOpacity>
          );
        })}
      </View>

      <Text style={trashStyles.hint}>
        {selected.length === 0
          ? "Touchez des photos pour les sélectionner"
          : `${selected.length} sélectionnée${selected.length > 1 ? "s" : ""}`}
      </Text>

      {selected.length > 0 && !acted && (
        <View style={trashStyles.actions}>
          <TouchableOpacity
            style={[trashStyles.btn, { backgroundColor: "#22C55E" }]}
            onPress={doRestore}
          >
            <Ionicons name="refresh" size={18} color="#fff" />
            <Text style={trashStyles.btnTxt}>Restaurer</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[trashStyles.btn, { backgroundColor: "#FF3B5C" }]}
            onPress={doDelete}
          >
            <Ionicons name="trash" size={18} color="#fff" />
            <Text style={trashStyles.btnTxt}>Supprimer</Text>
          </TouchableOpacity>
        </View>
      )}

      {acted && (
        <View style={trashStyles.doneRow}>
          <Ionicons name="checkmark-circle" size={16} color={color} />
          <Text style={[trashStyles.hint, { color, marginTop: 0 }]}>Bien joué !</Text>
        </View>
      )}
    </View>
  );
}

/* ─── Double-tap demo ──────────────────────────────────────────── */
function DoubleTapDemo({ color, onDone }: { color: string; onDone: () => void }) {
  const [zoomed, setZoomed] = useState(false);
  const [acted, setActed] = useState(false);
  const sc = useSharedValue(1);
  const rippleOp = useSharedValue(0);
  const rippleSc = useSharedValue(0.3);

  const triggerZoom = () => {
    if (acted) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    rippleOp.value = withSequence(withTiming(0.7, { duration: 60 }), withTiming(0, { duration: 300 }));
    rippleSc.value = withSequence(withTiming(0.3, { duration: 1 }), withTiming(1.6, { duration: 360 }));
    sc.value = withSequence(withTiming(1.18, { duration: 220 }), withSpring(1, { damping: 10, stiffness: 180 }));
    setZoomed(true);
    setActed(true);
    setTimeout(onDone, 900);
  };

  const imgStyle = useAnimatedStyle(() => ({ transform: [{ scale: sc.value }] }));
  const rippleStyle = useAnimatedStyle(() => ({ opacity: rippleOp.value, transform: [{ scale: rippleSc.value }] }));

  const CARD_SIZE = width * 0.72;

  return (
    <View style={{ alignItems: "center", gap: 16 }}>
      <TouchableOpacity onPress={triggerZoom} activeOpacity={0.95}>
        <View style={{ width: CARD_SIZE, height: CARD_SIZE * 1.3, borderRadius: 20, overflow: "hidden", backgroundColor: "#111" }}>
          <Animated.View style={[StyleSheet.absoluteFill, imgStyle]}>
            <Image
              source={require("../../assets/images/onboarding_5.jpg")}
              style={StyleSheet.absoluteFill}
              contentFit="cover"
              cachePolicy="memory"
            />
          </Animated.View>
          {/* Ripple */}
          <Animated.View
            pointerEvents="none"
            style={[StyleSheet.absoluteFill, { alignItems: "center", justifyContent: "center" }, rippleStyle]}
          >
            <View style={{ width: 100, height: 100, borderRadius: 50, borderWidth: 2, borderColor: color }} />
          </Animated.View>
          {/* Hint overlay si pas encore agi */}
          {!acted && (
            <View style={{ position: "absolute", bottom: 12, alignSelf: "center", backgroundColor: "rgba(0,0,0,0.55)", paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20, flexDirection: "row", alignItems: "center", gap: 6 }}>
              <Ionicons name="finger-print-outline" size={14} color={color} />
              <Text style={{ color: "#fff", fontSize: 12, fontWeight: "600" }}>Double-tapez</Text>
            </View>
          )}
          {acted && (
            <View style={{ position: "absolute", bottom: 12, alignSelf: "center", backgroundColor: color + "CC", paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20, flexDirection: "row", alignItems: "center", gap: 6 }}>
              <Ionicons name="checkmark-circle" size={14} color="#fff" />
              <Text style={{ color: "#fff", fontSize: 12, fontWeight: "600" }}>Plein écran !</Text>
            </View>
          )}
        </View>
      </TouchableOpacity>
    </View>
  );
}

/* ─── Duplicates interactive demo ─────────────────────────────── */

function DuplicatesDemo({ color, onDone }: { color: string; onDone: () => void }) {
  const [deleted, setDeleted] = useState<number[]>([]);
  const [acted, setActed] = useState(false);

  const doDelete = (i: number) => {
    if (acted) return;
    Haptics.selectionAsync();
    const next = [...deleted, i];
    setDeleted(next);
    if (next.length >= 1) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setActed(true);
      setTimeout(onDone, 700);
    }
  };

  const GSIZE = (width * 0.84 - 8) / 2;

  return (
    <View style={trashStyles.shell}>
      <View style={trashStyles.header}>
        <Ionicons name="copy-outline" size={16} color="rgba(255,255,255,0.45)" />
        <Text style={trashStyles.headerTxt}>Doublons détectés · 2 groupes</Text>
      </View>

      <View style={{ gap: 12 }}>
        {/* Groupe 1 : 2 copies */}
        <View style={{ gap: 6 }}>
          <Text style={{ fontSize: 11, color: "rgba(255,255,255,0.3)", fontWeight: "600" }}>GROUPE 1 · 2 copies</Text>
          <View style={{ flexDirection: "row", gap: 8 }}>
            {[0, 1].map((i) => {
              const isDup = i === 1;
              const isDeleted = deleted.includes(i);
              return (
                <TouchableOpacity key={i} onPress={() => isDup && !isDeleted && doDelete(i)} activeOpacity={isDup ? 0.7 : 1}>
                  <View style={[{ width: GSIZE, height: GSIZE, borderRadius: 12, overflow: "hidden" }]}>
                    <Image
                      source={require("../../assets/images/onboarding_6.jpg")}
                      style={StyleSheet.absoluteFill}
                      contentFit="cover"
                      cachePolicy="memory"
                    />
                    {isDup && !isDeleted && (
                      <View style={[trashStyles.selOver, { borderColor: color, backgroundColor: color + "20" }]}>
                        <View style={[trashStyles.check, { backgroundColor: color }]}>
                          <Ionicons name="trash-outline" size={10} color="#fff" />
                        </View>
                        <View style={{ position: "absolute", bottom: 6, left: 6, backgroundColor: "rgba(0,0,0,0.55)", paddingHorizontal: 5, paddingVertical: 2, borderRadius: 6 }}>
                          <Text style={{ color: "#fff", fontSize: 9, fontWeight: "700" }}>DOUBLON</Text>
                        </View>
                      </View>
                    )}
                    {isDeleted && (
                      <View style={[StyleSheet.absoluteFill, { backgroundColor: "rgba(0,0,0,0.65)", alignItems: "center", justifyContent: "center", borderRadius: 12 }]}>
                        <Ionicons name="checkmark-circle" size={28} color={color} />
                      </View>
                    )}
                    {!isDup && (
                      <View style={{ position: "absolute", bottom: 6, left: 6, backgroundColor: "rgba(0,0,0,0.55)", paddingHorizontal: 5, paddingVertical: 2, borderRadius: 6 }}>
                        <Text style={{ color: "#fff", fontSize: 9, fontWeight: "700" }}>ORIGINAL</Text>
                      </View>
                    )}
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      </View>

      <Text style={trashStyles.hint}>
        {acted ? "Doublon supprimé !" : "Touchez le doublon pour le supprimer"}
      </Text>
      {acted && (
        <View style={trashStyles.doneRow}>
          <Ionicons name="checkmark-circle" size={16} color={color} />
          <Text style={[trashStyles.hint, { color, marginTop: 0 }]}>Parfait !</Text>
        </View>
      )}
    </View>
  );
}

/* ─── Single particle (hook at component level) ─────────────── */
const PCFG = [
  { sz: 5, x: 0.12, y: 0.24, dur: 4200, delay: 0 },
  { sz: 3, x: 0.85, y: 0.18, dur: 5100, delay: 400 },
  { sz: 7, x: 0.78, y: 0.72, dur: 3800, delay: 200 },
  { sz: 4, x: 0.14, y: 0.68, dur: 4700, delay: 600 },
  { sz: 5, x: 0.92, y: 0.42, dur: 4300, delay: 100 },
  { sz: 3, x: 0.55, y: 0.88, dur: 5800, delay: 800 },
];

function Particle({ color, cfg }: { color: string; cfg: typeof PCFG[0] }) {
  const ty = useSharedValue(0);
  const op = useSharedValue(0);
  useEffect(() => {
    ty.value = withDelay(
      cfg.delay,
      withRepeat(withSequence(withTiming(-15, { duration: cfg.dur }), withTiming(0, { duration: cfg.dur })), -1, true)
    );
    op.value = withDelay(
      cfg.delay,
      withRepeat(withSequence(withTiming(0.4, { duration: cfg.dur / 2 }), withTiming(0.07, { duration: cfg.dur / 2 })), -1, true)
    );
    return () => { cancelAnimation(ty); cancelAnimation(op); };
  }, [color]);
  const s = useAnimatedStyle(() => ({ transform: [{ translateY: ty.value }], opacity: op.value }));
  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.particle, s,
        {
          width: cfg.sz, height: cfg.sz, borderRadius: cfg.sz / 2,
          backgroundColor: color,
          left: cfg.x * width, top: cfg.y * height,
        },
      ]}
    />
  );
}

/* ─── Main screen ────────────────────────────────────────────── */
export default function OnboardingScreen() {
  const [stepIdx, setStepIdx] = useState(0);
  const [canSkip, setCanSkip] = useState(false);
  const contOp = useSharedValue(1);
  const titleY = useSharedValue(0);

  const step = STEPS[stepIdx];

  useEffect(() => {
    setCanSkip(false);
    const t = setTimeout(() => setCanSkip(true), 6000);
    return () => clearTimeout(t);
  }, [stepIdx]);

  const goTo = useCallback((next: number) => {
    if (next >= STEPS.length) { doFinish(); return; }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    contOp.value = withTiming(0, { duration: 150 }, () => {
      runOnJS(setStepIdx)(next);
      titleY.value = 30;
      titleY.value = withSpring(0, { damping: 18, stiffness: 200 });
      contOp.value = withTiming(1, { duration: 230 });
    });
  }, []);

  const doFinish = async () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    await AsyncStorage.setItem(ONBOARDED_KEY, "true");
    router.replace("/");
  };

  const headerStyle = useAnimatedStyle(() => ({
    opacity: contOp.value,
    transform: [{ translateY: titleY.value }],
  }));

  return (
    <View style={styles.screen}>
      <StatusBar barStyle="light-content" />
      <LinearGradient
        colors={[step.dark, "#050505"]}
        locations={[0, 0.6]}
        style={StyleSheet.absoluteFill}
      />

      {PCFG.map((cfg, i) => (
        <Particle key={i} color={step.color} cfg={cfg} />
      ))}

      <SafeAreaView style={styles.safe}>
        {/* Top bar */}
        <View style={styles.topBar}>
          <View style={styles.dots}>
            {STEPS.map((_, i) => (
              <View
                key={i}
                style={[
                  styles.dot,
                  i === stepIdx && [styles.dotActive, { backgroundColor: step.color, width: 22 }],
                  i < stepIdx && [styles.dotDone, { backgroundColor: step.color + "55", width: 8 }],
                ]}
              />
            ))}
          </View>
          <TouchableOpacity
            onPress={doFinish}
            hitSlop={{ top: 14, bottom: 14, left: 14, right: 14 }}
          >
            <Text style={styles.skipTxt}>Passer</Text>
          </TouchableOpacity>
        </View>

        {/* Header text */}
        <Animated.View style={[styles.header, headerStyle]}>
          <View style={[styles.pill, { borderColor: step.color + "50", backgroundColor: step.color + "14" }]}>
            <View style={[styles.pillDot, { backgroundColor: step.color }]} />
            <Text style={[styles.pillTxt, { color: step.color }]}>{step.label}</Text>
          </View>
          <Text style={styles.title}>{step.title}</Text>
        </Animated.View>

        {/* Interactive zone */}
        <View style={styles.zone}>
          {step.dir === "trash" ? (
            <TrashDemo key={step.key} color={step.color} onDone={() => goTo(stepIdx + 1)} />
          ) : step.dir === "duplicates" ? (
            <DuplicatesDemo key={step.key} color={step.color} onDone={() => goTo(stepIdx + 1)} />
          ) : step.dir === "doubletap" ? (
            <DoubleTapDemo key={step.key} color={step.color} onDone={() => goTo(stepIdx + 1)} />
          ) : (
            <SwipeCard key={step.key} step={step} onDone={() => goTo(stepIdx + 1)} />
          )}
        </View>

        {/* Bottom */}
        <View style={styles.bottom}>
          <Text style={styles.desc}>{step.desc}</Text>

          {canSkip && (
            <TouchableOpacity
              style={[styles.skipStep, { borderColor: step.color + "45" }]}
              onPress={() => goTo(stepIdx + 1)}
            >
              <Text style={[styles.skipStepTxt, { color: step.color }]}>
                {stepIdx === STEPS.length - 1 ? "Commencer →" : "Étape suivante →"}
              </Text>
            </TouchableOpacity>
          )}
        </View>
      </SafeAreaView>
    </View>
  );
}

/* ─── Styles ─────────────────────────────────────────────────── */
const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#000" },
  safe: { flex: 1 },
  particle: { position: "absolute" },

  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 22,
    paddingTop: Platform.OS === "android" ? 10 : 4,
    paddingBottom: 6,
  },
  dots: { flexDirection: "row", gap: 5, alignItems: "center" },
  dot: { height: 5, width: 5, borderRadius: 3, backgroundColor: "rgba(255,255,255,0.12)" },
  dotActive: { height: 5, borderRadius: 3 },
  dotDone: { height: 5, borderRadius: 3 },
  skipTxt: { fontSize: 13, color: "rgba(255,255,255,0.28)", fontWeight: "500" },

  header: { paddingHorizontal: 24, paddingTop: 12, gap: 10 },
  pill: {
    flexDirection: "row", alignItems: "center", gap: 7,
    borderWidth: 1, borderRadius: 100,
    paddingHorizontal: 11, paddingVertical: 5,
    alignSelf: "flex-start",
  },
  pillDot: { width: 5, height: 5, borderRadius: 3 },
  pillTxt: { fontSize: 10, fontWeight: "800", letterSpacing: 0.9 },
  title: {
    fontSize: 38,
    fontWeight: "800",
    color: "#FFFFFF",
    letterSpacing: -1,
    lineHeight: 44,
  },

  zone: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 10,
  },

  bottom: {
    paddingHorizontal: 24,
    paddingBottom: Platform.OS === "android" ? 18 : 8,
    gap: 14,
  },
  desc: {
    fontSize: 14.5,
    color: "rgba(255,255,255,0.42)",
    lineHeight: 22,
    maxWidth: 320,
  },
  skipStep: {
    alignSelf: "flex-start",
    borderWidth: 1,
    borderRadius: 100,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  skipStepTxt: { fontSize: 13, fontWeight: "600" },
});

const cardStyles = StyleSheet.create({
  wrapper: { alignItems: "center", gap: 18 },

  burst: {
    position: "absolute",
    width: CARD_W * 0.85,
    height: CARD_W * 0.85,
    borderRadius: CARD_W * 0.5,
    borderWidth: 2,
  },

  card: {
    width: CARD_W,
    height: CARD_H,
    borderRadius: 24,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.55,
    shadowRadius: 24,
    elevation: 16,
  },

  photoGradient: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    height: 80,
  },

  iconBadge: {
    position: "absolute",
    bottom: 18,
    left: 18,
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },

  overlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },
  overlayText: { color: "#fff", fontSize: 18, fontWeight: "700", letterSpacing: 0.2 },

  hintRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  hintText: { fontSize: 13, fontWeight: "600" },
});

const arrowStyles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 8 },
  label: { fontSize: 13, fontWeight: "600" },
});

const trashStyles = StyleSheet.create({
  shell: {
    width: width * 0.86,
    backgroundColor: "rgba(255,255,255,0.04)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
    borderRadius: 22,
    padding: 16,
    gap: 14,
  },
  header: { flexDirection: "row", alignItems: "center", gap: 8 },
  headerTxt: { fontSize: 13, color: "rgba(255,255,255,0.45)", fontWeight: "600" },

  grid: { flexDirection: "row", flexWrap: "wrap", gap: 8, justifyContent: "flex-start" },
  photo: { borderRadius: 12, overflow: "hidden" },

  selOver: {
    ...StyleSheet.absoluteFillObject,
    borderWidth: 2.5,
    borderRadius: 12,
    backgroundColor: "rgba(0,184,230,0.15)",
  },
  check: {
    position: "absolute",
    top: 7,
    right: 7,
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },

  hint: { fontSize: 12, color: "rgba(255,255,255,0.35)", textAlign: "center", marginTop: 2 },

  actions: { flexDirection: "row", gap: 10 },
  btn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    height: 46,
    borderRadius: 14,
  },
  btnTxt: { color: "#fff", fontSize: 14, fontWeight: "700" },

  doneRow: { flexDirection: "row", alignItems: "center", gap: 6, justifyContent: "center" },
});
