import { useEffect } from "react";
import { Alert } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { Stack } from "expo-router";
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

function useAutoUpdate() {
  useEffect(() => {
    if (__DEV__) return;
    let cancelled = false;
    (async () => {
      try {
        const check = await Updates.checkForUpdateAsync();
        if (cancelled || !check.isAvailable) return;
        await Updates.fetchUpdateAsync();
        if (cancelled) return;
        Alert.alert(
          "Mise à jour disponible 🎉",
          "Une nouvelle version de SwipeClean est prête. Redémarrer maintenant ?",
          [
            { text: "Plus tard", style: "cancel" },
            { text: "Redémarrer", onPress: () => Updates.reloadAsync() },
          ],
          { cancelable: false }
        );
      } catch {}
    })();
    return () => { cancelled = true; };
  }, []);
}

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
  useAutoUpdate();
  useEnsureDailyReminder();
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <Stack screenOptions={{ headerShown: false }} />
    </GestureHandlerRootView>
  );
}
