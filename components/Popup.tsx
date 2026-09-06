// components/Popup.tsx
import React, { useState, useCallback } from "react";
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
} from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  runOnJS,
} from "react-native-reanimated";

const CARD_W = Math.min(Dimensions.get("window").width - 56, 320);

export type PopupButton = {
  text: string;
  style?: "default" | "cancel" | "destructive";
  onPress?: () => void;
};

export type PopupConfig = {
  title: string;
  message?: string;
  icon?: string;
  buttons: PopupButton[];
};

function PopupModal({
  config,
  dark,
  onDismiss,
}: {
  config: PopupConfig;
  dark: boolean;
  onDismiss: () => void;
}) {
  const scale = useSharedValue(0.88);
  const backdropOp = useSharedValue(0);

  React.useEffect(() => {
    scale.value = withSpring(1, { damping: 22, stiffness: 320 });
    backdropOp.value = withTiming(1, { duration: 160 });
  }, []);

  const dismiss = (fn?: () => void) => {
    scale.value = withTiming(0.9, { duration: 120 });
    backdropOp.value = withTiming(0, { duration: 120 }, (done) => {
      if (done) runOnJS(onDismiss)();
    });
    fn?.();
  };

  const cardAnim = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  const backdropAnim = useAnimatedStyle(() => ({ opacity: backdropOp.value }));

  const cardBg = dark ? "#2c2c2e" : "#ffffff";
  const titleColor = dark ? "#fff" : "#000";
  const msgColor = dark ? "rgba(255,255,255,0.58)" : "rgba(0,0,0,0.52)";
  const divColor = dark ? "rgba(255,255,255,0.09)" : "rgba(0,0,0,0.09)";

  return (
    <Modal transparent animationType="none" visible statusBarTranslucent>
      <Animated.View style={[styles.backdrop, backdropAnim]}>
        <Animated.View style={[styles.card, { backgroundColor: cardBg, width: CARD_W }, cardAnim]}>
          {config.icon ? <Text style={styles.icon}>{config.icon}</Text> : null}

          <Text style={[styles.title, { color: titleColor }]}>{config.title}</Text>

          {config.message ? (
            <Text style={[styles.message, { color: msgColor }]}>{config.message}</Text>
          ) : null}

          <View style={[styles.divider, { backgroundColor: divColor }]} />

          {config.buttons.map((btn, i) => {
            const btnColor =
              btn.style === "destructive"
                ? "#FF3B30"
                : btn.style === "cancel"
                ? dark ? "rgba(255,255,255,0.55)" : "rgba(0,0,0,0.45)"
                : "#007AFF";
            return (
              <React.Fragment key={i}>
                <TouchableOpacity
                  style={styles.btnRow}
                  activeOpacity={0.5}
                  onPress={() => dismiss(btn.onPress)}
                >
                  <Text
                    style={[
                      styles.btnText,
                      { color: btnColor },
                      btn.style !== "cancel" && { fontWeight: "700" },
                    ]}
                  >
                    {btn.text}
                  </Text>
                </TouchableOpacity>
                {i < config.buttons.length - 1 && (
                  <View style={[styles.divider, { backgroundColor: divColor }]} />
                )}
              </React.Fragment>
            );
          })}
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}

export function usePopup(dark = false) {
  const [config, setConfig] = useState<PopupConfig | null>(null);

  const showPopup = useCallback((cfg: PopupConfig) => setConfig(cfg), []);

  const popup = config ? (
    <PopupModal config={config} dark={dark} onDismiss={() => setConfig(null)} />
  ) : null;

  return { popup, showPopup };
}

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.48)",
    justifyContent: "center",
    alignItems: "center",
  },
  card: {
    borderRadius: 18,
    overflow: "hidden",
    paddingTop: 24,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.22,
    shadowRadius: 24,
    elevation: 12,
  },
  icon: { fontSize: 38, textAlign: "center", marginBottom: 8 },
  title: {
    fontSize: 17,
    fontWeight: "700",
    textAlign: "center",
    paddingHorizontal: 22,
    marginBottom: 7,
  },
  message: {
    fontSize: 14,
    textAlign: "center",
    lineHeight: 20,
    paddingHorizontal: 22,
    paddingBottom: 20,
  },
  divider: { height: StyleSheet.hairlineWidth },
  btnRow: { paddingVertical: 17, alignItems: "center" },
  btnText: { fontSize: 16 },
});
