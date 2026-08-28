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
