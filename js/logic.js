// Reine Rechenlogik (keine DOM-Zugriffe)
import { iso, today, startOfWeek, addDays, monthKey } from "./util.js";

export const DEFAULT_PPE = 10;

export function ppe(data) {
  const v = Number(data.settings?.points_per_euro);
  return v > 0 ? v : DEFAULT_PPE;
}

export const sumPoints = (arr) => arr.reduce((s, t) => s + (Number(t.points) || 0), 0);

/** Kontostand = Summe aller Buchungen (inkl. Auszahlungen) */
export const balance = (tx) => sumPoints(tx);

/** Netto-Punkte eines Monats (ohne Auszahlungen), key = "YYYY-MM" */
export const monthNet = (tx, key) => sumPoints(tx.filter((t) => t.kind !== "payout" && t.day.startsWith(key)));

export const isTaskTx = (t) => t.kind === "credit" || t.kind === "deduction";

/** Map "taskId|day" → Buchung (Gutschrift oder Abzug) */
export function indexByTaskDay(tx) {
  const m = new Map();
  for (const t of tx) if (t.task_id && isTaskTx(t)) m.set(`${t.task_id}|${t.day}`, t);
  return m;
}

export function groupByDay(tx) {
  const m = new Map();
  for (const t of tx) {
    if (!m.has(t.day)) m.set(t.day, []);
    m.get(t.day).push(t);
  }
  return m;
}

export function sortTx(tx) {
  return [...tx].sort((a, b) => a.day.localeCompare(b.day) || (a.created_at || "").localeCompare(b.created_at || ""));
}

/** Buchungen chronologisch mit laufendem Kontostand */
export function withRunning(tx) {
  let run = 0;
  return sortTx(tx).map((t) => ({ ...t, running: (run += Number(t.points) || 0) }));
}

/** Warum darf dieser Tag nicht bearbeitet werden? (null = darf bearbeitet werden) */
export function lockReason(role, date) {
  const t0 = today();
  if (date > t0) return "Zukünftige Tage sind gesperrt 🔒";
  if (role === "eltern") return null;
  if (date < startOfWeek(t0)) return "Du kannst nur Tage der aktuellen Woche ändern. Frag die Eltern 🙂";
  return null;
}

/** Tage eines Zeitraums als ISO-Strings */
export function rangeDays(from, to) {
  const out = [];
  for (let d = from; d <= to; d = addDays(d, 1)) out.push(iso(d));
  return out;
}

export { monthKey };
