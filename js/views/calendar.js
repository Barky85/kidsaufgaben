// Kalender: Wochenansicht (Standard) und Monatsansicht
import {
  h, iso, today, addDays, addMonths, startOfWeek, startOfMonth, endOfMonth, isoWeek,
  WEEKDAYS, MONTHS, weekdayIndex, fmtNum, daysBetween,
} from "../util.js";
import { indexByTaskDay, groupByDay, lockReason, sumPoints } from "../logic.js";
import { toast } from "../ui.js";

const shortMonth = (d) => MONTHS[d.getMonth()].slice(0, 3);

export function renderCalendar(ctx) {
  const { state } = ctx;
  const week = state.calMode === "week";
  const start = startOfWeek(state.calAnchor);
  const end = addDays(start, 6);

  const title = week
    ? `KW ${isoWeek(start)} · ${start.getDate()}. ${start.getMonth() === end.getMonth() ? "" : shortMonth(start) + " "}– ${end.getDate()}. ${shortMonth(end)} ${end.getFullYear()}`
    : `${MONTHS[state.calAnchor.getMonth()]} ${state.calAnchor.getFullYear()}`;

  const shift = (dir) => {
    state.calAnchor = week ? addDays(state.calAnchor, 7 * dir) : addMonths(state.calAnchor, dir);
    state.openDay = undefined;
    ctx.render();
  };
  const goToday = () => {
    state.calAnchor = today();
    state.openDay = iso(today());
    ctx.render();
  };
  const setMode = (mode) => { state.calMode = mode; ctx.render(); };

  const toolbar = h("div", { class: "toolbar" },
    h("div", { class: "seg", role: "group", "aria-label": "Ansicht" },
      h("button", { type: "button", class: week ? "on" : "", "aria-pressed": week, onclick: () => setMode("week") }, "Woche"),
      h("button", { type: "button", class: !week ? "on" : "", "aria-pressed": !week, onclick: () => setMode("month") }, "Monat")),
    h("div", { class: "pager" },
      h("button", { type: "button", class: "icon-btn", "aria-label": week ? "Vorherige Woche" : "Vorheriger Monat", onclick: () => shift(-1) }, "‹"),
      h("strong", { class: "pager-title" }, title),
      h("button", { type: "button", class: "icon-btn", "aria-label": week ? "Nächste Woche" : "Nächster Monat", onclick: () => shift(1) }, "›")),
    h("button", { type: "button", class: "btn ghost small", onclick: goToday }, "Heute"));

  return h("section", { class: "view calendar" }, toolbar, week ? weekView(ctx, start) : monthView(ctx));
}

// ---------------------------------------------------------------- Woche
function weekView(ctx, start) {
  const idx = indexByTaskDay(ctx.data.tx);
  const dmap = groupByDay(ctx.data.tx);
  const days = Array.from({ length: 7 }, (_, i) => addDays(start, i));
  if (ctx.data.tasks.length === 0) {
    return h("p", { class: "empty" }, "Noch keine Aufgaben angelegt. Die Eltern können sie im Bereich „Verwaltung“ hinzufügen.");
  }
  // Nach Wochenwechsel (openDay === undefined): heute bzw. Montag aufklappen (nur Handy relevant)
  if (ctx.state.openDay === undefined) {
    const t = iso(today());
    ctx.state.openDay = days.some((d) => iso(d) === t) ? t : iso(days[0]);
  }
  return h("div", { class: "week-grid" }, days.map((d) => dayCard(ctx, d, idx, dmap)));
}

function dayCard(ctx, d, idx, dmap) {
  const { state, data } = ctx;
  const key = iso(d);
  const t0 = today();
  const isToday = key === iso(t0);
  const isFuture = d > t0;
  const reason = lockReason(state.role, d);
  const dayTx = dmap.get(key) || [];
  const credits = dayTx.filter((t) => t.kind === "credit");
  const deds = dayTx.filter((t) => t.kind === "deduction");
  const earned = sumPoints(credits);
  const ded = sumPoints(deds);
  const dailies = data.tasks.filter((t) => t.type === "daily");
  const extras = data.tasks.filter((t) => t.type === "extra");
  const dailyDone = dailies.filter((t) => idx.get(`${t.id}|${key}`)?.kind === "credit").length;
  const open = state.openDay === key;
  const iconOf = (tx) => data.tasks.find((t) => t.id === tx.task_id)?.icon ?? "✅";
  const orphans = dayTx.filter((t) => !t.task_id && (t.kind === "credit" || t.kind === "deduction"));

  const head = h("button", {
    type: "button", class: "day-head", "aria-expanded": open,
    onclick: () => { state.openDay = open ? "" : key; ctx.render(); },
  },
    h("span", { class: "day-wd" }, WEEKDAYS[weekdayIndex(d)]),
    h("span", { class: "day-num" }, String(d.getDate())),
    h("span", { class: "day-summary", "aria-hidden": "true" }, credits.slice(0, 8).map((tx) => h("span", {}, iconOf(tx))), credits.length > 8 ? h("small", {}, `+${credits.length - 8}`) : null),
    h("span", { class: "day-score" },
      earned > 0 ? h("span", { class: "pos" }, `+${fmtNum(earned)} P`) : null,
      ded < 0 ? h("span", { class: "neg" }, `${fmtNum(ded)} P`) : null,
      !earned && !ded ? h("span", { class: "muted" }, isFuture ? "🔒" : "–") : null),
    dailies.length ? h("span", { class: "day-progress", title: `Tägliche Aufgaben: ${dailyDone} von ${dailies.length}` }, h("i", { style: { width: `${(dailyDone / dailies.length) * 100}%` } })) : null,
    h("span", { class: "day-caret", "aria-hidden": "true" }, "▾"));

  const section = (label, tasks, doneCount) => tasks.length ? h("div", { class: "chips-block" },
    h("h4", {}, label, doneCount !== undefined ? h("small", {}, ` ${doneCount}/${tasks.length}`) : null),
    h("div", { class: "chips" }, tasks.map((t) => chip(ctx, t, key, idx.get(`${t.id}|${key}`), reason, isFuture)))) : null;

  const extraDone = extras.filter((t) => idx.get(`${t.id}|${key}`)?.kind === "credit").length;
  return h("article", {
    class: `day${isToday ? " today" : ""}${isFuture ? " future" : ""}${reason && !isFuture ? " readonly" : ""}${open ? " open" : ""}`,
    "aria-label": `${WEEKDAYS[weekdayIndex(d)]} ${d.getDate()}.`,
  }, head,
    h("div", { class: "day-body" },
      section("Täglich", dailies, dailyDone),
      section("Zusätzlich", extras, extraDone),
      orphans.length ? h("div", { class: "chips-block" }, h("h4", {}, "Weitere Buchungen"),
        h("div", { class: "chips" }, orphans.map((tx) => h("span", { class: `chip static ${tx.kind === "credit" ? "done" : "deducted"}` },
          h("span", { class: "chip-icon" }, tx.kind === "credit" ? "✅" : "➖"),
          h("span", { class: "chip-name" }, tx.task_name || "Buchung"),
          h("span", { class: "chip-pts" }, fmtNum(tx.points, true)))))) : null));
}

function chip(ctx, task, day, tx, reason, isFuture) {
  const { state } = ctx;
  const st = tx?.kind === "credit" ? "done" : tx?.kind === "deduction" ? "deducted" : "open";
  const key = `${task.id}|${day}`;
  const pts = st === "deducted" ? fmtNum(tx.points) : fmtNum(task.points, true);
  const btn = h("button", {
    type: "button",
    class: `chip ${st}${reason ? " locked" : ""}`,
    dataset: { key },
    "aria-pressed": st === "done" ? "true" : "false",
    "aria-disabled": reason ? "true" : null,
    title: st === "deducted" ? `Abzug${tx.comment ? ": " + tx.comment : ""}` : null,
    onclick: () => (reason ? toast(reason) : ctx.actions.toggleTask(task, day)),
  },
    h("span", { class: "chip-icon", "aria-hidden": "true" }, task.icon),
    h("span", { class: "chip-name" }, task.name),
    h("span", { class: "chip-pts" }, pts),
    h("span", { class: "chip-check", "aria-hidden": "true" }, st === "done" ? "✓" : st === "deducted" ? "✕" : ""));

  const wrap = h("div", { class: "chip-wrap" }, btn);
  if (state.justDone === key) {
    btn.classList.add("pop");
    wrap.append(h("span", { class: "burst", "aria-hidden": "true" },
      Array.from({ length: 8 }, (_, i) => h("i", { style: { "--a": `${i * 45}deg` } })),
      h("b", {}, `+${task.points}`)));
  }
  if (state.role === "eltern" && task.type === "daily" && st === "open" && !isFuture) {
    wrap.append(h("button", {
      type: "button", class: "chip-minus", title: "Als Abzug verbuchen", "aria-label": `Abzug für „${task.name}“ verbuchen`,
      onclick: () => ctx.actions.deductDialog({ task, day }),
    }, "−"));
  }
  return wrap;
}

// ---------------------------------------------------------------- Monat
function monthView(ctx) {
  const { state, data } = ctx;
  const first = startOfMonth(state.calAnchor);
  const last = endOfMonth(state.calAnchor);
  const gridStart = startOfWeek(first);
  const weeks = Math.ceil((daysBetween(gridStart, last) + 1) / 7);
  const dmap = groupByDay(data.tx);
  const t0 = today();

  const cells = [];
  for (let i = 0; i < weeks * 7; i++) {
    const d = addDays(gridStart, i);
    const key = iso(d);
    const inMonth = d.getMonth() === first.getMonth();
    const dayTx = dmap.get(key) || [];
    const credits = dayTx.filter((t) => t.kind === "credit");
    const net = sumPoints(dayTx.filter((t) => t.kind !== "payout"));
    const hasDed = dayTx.some((t) => t.kind === "deduction");
    const iconOf = (tx) => data.tasks.find((t) => t.id === tx.task_id)?.icon ?? "✅";
    cells.push(h("button", {
      type: "button",
      class: `cell${inMonth ? "" : " out"}${key === iso(t0) ? " today" : ""}${d > t0 ? " future" : ""}`,
      "aria-label": `${d.getDate()}. ${MONTHS[d.getMonth()]}: ${credits.length} Aufgaben erledigt`,
      onclick: () => { state.calMode = "week"; state.calAnchor = d; state.openDay = key; ctx.render(); },
    },
      h("span", { class: "cell-num" }, String(d.getDate())),
      dayTx.length ? h("span", { class: `cell-pts ${net < 0 ? "neg" : "pos"}` }, fmtNum(net, true)) : null,
      h("span", { class: "cell-icons", "aria-hidden": "true" }, credits.slice(0, 6).map((tx) => h("span", {}, iconOf(tx))), credits.length > 6 ? h("small", {}, `+${credits.length - 6}`) : null),
      credits.length ? h("span", { class: "cell-count", "aria-hidden": "true" }, `✓${credits.length}`) : null,
      hasDed ? h("span", { class: "cell-dot", title: "Abzug" }) : null));
  }
  return h("div", { class: "month" },
    h("div", { class: "month-head" }, WEEKDAYS.map((w) => h("span", {}, w))),
    h("div", { class: "month-grid" }, cells));
}
