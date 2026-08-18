// app/Settings.tsx
import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  Switch,
  StatusBar,
  ScrollView,
  TouchableOpacity,
  LayoutAnimation,
  UIManager,
  Platform,
  Dimensions,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import Constants from "expo-constants";
import { isNotificationsEnabled, setNotificationsEnabled, getNotifHour, setNotifHour, scheduleDailyReminder } from "../../utils/notifications";
import * as Updates from "expo-updates";

const DARK_MODE_KEY = "@app_dark_mode";
const VIBRATE_KEY = "@app_vibrate_swipe";
export const SOUND_KEY = "@app_sound";
export const AUTO_DARK_KEY = "@app_dark_auto";
export const AUTO_TRASH_DAYS_KEY = "@app_auto_trash_days";

const { width, height } = Dimensions.get("window");
const wp = (p: number) => (width * p) / 100;
const hp = (p: number) => (height * p) / 100;

if (Platform.OS === "android" && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const AUTO_TRASH_OPTIONS: Array<{ value: 0 | 7 | 30; label: string }> = [
  { value: 0,  label: "Désactivé" },
  { value: 7,  label: "7 jours" },
  { value: 30, label: "30 jours" },
];

export default function SettingsScreen() {
  const [darkMode, setDarkMode] = useState(false);
  const [darkAuto, setDarkAuto] = useState(false);
  const [vibrateSwipe, setVibrateSwipe] = useState(true);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [notifications, setNotifications] = useState(true);
  const [autoTrashDays, setAutoTrashDays] = useState<0 | 7 | 30>(0);
  const [showAbout, setShowAbout] = useState(false);
  const [notifHour, setNotifHourState] = useState(10);
  const [updateStatus, setUpdateStatus] = useState<"idle" | "checking" | "downloading" | "ready" | "uptodate">("idle");

  useEffect(() => {
    (async () => {
      const [dm, vs, snd, dkAuto, atDays, notif, nh] = await Promise.all([
        AsyncStorage.getItem(DARK_MODE_KEY),
        AsyncStorage.getItem(VIBRATE_KEY),
        AsyncStorage.getItem(SOUND_KEY),
        AsyncStorage.getItem(AUTO_DARK_KEY),
        AsyncStorage.getItem(AUTO_TRASH_DAYS_KEY),
        isNotificationsEnabled(),
        getNotifHour(),
      ]);
      if (dm !== null) setDarkMode(dm === "true");
      if (vs !== null) setVibrateSwipe(vs === "true");
      if (snd !== null) setSoundEnabled(snd !== "false");
      if (dkAuto !== null) setDarkAuto(dkAuto === "true");
      if (atDays !== null) setAutoTrashDays(Number(atDays) as 0 | 7 | 30);
      setNotifications(notif);
      setNotifHourState(nh);
    })();
  }, []);

  const toggleDarkMode = async () => {
    const newVal = !darkMode;
    setDarkMode(newVal);
    await AsyncStorage.setItem(DARK_MODE_KEY, newVal.toString());
  };

  const toggleDarkAuto = async () => {
    const newVal = !darkAuto;
    setDarkAuto(newVal);
    await AsyncStorage.setItem(AUTO_DARK_KEY, newVal.toString());
  };

  const toggleVibrate = async () => {
    const newVal = !vibrateSwipe;
    setVibrateSwipe(newVal);
    await AsyncStorage.setItem(VIBRATE_KEY, newVal.toString());
  };

  const toggleSound = async () => {
    const newVal = !soundEnabled;
    setSoundEnabled(newVal);
    await AsyncStorage.setItem(SOUND_KEY, newVal.toString());
  };

  const toggleNotifications = async () => {
    const newVal = !notifications;
    setNotifications(newVal);
    await setNotificationsEnabled(newVal, notifHour);
  };

  const checkForUpdate = async () => {
    if (__DEV__) { Alert.alert("Info", "Mises à jour désactivées en développement."); return; }
    setUpdateStatus("checking");
    try {
      const check = await Updates.checkForUpdateAsync();
      if (!check.isAvailable) { setUpdateStatus("uptodate"); return; }
      setUpdateStatus("downloading");
      await Updates.fetchUpdateAsync();
      setUpdateStatus("ready");
      Alert.alert(
        "Mise à jour prête",
        "Une nouvelle version est installée. Redémarrer maintenant ?",
        [
          { text: "Plus tard", style: "cancel", onPress: () => setUpdateStatus("idle") },
          { text: "Redémarrer", onPress: () => Updates.reloadAsync() },
        ]
      );
    } catch {
      setUpdateStatus("idle");
      Alert.alert("Erreur", "Impossible de vérifier les mises à jour. Vérifiez votre connexion.");
    }
  };

  const changeNotifHour = async (delta: number) => {
    const newHour = (notifHour + delta + 24) % 24;
    setNotifHourState(newHour);
    await setNotifHour(newHour);
    if (notifications) await scheduleDailyReminder(newHour);
  };

  const cycleAutoTrash = async () => {
    const next: 0 | 7 | 30 = autoTrashDays === 0 ? 7 : autoTrashDays === 7 ? 30 : 0;
    setAutoTrashDays(next);
    await AsyncStorage.setItem(AUTO_TRASH_DAYS_KEY, String(next));
    if (next > 0) {
      Alert.alert("Corbeille auto", `Les photos dans la corbeille depuis plus de ${next} jours seront supprimées automatiquement au prochain lancement.`);
    }
  };

  const toggleAbout = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setShowAbout((prev) => !prev);
  };

  const sub = (txt: string) => (
    <Text style={[styles.optionSub, darkMode && { color: "rgba(255,255,255,0.4)" }]}>{txt}</Text>
  );

  const sep = (
    <View style={[styles.separator, { backgroundColor: darkMode ? "rgba(255,255,255,0.07)" : "#f0f0f0" }]} />
  );

  return (
    <SafeAreaView style={[styles.container, darkMode && styles.darkContainer]}>
      <StatusBar barStyle={darkMode ? "light-content" : "dark-content"} />

      {/* Header */}
      <View style={[styles.header, { borderBottomColor: darkMode ? "rgba(255,255,255,0.08)" : "#eee" }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={wp(7)} color={darkMode ? "#fff" : "#000"} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, darkMode && styles.darkText]}>Paramètres</Text>
        <View style={{ width: wp(7) }} />
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 32 }}
        keyboardShouldPersistTaps="handled"
      >

      {/* Section: Apparence */}
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: darkMode ? "rgba(255,255,255,0.4)" : "rgba(0,0,0,0.35)" }]}>
          APPARENCE
        </Text>
        <View style={[styles.card, { backgroundColor: darkMode ? "#1a1a1a" : "#fff" }]}>
          <View style={styles.optionRow}>
            <View>
              <Text style={[styles.optionText, darkMode && styles.darkText]}>Thème automatique</Text>
              {sub(darkAuto ? "Suit le mode clair/sombre de votre téléphone" : "Mode manuel activé")}
            </View>
            <Switch
              value={darkAuto}
              onValueChange={toggleDarkAuto}
              trackColor={{ false: "#ddd", true: "#0A84FF" }}
            />
          </View>
          {sep}
          <View style={[styles.optionRow, darkAuto && { opacity: 0.4 }]}>
            <View>
              <Text style={[styles.optionText, darkMode && styles.darkText]}>Mode sombre</Text>
              {sub(darkAuto ? "Désactivez le thème auto pour changer" : "Fond noir pour économiser la batterie")}
            </View>
            <Switch
              value={darkMode}
              onValueChange={darkAuto ? undefined : toggleDarkMode}
              disabled={darkAuto}
              trackColor={{ false: "#ddd", true: "#0A84FF" }}
            />
          </View>
        </View>
      </View>

      {/* Section: Swipe */}
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: darkMode ? "rgba(255,255,255,0.4)" : "rgba(0,0,0,0.35)" }]}>
          GESTES DE SWIPE
        </Text>
        <View style={[styles.card, { backgroundColor: darkMode ? "#1a1a1a" : "#fff" }]}>
          <View style={styles.optionRow}>
            <View>
              <Text style={[styles.optionText, darkMode && styles.darkText]}>Sons</Text>
              {sub("Bruit à chaque swipe")}
            </View>
            <Switch
              value={soundEnabled}
              onValueChange={toggleSound}
              trackColor={{ false: "#ddd", true: "#0A84FF" }}
            />
          </View>
          {sep}
          <View style={styles.optionRow}>
            <View>
              <Text style={[styles.optionText, darkMode && styles.darkText]}>Vibration</Text>
              {sub("Retour haptique au swipe")}
            </View>
            <Switch
              value={vibrateSwipe}
              onValueChange={toggleVibrate}
              trackColor={{ false: "#ddd", true: "#0A84FF" }}
            />
          </View>
        </View>
      </View>

      {/* Section: Corbeille */}
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: darkMode ? "rgba(255,255,255,0.4)" : "rgba(0,0,0,0.35)" }]}>
          CORBEILLE
        </Text>
        <View style={[styles.card, { backgroundColor: darkMode ? "#1a1a1a" : "#fff" }]}>
          <TouchableOpacity style={styles.optionRow} onPress={cycleAutoTrash} activeOpacity={0.7}>
            <View style={{ flex: 1, marginRight: 12 }}>
              <Text style={[styles.optionText, darkMode && styles.darkText]}>Suppression automatique</Text>
              {sub(autoTrashDays === 0
                ? "Les photos restent dans la corbeille indéfiniment"
                : `Les photos de plus de ${autoTrashDays} jours sont supprimées`)}
            </View>
            <View style={[styles.badge, { backgroundColor: autoTrashDays > 0 ? "#FF4458" : (darkMode ? "#333" : "#eee") }]}>
              <Text style={[styles.badgeText, { color: autoTrashDays > 0 ? "#fff" : (darkMode ? "#888" : "#999") }]}>
                {autoTrashDays === 0 ? "OFF" : `${autoTrashDays}j`}
              </Text>
            </View>
          </TouchableOpacity>
        </View>
      </View>

      {/* Section: Notifications */}
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: darkMode ? "rgba(255,255,255,0.4)" : "rgba(0,0,0,0.35)" }]}>
          RAPPELS
        </Text>
        <View style={[styles.card, { backgroundColor: darkMode ? "#1a1a1a" : "#fff" }]}>
          <View style={styles.optionRow}>
            <View>
              <Text style={[styles.optionText, darkMode && styles.darkText]}>Rappel quotidien</Text>
              {sub("Notification pour penser à trier vos photos")}
            </View>
            <Switch
              value={notifications}
              onValueChange={toggleNotifications}
              trackColor={{ false: "#ddd", true: "#0A84FF" }}
            />
          </View>
          {sep}
          <View style={[styles.optionRow, !notifications && { opacity: 0.4 }]}>
            <View>
              <Text style={[styles.optionText, darkMode && styles.darkText]}>Heure du rappel</Text>
              {sub(`Vous serez notifié à ${notifHour.toString().padStart(2, "0")}h00`)}
            </View>
            <View style={styles.hourPicker}>
              <TouchableOpacity
                onPress={() => notifications && changeNotifHour(-1)}
                style={[styles.hourBtn, { backgroundColor: darkMode ? "#2a2a2a" : "#f0f0f0" }]}
                disabled={!notifications}
              >
                <Ionicons name="remove" size={wp(5)} color={darkMode ? "#fff" : "#000"} />
              </TouchableOpacity>
              <Text style={[styles.hourVal, darkMode && styles.darkText]}>
                {notifHour.toString().padStart(2, "0")}h
              </Text>
              <TouchableOpacity
                onPress={() => notifications && changeNotifHour(1)}
                style={[styles.hourBtn, { backgroundColor: darkMode ? "#2a2a2a" : "#f0f0f0" }]}
                disabled={!notifications}
              >
                <Ionicons name="add" size={wp(5)} color={darkMode ? "#fff" : "#000"} />
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </View>

      {/* Section: App */}
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: darkMode ? "rgba(255,255,255,0.4)" : "rgba(0,0,0,0.35)" }]}>
          APPLICATION
        </Text>
        <View style={[styles.card, { backgroundColor: darkMode ? "#1a1a1a" : "#fff" }]}>
          <TouchableOpacity
            style={styles.optionRow}
            onPress={async () => {
              await AsyncStorage.removeItem("@app_onboarded");
              router.push("/Onboarding");
            }}
          >
            <View>
              <Text style={[styles.optionText, darkMode && styles.darkText]}>Revoir le tutoriel</Text>
              {sub("Apprendre les gestes ← → ↑")}
            </View>
            <Ionicons name="play-circle-outline" size={wp(5.5)} color={darkMode ? "#fff" : "#000"} />
          </TouchableOpacity>
          {sep}
          <TouchableOpacity
            onPress={checkForUpdate}
            disabled={updateStatus === "checking" || updateStatus === "downloading"}
            style={styles.optionRow}
            activeOpacity={0.7}
          >
            <View style={styles.updateBtnLeft}>
              <Ionicons
                name={updateStatus === "ready" ? "checkmark-circle" : updateStatus === "uptodate" ? "checkmark-circle-outline" : "cloud-download-outline"}
                size={wp(5.5)}
                color={updateStatus === "ready" ? "#34C759" : updateStatus === "uptodate" ? "#34C759" : (darkMode ? "#fff" : "#000")}
              />
              <View>
                <Text style={[styles.optionText, darkMode && styles.darkText]}>Mises à jour</Text>
                {sub(
                  updateStatus === "checking" ? "Vérification en cours…"
                  : updateStatus === "downloading" ? "Téléchargement…"
                  : updateStatus === "ready" ? "Prête — redémarrez l'app ✓"
                  : updateStatus === "uptodate" ? "Vous êtes à jour ✓"
                  : "Appuyez pour vérifier"
                )}
              </View>
            </View>
            <Ionicons name="chevron-forward" size={wp(4)} color={darkMode ? "#555" : "#bbb"} />
          </TouchableOpacity>
          {sep}
          <TouchableOpacity
            onPress={toggleAbout}
            style={styles.optionRow}
            activeOpacity={0.7}
          >
            <View>
              <Text style={[styles.optionText, darkMode && styles.darkText]}>À propos</Text>
              {sub(`SwipeClean v${Constants.expoConfig?.version ?? "—"}-beta`)}
            </View>
            <Ionicons name={showAbout ? "chevron-up" : "chevron-down"} size={wp(5)} color={darkMode ? "#888" : "#aaa"} />
          </TouchableOpacity>
          {showAbout && (
            <View style={[styles.aboutBox, { backgroundColor: darkMode ? "#111" : "#f5f5f5" }]}>
              <Text style={[styles.aboutLine, { color: darkMode ? "#888" : "#aaa" }]}>© 2025 SwipeClean · Tous droits réservés</Text>
            </View>
          )}
        </View>
      </View>

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F2F2F7" },
  darkContainer: { backgroundColor: "#0d0d0d" },

  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: wp(4),
    paddingVertical: hp(1.8),
    borderBottomWidth: 1,
    marginBottom: 8,
  },
  headerTitle: { fontSize: wp(5), fontWeight: "700" },
  darkText: { color: "#fff" },
  backBtn: { padding: wp(1) },

  section: { marginBottom: 8, paddingHorizontal: 16 },
  sectionTitle: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.8,
    marginBottom: 6,
    paddingHorizontal: 4,
  },
  card: {
    borderRadius: 16,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  optionRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 13,
  },
  optionText: { fontSize: wp(4), fontWeight: "500" },
  optionSub: { fontSize: wp(3.2), color: "rgba(0,0,0,0.4)", marginTop: 2 },
  separator: { height: 1, marginHorizontal: 16 },

  badge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
    minWidth: 44,
    alignItems: "center",
  },
  badgeText: { fontSize: 13, fontWeight: "700" },

  updateBtn: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginHorizontal: 16,
    paddingHorizontal: 16,
    paddingVertical: 13,
    borderRadius: 16,
    marginBottom: 8,
  },
  updateBtnLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    flex: 1,
  },

  hourPicker: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  hourBtn: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  hourVal: {
    fontSize: wp(4.5),
    fontWeight: "700",
    minWidth: 44,
    textAlign: "center",
    letterSpacing: -0.5,
  },

  aboutRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginHorizontal: 16,
    paddingHorizontal: 16,
    paddingVertical: 13,
    borderRadius: 16,
    marginBottom: 4,
  },
  aboutBox: {
    marginHorizontal: 16,
    borderRadius: 12,
    padding: 16,
    gap: 4,
  },
  aboutLine: { fontSize: 13 },
});
