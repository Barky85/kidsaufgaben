// Kleine Hilfsfunktionen: DOM, Datum, Formatierung

/** DOM-Element bauen. Kinder: Strings, Nodes, Arrays (null/false werden ignoriert). */
export function h(tag, attrs = {}, ...children) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v === null || v === undefined || v === false) continue;
    if (k === "class") el.className = v;
    else if (k === "dataset") Object.assign(el.dataset, v);
    else if (k === "style") {
      if (typeof v === "string") el.style.cssText = v;
      else for (const [sk, sv] of Object.entries(v)) {
        if (sk.startsWith("--")) el.style.setProperty(sk, sv);
        else el.style[sk] = sv;
      }
    } else if (k.startsWith("on") && typeof v === "function") {
      el.addEventListener(k.slice(2), v);
    } else if (["value", "checked", "disabled", "selected"].includes(k)) {
      el[k] = v;
    } else el.setAttribute(k, v === true ? "" : v);
  }
  append(el, children);
  return el;
}

function append(el, children) {
  for (const c of children) {
    if (c === null || c === undefined || c === false) continue;
    if (Array.isArray(c)) append(el, c);
    else if (c instanceof Node) el.appendChild(c);
    else el.appendChild(document.createTextNode(String(c)));
  }
}

// ---------- Datum ----------
const pad = (n) => String(n).padStart(2, "0");
export const WEEKDAYS = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];
export const MONTHS = ["Januar", "Februar", "März", "April", "Mai", "Juni", "Juli", "August", "September", "Oktober", "November", "Dezember"];

export const iso = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const parseISO = (s) => { const [y, m, d] = s.split("-").map(Number); return new Date(y, m - 1, d); };
export const today = () => { const n = new Date(); return new Date(n.getFullYear(), n.getMonth(), n.getDate()); };
export const addDays = (d, n) => { const x = new Date(d.getFullYear(), d.getMonth(), d.getDate()); x.setDate(x.getDate() + n); return x; };
export const startOfWeek = (d) => addDays(d, -((d.getDay() + 6) % 7)); // Montag
export const startOfMonth = (d) => new Date(d.getFullYear(), d.getMonth(), 1);
export const endOfMonth = (d) => new Date(d.getFullYear(), d.getMonth() + 1, 0);
export const addMonths = (d, n) => new Date(d.getFullYear(), d.getMonth() + n, 1);
export const monthKey = (d) => iso(d).slice(0, 7);
export const weekdayIndex = (d) => (d.getDay() + 6) % 7;
export const daysBetween = (a, b) => Math.round((Date.UTC(b.getFullYear(), b.getMonth(), b.getDate()) - Date.UTC(a.getFullYear(), a.getMonth(), a.getDate())) / 86400000);

export function isoWeek(date) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil(((d - yearStart) / 86400000 + 1) / 7);
}

export function fmtDateLong(d) {
  return `${WEEKDAYS[weekdayIndex(d)]}, ${d.getDate()}. ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}
export function fmtDateShort(d) {
  return `${WEEKDAYS[weekdayIndex(d)]} ${pad(d.getDate())}.${pad(d.getMonth() + 1)}.`;
}

// ---------- Zahlen / Geld ----------
const eurFmt = new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" });
const numFmt = new Intl.NumberFormat("de-DE", { maximumFractionDigits: 2 });

/** Punkte → "+5" / "−3" / "0" (mit echtem Minuszeichen) */
export function fmtNum(n, signed = false) {
  const v = Number(n) || 0;
  const body = numFmt.format(Math.abs(v));
  if (v < 0) return "−" + body;
  return (signed && v > 0 ? "+" : "") + body;
}
export const fmtPts = (n, signed = false) => `${fmtNum(n, signed)} P`;
export function fmtEuro(points, ppe, signed = false) {
  const e = points / ppe;
  const body = eurFmt.format(Math.abs(e));
  if (e < 0 && Math.abs(e) >= 0.005) return "−" + body;
  return (signed && e >= 0.005 ? "+" : "") + body;
}
export const round2 = (n) => Math.round(n * 100) / 100;

export function uuid() {
  if (globalThis.crypto?.randomUUID) return crypto.randomUUID();
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === "x" ? r : (r & 3) | 8).toString(16);
  });
}
