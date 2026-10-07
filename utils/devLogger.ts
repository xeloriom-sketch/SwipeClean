// utils/devLogger.ts — journal de session, persisté pour survivre à un crash
//
// Il était purement en mémoire. Or ce qui compte, c'est précisément ce qui s'est passé
// avant un plantage ou un blocage — perdu au redémarrage, et inaccessible de toute
// façon puisqu'il faut atteindre les Réglages pour le lire. Les entrées sont donc
// écrites sur disque (file debouncée, vidée au passage en arrière-plan) et la session
// précédente est rechargée au démarrage.
import { queueWrite } from "./storageQueue";

export type LogLevel = "info" | "warn" | "error";
export type LogEntry = { ts: number; tag: string; msg: string; level: LogLevel };

const MAX = 400;
/** Ce qu'on garde sur disque: assez pour comprendre, pas assez pour peser. */
const PERSIST_MAX = 150;
export const LOGS_KEY = "@app_logs";
const _logs: LogEntry[] = [];
const _subs = new Set<() => void>();

// Notification différée: un devLog émis pendant le rendu d'un composant
// déclencherait sinon un setState synchrone sur un abonné (Settings) —
// "Cannot update a component while rendering a different component".
let _notifyScheduled = false;
function _notify() {
  if (_notifyScheduled) return;
  _notifyScheduled = true;
  const flush = () => {
    _notifyScheduled = false;
    _subs.forEach((fn) => fn());
  };
  if (typeof queueMicrotask === "function") queueMicrotask(flush);
  else Promise.resolve().then(flush);
}

export function devLog(tag: string, msg: string, level: LogLevel = "info") {
  if (_logs.length >= MAX) _logs.shift();
  _logs.push({ ts: Date.now(), tag, msg, level });
  _persist();
  _notify();
}

// Debounce long: le journal ne doit pas peser sur le chemin du swipe. `queueWrite`
// fait le reste, y compris le vidage au passage en arrière-plan.
let _persistScheduled = false;
function _persist() {
  if (_persistScheduled) return;
  _persistScheduled = true;
  setTimeout(() => {
    _persistScheduled = false;
    queueWrite(LOGS_KEY, _logs.slice(-PERSIST_MAX), 2000);
  }, 1500);
}

/** Journal de la session précédente, relu au démarrage. Vide si aucun. */
let _previous: LogEntry[] = [];

export function getPreviousSessionLogs(): readonly LogEntry[] {
  return _previous;
}

export async function loadPersistedLogs(): Promise<void> {
  try {
    const AsyncStorage = require("@react-native-async-storage/async-storage").default;
    const raw = await AsyncStorage.getItem(LOGS_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) _previous = parsed.filter((e) => e && typeof e.msg === "string");
  } catch {}
}

export function getLogs(): readonly LogEntry[] {
  return _logs;
}

export function clearLogs() {
  _logs.length = 0;
  _notify();
}

export function subscribeLogs(fn: () => void): () => void {
  _subs.add(fn);
  return () => _subs.delete(fn);
}

export function logsAsText(): string {
  return _logs
    .map((e) => {
      const d = new Date(e.ts);
      const hh = d.getHours().toString().padStart(2, "0");
      const mm = d.getMinutes().toString().padStart(2, "0");
      const ss = d.getSeconds().toString().padStart(2, "0");
      const ms = d.getMilliseconds().toString().padStart(3, "0");
      const icon = e.level === "error" ? "ERR" : e.level === "warn" ? "WRN" : "INF";
      return `${hh}:${mm}:${ss}.${ms} [${icon}][${e.tag}] ${e.msg}`;
    })
    .join("\n");
}
