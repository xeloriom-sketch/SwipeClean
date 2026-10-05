import * as Notifications from "expo-notifications";
import AsyncStorage from "@react-native-async-storage/async-storage";

const NOTIF_KEY = "@app_notifications";
const NOTIF_HOUR_KEY = "@app_notif_hour";
const DAILY_NOTIF_ID = "swipeclean_daily_reminder";

export async function getNotifHour(): Promise<number> {
  const val = await AsyncStorage.getItem(NOTIF_HOUR_KEY);
  return val !== null ? Number(val) : 10;
}

export async function setNotifHour(hour: number): Promise<void> {
  await AsyncStorage.setItem(NOTIF_HOUR_KEY, String(hour));
}


export async function requestNotifPermission(): Promise<boolean> {
  const { status } = await Notifications.requestPermissionsAsync();
  return status === "granted";
}

export async function scheduleDailyReminder(hour?: number) {
  const h = hour ?? (await getNotifHour());
  await Notifications.cancelScheduledNotificationAsync(DAILY_NOTIF_ID).catch(() => {});
  await Notifications.scheduleNotificationAsync({
    identifier: DAILY_NOTIF_ID,
    content: {
      title: "SwipeClean 📷",
      body: "Quelques swipes pour libérer de l'espace aujourd'hui ?",
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DAILY,
      hour: h,
      minute: 0,
    },
  });
}

export async function cancelDailyReminder() {
  await Notifications.cancelScheduledNotificationAsync(DAILY_NOTIF_ID).catch(() => {});
}

export async function scheduleTrashFullNotif(count: number) {
  if (count < 20) return;
  await Notifications.scheduleNotificationAsync({
    content: {
      title: "Corbeille SwipeClean",
      body: `${count} photos dans la corbeille. Libérez de l'espace en les supprimant.`,
    },
    trigger: null,
  });
}

// Excuses pour l'incident du 2 octobre 2026: la mise à jour OTA a restauré un index de
// reprise devenu incompatible avec la pile filtrée, laissant l'app sur l'écran de
// chargement. Message unique, verrouillé par une clé dédiée — il ne repartira pas au
// prochain démarrage, et pas non plus chez qui a coupé les notifications.
const APOLOGY_KEY = "@app_notice_1_0_20_apology";

export async function maybeSendApologyNotice(): Promise<void> {
  try {
    if (await AsyncStorage.getItem(APOLOGY_KEY)) return;
    if (!(await isNotificationsEnabled())) return;
    // On ne réclame pas la permission pour une excuse: si elle n'est pas déjà
    // accordée, on se contente de ne rien envoyer.
    const { status } = await Notifications.getPermissionsAsync();
    if (status !== "granted") return;

    // Posée avant l'envoi: une erreur d'envoi ne doit pas faire réessayer indéfiniment.
    await AsyncStorage.setItem(APOLOGY_KEY, "1");
    await Notifications.scheduleNotificationAsync({
      content: {
        title: "Désolé pour la panne 🙏",
        body: "La dernière mise à jour bloquait l'app sur l'écran de chargement et ralentissait l'affichage des photos. C'est corrigé. Merci de ta patience.",
      },
      trigger: null,
    });
  } catch {}
}

export async function isNotificationsEnabled(): Promise<boolean> {
  const val = await AsyncStorage.getItem(NOTIF_KEY);
  return val !== "false";
}

export async function setNotificationsEnabled(enabled: boolean, hour?: number) {
  await AsyncStorage.setItem(NOTIF_KEY, enabled ? "true" : "false");
  if (enabled) {
    const granted = await requestNotifPermission();
    if (granted) await scheduleDailyReminder(hour);
  } else {
    await cancelDailyReminder();
  }
}
