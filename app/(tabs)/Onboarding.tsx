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
const CARD_W = width * 0.72;
const CARD_H = CARD_W * 1.36;

type Dir = "left" | "right" | "up" | "down" | "trash" | "duplicates" | "doubletap";

const PHOTOS = [
  require("../../assets/images/onboarding_1.jpg"),
  require("../../assets/images/onboarding_2.jpg"),
  require("../../assets/images/onboarding_3.jpg"),
  require("../../assets/images/onboarding_4.jpg"),
  require("../../assets/images/onboarding_5.jpg"),
  require("../../assets/images/onboarding_6.jpg"),
];

const STEPS = [
  {
    key: "delete",
    dir: "left" as Dir,
    color: "#FF375F",
    icon: "trash-outline" as const,
    label: "Supprimer",
    title: "Direction\nla corbeille.",
    desc: "Pas de suppression immédiate — récupérez toujours vos photos depuis la Corbeille.",
    image: PHOTOS[0],
  },
  {
    key: "keep",
    dir: "right" as Dir,
    color: "#30D158",
    icon: "heart" as const,
    label: "Garder",
    title: "Gardez ce\nqui compte.",
    desc: "La photo reste dans votre galerie, intacte. Vos souvenirs sont préservés.",
    image: PHOTOS[1],
  },
  {
    key: "star",
    dir: "up" as Dir,
    color: "#0A84FF",
    icon: "star" as const,
    label: "Favori",
    title: "Créez vos\nfavoris.",
    desc: "Épinglez vos meilleures photos. Retrouvez-les instantanément dans l'onglet Favoris.",
    image: PHOTOS[2],
  },
  {
    key: "skip",
    dir: "down" as Dir,
    color: "#BF5AF2",
    icon: "play-skip-forward" as const,
    label: "Passer",
    title: "Passez si\nvous hésitez.",
    desc: "Pas sûr ? Glissez vers le bas pour décider plus tard. Aucune décision forcée.",
    image: PHOTOS[3],
  },
  {
    key: "trash",
    dir: "trash" as Dir,
    color: "#FF9F0A",
    icon: "trash" as const,
    label: "Corbeille",
    title: "Vous gardez\nle contrôle.",
    desc: "Sélectionnez des photos, puis restaurez ou supprimez-les définitivement.",
    image: PHOTOS[4],
  },
  {
    key: "doubletap",
    dir: "doubletap" as Dir,
    color: "#FFD60A",
    icon: "expand-outline" as const,
    label: "Plein écran",
    title: "Agrandis\nla photo.",
    desc: "Double-tapez sur une photo pour l'afficher en plein écran. Pincez pour zoomer.",
    image: PHOTOS[4],
  },
  {
    key: "duplicates",
    dir: "duplicates" as Dir,
    color: "#5E5CE6",
    icon: "copy-outline" as const,
    label: "Doublons",
    title: "Trouvez les\ncopies cachées.",
    desc: "SwipeClean détecte automatiquement vos photos en double. Supprimez-les en un tap.",
    image: PHOTOS[5],
  },
];

/* ─── Swipe hint ─────────────────────────────────────────────── */
function ArrowHint({ dir, color }: { dir: Dir; color: string }) {
  const shift = useSharedValue(0);
  const op = useSharedValue(0.5);

  useEffect(() => {
    shift.value = withRepeat(
      withSequence(withTiming(8, { duration: 550 }), withTiming(0, { duration: 550 })),
      -1, false
    );
    op.value = withRepeat(
      withSequence(withTiming(1, { duration: 550 }), withTiming(0.4, { duration: 550 })),
      -1, false
    );
    return () => { cancelAnimation(shift); cancelAnimation(op); };
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
    <Animated.View style={[hintStyles.row, s]}>
      {(dir === "left" || dir === "up") && (
        <Ionicons name={iconName as any} size={16} color={color} />
      )}
      <Text style={[hintStyles.label, { color }]}>{label}</Text>
      {(dir === "right" || dir === "down") && (
        <Ionicons name={iconName as any} size={16} color={color} />
      )}
    </Animated.View>
  );
}

/* ─── Swipe card ─────────────────────────────────────────────── */
function SwipeCard({ step, onDone }: { step: typeof STEPS[0]; onDone: () => void }) {
  const tx = useSharedValue(0);
  const ty = useSharedValue(0);
  const rot = useSharedValue(0);
  const ovOp = useSharedValue(0);
  const sc = useSharedValue(1);
  const [done, setDone] = useState(false);
  const THR = 72;
  const VTHR = 480;

  useEffect(() => {
    tx.value = 0; ty.value = 0; rot.value = 0;
    ovOp.value = 0; sc.value = 1;
    setDone(false);
  }, [step.key]);

  const complete = useCallback(() => {
    setDone(true);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setTimeout(onDone, 600);
  }, [onDone]);

  const snap = (dx: number, dy: number) => {
    "worklet";
    const tx2 = dx < 0 ? -width * 1.4 : dx > 0 ? width * 1.4 : 0;
    const ty2 = dy < 0 ? -height * 0.9 : dy > 0 ? height * 0.9 : 0;
    tx.value = withTiming(tx2, { duration: 280 });
    ty.value = withTiming(ty2, { duration: 280 }, () => runOnJS(complete)());
    sc.value = withTiming(0.88, { duration: 160 });
  };

  const pan = Gesture.Pan()
    .onUpdate((e) => {
      const x = e.translationX, y = e.translationY;
      if (step.dir === "left" && x < 0) {
        tx.value = x; rot.value = x * 0.032;
        ovOp.value = Math.min(1, Math.abs(x) / THR);
      } else if (step.dir === "right" && x > 0) {
        tx.value = x; rot.value = x * 0.032;
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
        ovOp.value = withTiming(0, { duration: 180 });
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

  return (
    <View style={cardStyles.wrapper}>
      <GestureDetector gesture={pan}>
        <Animated.View style={[cardStyles.card, cardStyle]}>
          <Image
            source={step.image}
            style={StyleSheet.absoluteFill}
            contentFit="cover"
            cachePolicy="memory"
          />
          <LinearGradient
            colors={["transparent", "rgba(0,0,0,0.5)"]}
            style={cardStyles.photoGrad}
            pointerEvents="none"
          />
          <View style={[cardStyles.badge, { backgroundColor: step.color }]}>
            <Ionicons name={step.icon} size={20} color="#fff" />
          </View>
          <Animated.View
            style={[cardStyles.overlay, { backgroundColor: step.color + "CC" }, overlayStyle]}
          >
            <Ionicons name={step.icon} size={44} color="#fff" />
            <Text style={cardStyles.overlayTxt}>{step.label}</Text>
          </Animated.View>
        </Animated.View>
      </GestureDetector>

      <View style={cardStyles.hintRow}>
        {done ? (
          <View style={cardStyles.doneChip}>
            <Ionicons name="checkmark-circle-outline" size={14} color={step.color} />
            <Text style={[cardStyles.doneText, { color: step.color }]}>Parfait !</Text>
          </View>
        ) : (
          <ArrowHint dir={step.dir} color="rgba(255,255,255,0.35)" />
        )}
      </View>
    </View>
  );
}

/* ─── Trash demo ─────────────────────────────────────────────── */
const TRASH_PHOTOS = [PHOTOS[0], PHOTOS[2], PHOTOS[3], PHOTOS[1]];

function TrashDemo({ color, onDone }: { color: string; onDone: () => void }) {
  const [selected, setSelected] = useState<number[]>([]);
  const [acted, setActed] = useState(false);
  const GSIZE = (width * 0.82 - 40) / 4;

  const toggle = (i: number) => {
    if (acted) return;
    Haptics.selectionAsync();
    setSelected((p) => (p.includes(i) ? p.filter((x) => x !== i) : [...p, i]));
  };

  const doAction = (action: "restore" | "delete") => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setActed(true);
    setTimeout(onDone, 700);
  };

  return (
    <View style={demoStyles.shell}>
      {/* Fausse barre de navigation */}
      <View style={demoStyles.navBar}>
        <Text style={demoStyles.navTitle}>Corbeille</Text>
        <Text style={demoStyles.navSub}>4 éléments</Text>
      </View>

      {/* Grille de photos */}
      <View style={demoStyles.grid}>
        {[0, 1, 2, 3].map((i) => {
          const sel = selected.includes(i);
          return (
            <TouchableOpacity key={i} onPress={() => toggle(i)} activeOpacity={0.85}>
              <View style={[demoStyles.thumb, { width: GSIZE, height: GSIZE }]}>
                <Image
                  source={TRASH_PHOTOS[i]}
                  style={StyleSheet.absoluteFill}
                  contentFit="cover"
                  cachePolicy="memory"
                />
                {sel && (
                  <View style={demoStyles.selMask}>
                    <View style={[demoStyles.selCheck, { backgroundColor: color }]}>
                      <Ionicons name="checkmark" size={10} color="#fff" />
                    </View>
                  </View>
                )}
              </View>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Barre d'actions */}
      {selected.length > 0 && !acted ? (
        <View style={demoStyles.actionBar}>
          <TouchableOpacity style={[demoStyles.actionBtn, { backgroundColor: "rgba(255,255,255,0.08)" }]} onPress={() => doAction("restore")}>
            <Ionicons name="arrow-undo-outline" size={16} color="#fff" />
            <Text style={demoStyles.actionTxt}>Restaurer</Text>
          </TouchableOpacity>
          <View style={demoStyles.separator} />
          <TouchableOpacity style={[demoStyles.actionBtn, { backgroundColor: "rgba(255,255,255,0.08)" }]} onPress={() => doAction("delete")}>
            <Ionicons name="trash-outline" size={16} color="#FF375F" />
            <Text style={[demoStyles.actionTxt, { color: "#FF375F" }]}>Supprimer</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <Text style={demoStyles.hint}>
          {acted
            ? "✓  Action effectuée"
            : "Sélectionnez des photos pour agir"}
        </Text>
      )}
    </View>
  );
}

/* ─── Double tap demo ────────────────────────────────────────── */
function DoubleTapDemo({ color, onDone }: { color: string; onDone: () => void }) {
  const [acted, setActed] = useState(false);
  const sc = useSharedValue(1);
  const rippleOp = useSharedValue(0);
  const rippleSc = useSharedValue(0.3);
  const CARD_SIZE = width * 0.68;

  const triggerZoom = () => {
    if (acted) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    rippleOp.value = withSequence(withTiming(0.6, { duration: 60 }), withTiming(0, { duration: 320 }));
    rippleSc.value = withSequence(withTiming(0.3, { duration: 1 }), withTiming(1.7, { duration: 380 }));
    sc.value = withSequence(withTiming(1.14, { duration: 200 }), withSpring(1, { damping: 10, stiffness: 180 }));
    setActed(true);
    setTimeout(onDone, 900);
  };

  const imgStyle = useAnimatedStyle(() => ({ transform: [{ scale: sc.value }] }));
  const rippleStyle = useAnimatedStyle(() => ({ opacity: rippleOp.value, transform: [{ scale: rippleSc.value }] }));

  return (
    <View style={demoStyles.shell}>
      <View style={demoStyles.navBar}>
        <Text style={demoStyles.navTitle}>Photo</Text>
        <Text style={demoStyles.navSub}>Double-tapez pour zoomer</Text>
      </View>
      <TouchableOpacity onPress={triggerZoom} activeOpacity={0.97}>
        <View style={{ width: CARD_SIZE, height: CARD_SIZE * 0.82, borderRadius: 14, overflow: "hidden", backgroundColor: "#111" }}>
          <Animated.View style={[StyleSheet.absoluteFill, imgStyle]}>
            <Image
              source={require("../../assets/images/onboarding_5.jpg")}
              style={StyleSheet.absoluteFill}
              contentFit="cover"
              cachePolicy="memory"
            />
          </Animated.View>
          <Animated.View
            pointerEvents="none"
            style={[StyleSheet.absoluteFill, { alignItems: "center", justifyContent: "center" }, rippleStyle]}
          >
            <View style={{ width: 90, height: 90, borderRadius: 45, borderWidth: 1.5, borderColor: "rgba(255,255,255,0.7)" }} />
          </Animated.View>
        </View>
      </TouchableOpacity>
      <Text style={demoStyles.hint}>
        {acted ? "✓  Zoom activé" : "Tapez deux fois sur la photo"}
      </Text>
    </View>
  );
}

/* ─── Duplicates demo ────────────────────────────────────────── */
function DuplicatesDemo({ color, onDone }: { color: string; onDone: () => void }) {
  const [deleted, setDeleted] = useState<number[]>([]);
  const [acted, setActed] = useState(false);
  const GSIZE = (width * 0.82 - 40) / 2 - 4;

  const doDelete = (i: number) => {
    if (acted) return;
    Haptics.selectionAsync();
    setDeleted([...deleted, i]);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setActed(true);
    setTimeout(onDone, 700);
  };

  return (
    <View style={demoStyles.shell}>
      <View style={demoStyles.navBar}>
        <Text style={demoStyles.navTitle}>Doublons</Text>
        <Text style={demoStyles.navSub}>1 groupe · 2 copies</Text>
      </View>
      <View style={{ gap: 6 }}>
        <Text style={demoStyles.groupLabel}>GROUPE 1</Text>
        <View style={{ flexDirection: "row", gap: 8 }}>
          {[0, 1].map((i) => {
            const isDup = i === 1;
            const isDel = deleted.includes(i);
            return (
              <TouchableOpacity key={i} onPress={() => isDup && doDelete(i)} activeOpacity={isDup ? 0.8 : 1}>
                <View style={{ width: GSIZE, height: GSIZE, borderRadius: 12, overflow: "hidden", backgroundColor: "#111" }}>
                  <Image
                    source={require("../../assets/images/onboarding_6.jpg")}
                    style={StyleSheet.absoluteFill}
                    contentFit="cover"
                    cachePolicy="memory"
                  />
                  {/* Badge original / doublon */}
                  <View style={[demoStyles.badge, isDup ? { backgroundColor: "#FF375F" } : { backgroundColor: "rgba(255,255,255,0.2)" }]}>
                    <Text style={demoStyles.badgeTxt}>{isDup ? "DOUBLON" : "ORIGINAL"}</Text>
                  </View>
                  {isDel && (
                    <View style={[StyleSheet.absoluteFill, { backgroundColor: "rgba(0,0,0,0.6)", alignItems: "center", justifyContent: "center", borderRadius: 12 }]}>
                      <Ionicons name="checkmark-circle" size={30} color={color} />
                    </View>
                  )}
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>
      <Text style={demoStyles.hint}>
        {acted ? "✓  Doublon supprimé" : "Touchez le doublon pour le supprimer"}
      </Text>
    </View>
  );
}

/* ─── Main screen ────────────────────────────────────────────── */
export default function OnboardingScreen() {
  const [stepIdx, setStepIdx] = useState(0);
  const [canSkip, setCanSkip] = useState(false);
  const fadeAnim = useSharedValue(1);
  const slideAnim = useSharedValue(0);

  const step = STEPS[stepIdx];

  useEffect(() => {
    setCanSkip(false);
    const t = setTimeout(() => setCanSkip(true), 5000);
    return () => clearTimeout(t);
  }, [stepIdx]);

  const goTo = useCallback((next: number) => {
    if (next >= STEPS.length) { doFinish(); return; }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    fadeAnim.value = withTiming(0, { duration: 140 }, () => {
      runOnJS(setStepIdx)(next);
      slideAnim.value = 18;
      slideAnim.value = withSpring(0, { damping: 20, stiffness: 220 });
      fadeAnim.value = withTiming(1, { duration: 200 });
    });
  }, []);

  const doFinish = async () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    await AsyncStorage.setItem(ONBOARDED_KEY, "true");
    router.replace("/");
  };

  const contentStyle = useAnimatedStyle(() => ({
    opacity: fadeAnim.value,
    transform: [{ translateY: slideAnim.value }],
  }));

  return (
    <View style={S.screen}>
      <StatusBar barStyle="light-content" />

      <SafeAreaView style={S.safe}>
        {/* Top bar */}
        <View style={S.topBar}>
          <View style={S.stepIndicator}>
            {STEPS.map((_, i) => (
              <View
                key={i}
                style={[
                  S.dot,
                  i === stepIdx && [S.dotActive, { width: 20, backgroundColor: step.color }],
                  i < stepIdx && { backgroundColor: "rgba(255,255,255,0.25)", width: 6 },
                ]}
              />
            ))}
          </View>
          <TouchableOpacity onPress={doFinish} hitSlop={{ top: 14, bottom: 14, left: 14, right: 14 }}>
            <Text style={S.skipTxt}>Passer</Text>
          </TouchableOpacity>
        </View>

        {/* Content */}
        <Animated.View style={[S.content, contentStyle]}>
          {/* Icon */}
          <View style={[S.iconWrap, { backgroundColor: step.color + "1A" }]}>
            <Ionicons name={step.icon} size={28} color={step.color} />
          </View>

          {/* Title */}
          <Text style={S.title}>{step.title}</Text>
        </Animated.View>

        {/* Interactive zone */}
        <View style={S.zone}>
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
        <View style={S.bottom}>
          <Text style={S.desc}>{step.desc}</Text>

          {canSkip && (
            <TouchableOpacity
              style={[S.continueBtn, { backgroundColor: step.color }]}
              onPress={() => goTo(stepIdx + 1)}
              activeOpacity={0.88}
            >
              <Text style={S.continueTxt}>
                {stepIdx === STEPS.length - 1 ? "Commencer" : "Continuer"}
              </Text>
              <Ionicons name="arrow-forward" size={16} color="#fff" />
            </TouchableOpacity>
          )}
        </View>
      </SafeAreaView>
    </View>
  );
}

/* ─── Styles ─────────────────────────────────────────────────── */
const S = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#000" },
  safe: { flex: 1 },

  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 22,
    paddingTop: Platform.OS === "android" ? 10 : 4,
    paddingBottom: 8,
  },
  stepIndicator: { flexDirection: "row", gap: 5, alignItems: "center" },
  dot: { height: 5, width: 6, borderRadius: 3, backgroundColor: "rgba(255,255,255,0.12)" },
  dotActive: { height: 5, borderRadius: 3 },
  skipTxt: {
    fontSize: 15,
    color: "rgba(255,255,255,0.35)",
    fontWeight: "500",
  },

  content: {
    paddingHorizontal: 26,
    paddingTop: 10,
    paddingBottom: 4,
    gap: 14,
  },
  iconWrap: {
    width: 58,
    height: 58,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    fontSize: 36,
    fontWeight: "800",
    color: "#FFFFFF",
    letterSpacing: -1,
    lineHeight: 42,
  },

  zone: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 8,
  },

  bottom: {
    paddingHorizontal: 22,
    paddingBottom: Platform.OS === "android" ? 20 : 8,
    gap: 16,
  },
  desc: {
    fontSize: 15,
    color: "rgba(255,255,255,0.45)",
    lineHeight: 22,
  },
  continueBtn: {
    height: 54,
    borderRadius: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  continueTxt: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "700",
    letterSpacing: 0.1,
  },
});

const cardStyles = StyleSheet.create({
  wrapper: { alignItems: "center", gap: 16 },
  card: {
    width: CARD_W,
    height: CARD_H,
    borderRadius: 22,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.5,
    shadowRadius: 20,
    elevation: 14,
  },
  photoGrad: {
    position: "absolute",
    left: 0, right: 0, bottom: 0,
    height: 70,
  },
  badge: {
    position: "absolute",
    bottom: 16,
    left: 16,
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },
  overlayTxt: {
    color: "#fff",
    fontSize: 17,
    fontWeight: "700",
    letterSpacing: 0.1,
  },
  hintRow: { flexDirection: "row", alignItems: "center", gap: 6, height: 24 },
  doneChip: { flexDirection: "row", alignItems: "center", gap: 5 },
  doneText: { fontSize: 13, fontWeight: "600" },
});

const hintStyles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 6 },
  label: { fontSize: 13, fontWeight: "500" },
});

const demoStyles = StyleSheet.create({
  shell: {
    width: width * 0.82,
    backgroundColor: "#111",
    borderRadius: 20,
    overflow: "hidden",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,255,255,0.08)",
    padding: 0,
    gap: 0,
  },
  navBar: {
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "rgba(255,255,255,0.07)",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  navTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: "#fff",
  },
  navSub: {
    fontSize: 12,
    color: "rgba(255,255,255,0.35)",
    fontWeight: "500",
  },
  grid: {
    flexDirection: "row",
    padding: 12,
    gap: 6,
  },
  thumb: {
    borderRadius: 10,
    overflow: "hidden",
    backgroundColor: "#1a1a1a",
  },
  selMask: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.3)",
    borderRadius: 10,
  },
  selCheck: {
    position: "absolute",
    top: 6,
    right: 6,
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
  },
  actionBar: {
    flexDirection: "row",
    marginHorizontal: 12,
    marginBottom: 12,
    borderRadius: 12,
    overflow: "hidden",
    backgroundColor: "rgba(255,255,255,0.06)",
  },
  actionBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 12,
  },
  actionTxt: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "600",
  },
  separator: {
    width: StyleSheet.hairlineWidth,
    backgroundColor: "rgba(255,255,255,0.1)",
  },
  hint: {
    fontSize: 13,
    color: "rgba(255,255,255,0.3)",
    textAlign: "center",
    paddingVertical: 12,
    paddingHorizontal: 16,
    fontWeight: "500",
  },
  groupLabel: {
    fontSize: 10,
    fontWeight: "700",
    color: "rgba(255,255,255,0.25)",
    letterSpacing: 0.8,
    paddingHorizontal: 12,
    paddingTop: 12,
  },
  badge: {
    position: "absolute",
    bottom: 7,
    left: 7,
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 6,
  },
  badgeTxt: {
    color: "#fff",
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 0.5,
  },
});
