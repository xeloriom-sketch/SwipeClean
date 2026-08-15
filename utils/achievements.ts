import AsyncStorage from "@react-native-async-storage/async-storage";

const KEY = "@app_achievements";

export type Achievement = {
  id: string;
  emoji: string;
  title: string;
  desc: string;
  unlockedAt?: number;
};

export const ALL_ACHIEVEMENTS: Achievement[] = [
  { id: "first_swipe",   emoji: "🎉", title: "Premier swipe",       desc: "Tu as commencé !" },
  { id: "swipes_10",     emoji: "✨", title: "10 photos triées",     desc: "Belle lancée !" },
  { id: "swipes_50",     emoji: "🚀", title: "50 photos triées",     desc: "Tu prends ton rythme !" },
  { id: "swipes_100",    emoji: "💪", title: "100 photos triées",    desc: "Accro au swipe !" },
  { id: "swipes_500",    emoji: "🔥", title: "500 photos triées",    desc: "Machine à trier !" },
  { id: "swipes_1000",   emoji: "🏆", title: "1 000 photos triées",  desc: "Légende du swipe !" },
  { id: "first_fav",     emoji: "⭐", title: "Premier favori",       desc: "Tu sais ce que tu aimes !" },
  { id: "favs_10",       emoji: "💎", title: "10 favoris",           desc: "Belle collection !" },
  { id: "first_trash",   emoji: "🗑️", title: "Première suppression", desc: "Tu as fait le ménage !" },
  { id: "trash_emptied", emoji: "🧹", title: "Corbeille vidée",      desc: "Propre et net !" },
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
    100: "swipes_100", 500: "swipes_500", 1000: "swipes_1000",
  };
  const id = milestones[totalSwiped];
  return id ? checkAndUnlock(id) : null;
}
