import { useEffect } from "react";
import { Alert } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { Stack } from "expo-router";
import * as Updates from "expo-updates";

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

export default function Layout() {
  useAutoUpdate();
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <Stack screenOptions={{ headerShown: false }} />
    </GestureHandlerRootView>
  );
}
