// Abzüge-Übersicht und Verlauf aller Buchungen
import {
  h, iso, today, parseISO, addMonths, startOfMonth, monthKey, MONTHS, fmtDateShort, fmtNum, fmtEuro,
} from "../util.js";
import { ppe, sumPoints, withRunning } from "../logic.js";

const sortDesc = (a, b) => b.day.localeCompare(a.day) || (b.created_at || "").localeCompare(a.created_at || "");
const iconOf = (ctx, t) => ctx.data.tasks.find((x) => x.id === t.task_id)?.icon;

// ---------------------------------------------------------------- Abzüge
export function renderDeductions(ctx) {
  const { data, state } = ctx;
  const P = ppe(data);
  const deds = data.tx.filter((t) => t.kind === "deduction").sort(sortDesc);
  const thisMonth = monthKey(today());
  const monthSum = sumPoints(deds.filter((t) => t.day.startsWith(thisMonth)));
  const allSum = sumPoints(deds);
  const parent = state.role === "eltern";

  const summary = h("div", { class: "kpis two" },
    h("div", { class: "kpi" }, h("span", { class: "kpi-label" }, `Abzüge ${MONTHS[today().getMonth()]}`), h("strong", { class: "kpi-value neg-text" }, `${fmtNum(monthSum)} P`), h("small", { class: "kpi-sub" }, fmtEuro(monthSum, P))),
    h("div", { class: "kpi" }, h("span", { class: "kpi-label" }, "Abzüge gesamt"), h("strong", { class: "kpi-value neg-text" }, `${fmtNum(allSum)} P`), h("small", { class: "kpi-sub" }, fmtEuro(allSum, P))));

  const head = h("div", { class: "toolbar" },
    h("h2", { class: "view-title" }, "Abzüge"),
    parent ? h("button", { type: "button", class: "btn danger small", onclick: () => ctx.actions.deductDialog() }, "− Abzug verbuchen") : null);

  if (!deds.length) {
    return h("section", { class: "view" }, head, summary, h("p", { class: "empty big" }, "🎉 Keine Abzüge – super gemacht!"));
  }

  const groups = new Map();
  for (const t of deds) {
    const k = t.day.slice(0, 7);
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k).push(t);
  }
  const blocks = [...groups.entries()].map(([k, list]) => {
    const [y, m] = k.split("-").map(Number);
    return h("div", { class: "group" },
      h("h3", { class: "group-title" }, `${MONTHS[m - 1]} ${y}`, h("small", {}, ` ${fmtNum(sumPoints(list))} P`)),
      h("ul", { class: "rows" }, list.map((t) => h("li", { class: "row" },
        h("span", { class: "row-date" }, fmtDateShort(parseISO(t.day))),
        h("span", { class: "row-main" },
          h("strong", {}, `${iconOf(ctx, t) || "➖"} ${t.task_name || "Abzug"}`),
          t.comment ? h("small", {}, t.comment) : null),
        h("span", { class: "row-pts neg-text" }, `${fmtNum(t.points)} P`),
        parent ? h("span", { class: "row-actions" },
          h("button", { type: "button", class: "btn ghost small", onclick: () => ctx.actions.removeTx(t) }, "Zurücknehmen")) : null))));
  });
  return h("section", { class: "view" }, head, summary, blocks);
}

// ---------------------------------------------------------------- Verlauf
const KINDS = [["all", "Alle"], ["credit", "Gutschriften"], ["deduction", "Abzüge"], ["payout", "Auszahlungen"]];

export function renderHistory(ctx) {
  const { data, state } = ctx;
  const P = ppe(data);
  const parent = state.role === "eltern";
  const full = withRunning(data.tx);
  const [y, m] = state.histMonth.split("-").map(Number);
  const first = new Date(y, m - 1, 1);

  let rows = full.filter((t) => t.day.startsWith(state.histMonth));
  if (state.histKind !== "all") rows = rows.filter((t) => t.kind === state.histKind);
  rows = rows.reverse();

  const shift = (dir) => { state.histMonth = monthKey(addMonths(first, dir)); ctx.render(); };
  const canNext = monthKey(addMonths(first, 1)) <= monthKey(today());

  const toolbar = h("div", { class: "toolbar" },
    h("h2", { class: "view-title" }, "Verlauf"),
    h("div", { class: "pager" },
      h("button", { type: "button", class: "icon-btn", "aria-label": "Vorheriger Monat", onclick: () => shift(-1) }, "‹"),
      h("strong", { class: "pager-title" }, `${MONTHS[m - 1]} ${y}`),
      h("button", { type: "button", class: "icon-btn", "aria-label": "Nächster Monat", disabled: !canNext, onclick: () => shift(1) }, "›")));

  const filters = h("div", { class: "filters", role: "group", "aria-label": "Filter" },
    KINDS.map(([k, label]) => h("button", {
      type: "button", class: `pill${state.histKind === k ? " on" : ""}`, "aria-pressed": state.histKind === k,
      onclick: () => { state.histKind = k; ctx.render(); },
    }, label)));

  const monthTx = data.tx.filter((t) => t.day.startsWith(state.histMonth) && t.kind !== "payout");
  const monthSummary = h("p", { class: "month-sum" }, `Monatssumme: `, h("strong", { class: sumPoints(monthTx) < 0 ? "neg-text" : "pos-text" }, `${fmtNum(sumPoints(monthTx), true)} P · ${fmtEuro(sumPoints(monthTx), P, true)}`));

  const list = rows.length ? h("ul", { class: "rows" }, rows.map((t) => {
    const icon = t.kind === "payout" ? "💶" : iconOf(ctx, t) || (t.kind === "deduction" ? "➖" : "✅");
    const label = t.kind === "payout" ? "Auszahlung" : t.kind === "deduction" ? `Abzug: ${t.task_name || "Sonstiges"}` : t.task_name || "Gutschrift";
    return h("li", { class: `row ${t.kind}` },
      h("span", { class: "row-date" }, fmtDateShort(parseISO(t.day))),
      h("span", { class: "row-main" },
        h("strong", {}, `${icon} ${label}`),
        t.comment ? h("small", {}, t.comment) : null,
        h("small", { class: "balance-after" }, `Stand danach: ${fmtNum(t.running)} P · ${fmtEuro(t.running, P)}`)),
      h("span", { class: `row-pts ${t.points < 0 ? "neg-text" : "pos-text"}` },
        `${fmtNum(t.points, true)} P`,
        h("small", {}, t.kind === "payout" && t.euro != null ? fmtEuro(t.euro * P, P) : fmtEuro(t.points, P, true))),
      parent ? h("span", { class: "row-actions" },
        h("button", { type: "button", class: "icon-btn", title: "Bearbeiten", "aria-label": "Eintrag bearbeiten", onclick: () => ctx.actions.editTxDialog(t) }, "✏️"),
        h("button", { type: "button", class: "icon-btn", title: "Löschen", "aria-label": "Eintrag löschen", onclick: () => ctx.actions.removeTx(t) }, "🗑️")) : null);
  })) : h("p", { class: "empty" }, "Keine Buchungen in diesem Zeitraum.");

  return h("section", { class: "view" }, toolbar, filters, monthSummary, list);
}
