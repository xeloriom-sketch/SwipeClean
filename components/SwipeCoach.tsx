// components/SwipeCoach.tsx — tutoriel guidé, par-dessus le vrai écran de tri
//
// Parti pris: on n'explique pas l'app, on la fait utiliser. La personne apprend sur sa
// propre photo, dans son propre thème, avec la vraie carte et les vrais boutons — il
// n'y a donc rien à transposer en sortant du tutoriel, puisqu'on n'en sort pas.
//
// Le voile assombrit les bandes au-dessus et en dessous de la carte, jamais la carte
// elle-même: elle reste nette, et surtout elle reste touchable. Un voile plein écran
// aurait intercepté le geste qu'on demande justement de faire.
import React, { useEffect } from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
  withDelay,
  Easing,
} from "react-native-reanimated";
import { COACH_STEPS, type CoachState } from "../utils/coach";

const ARROW: Record<string, { icon: keyof typeof Ionicons.glyphMap; dx: number; dy: number }> = {
  left: { icon: "arrow-back", dx: -1, dy: 0 },
  right: { icon: "arrow-forward", dx: 1, dy: 0 },
  top: { icon: "arrow-up", dx: 0, dy: -1 },
  bottom: { icon: "arrow-down", dx: 0, dy: 1 },
};

/** Flèche qui part dans la direction demandée, en boucle. */
function DirectionHint({ dir, tint }: { dir: string; tint: string }) {
  const progress = useSharedValue(0);
  const conf = ARROW[dir] ?? ARROW.left;

  useEffect(() => {
    progress.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 900, easing: Easing.out(Easing.quad) }),
        withDelay(250, withTiming(0, { duration: 0 }))
      ),
      -1,
      false
    );
  }, [dir, progress]);

  const style = useAnimatedStyle(() => ({
    opacity: progress.value < 0.15 ? progress.value / 0.15 : 1 - (progress.value - 0.15) / 0.85,
    transform: [
      { translateX: conf.dx * 34 * progress.value },
      { translateY: conf.dy * 34 * progress.value },
    ],
  }));

  return (
    <Animated.View style={style}>
      <Ionicons name={conf.icon} size={30} color={tint} />
    </Animated.View>
  );
}

export default function SwipeCoach({
  state,
  darkMode,
  onSkip,
  topInset,
  bottomInset,
}: {
  state: CoachState;
  darkMode: boolean;
  onSkip: () => void;
  topInset: number;
  bottomInset: number;
}) {
  if (state.step === null) return null;
  const step = COACH_STEPS[state.step];
  if (!step) return null;

  const veil = darkMode ? "rgba(0,0,0,0.78)" : "rgba(0,0,0,0.62)";
  const tint = "rgba(255,255,255,0.9)";

  return (
    // `box-none`: le conteneur ne capte rien, seuls ses enfants tactiles le font. Sans
    // ça, le voile avalerait le geste qu'on demande de faire sur la carte.
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      {/* Bande haute: consigne + progression */}
      <View style={[styles.band, { backgroundColor: veil, paddingTop: topInset + 14 }]} pointerEvents="box-none">
        <View style={styles.dots}>
          {COACH_STEPS.map((_, i) => (
            <View
              key={i}
              style={[
                styles.dot,
                i === state.step && styles.dotActive,
                i < (state.step ?? 0) && styles.dotDone,
              ]}
            />
          ))}
        </View>

        <Text style={styles.instruction}>{step.instruction}</Text>

        {state.attempts > 0 && (
          <Text style={styles.nudge}>
            {`Essaie dans l'autre sens — ${
              step.dir === "left"
                ? "vers la gauche"
                : step.dir === "right"
                  ? "vers la droite"
                  : "vers le haut"
            }.`}
          </Text>
        )}

        <TouchableOpacity onPress={onSkip} hitSlop={{ top: 12, bottom: 12, left: 16, right: 16 }}>
          <Text style={styles.skip}>Passer le tutoriel</Text>
        </TouchableOpacity>
      </View>

      {/* Bande basse: la flèche, au-dessus des vrais boutons qui restent visibles */}
      <View
        style={[styles.bottomBand, { backgroundColor: veil, paddingBottom: bottomInset + 10 }]}
        pointerEvents="box-none"
      >
        <DirectionHint dir={step.dir} tint={tint} />
        <Text style={styles.hintText}>
          {state.step === COACH_STEPS.length - 1
            ? "Les boutons en bas font la même chose, sans les mains."
            : "Fais-le sur ta photo — c'est vraiment ta galerie."}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  band: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 26,
    paddingBottom: 20,
    alignItems: "center",
    gap: 10,
  },
  bottomBand: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    paddingTop: 16,
    paddingHorizontal: 26,
    alignItems: "center",
    gap: 6,
  },
  dots: { flexDirection: "row", gap: 6, marginBottom: 2 },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "rgba(255,255,255,0.22)",
  },
  dotActive: { width: 20, backgroundColor: "#fff" },
  dotDone: { backgroundColor: "rgba(255,255,255,0.5)" },
  instruction: {
    color: "#fff",
    fontSize: 19,
    fontWeight: "700",
    lineHeight: 26,
    textAlign: "center",
  },
  nudge: {
    color: "rgba(255,255,255,0.65)",
    fontSize: 14,
    lineHeight: 20,
    textAlign: "center",
  },
  skip: {
    color: "rgba(255,255,255,0.45)",
    fontSize: 14,
    lineHeight: 20,
    marginTop: 2,
  },
  hintText: {
    color: "rgba(255,255,255,0.6)",
    fontSize: 13.5,
    lineHeight: 19,
    textAlign: "center",
  },
});
