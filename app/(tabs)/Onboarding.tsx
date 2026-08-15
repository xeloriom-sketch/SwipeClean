// app/(tabs)/Onboarding.tsx
import React, { useEffect, useRef } from "react";
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
  interpolate,
  Extrapolate,
  cancelAnimation,
  runOnJS,
} from "react-native-reanimated";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { router } from "expo-router";
import * as Haptics from "expo-haptics";

const { width, height } = Dimensions.get("window");
const ONBOARDED_KEY = "@app_onboarded";

/* ─── Step definitions ─────────────────────────────────────── */
const STEPS = [
  {
    key: "delete",
    color: "#FF3B5C",
    dark: "#1C0008",
    icon: "close" as const,
    label: "SWIPE GAUCHE",
    title: "Supprimez\nsans regret.",
    desc: "Glissez à gauche pour envoyer une photo à la corbeille. Elle reste récupérable jusqu'à suppression définitive.",
    anim: "shake",
  },
  {
    key: "keep",
    color: "#30D158",
    dark: "#001408",
    icon: "heart" as const,
    label: "SWIPE DROITE",
    title: "Gardez ce\nqui compte.",
    desc: "Glissez à droite pour conserver vos souvenirs précieux. La photo reste dans votre galerie, intacte.",
    anim: "pulse",
  },
  {
    key: "star",
    color: "#0A84FF",
    dark: "#00061A",
    icon: "star" as const,
    label: "SWIPE HAUT",
    title: "Créez vos\nfavoris.",
    desc: "Glissez vers le haut pour épingler vos meilleures photos. Retrouvez-les instantanément.",
    anim: "spin",
  },
  {
    key: "skip",
    color: "#EBEBF5",
    dark: "#0D0D10",
    icon: "play-skip-forward" as const,
    label: "SWIPE BAS",
    title: "Passez si\nvous hésitez.",
    desc: "Pas sûr ? Glissez vers le bas pour passer à la suivante. Aucune décision forcée.",
    anim: "slide",
  },
];

/* ─── Ripple rings ─────────────────────────────────────────── */
function Ripples({ color }: { color: string }) {
  const rings = [0, 1, 2].map(() => ({
    scale: useSharedValue(0.6),
    opacity: useSharedValue(0),
  }));

  useEffect(() => {
    rings.forEach((r, i) => {
      cancelAnimation(r.scale);
      cancelAnimation(r.opacity);
      r.scale.value = 0.6;
      r.opacity.value = 0;

      r.scale.value = withDelay(
        i * 500,
        withRepeat(withTiming(2.2, { duration: 2000 }), -1, false)
      );
      r.opacity.value = withDelay(
        i * 500,
        withRepeat(
          withSequence(
            withTiming(0.35, { duration: 200 }),
            withTiming(0, { duration: 1800 })
          ),
          -1,
          false
        )
      );
    });
    return () => rings.forEach((r) => { cancelAnimation(r.scale); cancelAnimation(r.opacity); });
  }, [color]);

  return (
    <>
      {rings.map((r, i) => {
        const s = useAnimatedStyle(() => ({
          opacity: r.opacity.value,
          transform: [{ scale: r.scale.value }],
        }));
        return (
          <Animated.View
            key={i}
            pointerEvents="none"
            style={[styles.ring, { borderColor: color }, s]}
          />
        );
      })}
    </>
  );
}

/* ─── Main icon ────────────────────────────────────────────── */
function StepIcon({ step }: { step: typeof STEPS[0] }) {
  const v = useSharedValue(0);

  useEffect(() => {
    cancelAnimation(v);
    v.value = 0;

    if (step.anim === "shake") {
      v.value = withRepeat(
        withSequence(
          withTiming(-18, { duration: 80 }),
          withTiming(18, { duration: 80 }),
          withTiming(-12, { duration: 70 }),
          withTiming(12, { duration: 70 }),
          withTiming(0, { duration: 60 }),
          withTiming(0, { duration: 900 })
        ),
        -1,
        false
      );
    } else if (step.anim === "pulse") {
      v.value = withRepeat(
        withSequence(
          withSpring(1.25, { damping: 6, stiffness: 200 }),
          withSpring(1, { damping: 8, stiffness: 160 }),
          withTiming(1, { duration: 800 })
        ),
        -1,
        false
      );
    } else if (step.anim === "spin") {
      v.value = withRepeat(withTiming(360, { duration: 3000 }), -1, false);
    } else if (step.anim === "slide") {
      v.value = withRepeat(
        withSequence(
          withTiming(28, { duration: 350 }),
          withTiming(0, { duration: 200 }),
          withTiming(0, { duration: 900 })
        ),
        -1,
        false
      );
    }
    return () => cancelAnimation(v);
  }, [step.key]);

  const iconStyle = useAnimatedStyle(() => {
    if (step.anim === "shake") return { transform: [{ translateX: v.value }] };
    if (step.anim === "pulse") return { transform: [{ scale: v.value === 0 ? 1 : v.value }] };
    if (step.anim === "spin") return { transform: [{ rotate: `${v.value}deg` }] };
    if (step.anim === "slide") return { transform: [{ translateX: v.value }] };
    return {};
  });

  return (
    <View style={styles.iconWrap}>
      <Ripples color={step.color} />
      <View style={[styles.iconBg, { backgroundColor: step.color + "22" }]}>
        <View style={[styles.iconInner, { backgroundColor: step.color + "18", borderColor: step.color + "40" }]}>
          <Animated.View style={iconStyle}>
            <Ionicons name={step.icon} size={86} color={step.color} />
          </Animated.View>
        </View>
      </View>
    </View>
  );
}

/* ─── Floating particles ───────────────────────────────────── */
function Particles({ color }: { color: string }) {
  const dots = [
    { size: 6, x: 0.12, y: 0.22, dur: 4200 },
    { size: 4, x: 0.85, y: 0.18, dur: 5100 },
    { size: 8, x: 0.78, y: 0.72, dur: 3800 },
    { size: 5, x: 0.14, y: 0.68, dur: 4700 },
    { size: 3, x: 0.55, y: 0.12, dur: 5800 },
    { size: 6, x: 0.92, y: 0.45, dur: 4300 },
  ];

  return (
    <>
      {dots.map((d, i) => {
        const ty = useSharedValue(0);
        const op = useSharedValue(0);

        useEffect(() => {
          ty.value = withDelay(
            i * 400,
            withRepeat(
              withSequence(
                withTiming(-18, { duration: d.dur }),
                withTiming(0, { duration: d.dur })
              ),
              -1,
              true
            )
          );
          op.value = withDelay(
            i * 400,
            withRepeat(
              withSequence(
                withTiming(0.5, { duration: d.dur / 2 }),
                withTiming(0.1, { duration: d.dur / 2 })
              ),
              -1,
              true
            )
          );
          return () => { cancelAnimation(ty); cancelAnimation(op); };
        }, [color]);

        const s = useAnimatedStyle(() => ({
          transform: [{ translateY: ty.value }],
          opacity: op.value,
        }));

        return (
          <Animated.View
            key={i}
            pointerEvents="none"
            style={[
              styles.particle,
              s,
              {
                width: d.size,
                height: d.size,
                borderRadius: d.size / 2,
                backgroundColor: color,
                left: d.x * width,
                top: d.y * height,
              },
            ]}
          />
        );
      })}
    </>
  );
}

/* ─── Screen ───────────────────────────────────────────────── */
export default function OnboardingScreen() {
  const [stepIdx, setStepIdx] = React.useState(0);
  const offsetX = useSharedValue(0);
  const contentOpacity = useSharedValue(1);
  const textY = useSharedValue(0);

  const step = STEPS[stepIdx];

  const animateTo = (next: number) => {
    if (next < 0 || next >= STEPS.length) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    contentOpacity.value = withTiming(0, { duration: 140 }, () => {
      runOnJS(setStepIdx)(next);
      textY.value = 24;
      textY.value = withSpring(0, { damping: 18, stiffness: 220 });
      contentOpacity.value = withTiming(1, { duration: 220 });
    });
  };

  const panGesture = Gesture.Pan()
    .activeOffsetX([-12, 12])
    .onEnd((e) => {
      if (e.translationX < -40) runOnJS(animateTo)(stepIdx + 1);
      else if (e.translationX > 40) runOnJS(animateTo)(stepIdx - 1);
    });

  const finish = async () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    await AsyncStorage.setItem(ONBOARDED_KEY, "true");
    router.replace("/");
  };

  const contentStyle = useAnimatedStyle(() => ({
    opacity: contentOpacity.value,
    transform: [{ translateY: textY.value }],
  }));

  return (
    <GestureDetector gesture={panGesture}>
      <View style={styles.screen}>
        <StatusBar barStyle="light-content" />

        {/* Dark atmospheric gradient */}
        <LinearGradient
          colors={[step.dark, "#000000"]}
          locations={[0, 0.6]}
          style={StyleSheet.absoluteFill}
        />

        {/* Floating particles */}
        <Particles color={step.color} />

        <SafeAreaView style={styles.safe}>
          {/* Top bar */}
          <View style={styles.topBar}>
            <View style={[styles.labelPill, { borderColor: step.color + "50", backgroundColor: step.color + "12" }]}>
              <View style={[styles.labelDot, { backgroundColor: step.color }]} />
              <Text style={[styles.labelText, { color: step.color }]}>{step.label}</Text>
            </View>
            <TouchableOpacity onPress={finish} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
              <Text style={styles.skipText}>Passer</Text>
            </TouchableOpacity>
          </View>

          {/* Icon area */}
          <View style={styles.iconArea}>
            <StepIcon step={step} />
          </View>

          {/* Text content */}
          <Animated.View style={[styles.textBlock, contentStyle]}>
            <Text style={styles.bigTitle}>{step.title}</Text>
            <Text style={styles.desc}>{step.desc}</Text>
          </Animated.View>

          {/* Bottom bar */}
          <View style={styles.bottom}>
            {/* Dots */}
            <View style={styles.dotsRow}>
              {STEPS.map((_, i) => {
                const isActive = i === stepIdx;
                return (
                  <TouchableOpacity key={i} onPress={() => animateTo(i)}>
                    <View
                      style={[
                        styles.dot,
                        isActive
                          ? [styles.dotOn, { backgroundColor: step.color, width: 28 }]
                          : styles.dotOff,
                      ]}
                    />
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Navigation */}
            <View style={styles.navRow}>
              {stepIdx > 0 ? (
                <TouchableOpacity style={styles.prevBtn} onPress={() => animateTo(stepIdx - 1)}>
                  <Ionicons name="chevron-back" size={22} color="rgba(255,255,255,0.45)" />
                </TouchableOpacity>
              ) : (
                <View style={{ width: 50 }} />
              )}

              <TouchableOpacity
                style={[styles.nextBtn, { backgroundColor: step.color }]}
                onPress={stepIdx < STEPS.length - 1 ? () => animateTo(stepIdx + 1) : finish}
                activeOpacity={0.8}
              >
                <Text style={[styles.nextText, stepIdx === 3 && { color: "#000" }]}>
                  {stepIdx === STEPS.length - 1 ? "Commencer" : "Suivant"}
                </Text>
                <Ionicons
                  name={stepIdx === STEPS.length - 1 ? "checkmark" : "arrow-forward"}
                  size={18}
                  color={stepIdx === 3 ? "#000" : "#fff"}
                />
              </TouchableOpacity>
            </View>

            <Text style={styles.swipeHint}>Glissez pour naviguer</Text>
          </View>
        </SafeAreaView>
      </View>
    </GestureDetector>
  );
}

/* ─── Styles ───────────────────────────────────────────────── */
const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#000" },
  safe: { flex: 1 },

  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 22,
    paddingTop: Platform.OS === "android" ? 8 : 4,
    paddingBottom: 8,
  },
  labelPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    borderWidth: 1,
    borderRadius: 100,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  labelDot: { width: 6, height: 6, borderRadius: 3 },
  labelText: { fontSize: 11, fontWeight: "800", letterSpacing: 0.8 },
  skipText: { fontSize: 14, color: "rgba(255,255,255,0.3)", fontWeight: "500" },

  iconArea: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  iconWrap: {
    alignItems: "center",
    justifyContent: "center",
    width: 240,
    height: 240,
  },
  ring: {
    position: "absolute",
    width: 200,
    height: 200,
    borderRadius: 100,
    borderWidth: 1.5,
  },
  iconBg: {
    width: 180,
    height: 180,
    borderRadius: 90,
    alignItems: "center",
    justifyContent: "center",
  },
  iconInner: {
    width: 140,
    height: 140,
    borderRadius: 70,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.5,
  },

  textBlock: {
    paddingHorizontal: 28,
    marginBottom: 28,
    gap: 12,
  },
  bigTitle: {
    fontSize: 40,
    fontWeight: "800",
    color: "#FFFFFF",
    letterSpacing: -1.2,
    lineHeight: 46,
  },
  desc: {
    fontSize: 15.5,
    color: "rgba(255,255,255,0.48)",
    lineHeight: 24,
    maxWidth: 320,
  },

  bottom: {
    paddingHorizontal: 24,
    paddingBottom: Platform.OS === "android" ? 16 : 8,
    gap: 16,
  },
  dotsRow: {
    flexDirection: "row",
    gap: 6,
    alignItems: "center",
  },
  dot: { height: 6, borderRadius: 3 },
  dotOn: {},
  dotOff: { width: 6, backgroundColor: "rgba(255,255,255,0.15)" },

  navRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  prevBtn: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: "rgba(255,255,255,0.07)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    alignItems: "center",
    justifyContent: "center",
  },
  nextBtn: {
    flex: 1,
    marginLeft: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    height: 56,
    borderRadius: 18,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 14,
    elevation: 10,
  },
  nextText: {
    fontSize: 17,
    fontWeight: "700",
    color: "#fff",
    letterSpacing: 0.1,
  },

  swipeHint: {
    textAlign: "center",
    fontSize: 11,
    color: "rgba(255,255,255,0.18)",
    fontWeight: "500",
    letterSpacing: 0.3,
  },

  particle: { position: "absolute" },
});
