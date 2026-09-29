// utils/storageQueue.ts — écritures AsyncStorage debouncées
//
// `@app_trash` (jusqu'à 1000 objets complets) et `@app_kept` (jusqu'à 10 000 ids)
// étaient re-sérialisés et réécrits intégralement à *chaque* swipe : ~200-500 Ko
// de JSON par geste, soit du jank, de la pression GC Hermes et de la contention
// SQLite sur le thread natif d'AsyncStorage.
import AsyncStorage from "@react-native-async-storage/async-storage";
import { AppState } from "react-native";

const DEFAULT_DELAY_MS = 800;

const pending = new Map<string, unknown>();
const timers = new Map<string, ReturnType<typeof setTimeout>>();

function write(key: string) {
  const timer = timers.get(key);
  if (timer) clearTimeout(timer);
  timers.delete(key);

  if (!pending.has(key)) return;
  const value = pending.get(key);
  pending.delete(key);
  try {
    AsyncStorage.setItem(key, JSON.stringify(value)).catch(() => {});
  } catch {}
}

/** Remplace la valeur en attente pour `key` et programme l'écriture. */
export function queueWrite(key: string, value: unknown, delayMs = DEFAULT_DELAY_MS) {
  pending.set(key, value);
  const existing = timers.get(key);
  if (existing) clearTimeout(existing);
  timers.set(
    key,
    setTimeout(() => write(key), delayMs)
  );
}

/** Écrit immédiatement tout ce qui est en attente (démontage, mise en arrière-plan). */
export function flushWrites() {
  for (const key of Array.from(pending.keys())) write(key);
}

// Filet de sécurité: l'app peut être tuée en arrière-plan avant l'échéance du timer.
AppState.addEventListener("change", (state) => {
  if (state !== "active") flushWrites();
});
