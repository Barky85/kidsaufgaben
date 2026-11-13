// Elternbereich: Aufgaben, Umrechnung, Abzüge, Auszahlung
import { h, fmtNum, fmtEuro } from "../util.js";
import { ppe, balance } from "../logic.js";
import { modal, field, toast } from "../ui.js";

const QUICK_ICONS = ["⭐", "🧹", "🗑️", "🛏️", "🍽️", "📚", "🪗", "🐇", "🎒", "🧺", "🚲", "🌱", "🐕", "🧼", "🪴", "🚿"];

export function renderAdmin(ctx) {
  const { data } = ctx;
  const P = ppe(data);
  const bal = balance(data.tx);

  // ---- Umrechnung
  const ppeInput = h("input", { type: "number", min: 1, step: "any", inputmode: "decimal", value: P, id: "ppe-input", required: true });
  const preview = h("small", { class: "field-hint" });
  const updatePreview = () => {
    const v = Number(String(ppeInput.value).replace(",", "."));
    preview.textContent = v > 0 ? `${fmtNum(v)} Punkte = 1,00 €  ·  1 Punkt = ${fmtEuro(1, v)}` : "Bitte eine Zahl größer 0 eintragen.";
  };
  ppeInput.addEventListener("input", updatePreview);
  updatePreview();
  const rate = h("article", { class: "card" },
    h("h3", {}, "💱 Umrechnung Punkte → Euro"),
    h("form", { class: "inline-form", onsubmit: async (e) => {
      e.preventDefault();
      const v = Number(String(ppeInput.value).replace(",", "."));
      if (!(v > 0)) { toast("Bitte eine Zahl größer 0 eintragen.", "error"); return; }
      if (await ctx.actions.setPpe(v)) toast("Umrechnung gespeichert.");
    } },
      h("label", { class: "field grow" }, h("span", { class: "field-label" }, "Punkte pro 1 Euro"), ppeInput, preview),
      h("button", { type: "submit", class: "btn primary" }, "Speichern")),
    h("p", { class: "hint" }, "Gilt für alle Anzeigen. Die gespeicherten Punkte der Buchungen ändern sich dadurch nicht, nur der Eurobetrag."));

  // ---- Aufgaben
  const taskRow = (t) => h("li", { class: "row task-row" },
    h("span", { class: "task-icon", "aria-hidden": "true" }, t.icon),
    h("span", { class: "row-main" }, h("strong", {}, t.name)),
    h("span", { class: "row-pts" }, `${fmtNum(t.points)} P`),
    h("span", { class: "row-actions" },
      h("button", { type: "button", class: "icon-btn", title: "Bearbeiten", "aria-label": `„${t.name}“ bearbeiten`, onclick: () => taskDialog(ctx, t) }, "✏️"),
      h("button", { type: "button", class: "icon-btn", title: "Löschen", "aria-label": `„${t.name}“ löschen`, onclick: () => ctx.actions.removeTask(t) }, "🗑️")));
  const group = (title, type) => {
    const list = data.tasks.filter((t) => t.type === type);
    return h("div", { class: "group" }, h("h4", { class: "group-title" }, title, h("small", {}, ` ${list.length}`)),
      list.length ? h("ul", { class: "rows" }, list.map(taskRow)) : h("p", { class: "empty" }, "Noch keine Aufgaben."));
  };
  const tasks = h("article", { class: "card" },
    h("div", { class: "card-head" }, h("h3", {}, "📝 Aufgaben"), h("button", { type: "button", class: "btn primary small", onclick: () => taskDialog(ctx, null) }, "+ Neue Aufgabe")),
    group("Täglich", "daily"), group("Zusätzlich", "extra"));

  // ---- Abzüge & Einträge
  const deductions = h("article", { class: "card" },
    h("h3", {}, "➖ Abzüge & Einträge"),
    h("p", { class: "hint" }, "Nicht erledigte tägliche Aufgaben bucht ihr im Kalender mit dem „−“-Knopf neben der Aufgabe als Abzug. Einträge von Bob setzt oder entfernt ihr dort ebenfalls, auch rückwirkend. Im Verlauf lassen sich alle Buchungen bearbeiten und löschen."),
    h("div", { class: "btn-row" },
      h("button", { type: "button", class: "btn danger", onclick: () => ctx.actions.deductDialog() }, "− Abzug verbuchen"),
      h("button", { type: "button", class: "btn ghost", onclick: () => ctx.go("calendar") }, "📅 Zum Kalender"),
      h("button", { type: "button", class: "btn ghost", onclick: () => ctx.go("history") }, "🧾 Zum Verlauf")));

  // ---- Monatsabschluss
  const payout = h("article", { class: "card" },
    h("h3", {}, "💶 Monatsabschluss"),
    h("p", {}, "Aktueller Kontostand: ", h("strong", { class: bal < 0 ? "neg-text" : "pos-text" }, `${fmtNum(bal)} Punkte = ${fmtEuro(bal, P)}`)),
    h("p", { class: "hint" }, "Bucht den Betrag als Auszahlung und setzt den Kontostand auf 0. Die Auszahlung erscheint im Verlauf und lässt sich dort wieder löschen."),
    h("button", { type: "button", class: "btn primary", disabled: bal <= 0, onclick: () => ctx.actions.payout() }, "💶 Taschengeld ausgezahlt"));

  // ---- System
  const demo = ctx.store.mode === "demo";
  const system = h("article", { class: "card" },
    h("h3", {}, "⚙️ Datenquelle"),
    h("p", {}, demo
      ? "Demo-Modus: Die Daten liegen nur in diesem Browser. Trage Supabase-URL und anon key in config.js ein, damit alle Geräte dieselben Daten sehen."
      : "Supabase ist verbunden. Alle Geräte sehen dieselben Daten."),
    demo ? h("button", { type: "button", class: "btn ghost", onclick: () => ctx.actions.resetDemo() }, "Demo-Daten zurücksetzen") : null,
    h("button", { type: "button", class: "btn ghost", onclick: () => ctx.reload().then(() => toast("Daten neu geladen.")) }, "🔄 Daten neu laden"));

  return h("section", { class: "view admin" },
    h("h2", { class: "view-title" }, "Verwaltung"),
    h("div", { class: "admin-grid" }, tasks, h("div", { class: "stack" }, rate, payout, deductions, system)));
}

function taskDialog(ctx, task) {
  const name = h("input", { type: "text", maxlength: 80, value: task?.name ?? "", required: true, placeholder: "z. B. Fenster geputzt" });
  const type = h("select", {},
    h("option", { value: "daily", selected: task?.type === "daily" }, "Täglich"),
    h("option", { value: "extra", selected: !task || task.type === "extra" }, "Zusätzlich"));
  const points = h("input", { type: "number", min: 0, step: 1, inputmode: "numeric", value: task?.points ?? 1, required: true });
  const icon = h("input", { type: "text", maxlength: 8, value: task?.icon ?? "⭐", required: true, class: "icon-input", "aria-label": "Icon (Emoji)" });
  const quick = h("div", { class: "quick-icons" }, QUICK_ICONS.map((e) => h("button", { type: "button", class: "icon-btn", onclick: () => { icon.value = e; } }, e)));
  modal({
    title: task ? "Aufgabe bearbeiten" : "Neue Aufgabe",
    body: h("div", { class: "form" },
      field("Name", name), field("Typ", type),
      field("Punkte", points, task ? "Gilt für neue Einträge. Bereits abgehakte Aufgaben behalten ihre Punkte." : null),
      field("Icon (Emoji)", icon), quick),
    buttons: [
      { label: "Abbrechen", kind: "ghost" },
      {
        label: "Speichern", kind: "primary",
        onClick: async () => {
          const p = Math.round(Number(points.value));
          if (!name.value.trim()) { toast("Bitte einen Namen eintragen.", "error"); return false; }
          if (!(p >= 0)) { toast("Bitte gültige Punkte eintragen.", "error"); return false; }
          const ok = await ctx.actions.saveTask(task?.id ?? null, { name: name.value.trim(), type: type.value, points: p, icon: icon.value.trim() || "⭐" });
          if (!ok) return false;
          toast(task ? "Aufgabe gespeichert." : "Aufgabe angelegt.");
        },
      },
    ],
  });
}
