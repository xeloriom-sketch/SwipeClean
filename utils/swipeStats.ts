import AsyncStorage from "@react-native-async-storage/async-storage";

const STATS_KEY = "@app_swipe_daily_stats";

type DayStat = {
  deletedMB: number;
  keptCount: number;
  starredCount: number;
  swipedCount: number;
};

type StatsStore = Record<string, DayStat>;

// Bug #6 fix: local timezone instead of UTC so users west of UTC don't get wrong day
function todayKey(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function dateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// Bug #1 fix: single shared cache promise — prevents read-modify-write races on rapid swipes
let cachePromise: Promise<StatsStore> | null = null;

async function getCache(): Promise<StatsStore> {
  if (!cachePromise) {
    cachePromise = AsyncStorage.getItem(STATS_KEY)
      .then((raw) => (raw ? (JSON.parse(raw) as StatsStore) : {}))
      .catch((): StatsStore => ({}));
  }
  return cachePromise;
}

let flushTimer: ReturnType<typeof setTimeout> | null = null;

function scheduleFlush(cache: StatsStore): void {
  if (flushTimer !== null) clearTimeout(flushTimer);
  flushTimer = setTimeout(() => {
    AsyncStorage.setItem(STATS_KEY, JSON.stringify(cache)).catch(() => {});
    flushTimer = null;
  }, 600);
}

export async function recordSwipe(
  fileSize: number | undefined,
  direction: "left" | "right" | "top" | "bottom"
): Promise<void> {
  const cache = await getCache();
  const key = todayKey();
  if (!cache[key]) {
    cache[key] = { deletedMB: 0, keptCount: 0, starredCount: 0, swipedCount: 0 };
  }
  cache[key].swipedCount++;
  if (direction === "left") cache[key].deletedMB += (fileSize ?? 0) / 1_048_576;
  else if (direction === "right") cache[key].keptCount++;
  else if (direction === "top") cache[key].starredCount++;
  scheduleFlush(cache);
}

export type DayStatEntry = {
  date: string;
  label: string;
  deletedMB: number;
  swipedCount: number;
};

const DAY_LABELS = ["Di", "Lu", "Ma", "Me", "Je", "Ve", "Sa"];

export async function getWeeklyStats(): Promise<DayStatEntry[]> {
  const cache = await getCache();
  const result: DayStatEntry[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const key = dateKey(d);
    const day = cache[key] ?? { deletedMB: 0, keptCount: 0, starredCount: 0, swipedCount: 0 };
    result.push({ date: key, label: DAY_LABELS[d.getDay()], deletedMB: day.deletedMB, swipedCount: day.swipedCount });
  }
  return result;
}

export async function getStreak(): Promise<number> {
  const cache = await getCache();
  let streak = 0;
  const today = todayKey();
  if (cache[today]?.swipedCount > 0) streak++;
  const d = new Date();
  d.setDate(d.getDate() - 1);
  while (true) {
    const key = dateKey(d);
    if (cache[key]?.swipedCount > 0) {
      streak++;
      d.setDate(d.getDate() - 1);
    } else {
      break;
    }
  }
  return streak;
}

export type WeeklyTotals = {
  thisWeek: { deletedMB: number; swipedCount: number };
  lastWeek: { deletedMB: number; swipedCount: number };
};

export async function getWeeklyTotals(): Promise<WeeklyTotals> {
  const cache = await getCache();
  const thisWeek = { deletedMB: 0, swipedCount: 0 };
  const lastWeek = { deletedMB: 0, swipedCount: 0 };
  for (let i = 0; i < 7; i++) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const day = cache[dateKey(d)];
    if (day) { thisWeek.deletedMB += day.deletedMB; thisWeek.swipedCount += day.swipedCount; }
  }
  for (let i = 7; i < 14; i++) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const day = cache[dateKey(d)];
    if (day) { lastWeek.deletedMB += day.deletedMB; lastWeek.swipedCount += day.swipedCount; }
  }
  return { thisWeek, lastWeek };
}
