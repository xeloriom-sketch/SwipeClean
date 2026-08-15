// app/(tabs)/Onboarding.tsx
import React, { useEffect } from "react";
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
  runOnJS,
  cancelAnimation,
} from "react-native-reanimated";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { router } from "expo-router";
import * as Haptics from "expo-haptics";

const { width, height } = Dimensions.get("window");
const ONBOARDED_KEY = "@app_onboarded";

const CARD_W = width * 0.6;
const CARD_H = CARD_W * 1.42;

type Step = {
  key: string;
  color: string;
  glow: string;
  icon: string;
  gesture: string;
  direction: "left" | "right" | "up" | "down";
  title: string;
  desc: string;
  cardGradient: [string, string];
};

const STEPS: Step[] = [
  {
    key: "delete",
    color: "#FF4458",
    glow: "rgba(255,68,88,0.22)",
    icon: "close",
    gesture: "← Swipe gauche",
    direction: "left",
    title: "Supprimer",
    desc: "Envoyez les photos indésirables à la corbeille. Récupérables jusqu'à suppression définitive.",
    cardGradient: ["#2A0A0F", "#1A0508"],
  },
  {
    key: "keep",
    color: "#4CFF5E",
    glow: "rgba(76,255,94,0.2)",
    icon: "heart",
    gesture: "→ Swipe droite",
    direction: "right",
    title: "Garder",
    desc: "Conservez vos meilleurs souvenirs. La photo reste dans votre galerie, intacte.",
    cardGradient: ["#081A0A", "#040E06"],
  },
  {
    key: "star",
    color: "#00B4D8",
    glow: "rgba(0,180,216,0.2)",
    icon: "star",
    gesture: "↑ Swipe haut",
    direction: "up",
    title: "Favoris",
    desc: "Mettez en avant vos clichés préférés. Retrouvez-les instantanément dans les Favoris.",
    cardGradient: ["#020F18", "#010A12"],
  },
  {
    key: "skip",
    color: "#A0A0A8",
    glow: "rgba(160,160,168,0.15)",
    icon: "play-skip-forward",
    gesture: "↓ Swipe bas",
    direction: "down",
    title: "Passer",
    desc: "Vous hésitez ? Passez à la suivante et décidez plus tard.",
    cardGradient: ["#111114", "#0A0A0C"],
  },
];

/* ---- Animated demo card ---- */
function DemoCard({ step }: { step: Step }) {
  const tx = useSharedValue(0);
  const ty = useSharedValue(0);
  const rot = useSharedValue(0);
  const cardOpacity = useSharedValue(1);
  const iconScale = useSharedValue(0);
  const iconOpacity = useSharedValue(0);
  const glowScale = useSharedValue(0.7);
  const glowOpacity = useSharedValue(0);

  useEffect(() => {
    // Reset
    cancelAnimation(tx);
    cancelAnimation(ty);
    cancelAnimation(rot);
    cancelAnimation(cardOpacity);
    cancelAnimation(iconScale);
    cancelAnimation(iconOpacity);
    cancelAnimation(glowScale);
    cancelAnimation(glowOpacity);

    tx.value = 0;
    ty.value = 0;
    rot.value = 0;
    cardOpacity.value = 1;
    iconScale.value = 0;
    iconOpacity.value = 0;
    glowScale.value = 0.7;
    glowOpacity.value = 0;

    const DX = step.direction === "left" ? -width * 1.2
             : step.direction === "right" ? width * 1.2
             : 0;
    const DY = step.direction === "up" ? -height * 0.9
             : step.direction === "down" ? height * 0.9
             : 0;
    const ROT = step.direction === "left" ? -22
              : step.direction === "right" ? 22
              : 0;

    const runCycle = () => {
      // Hold 0.8s, then animate out
      tx.value = withDelay(800, withTiming(DX, { duration: 520 }));
      ty.value = withDelay(800, withTiming(DY, { duration: 520 }));
      rot.value = withDelay(800, withTiming(ROT, { duration: 520 }));
      cardOpacity.value = withDelay(900, withTiming(0, { duration: 400 }));

      iconScale.value = withDelay(950, withSpring(1, { damping: 14, stiffness: 280 }));
      iconOpacity.value = withDelay(950, withTiming(1, { duration: 200 }));

      glowOpacity.value = withDelay(800, withTiming(1, { duration: 300 }));
      glowScale.value = withDelay(800, withSpring(1.2, { damping: 12, stiffness: 120 }));

      // Reset after exit
      setTimeout(() => {
        tx.value = 0;
        ty.value = 0;
        rot.value = 0;
        cardOpacity.value = 0;
        iconScale.value = 0;
        iconOpacity.value = 0;
        glowOpacity.value = 0;
        glowScale.value = 0.7;

        // Fade back in
        cardOpacity.value = withTiming(1, { duration: 350 });
      }, 1480);
    };

    runCycle();
    const interval = setInterval(runCycle, 2400);
    return () => clearInterval(interval);
  }, [step.key]);

  const cardStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: tx.value },
      { translateY: ty.value },
      { rotate: `${rot.value}deg` },
    ],
    opacity: cardOpacity.value,
  }));

  const iconStyle = useAnimatedStyle(() => ({
    transform: [{ scale: iconScale.value }],
    opacity: iconOpacity.value,
  }));

  const glowStyle = useAnimatedStyle(() => ({
    opacity: glowOpacity.value,
    transform: [{ scale: glowScale.value }],
  }));

  return (
    <View style={styles.demoArea}>
      {/* Glow */}
      <Animated.View style={[styles.glow, { backgroundColor: step.glow }, glowStyle]} />

      {/* Photo card */}
      <Animated.View style={[styles.demoCard, cardStyle]}>
        <LinearGradient
          colors={step.cardGradient}
          style={StyleSheet.absoluteFill}
        />
        {/* Simulated photo content */}
        <View style={styles.fakePhoto}>
          <LinearGradient
            colors={[step.color + "18", step.color + "04"]}
            style={styles.fakePhotoInner}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          />
        </View>
        {/* Bottom info strip */}
        <LinearGradient
          colors={["transparent", "rgba(0,0,0,0.7)"]}
          style={styles.fakeInfoBar}
        >
          <View style={[styles.fakeInfoLine, { width: "55%", backgroundColor: "rgba(255,255,255,0.2)" }]} />
          <View style={[styles.fakeInfoLine, { width: "35%", backgroundColor: "rgba(255,255,255,0.1)", marginTop: 6 }]} />
        </LinearGradient>
        {/* Border */}
        <View style={[styles.demoCardBorder, { borderColor: step.color + "30" }]} />
      </Animated.View>

      {/* Animated icon circle */}
      <Animated.View style={[styles.iconCircle, { backgroundColor: step.color + "EE" }, iconStyle]}>
        <Ionicons name={step.icon as any} size={52} color="#fff" />
      </Animated.View>

      {/* Directional hint arrows */}
      <DirectionArrows step={step} />
    </View>
  );
}

function DirectionArrows({ step }: { step: Step }) {
  const opacity = useSharedValue(0);

  useEffect(() => {
    cancelAnimation(opacity);
    opacity.value = 0;
    opacity.value = withRepeat(
      withSequence(
        withDelay(400, withTiming(1, { duration: 400 })),
        withTiming(0.3, { duration: 600 }),
        withTiming(1, { duration: 400 }),
        withTiming(0, { duration: 400 }),
      ),
      -1,
      false
    );
    return () => cancelAnimation(opacity);
  }, [step.key]);

  const arrowStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));

  const arrows = {
    left: [
      { icon: "chevron-back" as const, style: { left: 4 } },
      { icon: "chevron-back" as const, style: { left: 14 } },
    ],
    right: [
      { icon: "chevron-forward" as const, style: { right: 14 } },
      { icon: "chevron-forward" as const, style: { right: 4 } },
    ],
    up: [
      { icon: "chevron-up" as const, style: { top: 4 } },
      { icon: "chevron-up" as const, style: { top: 14 } },
    ],
    down: [
      { icon: "chevron-down" as const, style: { bottom: 14 } },
      { icon: "chevron-down" as const, style: { bottom: 4 } },
    ],
  };

  const dir = step.direction;
  const isH = dir === "left" || dir === "right";

  return (
    <Animated.View
      style={[
        styles.arrowsWrap,
        isH ? styles.arrowsH : styles.arrowsV,
        arrowStyle,
      ]}
    >
      {arrows[dir].map((a, i) => (
        <Ionicons
          key={i}
          name={a.icon}
          size={24}
          color={step.color}
          style={{ opacity: i === 0 ? 0.45 : 1 }}
        />
      ))}
    </Animated.View>
  );
}

/* ---- Main screen ---- */
export default function OnboardingScreen() {
  const [step, setStep] = React.useState(0);
  const slideX = useSharedValue(0);
  const contentOpacity = useSharedValue(1);

  const goTo = (next: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    contentOpacity.value = withTiming(0, { duration: 150 }, () => {
      runOnJS(setStep)(next);
      slideX.value = next > step ? 40 : -40;
      slideX.value = withSpring(0, { damping: 18, stiffness: 260 });
      contentOpacity.value = withTiming(1, { duration: 200 });
    });
  };

  const finish = async () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    await AsyncStorage.setItem(ONBOARDED_KEY, "true");
    router.replace("/");
  };

  const s = STEPS[step];

  const infoStyle = useAnimatedStyle(() => ({
    opacity: contentOpacity.value,
    transform: [{ translateX: slideX.value }],
  }));

  return (
    <View style={styles.screen}>
      <StatusBar barStyle="light-content" />

      {/* Background glow blob */}
      <View style={[styles.bgBlob, { backgroundColor: s.glow }]} />

      {/* Skip */}
      <SafeAreaView style={styles.safeWrap}>
        <TouchableOpacity style={styles.skipBtn} onPress={finish}>
          <Text style={styles.skipText}>Passer</Text>
        </TouchableOpacity>

        {/* Demo card area */}
        <DemoCard step={s} />

        {/* Info block */}
        <Animated.View style={[styles.infoBlock, infoStyle]}>
          {/* Gesture pill */}
          <View style={[styles.gesturePill, { borderColor: s.color + "60", backgroundColor: s.color + "14" }]}>
            <Text style={[styles.gesturePillText, { color: s.color }]}>{s.gesture}</Text>
          </View>

          <Text style={styles.stepTitle}>{s.title}</Text>
          <Text style={styles.stepDesc}>{s.desc}</Text>
        </Animated.View>

        {/* Progress dots */}
        <View style={styles.dotsRow}>
          {STEPS.map((st, i) => (
            <TouchableOpacity key={i} onPress={() => i !== step && goTo(i)}>
              <Animated.View
                style={[
                  styles.dot,
                  i === step
                    ? [styles.dotActive, { backgroundColor: s.color }]
                    : styles.dotInactive,
                ]}
              />
            </TouchableOpacity>
          ))}
        </View>

        {/* Navigation */}
        <View style={styles.nav}>
          {step > 0 ? (
            <TouchableOpacity style={styles.prevBtn} onPress={() => goTo(step - 1)}>
              <Ionicons name="chevron-back" size={20} color="rgba(255,255,255,0.5)" />
            </TouchableOpacity>
          ) : (
            <View style={{ width: 44 }} />
          )}

          <TouchableOpacity
            style={[styles.nextBtn, { backgroundColor: s.color }]}
            onPress={step < STEPS.length - 1 ? () => goTo(step + 1) : finish}
            activeOpacity={0.82}
          >
            <Text style={styles.nextText}>
              {step === STEPS.length - 1 ? "C'est parti !" : "Suivant"}
            </Text>
            <Ionicons
              name={step === STEPS.length - 1 ? "rocket-outline" : "arrow-forward"}
              size={18}
              color="#fff"
            />
          </TouchableOpacity>
        </View>

        {/* Step counter */}
        <Text style={styles.stepCounter}>{step + 1} / {STEPS.length}</Text>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#050507",
  },
  bgBlob: {
    position: "absolute",
    top: height * 0.1,
    alignSelf: "center",
    width: width * 1.2,
    height: width * 1.2,
    borderRadius: width * 0.6,
    opacity: 0.35,
    transform: [{ scaleY: 0.6 }],
  },
  safeWrap: {
    flex: 1,
    alignItems: "center",
  },

  skipBtn: {
    alignSelf: "flex-end",
    paddingRight: 24,
    paddingTop: 8,
    paddingBottom: 8,
    paddingLeft: 16,
  },
  skipText: {
    color: "rgba(255,255,255,0.35)",
    fontSize: 14,
    fontWeight: "500",
  },

  /* Demo area */
  demoArea: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    width: "100%",
    maxHeight: height * 0.46,
  },
  glow: {
    position: "absolute",
    width: CARD_W * 1.6,
    height: CARD_W * 1.6,
    borderRadius: CARD_W * 0.8,
  },
  demoCard: {
    width: CARD_W,
    height: CARD_H,
    borderRadius: 26,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.55,
    shadowRadius: 28,
    elevation: 18,
  },
  demoCardBorder: {
    ...StyleSheet.absoluteFillObject as any,
    borderRadius: 26,
    borderWidth: 1,
  },
  fakePhoto: {
    flex: 1,
  },
  fakePhotoInner: {
    flex: 1,
  },
  fakeInfoBar: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    padding: 16,
    paddingTop: 40,
  },
  fakeInfoLine: {
    height: 9,
    borderRadius: 5,
  },

  iconCircle: {
    position: "absolute",
    width: 110,
    height: 110,
    borderRadius: 55,
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 12,
  },

  arrowsWrap: { position: "absolute" },
  arrowsH: {
    flexDirection: "row",
    top: "50%",
    marginTop: -12,
    gap: 0,
  },
  arrowsV: {
    flexDirection: "column",
    left: "50%",
    marginLeft: -12,
    gap: 0,
  },

  /* Info block */
  infoBlock: {
    width: "100%",
    paddingHorizontal: 28,
    alignItems: "flex-start",
    marginTop: 8,
    gap: 12,
  },
  gesturePill: {
    borderWidth: 1,
    borderRadius: 100,
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  gesturePillText: {
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 0.4,
  },
  stepTitle: {
    fontSize: 36,
    fontWeight: "800",
    color: "#fff",
    letterSpacing: -0.8,
    lineHeight: 40,
  },
  stepDesc: {
    fontSize: 15,
    color: "rgba(255,255,255,0.5)",
    lineHeight: 22,
    maxWidth: 320,
  },

  /* Progress */
  dotsRow: {
    flexDirection: "row",
    gap: 6,
    marginTop: 28,
    alignItems: "center",
  },
  dot: {
    height: 6,
    borderRadius: 3,
  },
  dotActive: { width: 24 },
  dotInactive: {
    width: 6,
    backgroundColor: "rgba(255,255,255,0.18)",
  },

  /* Navigation */
  nav: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    width: "100%",
    paddingHorizontal: 24,
    marginTop: 20,
    marginBottom: 4,
  },
  prevBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.07)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  nextBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 28,
    paddingVertical: 15,
    borderRadius: 100,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  },
  nextText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "700",
    letterSpacing: 0.1,
  },

  stepCounter: {
    fontSize: 11,
    color: "rgba(255,255,255,0.2)",
    fontWeight: "600",
    letterSpacing: 0.5,
    marginBottom: Platform.OS === "android" ? 12 : 4,
  },
});
