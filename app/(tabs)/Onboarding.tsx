// app/(tabs)/Onboarding.tsx
import React, { useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  StatusBar,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  interpolate,
  Extrapolate,
} from "react-native-reanimated";
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { router } from "expo-router";

const { width, height } = Dimensions.get("window");
const ONBOARDED_KEY = "@app_onboarded";

const STEPS = [
  {
    icon: "close-circle",
    iconColor: "#FF4458",
    bg: "rgba(255,68,88,0.08)",
    gesture: "← Swipe gauche",
    title: "Supprimer",
    desc: "Envoyez les photos indésirables à la corbeille. Elles restent récupérables jusqu'à suppression définitive.",
  },
  {
    icon: "checkmark-circle",
    iconColor: "#4CFF5E",
    bg: "rgba(76,255,94,0.08)",
    gesture: "→ Swipe droite",
    title: "Garder",
    desc: "Conservez vos meilleurs souvenirs. La photo reste dans votre galerie, intacte.",
  },
  {
    icon: "star",
    iconColor: "#00B4D8",
    bg: "rgba(0,180,216,0.08)",
    gesture: "↑ Swipe haut",
    title: "Favoris",
    desc: "Mettez en avant vos clichés préférés. Retrouvez-les instantanément dans l'onglet Favoris.",
  },
  {
    icon: "play-skip-forward",
    iconColor: "#A0A0A0",
    bg: "rgba(160,160,160,0.08)",
    gesture: "↓ Swipe bas",
    title: "Passer",
    desc: "Vous hésitez ? Passez à la suivante et revenez plus tard.",
  },
];

export default function OnboardingScreen() {
  const [step, setStep] = useState(0);
  const progress = useSharedValue(0);

  const goNext = () => {
    if (step < STEPS.length - 1) {
      progress.value = withSpring(step + 1, { damping: 18, stiffness: 200 });
      setStep((s) => s + 1);
    } else {
      finish();
    }
  };

  const goPrev = () => {
    if (step > 0) {
      progress.value = withSpring(step - 1, { damping: 18, stiffness: 200 });
      setStep((s) => s - 1);
    }
  };

  const finish = async () => {
    await AsyncStorage.setItem(ONBOARDED_KEY, "true");
    router.replace("/");
  };

  const s = STEPS[step];

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" />

      {/* Skip */}
      <TouchableOpacity style={styles.skipBtn} onPress={finish}>
        <Text style={styles.skipText}>Passer</Text>
      </TouchableOpacity>

      {/* Content */}
      <View style={styles.content}>
        <View style={[styles.iconCircle, { backgroundColor: s.bg }]}>
          <Ionicons name={s.icon as any} size={80} color={s.iconColor} />
        </View>

        <View style={[styles.gesturePill, { borderColor: s.iconColor + "55" }]}>
          <Text style={[styles.gesturePillText, { color: s.iconColor }]}>{s.gesture}</Text>
        </View>

        <Text style={styles.stepTitle}>{s.title}</Text>
        <Text style={styles.stepDesc}>{s.desc}</Text>
      </View>

      {/* Dots */}
      <View style={styles.dots}>
        {STEPS.map((_, i) => (
          <View
            key={i}
            style={[
              styles.dot,
              i === step ? styles.dotActive : styles.dotInactive,
            ]}
          />
        ))}
      </View>

      {/* Navigation */}
      <View style={styles.nav}>
        {step > 0 ? (
          <TouchableOpacity style={styles.prevBtn} onPress={goPrev}>
            <Ionicons name="chevron-back" size={22} color="rgba(255,255,255,0.6)" />
          </TouchableOpacity>
        ) : (
          <View style={{ width: 44 }} />
        )}

        <TouchableOpacity style={[styles.nextBtn, { backgroundColor: s.iconColor }]} onPress={goNext}>
          <Text style={styles.nextText}>
            {step === STEPS.length - 1 ? "Commencer" : "Suivant"}
          </Text>
          <Ionicons
            name={step === STEPS.length - 1 ? "checkmark" : "chevron-forward"}
            size={18}
            color="#fff"
          />
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0a0a0a",
    paddingHorizontal: 24,
  },
  skipBtn: {
    alignSelf: "flex-end",
    paddingVertical: 12,
    paddingLeft: 16,
  },
  skipText: {
    color: "rgba(255,255,255,0.4)",
    fontSize: 14,
    fontWeight: "500",
  },

  content: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 20,
  },
  iconCircle: {
    width: 160,
    height: 160,
    borderRadius: 80,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 8,
  },
  gesturePill: {
    borderWidth: 1,
    borderRadius: 100,
    paddingHorizontal: 18,
    paddingVertical: 7,
  },
  gesturePillText: {
    fontSize: 14,
    fontWeight: "700",
    letterSpacing: 0.3,
  },
  stepTitle: {
    fontSize: 34,
    fontWeight: "800",
    color: "#fff",
    letterSpacing: -0.5,
  },
  stepDesc: {
    fontSize: 15,
    color: "rgba(255,255,255,0.55)",
    textAlign: "center",
    lineHeight: 22,
    maxWidth: 300,
  },

  dots: {
    flexDirection: "row",
    gap: 6,
    justifyContent: "center",
    marginBottom: 24,
  },
  dot: { width: 6, height: 6, borderRadius: 3 },
  dotActive: { width: 22, backgroundColor: "#fff" },
  dotInactive: { backgroundColor: "rgba(255,255,255,0.2)" },

  nav: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingBottom: 12,
  },
  prevBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.08)",
  },
  nextBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 100,
  },
  nextText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "700",
  },
});
