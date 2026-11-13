// UI-Bausteine: Toast, Dialoge, Formularfelder
import { h } from "./util.js";

let toastTimer;
export function toast(message, kind = "info") {
  let box = document.getElementById("toast");
  if (!box) {
    box = h("div", { id: "toast", role: "status", "aria-live": "polite" });
    document.body.append(box);
  }
  box.className = `toast show ${kind}`;
  box.textContent = message;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { box.className = "toast"; }, kind === "error" ? 5000 : 2600);
}

/**
 * Dialog öffnen.
 * buttons: [{ label, kind: "primary"|"ghost"|"danger", onClick(close) }]
 * onClick darf `false` zurückgeben, um den Dialog offen zu lassen.
 */
export function modal({ title, body, buttons }) {
  const dlg = h("dialog", { class: "modal" });
  const close = () => { if (dlg.open) dlg.close(); };
  const buttonEls = buttons.map((b) => h("button", {
    type: "button",
    class: `btn ${b.kind || "ghost"}`,
    onclick: async () => {
      const result = b.onClick ? await b.onClick(close) : undefined;
      if (result !== false) close();
    },
  }, b.label));
  const primary = buttonEls[buttons.findIndex((b) => b.kind === "primary" || b.kind === "danger")];
  const form = h("form", { onsubmit: (e) => { e.preventDefault(); primary?.click(); } },
    h("h2", {}, title), body, h("div", { class: "modal-actions" }, buttonEls));
  dlg.append(form);
  dlg.addEventListener("close", () => dlg.remove());
  dlg.addEventListener("click", (e) => { if (e.target === dlg) close(); });
  document.body.append(dlg);
  dlg.showModal();
  dlg.querySelector("input, select, textarea")?.focus();
  return { close, dlg };
}

export function confirmBox(message, { okLabel = "Ja", cancelLabel = "Abbrechen", danger = false, title = "Bist du sicher?" } = {}) {
  return new Promise((resolve) => {
    let answered = false;
    const { dlg } = modal({
      title,
      body: h("p", { class: "modal-text" }, message),
      buttons: [
        { label: cancelLabel, kind: "ghost", onClick: () => { answered = true; resolve(false); } },
        { label: okLabel, kind: danger ? "danger" : "primary", onClick: () => { answered = true; resolve(true); } },
      ],
    });
    dlg.addEventListener("close", () => { if (!answered) resolve(false); });
  });
}

export function field(label, input, hint) {
  return h("label", { class: "field" }, h("span", { class: "field-label" }, label), input, hint ? h("small", { class: "field-hint" }, hint) : null);
}
