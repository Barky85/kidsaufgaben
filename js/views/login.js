// Login-Bildschirm
import { h } from "../util.js";
import { checkPassword } from "../auth.js";

const PROFILES = [
  { id: "bob", name: "Bob", emoji: "🧒", hint: "Hier trägst du deine Aufgaben ein." },
  { id: "eltern", name: "Eltern", emoji: "👪", hint: "Aufgaben, Punkte und Abzüge verwalten." },
];

export function renderLogin({ hashes, onSuccess, demo }) {
  let selected = null;
  let error = "";
  let busy = false;
  const root = h("main", { class: "login" });

  function draw() {
    const card = h("div", { class: "login-card" },
      h("div", { class: "login-logo", "aria-hidden": "true" }, "🌱"),
      h("h1", {}, "Taschengeld"),
      h("p", { class: "login-sub" }, "Wer bist du?"),
      h("div", { class: "profiles" }, PROFILES.map((p) => h("button", {
        type: "button", class: `profile${selected === p.id ? " on" : ""}`, "aria-pressed": selected === p.id,
        onclick: () => { selected = p.id; error = ""; draw(); },
      }, h("span", { class: "profile-emoji", "aria-hidden": "true" }, p.emoji), h("strong", {}, p.name), h("small", {}, p.hint)))));

    if (selected) {
      const pw = h("input", {
        type: "password", id: "pw", autocomplete: "current-password", autocapitalize: "off", autocorrect: "off", spellcheck: "false",
        placeholder: "Passwort", required: true, "aria-label": "Passwort", "aria-invalid": error ? "true" : null,
      });
      card.append(h("form", {
        class: "login-form",
        onsubmit: async (e) => {
          e.preventDefault();
          if (busy) return;
          busy = true;
          const ok = await checkPassword(selected, pw.value, hashes);
          busy = false;
          if (ok) { onSuccess(selected); return; }
          error = "Das Passwort stimmt nicht. Versuch es nochmal.";
          draw();
          const again = root.querySelector("#pw");
          again?.focus();
          root.querySelector(".login-card")?.classList.add("shake");
        },
      },
        pw,
        error ? h("p", { class: "login-error", role: "alert" }, error) : null,
        h("button", { type: "submit", class: "btn primary big" }, "Anmelden")));
    }
    if (demo) card.append(h("p", { class: "demo-note" }, "Demo-Modus: Daten liegen nur in diesem Browser."));
    root.replaceChildren(card);
    if (selected) root.querySelector("#pw")?.focus();
  }
  draw();
  return root;
}
