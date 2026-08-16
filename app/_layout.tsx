import { useEffect } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { Stack } from "expo-router";
import * as Updates from "expo-updates";
import * as Notifications from "expo-notifications";

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
        // Notify user before restarting
        await Notifications.scheduleNotificationAsync({
          content: {
            title: "SwipeClean mis à jour ✓",
            body: "Une nouvelle version a été installée. L'app redémarre…",
          },
          trigger: null,
        }).catch(() => {});
        // Short delay so the notification appears before reload
        await new Promise(r => setTimeout(r, 1200));
        if (!cancelled) await Updates.reloadAsync();
      } catch {}
    })();
    return () => { cancelled = true; };
  }, []);
}

export default function Layout() {
  useAutoUpdate();
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <Stack screenOptions={{ headerShown: false }} />
    </GestureHandlerRootView>
  );
}
