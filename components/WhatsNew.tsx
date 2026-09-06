// components/WhatsNew.tsx
import React, { useEffect, useRef } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  Modal,
  ScrollView,
  Platform,
} from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  runOnJS,
} from "react-native-reanimated";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { CHANGELOG, type ChangelogEntry } from "../utils/changelog";
import AsyncStorage from "@react-native-async-storage/async-storage";
import Constants from "expo-constants";

const { width, height } = Dimensions.get("window");
const WHATS_NEW_KEY = "@app_whats_new_seen";

export function getLatestEntry(): ChangelogEntry {
  return CHANGELOG[0];
}

export async function shouldShowWhatsNew(): Promise<boolean> {
  try {
    const seen = await AsyncStorage.getItem(WHATS_NEW_KEY);
    const current = Constants.expoConfig?.version ?? "0";
    return seen !== current;
  } catch {
    return false;
  }
}

export async function markWhatsNewSeen(): Promise<void> {
  try {
    const current = Constants.expoConfig?.version ?? "0";
    await AsyncStorage.setItem(WHATS_NEW_KEY, current);
  } catch {}
}

/* ---- Feature row ---- */
function FeatureRow({
  icon,
  color,
  title,
  description,
  dark,
  delay,
}: {
  icon: string;
  color: string;
  title: string;
  description: string;
  dark: boolean;
  delay: number;
}) {
  const translateX = useSharedValue(24);
  const opacity = useSharedValue(0);

  useEffect(() => {
    const t = setTimeout(() => {
      translateX.value = withSpring(0, { damping: 18, stiffness: 200 });
      opacity.value = withTiming(1, { duration: 300 });
    }, delay);
    return () => clearTimeout(t);
  }, []);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
    opacity: opacity.value,
  }));

  return (
    <Animated.View style={[styles.featureRow, animStyle]}>
      <View style={[styles.featureIconWrap, { backgroundColor: color + "22" }]}>
        <Ionicons name={icon as any} size={22} color={color} />
      </View>
      <View style={styles.featureText}>
        <Text style={[styles.featureTitle, { color: dark ? "#fff" : "#111" }]}>
          {title}
        </Text>
        <Text style={[styles.featureDesc, { color: dark ? "rgba(255,255,255,0.55)" : "rgba(0,0,0,0.48)" }]}>
          {description}
        </Text>
      </View>
    </Animated.View>
  );
}

/* ---- Main modal ---- */
export function WhatsNewModal({
  visible,
  dark,
  onClose,
}: {
  visible: boolean;
  dark: boolean;
  onClose: () => void;
}) {
  const translateY = useSharedValue(height);
  const backdropOp = useSharedValue(0);
  // Bug #3 fix: guard against onClose firing on a re-opened sheet
  const isDismissing = useRef(false);

  useEffect(() => {
    if (visible) {
      isDismissing.current = false;
      backdropOp.value = withTiming(1, { duration: 260 });
      translateY.value = withSpring(0, { damping: 24, stiffness: 280 });
    }
  }, [visible]);

  const dismiss = () => {
    isDismissing.current = true;
    backdropOp.value = withTiming(0, { duration: 200 });
    translateY.value = withTiming(height, { duration: 300 }, (done) => {
      if (done && isDismissing.current) runOnJS(onClose)();
    });
  };

  const sheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));
  const backdropStyle = useAnimatedStyle(() => ({ opacity: backdropOp.value }));

  const entry = getLatestEntry();
  const version = Constants.expoConfig?.version ?? "—";

  const cardBg = dark ? "#1c1c1e" : "#ffffff";
  const titleColor = dark ? "#fff" : "#111";

  if (!visible) return null;

  return (
    <Modal transparent animationType="none" visible={visible} statusBarTranslucent>
      <Animated.View style={[styles.backdrop, backdropStyle]}>
        <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={dismiss} />
      </Animated.View>

      <Animated.View style={[styles.sheet, { backgroundColor: cardBg }, sheetStyle]}>
        {/* Gradient header */}
        <LinearGradient
          colors={["#6C47FF", "#00C9FF"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.gradientHeader}
        >
          {/* Decorative circles */}
          <View style={styles.circle1} />
          <View style={styles.circle2} />

          <View style={styles.versionBadge}>
            <Text style={styles.versionBadgeText}>v{version}</Text>
          </View>

          <Text style={styles.headerEmoji}>🎉</Text>
          <Text style={styles.headerTitle}>Nouveautés</Text>
          <Text style={styles.headerTagline}>{entry.tagline}</Text>
        </LinearGradient>

        {/* Feature list */}
        <ScrollView
          style={{ flex: 1 }}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.featureList}
        >
          {entry.features.map((f, i) => (
            <FeatureRow
              key={i}
              icon={f.icon}
              color={f.color}
              title={f.title}
              description={f.description}
              dark={dark}
              delay={i * 80}
            />
          ))}
        </ScrollView>

        {/* CTA */}
        <View style={styles.footer}>
          <TouchableOpacity style={styles.ctaBtn} onPress={dismiss} activeOpacity={0.85}>
            <LinearGradient
              colors={["#6C47FF", "#00C9FF"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.ctaGradient}
            >
              <Text style={styles.ctaText}>C'est parti !</Text>
              <Ionicons name="arrow-forward" size={18} color="#fff" style={{ marginLeft: 8 }} />
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </Animated.View>
    </Modal>
  );
}

/* ---- Badge dot ---- */
export function NewBadge({ visible }: { visible: boolean }) {
  const scale = useSharedValue(0);
  const opacity = useSharedValue(0);

  useEffect(() => {
    if (visible) {
      opacity.value = withTiming(1, { duration: 100 });
      scale.value = withSpring(1, { damping: 12, stiffness: 300 });
    } else {
      // Bug #8 fix: keep mounted during exit animation instead of returning null immediately
      opacity.value = withTiming(0, { duration: 160 });
      scale.value = withTiming(0, { duration: 160 });
    }
  }, [visible]);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }));

  // Always mounted so the exit animation can play
  return (
    <Animated.View style={[styles.badge, animStyle]}>
      <Text style={styles.badgeText}>N</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.5)",
  },

  sheet: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    maxHeight: height * 0.9,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -6 },
    shadowOpacity: 0.18,
    shadowRadius: 20,
    elevation: 16,
  },

  gradientHeader: {
    paddingTop: 36,
    paddingBottom: 28,
    paddingHorizontal: 24,
    alignItems: "center",
    overflow: "hidden",
  },
  circle1: {
    position: "absolute",
    width: 180,
    height: 180,
    borderRadius: 90,
    backgroundColor: "rgba(255,255,255,0.07)",
    top: -60,
    right: -40,
  },
  circle2: {
    position: "absolute",
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: "rgba(255,255,255,0.06)",
    bottom: -30,
    left: -20,
  },
  versionBadge: {
    position: "absolute",
    top: 16,
    right: 20,
    backgroundColor: "rgba(255,255,255,0.2)",
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  versionBadgeText: {
    color: "rgba(255,255,255,0.9)",
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 0.4,
  },
  headerEmoji: { fontSize: 44, marginBottom: 10 },
  headerTitle: {
    fontSize: 28,
    fontWeight: "800",
    color: "#fff",
    letterSpacing: -0.5,
    marginBottom: 6,
  },
  headerTagline: {
    fontSize: 14,
    color: "rgba(255,255,255,0.75)",
    textAlign: "center",
    lineHeight: 20,
  },

  featureList: {
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 12,
    gap: 16,
  },
  featureRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 14,
  },
  featureIconWrap: {
    width: 48,
    height: 48,
    borderRadius: 14,
    justifyContent: "center",
    alignItems: "center",
    flexShrink: 0,
  },
  featureText: { flex: 1, paddingTop: 2 },
  featureTitle: { fontSize: 15, fontWeight: "700", marginBottom: 3 },
  featureDesc: { fontSize: 13, lineHeight: 18 },

  footer: {
    paddingHorizontal: 20,
    paddingBottom: Platform.OS === "ios" ? 36 : 24,
    paddingTop: 12,
  },
  ctaBtn: { borderRadius: 18, overflow: "hidden" },
  ctaGradient: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 16,
  },
  ctaText: {
    color: "#fff",
    fontSize: 17,
    fontWeight: "800",
    letterSpacing: -0.3,
  },

  badge: {
    position: "absolute",
    top: -4,
    right: -4,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: "#FF3B30",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    borderColor: "#121212",
  },
  badgeText: {
    color: "#fff",
    fontSize: 9,
    fontWeight: "900",
    letterSpacing: -0.2,
  },
});
