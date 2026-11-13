// Auswertung: Kennzahlen + Diagramme (Woche / Monat)
import {
  h, iso, today, addDays, addMonths, startOfWeek, startOfMonth, endOfMonth, isoWeek,
  WEEKDAYS, MONTHS, fmtNum, fmtEuro, parseISO,
} from "../util.js";
import { ppe, sumPoints, rangeDays, balance } from "../logic.js";
import { mountChart, barsChart, linesChart } from "../charts.js";

export function renderStats(ctx) {
  const { state, data } = ctx;
  const P = ppe(data);
  const week = state.statsMode === "week";
  const from = week ? startOfWeek(state.statsAnchor) : startOfMonth(state.statsAnchor);
  const to = week ? addDays(from, 6) : endOfMonth(state.statsAnchor);
  const days = rangeDays(from, to);
  const todayKey = iso(today());
  const elapsed = days.filter((d) => d <= todayKey);

  const title = week
    ? `KW ${isoWeek(from)} · ${from.getDate()}.${from.getMonth() + 1}. – ${to.getDate()}.${to.getMonth() + 1}.${to.getFullYear()}`
    : `${MONTHS[from.getMonth()]} ${from.getFullYear()}`;
  const nextStart = week ? addDays(from, 7) : addMonths(from, 1);
  const canNext = iso(nextStart) <= todayKey;

  const shift = (dir) => { state.statsAnchor = week ? addDays(state.statsAnchor, 7 * dir) : addMonths(state.statsAnchor, dir); ctx.render(); };
  const setMode = (m) => { state.statsMode = m; state.statsAnchor = today(); ctx.render(); };

  const toolbar = h("div", { class: "toolbar" },
    h("div", { class: "seg", role: "group", "aria-label": "Zeitraum" },
      h("button", { type: "button", class: week ? "on" : "", "aria-pressed": week, onclick: () => setMode("week") }, "Woche"),
      h("button", { type: "button", class: !week ? "on" : "", "aria-pressed": !week, onclick: () => setMode("month") }, "Monat")),
    h("div", { class: "pager" },
      h("button", { type: "button", class: "icon-btn", "aria-label": "Zurück", onclick: () => shift(-1) }, "‹"),
      h("strong", { class: "pager-title" }, title),
      h("button", { type: "button", class: "icon-btn", "aria-label": "Weiter", disabled: !canNext, onclick: () => shift(1) }, "›")),
    h("button", { type: "button", class: "btn ghost small", onclick: () => { state.statsAnchor = today(); ctx.render(); } }, "Heute"));

  const inRange = data.tx.filter((t) => t.day >= days[0] && t.day <= days[days.length - 1]);
  const credits = inRange.filter((t) => t.kind === "credit");
  const deds = inRange.filter((t) => t.kind === "deduction");

  // --- Kennzahlen
  const dailyCount = data.tasks.filter((t) => t.type === "daily").length;
  const dailyDone = credits.filter((t) => t.task_type === "daily").length;
  const possible = elapsed.length * dailyCount;
  const quote = possible > 0 ? Math.round((dailyDone / possible) * 100) : null;
  const earned = sumPoints(credits);
  const dedSum = sumPoints(deds);
  const net = earned + dedSum;

  const kpis = h("div", { class: "kpis" },
    kpi("🎯", "Erledigungsquote", quote === null ? "–" : `${quote} %`, possible ? `${dailyDone} von ${possible} täglichen Aufgaben` : "Noch keine Tage im Zeitraum"),
    kpi("⭐", "Erarbeitet", `${fmtNum(earned)} P`, fmtEuro(earned, P)),
    kpi("➖", "Abzüge", `${fmtNum(dedSum)} P`, fmtEuro(dedSum, P), dedSum < 0 ? "neg" : ""),
    kpi("📈", "Im Zeitraum", fmtEuro(net, P, true), `${fmtNum(net, true)} Punkte`),
    kpi("💰", "Kontostand", fmtEuro(balance(data.tx), P), `${fmtNum(balance(data.tx))} Punkte`, "", true));

  // --- Diagramm 1: erledigte Aufgaben pro Tag
  const labelOf = (key) => (week ? WEEKDAYS[(parseISO(key).getDay() + 6) % 7] : String(parseISO(key).getDate()));
  const perDay = (fn) => days.map((d) => fn(credits.filter((t) => t.day === d)));
  const chart1 = card("✅ Erledigte Aufgaben pro Tag", chartBox((w) => barsChart({
    width: w, labels: days.map(labelOf), ariaLabel: "Erledigte Aufgaben pro Tag",
    series: [
      { name: "täglich", color: "var(--c-daily)", values: perDay((a) => a.filter((t) => t.task_type === "daily").length) },
      { name: "zusätzlich", color: "var(--c-extra)", values: perDay((a) => a.filter((t) => t.task_type !== "daily").length) },
    ],
  })), legend([["täglich", "var(--c-daily)"], ["zusätzlich", "var(--c-extra)"]]));

  // --- Diagramm 2: Punkte und Euro im Zeitverlauf (kumuliert im Zeitraum)
  let cumE = 0, cumN = 0;
  const eVals = [], nVals = [];
  for (const d of elapsed) {
    cumE += sumPoints(credits.filter((t) => t.day === d));
    cumN += sumPoints(inRange.filter((t) => t.day === d && t.kind !== "payout"));
    eVals.push(cumE); nVals.push(cumN);
  }
  const chart2 = card("📈 Punkte und Euro im Zeitverlauf",
    elapsed.length ? chartBox((w) => linesChart({
      width: w, ppe: P, labels: elapsed.map(labelOf), ariaLabel: "Punkte und Euro im Zeitverlauf",
      lines: [
        { name: "Erarbeitet", color: "var(--c-daily)", values: eVals },
        { name: "Nach Abzügen", color: "var(--c-line2)", values: nVals, dashed: true },
      ],
    })) : h("p", { class: "empty" }, "Für diesen Zeitraum gibt es noch keine Daten."),
    legend([["Erarbeitet (links: Punkte, rechts: Euro)", "var(--c-daily)"], ["Nach Abzügen", "var(--c-line2)"]]));

  // --- Diagramm 3: Verteilung nach Aufgabe
  const byTask = new Map();
  for (const t of credits) {
    const k = t.task_id || `name:${t.task_name}`;
    const e = byTask.get(k) || { name: t.task_name || "Buchung", icon: data.tasks.find((x) => x.id === t.task_id)?.icon || "✅", count: 0, pts: 0 };
    e.count++; e.pts += t.points;
    byTask.set(k, e);
  }
  const rows = [...byTask.values()].sort((a, b) => b.count - a.count || b.pts - a.pts);
  const maxCount = Math.max(1, ...rows.map((r) => r.count));
  const chart3 = card("🥧 Verteilung nach Aufgabe", rows.length
    ? h("ul", { class: "dist" }, rows.map((r) => h("li", {},
      h("span", { class: "dist-label" }, h("span", { "aria-hidden": "true" }, r.icon), " ", r.name),
      h("span", { class: "dist-bar", role: "img", "aria-label": `${r.count} mal` }, h("i", { style: { width: `${(r.count / maxCount) * 100}%` } })),
      h("span", { class: "dist-val" }, `${r.count}× · ${fmtNum(r.pts)} P`))))
    : h("p", { class: "empty" }, "Noch keine erledigten Aufgaben in diesem Zeitraum."));

  return h("section", { class: "view stats" }, toolbar, kpis, h("div", { class: "charts" }, chart1, chart2, chart3));
}

function kpi(icon, label, value, sub, tone = "", accent = false) {
  return h("div", { class: `kpi${accent ? " accent" : ""} ${tone}` },
    h("span", { class: "kpi-icon", "aria-hidden": "true" }, icon),
    h("span", { class: "kpi-label" }, label),
    h("strong", { class: "kpi-value" }, value),
    h("small", { class: "kpi-sub" }, sub));
}
function card(title, ...children) { return h("article", { class: "card chart-card" }, h("h3", {}, title), ...children); }
function chartBox(draw) { const box = h("div", { class: "chart-box" }); mountChart(box, draw); return box; }
function legend(items) {
  return h("ul", { class: "legend" }, items.map(([name, color]) => h("li", {}, h("i", { style: { background: color } }), name)));
}
