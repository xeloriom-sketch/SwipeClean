// utils/devLogger.ts — in-memory log store, no persistence (ephemeral per session)
export type LogLevel = "info" | "warn" | "error";
export type LogEntry = { ts: number; tag: string; msg: string; level: LogLevel };

const MAX = 400;
const _logs: LogEntry[] = [];
const _subs = new Set<() => void>();

export function devLog(tag: string, msg: string, level: LogLevel = "info") {
  if (_logs.length >= MAX) _logs.shift();
  _logs.push({ ts: Date.now(), tag, msg, level });
  _subs.forEach((fn) => fn());
}

export function getLogs(): readonly LogEntry[] {
  return _logs;
}

export function clearLogs() {
  _logs.length = 0;
  _subs.forEach((fn) => fn());
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
