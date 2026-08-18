import AsyncStorage from "@react-native-async-storage/async-storage";

const KEY = "@app_achievements";

export type Achievement = {
  id: string;
  icon: string;
  color: string;
  title: string;
  desc: string;
  unlockedAt?: number;
};

export const ALL_ACHIEVEMENTS: Achievement[] = [
  // Swipes
  { id: "first_swipe",   icon: "flash",              color: "#FFD60A", title: "Premier swipe",         desc: "Tu as commencé !" },
  { id: "swipes_10",     icon: "layers",             color: "#4ECDC4", title: "10 photos triées",      desc: "Belle lancée !" },
  { id: "swipes_50",     icon: "flame",              color: "#FF6B35", title: "50 photos triées",      desc: "Tu prends ton rythme !" },
  { id: "swipes_100",    icon: "rocket",             color: "#A78BFA", title: "100 photos triées",     desc: "Accro au swipe !" },
  { id: "swipes_200",    icon: "planet",             color: "#34D399", title: "200 photos triées",     desc: "Tu déchires !" },
  { id: "swipes_500",    icon: "medal",              color: "#F59E0B", title: "500 photos triées",     desc: "Machine à trier !" },
  { id: "swipes_1000",   icon: "trophy",             color: "#FFD700", title: "1 000 photos triées",   desc: "Légende du swipe !" },
  { id: "swipes_2000",   icon: "infinite",           color: "#FF4458", title: "2 000 photos triées",   desc: "Tu es inarrêtable !" },
  { id: "swipes_5000",   icon: "skull",              color: "#EC4899", title: "5 000 photos triées",   desc: "Maître absolu du swipe !" },
  // Favoris
  { id: "first_fav",     icon: "star",               color: "#FF6B9D", title: "Premier favori",        desc: "Tu sais ce que tu aimes !" },
  { id: "favs_10",       icon: "diamond",            color: "#00C9FF", title: "10 favoris",            desc: "Belle collection !" },
  { id: "favs_50",       icon: "heart-circle",       color: "#F43F5E", title: "50 favoris",            desc: "Collectionneur de souvenirs !" },
  // Corbeille
  { id: "first_trash",   icon: "trash",              color: "#4CFF5E", title: "Première corbeille",    desc: "Tu as fait le ménage !" },
  { id: "trash_emptied", icon: "sparkles",           color: "#BF5AF2", title: "Corbeille vidée",       desc: "Propre et net !" },
  // Galerie
  { id: "gallery_open",  icon: "images",             color: "#6366F1", title: "Explorateur",           desc: "Tu as ouvert une galerie !" },
  { id: "night_swipe",   icon: "moon",               color: "#818CF8", title: "Oiseau de nuit",        desc: "Trié des photos après minuit !" },
];

export async function getUnlocked(): Promise<Achievement[]> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    const unlocked: Record<string, number> = raw ? JSON.parse(raw) : {};
    return ALL_ACHIEVEMENTS.map((a) =>
      unlocked[a.id] ? { ...a, unlockedAt: unlocked[a.id] } : a
    );
  } catch {
    return ALL_ACHIEVEMENTS;
  }
}

export async function checkAndUnlock(
  id: string
): Promise<Achievement | null> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    const unlocked: Record<string, number> = raw ? JSON.parse(raw) : {};
    if (unlocked[id]) return null;
    unlocked[id] = Date.now();
    await AsyncStorage.setItem(KEY, JSON.stringify(unlocked));
    return ALL_ACHIEVEMENTS.find((a) => a.id === id) ?? null;
  } catch {
    return null;
  }
}

export async function checkSwipeMilestones(totalSwiped: number): Promise<Achievement | null> {
  const milestones: Record<number, string> = {
    1: "first_swipe", 10: "swipes_10", 50: "swipes_50",
    100: "swipes_100", 200: "swipes_200", 500: "swipes_500",
    1000: "swipes_1000", 2000: "swipes_2000", 5000: "swipes_5000",
  };
  const id = milestones[totalSwiped];
  return id ? checkAndUnlock(id) : null;
}

export async function checkNightSwipe(): Promise<Achievement | null> {
  const h = new Date().getHours();
  if (h >= 0 && h < 5) return checkAndUnlock("night_swipe");
  return null;
}

export function notifyAchievement(a: Achievement): void {
  import("expo-notifications").then(({ scheduleNotificationAsync }) => {
    scheduleNotificationAsync({
      content: { title: "Succès débloqué !", body: `${a.title} — ${a.desc}` },
      trigger: null,
    }).catch(() => {});
  }).catch(() => {});
}

export async function unlockAndNotify(id: string): Promise<void> {
  const a = await checkAndUnlock(id);
  if (a) notifyAchievement(a);
}

export async function checkFavMilestones(total: number): Promise<Achievement | null> {
  const milestones: Record<number, string> = { 1: "first_fav", 10: "favs_10", 50: "favs_50" };
  const id = milestones[total];
  return id ? checkAndUnlock(id) : null;
}
