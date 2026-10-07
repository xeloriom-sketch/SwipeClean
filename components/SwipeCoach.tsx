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
import React, { useEffect, useState } from "react";
import { AccessibilityInfo, View, Text, StyleSheet, Dimensions, Platform } from "react-native";
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
const LOOK: Record<CoachDirection, {
  tint: string;
  icon: keyof typeof Ionicons.glyphMap;
  /** Vrai quand la teinte est trop claire pour une icône blanche (ratio < 3:1). */
  darkIcon: boolean;
}> = {
  left: { tint: "rgba(255, 68, 88, 0.92)", icon: "close", darkIcon: false },
  right: { tint: "rgba(76, 255, 94, 0.92)", icon: "heart", darkIcon: true },
  top: { tint: "rgba(0, 180, 230, 0.92)", icon: "star", darkIcon: true },
  bottom: { tint: "rgba(110, 110, 120, 0.92)", icon: "play-skip-forward", darkIcon: false },
};

/**
 * Le badge exact de l'app, montré au repos: le reconnaître avant de le déclencher.
 *
 * Opacité pleine, comme dans l'app. Une version précédente le faisait respirer entre
 * 50 % et 78 %: sur une photo claire le contraste tombait à 1,2:1 et l'icône
 * disparaissait — on enseignait un objet qui n'existe pas. Seule l'échelle respire, et
 * pas du tout si l'appareil demande moins d'animations.
 *
 * L'icône passe en sombre sur le vert et le cyan: un cœur blanc sur #4CFF5E ne donne
 * que 1,32:1. Ce défaut existe aussi dans l'app elle-même, il est noté pour plus tard.
 */
function Badge({ tint, icon, darkIcon, reduceMotion }: {
  tint: string;
  icon: keyof typeof Ionicons.glyphMap;
  darkIcon: boolean;
  reduceMotion: boolean;
}) {
  const pulse = useSharedValue(0);
  useEffect(() => {
    if (reduceMotion) return;
    pulse.value = withRepeat(withTiming(1, { duration: 1800, easing: Easing.inOut(Easing.quad) }), -1, true);
  }, [pulse, reduceMotion]);

  const style = useAnimatedStyle(() => ({
    transform: [{ scale: interpolate(pulse.value, [0, 1], [1, 1.06]) }],
  }));

  return (
    <Animated.View style={[styles.badge, { backgroundColor: tint }, style]}>
      <Ionicons name={icon} size={60} color={darkIcon ? "#0B0B0B" : "#FFF"} />
    </Animated.View>
  );
}

export default function SwipeCoach({ state }: { state: CoachState }) {
  const enter = useSharedValue(0);
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion).catch(() => {});
    const sub = AccessibilityInfo.addEventListener("reduceMotionChanged", setReduceMotion);
    return () => sub.remove();
  }, []);
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

  return (
    // Pas de SafeAreaView ici: `absoluteFill` est deja positionne dans la boite de
    // padding du SafeAreaView de l'ecran. En ajouter un comptait les insets deux fois
    // et decalait tout le cadre de la hauteur de l'encoche.
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <View style={styles.safe} pointerEvents="none">
        <View style={{ height: HEADER_H }} />

        <View style={styles.zone} pointerEvents="none">
          <View style={styles.cardFrame} pointerEvents="none">
            <Badge tint={look.tint} icon={look.icon} darkIcon={look.darkIcon} reduceMotion={reduceMotion} />

            <LinearGradient
              colors={["rgba(8,9,11,0)", "rgba(8,9,11,0.55)", "rgba(8,9,11,0.93)"]}
              locations={[0, 0.46, 1]}
              style={styles.foot}
              pointerEvents="none"
            />

            <Animated.View style={[styles.copy, enterStyle]} pointerEvents="none">
              <Text style={styles.gesture}>{step.gesture}</Text>
              <Text style={styles.detail}>{step.detail}</Text>
            </Animated.View>
          </View>
        </View>

        <View style={{ height: ACTIONS_H }} />
      </View>
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
  // bottom 56 et non 20: `MediaCard` affiche toujours la date et les dimensions dans
  // les ~46 derniers points de la carte. La consigne se posait dessus.
  copy: { position: "absolute", left: 22, right: 22, bottom: 56 },
  gesture: {
    color: "#fff",
    fontSize: 22,
    fontWeight: "700",
    letterSpacing: -0.5,
    lineHeight: 27,
  },
  detail: {
    color: "rgba(255,255,255,0.85)",
    fontSize: 15,
    lineHeight: 21,
    marginTop: 5,
  },
});
