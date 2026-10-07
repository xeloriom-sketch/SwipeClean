// components/SwipeCoach.tsx — tutoriel guidé, posé sur le vrai écran de tri
//
// Parti pris: on n'explique pas l'app, on la fait utiliser. La personne apprend sur sa
// propre photo, dans son thème, avec la vraie carte et les vrais boutons — il n'y a
// rien à transposer en sortant du tutoriel, puisqu'on n'en sort pas.
//
// Deux règles tirées d'une première version ratée:
//
// 1. AUCUNE bande. La version précédente assombrissait deux bandes pleine largeur en
//    haut et en bas. Mesuré sur iPhone 14: la bande haute mangeait 70 pt du haut de la
//    photo, la bande basse 18 pt des boutons, et son bouton « Passer » tombait *dans*
//    l'emprise de la carte — un geste commencé là sautait le tutoriel au lieu de
//    swiper. La consigne s'écrit donc sur la photo elle-même, dans le dégradé de pied
//    que l'app utilise déjà pour la date.
//
// 2. `pointerEvents="none"` partout, sans exception et sans aucun élément tactile. Le
//    tutoriel se termine en trois gestes et avance de toute façon après trois essais:
//    il n'a pas besoin d'un bouton « Passer », et s'en passer garantit qu'il ne peut
//    pas intercepter le geste qu'il demande.
//
// L'alignement sur la carte ne repose sur aucun calcul: on reproduit la même pile de
// flex que l'écran (en-tête, zone centrale, barre de boutons), donc le cadre suit la
// carte sur n'importe quel appareil.
import React, { useEffect } from "react";
import { View, Text, StyleSheet, Dimensions, Platform } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  withDelay,
  Easing,
  interpolate,
} from "react-native-reanimated";
import { COACH_STEPS, type CoachDirection, type CoachState } from "../utils/coach";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");
const CARD_W = SCREEN_WIDTH * 0.9;
const CARD_H = SCREEN_HEIGHT * 0.7;

/** Doit suivre `styles.header` et `styles.globalActions` de l'écran de tri. */
const HEADER_H = 50;
const ACTIONS_H = (Platform.OS === "ios" ? 12 : 8) * 2 + Math.min(Math.round(SCREEN_WIDTH * 0.16), 66);

/** Les couleurs et icônes que l'écran peint réellement pendant le geste. */
const LOOK: Record<CoachDirection, { tint: string; icon: keyof typeof Ionicons.glyphMap; rotate: string }> = {
  left: { tint: "rgba(255, 68, 88, 0.92)", icon: "close", rotate: "0deg" },
  right: { tint: "rgba(76, 255, 94, 0.92)", icon: "heart", rotate: "180deg" },
  top: { tint: "rgba(0, 180, 230, 0.92)", icon: "star", rotate: "90deg" },
  bottom: { tint: "rgba(110, 110, 120, 0.92)", icon: "play-skip-forward", rotate: "270deg" },
};

const SOLID: Record<CoachDirection, string> = {
  left: "#FF4458",
  right: "#4CFF5E",
  top: "#00B4E6",
  bottom: "#6E6E78",
};

/** Le badge exact de l'app, montré au repos: le reconnaître avant de le déclencher. */
function Badge({ tint, icon }: { tint: string; icon: keyof typeof Ionicons.glyphMap }) {
  const pulse = useSharedValue(0);
  useEffect(() => {
    pulse.value = withRepeat(withTiming(1, { duration: 1800, easing: Easing.inOut(Easing.quad) }), -1, true);
  }, [pulse]);

  const style = useAnimatedStyle(() => ({
    transform: [{ scale: interpolate(pulse.value, [0, 1], [1, 1.07]) }],
    opacity: interpolate(pulse.value, [0, 1], [0.5, 0.78]),
  }));

  return (
    <Animated.View style={[styles.badge, { backgroundColor: tint }, style]}>
      <Ionicons name={icon} size={54} color="#FFF" />
    </Animated.View>
  );
}

/** Trois chevrons sur le bord visé: ils disent où aller, sans flèche décorative. */
function Chevrons({ tint, rotate }: { tint: string; rotate: string }) {
  const wave = useSharedValue(0);
  useEffect(() => {
    wave.value = withRepeat(withTiming(1, { duration: 1400, easing: Easing.inOut(Easing.quad) }), -1, true);
  }, [wave]);

  // Une seule valeur animée pour les trois chevrons: le décalage entre eux passe par
  // leur opacité de base, pas par trois animations distinctes.
  const style = useAnimatedStyle(() => ({
    opacity: interpolate(wave.value, [0, 1], [0.25, 1]),
    transform: [{ translateX: interpolate(wave.value, [0, 1], [0, -9]) }],
  }));

  return (
    <View style={[styles.chevrons, { transform: [{ rotate }] }]} pointerEvents="none">
      <Animated.View style={[styles.chevronRow, style]}>
        <Ionicons name="chevron-back" size={26} color={tint} />
        <Ionicons name="chevron-back" size={26} color={tint} style={{ opacity: 0.66, marginLeft: -6 }} />
        <Ionicons name="chevron-back" size={26} color={tint} style={{ opacity: 0.38, marginLeft: -6 }} />
      </Animated.View>
    </View>
  );
}

export default function SwipeCoach({ state }: { state: CoachState }) {
  const enter = useSharedValue(0);
  const step = state.step === null ? null : COACH_STEPS[state.step];

  useEffect(() => {
    if (state.step === null) return;
    enter.value = 0;
    enter.value = withDelay(60, withTiming(1, { duration: 260, easing: Easing.out(Easing.cubic) }));
  }, [state.step, enter]);

  const enterStyle = useAnimatedStyle(() => ({
    opacity: enter.value,
    transform: [{ translateY: interpolate(enter.value, [0, 1], [10, 0]) }],
  }));

  if (!step) return null;

  const look = LOOK[step.dir];
  const solid = SOLID[step.dir];

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <SafeAreaView style={styles.safe} pointerEvents="none">
        <View style={{ height: HEADER_H }} />

        <View style={styles.zone} pointerEvents="none">
          <View style={styles.cardFrame} pointerEvents="none">
            <Badge tint={look.tint} icon={look.icon} />
            <Chevrons tint={solid} rotate={look.rotate} />

            <LinearGradient
              colors={["rgba(8,9,11,0)", "rgba(8,9,11,0.55)", "rgba(8,9,11,0.93)"]}
              locations={[0, 0.46, 1]}
              style={styles.foot}
              pointerEvents="none"
            />

            <Animated.View style={[styles.copy, enterStyle]} pointerEvents="none">
              <View style={styles.segments}>
                {COACH_STEPS.map((_, i) => (
                  <View
                    key={i}
                    style={[
                      styles.segment,
                      i === state.step && styles.segmentActive,
                      i <= (state.step ?? 0) ? { backgroundColor: solid } : null,
                    ]}
                  />
                ))}
              </View>
              <Text style={styles.gesture}>{step.gesture}</Text>
              <Text style={styles.detail}>{step.detail}</Text>
            </Animated.View>
          </View>
        </View>

        <View style={{ height: ACTIONS_H }} />
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  zone: { flex: 1, marginTop: 4, marginBottom: 8, alignItems: "center", justifyContent: "center" },
  cardFrame: {
    width: CARD_W,
    height: CARD_H,
    borderRadius: 24,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
  },
  badge: {
    width: 108,
    height: 108,
    borderRadius: 54,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 40,
  },
  chevrons: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "flex-start",
    justifyContent: "center",
    paddingLeft: 14,
  },
  chevronRow: { flexDirection: "row", alignItems: "center", marginTop: -40 },
  foot: { position: "absolute", left: 0, right: 0, bottom: 0, height: 250 },
  copy: { position: "absolute", left: 22, right: 22, bottom: 20 },
  segments: { flexDirection: "row", gap: 5, marginBottom: 13 },
  segment: {
    width: 11,
    height: 3,
    borderRadius: 2,
    backgroundColor: "rgba(255,255,255,0.2)",
  },
  segmentActive: { width: 26 },
  gesture: {
    color: "#fff",
    fontSize: 27,
    fontWeight: "800",
    letterSpacing: -0.8,
    lineHeight: 31,
  },
  detail: {
    color: "rgba(255,255,255,0.66)",
    fontSize: 15,
    lineHeight: 21,
    marginTop: 5,
  },
});
