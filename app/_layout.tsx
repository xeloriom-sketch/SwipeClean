import { useEffect, useState } from "react";
import { useColorScheme } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { Stack } from "expo-router";
import { usePopup } from "../components/Popup";
import * as Updates from "expo-updates";
import * as Notifications from "expo-notifications";
import { isNotificationsEnabled, scheduleDailyReminder } from "../utils/notifications";

// Doit être au niveau module (avant tout render) pour que les notifs s'affichent en foreground
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

function useEnsureDailyReminder() {
  useEffect(() => {
    (async () => {
      try {
        const enabled = await isNotificationsEnabled();
        if (!enabled) return;
        const { status } = await Notifications.getPermissionsAsync();
        if (status === "granted") {
          await scheduleDailyReminder();
        } else if (status === "undetermined") {
          const { status: newStatus } = await Notifications.requestPermissionsAsync();
          if (newStatus === "granted") await scheduleDailyReminder();
        }
      } catch {}
    })();
  }, []);
}

export default function Layout() {
  useEnsureDailyReminder();
  const scheme = useColorScheme();
  const [darkPref, setDarkPref] = useState<boolean | null>(null);
  useEffect(() => {
    const AsyncStorage = require("@react-native-async-storage/async-storage").default;
    AsyncStorage.getItem("@app_dark_mode").then((v: string | null) => {
      setDarkPref(v !== null ? v === "true" : null);
    }).catch(() => {});
  }, []);
  const isDark = darkPref !== null ? darkPref : scheme === "dark";
  const { popup, showPopup } = usePopup(isDark);

  useEffect(() => {
    if (__DEV__) return;
    let cancelled = false;
    (async () => {
      try {
        const check = await Updates.checkForUpdateAsync();
        if (cancelled || !check.isAvailable) return;
        await Updates.fetchUpdateAsync();
        if (cancelled) return;
        showPopup({
          icon: "🎉",
          title: "Mise à jour disponible",
          message: "Une nouvelle version de SwipeClean est prête. Redémarrer maintenant ?",
          buttons: [
            { text: "Plus tard", style: "cancel" },
            { text: "Redémarrer", style: "default", onPress: () => Updates.reloadAsync() },
          ],
        });
      } catch {}
    })();
    return () => { cancelled = true; };
  }, [showPopup]);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <Stack screenOptions={{ headerShown: false }} />
      {popup}
    </GestureHandlerRootView>
  );
}
