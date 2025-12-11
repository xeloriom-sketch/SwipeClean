// app/Settings.tsx
import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  Switch,
  SafeAreaView,
  StatusBar,
  TouchableOpacity,
  LayoutAnimation,
  UIManager,
  Platform,
  Dimensions,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";

const DARK_MODE_KEY = "@app_dark_mode";
const VIBRATE_KEY = "@app_vibrate_swipe";

const { width, height } = Dimensions.get("window");

// Responsive utils
const wp = (p: number) => (width * p) / 100;
const hp = (p: number) => (height * p) / 100;

if (
  Platform.OS === "android" &&
  UIManager.setLayoutAnimationEnabledExperimental
) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

export default function SettingsScreen() {
  const [darkMode, setDarkMode] = useState(false);
  const [vibrateSwipe, setVibrateSwipe] = useState(true);
  const [showAbout, setShowAbout] = useState(false);

  useEffect(() => {
    (async () => {
      const dm = await AsyncStorage.getItem(DARK_MODE_KEY);
      const vs = await AsyncStorage.getItem(VIBRATE_KEY);
      if (dm !== null) setDarkMode(dm === "true");
      if (vs !== null) setVibrateSwipe(vs === "true");
    })();
  }, []);

  const toggleDarkMode = async () => {
    const newVal = !darkMode;
    setDarkMode(newVal);
    await AsyncStorage.setItem(DARK_MODE_KEY, newVal.toString());
  };

  const toggleVibrate = async () => {
    const newVal = !vibrateSwipe;
    setVibrateSwipe(newVal);
    await AsyncStorage.setItem(VIBRATE_KEY, newVal.toString());
  };

  const toggleAbout = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setShowAbout((prev) => !prev);
  };

  return (
    <SafeAreaView
      style={[styles.container, darkMode && styles.darkContainer]}
    >
      <StatusBar
        barStyle={darkMode ? "light-content" : "dark-content"}
      />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons
            name="arrow-back"
            size={wp(7)}
            color={darkMode ? "#fff" : "#000"}
          />
        </TouchableOpacity>

        <Text style={[styles.headerTitle, darkMode && styles.darkText]}>
          Paramètres
        </Text>

        <View style={{ width: wp(7) }} />
      </View>

      {/* Options */}
      <View style={styles.options}>
        {/* Mode sombre */}
        <View style={styles.optionRow}>
          <Text style={[styles.optionText, darkMode && styles.darkText]}>
            Mode sombre
          </Text>
          <Switch value={darkMode} onValueChange={toggleDarkMode} />
        </View>

        {/* Vibration */}
        <View style={styles.optionRow}>
          <Text style={[styles.optionText, darkMode && styles.darkText]}>
            Vibration swipe
          </Text>
          <Switch value={vibrateSwipe} onValueChange={toggleVibrate} />
        </View>

        {/* About */}
        <TouchableOpacity onPress={toggleAbout} style={styles.optionRow}>
          <Text style={[styles.optionText, darkMode && styles.darkText]}>
            À propos
          </Text>
          <Ionicons
            name={showAbout ? "chevron-up" : "chevron-down"}
            size={wp(5)}
            color={darkMode ? "#fff" : "#000"}
          />
        </TouchableOpacity>

        {showAbout && (
          <View style={[styles.aboutContainer, darkMode && styles.darkAbout]}>
            <Text style={[styles.aboutText, darkMode && styles.darkText]}>
              Nom de l'application: SwipeClean
            </Text>
            <Text style={[styles.aboutText, darkMode && styles.darkText]}>
              Version: 1.0.5-beta
            </Text>
            <Text style={[styles.aboutText, darkMode && styles.darkText]}>
              Développé par: SwipeClean
            </Text>
            <Text style={[styles.aboutText, darkMode && styles.darkText]}>
              © 2025 Tous droits réservés
            </Text>
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
  },

  darkContainer: {
    backgroundColor: "#121212",
  },

  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: wp(4),
    paddingVertical: hp(2),
    borderBottomWidth: 1,
    borderBottomColor: "#ccc",
  },

  headerTitle: {
    fontSize: wp(5),
    fontWeight: "600",
  },

  darkText: {
    color: "#fff",
  },

  backBtn: {
    padding: wp(1),
  },

  options: {
    marginTop: hp(3),
  },

  optionRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: wp(4),
    paddingVertical: hp(2),
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
  },

  optionText: {
    fontSize: wp(4.2),
    fontWeight: "500",
  },

  aboutContainer: {
    padding: wp(4),
    backgroundColor: "#f9f9f9",
  },

  darkAbout: {
    backgroundColor: "#1e1e1e",
  },

  aboutText: {
    fontSize: wp(3.7),
    marginBottom: hp(0.5),
  },
});