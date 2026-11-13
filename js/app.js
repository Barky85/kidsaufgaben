// Einstieg: Login, Rahmen (Header, Navigation) und Ansichten
import * as cfg from "../config.js";
import { h, today, iso, startOfMonth, monthKey, MONTHS, fmtNum, fmtEuro } from "./util.js";
import { createStore } from "./store.js";
import { getSession, setSession, clearSession } from "./auth.js";
import { ppe, balance, monthNet } from "./logic.js";
import { makeActions } from "./actions.js";
import { toast } from "./ui.js";
import { renderLogin } from "./views/login.js";
import { renderCalendar } from "./views/calendar.js";
import { renderDeductions, renderHistory } from "./views/lists.js";
import { renderStats } from "./views/stats.js";
import { renderAdmin } from "./views/admin.js";

const appEl = document.getElementById("app");

const ctx = {
  cfg,
  store: null,
  data: { tasks: [], tx: [], settings: { points_per_euro: 10 } },
  state: {
    role: null,
    view: "calendar",
    calMode: "week",
    calAnchor: today(),
    openDay: undefined,      // undefined = beim nächsten Rendern automatisch wählen
    statsMode: "week",
    statsAnchor: today(),
    histMonth: monthKey(today()),
    histKind: "all",
    justDone: null,
  },
  actions: null,
  lastLoad: 0,
  render,
  reload,
  go,
};

const VIEWS = {
  calendar: { label: "Kalender", icon: "📅", render: renderCalendar },
  deductions: { label: "Abzüge", icon: "➖", render: renderDeductions },
  stats: { label: "Auswertung", icon: "📊", render: renderStats },
  history: { label: "Verlauf", icon: "🧾", render: renderHistory },
  admin: { label: "Verwaltung", icon: "⚙️", render: renderAdmin, parentOnly: true },
};

function go(view) {
  ctx.state.view = view;
  render();
  window.scrollTo(0, 0);
}

async function reload() {
  const fresh = await ctx.store.load();
  Object.assign(ctx.data, { tasks: fresh.tasks, tx: fresh.tx, settings: { points_per_euro: 10, ...fresh.settings } });
  ctx.lastLoad = Date.now();
  if (ctx.state.role) render();
}

// ---------------------------------------------------------------- Rahmen
function balanceCard(icon, label, value, sub, negative) {
  return h("div", { class: "bal" },
    h("span", { class: "bal-icon", "aria-hidden": "true" }, icon),
    h("div", {}, h("span", { class: "bal-label" }, label), h("strong", { class: `bal-value${negative ? " neg-text" : ""}` }, value), h("small", { class: "bal-sub" }, sub)));
}

function shell() {
  const { state, data } = ctx;
  const P = ppe(data);
  const bal = balance(data.tx);
  const mNet = monthNet(data.tx, monthKey(today()));
  const name = state.role === "eltern" ? "Eltern" : "Bob";
  const view = VIEWS[state.view] && !(VIEWS[state.view].parentOnly && state.role !== "eltern") ? state.view : "calendar";
  state.view = view;

  const header = h("header", { class: "topbar" },
    h("div", { class: "topbar-row" },
      h("div", { class: "brand" }, h("span", { "aria-hidden": "true" }, "🌱"), " Taschengeld"),
      h("div", { class: "user" },
        h("span", { class: "user-name" }, `Hallo ${name}!`),
        h("button", { type: "button", class: "btn ghost small", onclick: logout }, "Abmelden"))),
    h("div", { class: "balances" },
      balanceCard("💰", "Kontostand", fmtEuro(bal, P), `${fmtNum(bal)} Punkte`, bal < 0),
      balanceCard("📅", "Laufender Monat", fmtEuro(mNet, P, true), `${MONTHS[today().getMonth()]} · ${fmtNum(mNet, true)} Punkte`, mNet < 0)),
    ctx.store.mode === "demo" ? h("div", { class: "demo-banner" }, "Demo-Modus · Daten nur in diesem Browser") : null);

  const nav = h("nav", { class: "tabs", "aria-label": "Hauptmenü" },
    Object.entries(VIEWS).filter(([, v]) => !v.parentOnly || state.role === "eltern").map(([id, v]) =>
      h("button", { type: "button", class: `tab${id === view ? " on" : ""}`, "aria-current": id === view ? "page" : null, onclick: () => go(id) },
        h("span", { class: "tab-icon", "aria-hidden": "true" }, v.icon), h("span", { class: "tab-label" }, v.label))));

  return h("div", { class: "shell" }, header, nav, h("main", { class: "content" }, VIEWS[view].render(ctx)));
}

function render() {
  if (!ctx.state.role) return;
  const focusKey = document.activeElement?.dataset?.key;
  const y = window.scrollY;
  appEl.replaceChildren(shell());
  window.scrollTo(0, y);
  ctx.state.justDone = null;
  if (focusKey) appEl.querySelector(`[data-key="${CSS.escape(focusKey)}"]`)?.focus({ preventScroll: true });
}

// ---------------------------------------------------------------- Sitzung
function showLogin() {
  ctx.state.role = null;
  appEl.replaceChildren(renderLogin({
    hashes: cfg.PASSWORD_HASHES,
    demo: ctx.store.mode === "demo",
    onSuccess: (role) => { setSession(role); start(role); },
  }));
}

function logout() {
  clearSession();
  ctx.state.view = "calendar";
  showLogin();
}

function showMessage(text, detail, retry) {
  appEl.replaceChildren(h("main", { class: "login" }, h("div", { class: "login-card" },
    h("div", { class: "login-logo", "aria-hidden": "true" }, text.startsWith("Lade") ? "⏳" : "⚠️"),
    h("h1", {}, text),
    detail ? h("p", { class: "login-sub" }, detail) : null,
    retry ? h("button", { type: "button", class: "btn primary big", onclick: retry }, "Nochmal versuchen") : null,
    retry ? h("button", { type: "button", class: "btn ghost", onclick: logout }, "Abmelden") : null)));
}

async function start(role) {
  ctx.state.role = role;
  ctx.state.openDay = undefined;
  ctx.state.calAnchor = today();
  showMessage("Lade Daten …");
  try {
    await reload();
    render();
  } catch (e) {
    console.error(e);
    showMessage("Daten konnten nicht geladen werden",
      `${e.message}. Prüfe config.js und ob supabase/schema.sql ausgeführt wurde.`, () => start(role));
  }
}

async function boot() {
  try {
    ctx.store = await createStore(cfg);
  } catch (e) {
    console.error(e);
    appEl.replaceChildren(h("main", { class: "login" }, h("div", { class: "login-card" },
      h("h1", {}, "Start fehlgeschlagen"), h("p", { class: "login-sub" }, `Supabase konnte nicht geladen werden (${e.message}).`))));
    return;
  }
  ctx.actions = makeActions(ctx);
  const role = getSession();
  if (role) start(role); else showLogin();

  // Beim Zurückkehren in die App Daten auffrischen (z. B. wenn ein anderes Gerät etwas geändert hat)
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState !== "visible" || !ctx.state.role || document.querySelector("dialog[open]")) return;
    if (Date.now() - ctx.lastLoad > 20000) reload().catch(() => {});
  });
}

boot();
