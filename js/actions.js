// Aktionen, die Daten verändern (Abhaken, Abzüge, Auszahlung, Aufgaben …)
import { h, iso, today, parseISO, fmtDateLong, fmtEuro, fmtNum, round2 } from "./util.js";
import { lockReason, balance, ppe, indexByTaskDay } from "./logic.js";
import { toast, modal, confirmBox, field } from "./ui.js";

export function makeActions(ctx) {
  const busy = new Set();

  /** Führt fn aus, zeigt Fehler als Toast. Gibt true bei Erfolg zurück. */
  async function guard(fn) {
    try {
      await fn();
      return true;
    } catch (e) {
      console.error(e);
      if (e.code === "23505") {
        toast("Dafür gibt es an dem Tag schon einen Eintrag. Ich lade neu …", "error");
        await ctx.reload();
      } else {
        toast(`Das hat nicht geklappt: ${e.message}`, "error");
      }
      return false;
    }
  }

  const replaceTx = (row) => {
    const i = ctx.data.tx.findIndex((t) => t.id === row.id);
    if (i >= 0) ctx.data.tx[i] = row; else ctx.data.tx.push(row);
  };
  const dropTx = (id) => { ctx.data.tx = ctx.data.tx.filter((t) => t.id !== id); };

  const actions = {
    // ---------------- Abhaken ----------------
    async toggleTask(task, day) {
      const key = `${task.id}|${day}`;
      if (busy.has(key)) return;
      const reason = lockReason(ctx.state.role, parseISO(day));
      if (reason) { toast(reason); return; }
      const existing = indexByTaskDay(ctx.data.tx).get(key);

      if (existing?.kind === "deduction") {
        if (ctx.state.role !== "eltern") { toast("Dafür gibt es einen Abzug. Frag die Eltern 🙂"); return; }
        if (!(await confirmBox("Für diese Aufgabe gibt es an dem Tag einen Abzug. Abzug zurücknehmen?", { okLabel: "Abzug zurücknehmen" }))) return;
        busy.add(key);
        await guard(async () => { await ctx.store.deleteTx(existing.id); dropTx(existing.id); });
        busy.delete(key);
        ctx.render();
        return;
      }

      busy.add(key);
      await guard(async () => {
        if (existing) {
          await ctx.store.deleteTx(existing.id);
          dropTx(existing.id);
        } else {
          const row = await ctx.store.insertTx({
            kind: "credit", day, task_id: task.id, task_name: task.name, task_type: task.type, points: task.points,
          });
          ctx.data.tx.push(row);
          ctx.state.justDone = key;
        }
      });
      busy.delete(key);
      ctx.render();
    },

    // ---------------- Abzug ----------------
    deductDialog({ task = null, day = iso(today()) } = {}) {
      const dailies = ctx.data.tasks.filter((t) => t.type === "daily");
      const date = h("input", { type: "date", value: day, max: iso(today()), required: true });
      const sel = h("select", {},
        h("option", { value: "" }, "Sonstiges (ohne Aufgabe)"),
        dailies.map((t) => h("option", { value: t.id, selected: task?.id === t.id }, `${t.icon} ${t.name} (${t.points} P)`)));
      const pts = h("input", { type: "number", min: 1, step: 1, inputmode: "numeric", value: task ? task.points : 1, required: true });
      const comment = h("input", { type: "text", maxlength: 200, placeholder: "optional, z. B. Hasen waren nicht versorgt" });
      let touched = false;
      pts.addEventListener("input", () => { touched = true; });
      sel.addEventListener("change", () => {
        const t = dailies.find((x) => x.id === sel.value);
        if (t && !touched) pts.value = t.points;
      });
      modal({
        title: "Abzug verbuchen",
        body: h("div", { class: "form" },
          field("Datum", date), field("Aufgabe", sel),
          field("Punkte abziehen", pts, "Standard: Punkte der Aufgabe – frei änderbar"),
          field("Kommentar", comment)),
        buttons: [
          { label: "Abbrechen", kind: "ghost" },
          {
            label: "Abzug verbuchen", kind: "danger",
            onClick: async () => {
              const d = date.value;
              const p = Math.round(Number(pts.value));
              if (!d || parseISO(d) > today()) { toast("Bitte ein Datum bis heute wählen.", "error"); return false; }
              if (!(p >= 1)) { toast("Bitte mindestens 1 Punkt eintragen.", "error"); return false; }
              const t = dailies.find((x) => x.id === sel.value) || null;
              if (t && indexByTaskDay(ctx.data.tx).has(`${t.id}|${d}`)) {
                toast("Für diese Aufgabe gibt es an dem Tag schon einen Eintrag (erledigt oder Abzug).", "error");
                return false;
              }
              const ok = await guard(async () => {
                const row = await ctx.store.insertTx({
                  kind: "deduction", day: d, task_id: t?.id ?? null, task_name: t?.name ?? "Sonstiges",
                  task_type: t?.type ?? null, points: -p, comment: comment.value.trim() || null,
                });
                ctx.data.tx.push(row);
              });
              ctx.render();
              if (!ok) return false;
              toast(`Abzug von ${p} Punkten verbucht.`);
            },
          },
        ],
      });
    },

    // ---------------- Buchung bearbeiten / löschen ----------------
    editTxDialog(t) {
      const isPayout = t.kind === "payout";
      const date = h("input", { type: "date", value: t.day, max: iso(today()), required: true });
      const pts = h("input", { type: "number", min: 0, step: 1, inputmode: "numeric", value: Math.abs(t.points), required: true });
      const comment = h("input", { type: "text", maxlength: 200, value: t.comment || "" });
      const kindLabel = { credit: "Gutschrift", deduction: "Abzug", payout: "Auszahlung" }[t.kind];
      modal({
        title: `${kindLabel} bearbeiten`,
        body: h("div", { class: "form" },
          h("p", { class: "modal-text" }, t.task_name || kindLabel),
          field("Datum", date),
          isPayout ? null : field(t.kind === "credit" ? "Punkte (Gutschrift)" : "Punkte (Abzug)", pts),
          field("Kommentar", comment)),
        buttons: [
          { label: "Abbrechen", kind: "ghost" },
          {
            label: "Speichern", kind: "primary",
            onClick: async () => {
              if (!date.value || parseISO(date.value) > today()) { toast("Bitte ein Datum bis heute wählen.", "error"); return false; }
              const patch = { day: date.value, comment: comment.value.trim() || null };
              if (!isPayout) {
                const p = Math.round(Number(pts.value));
                if (!(p >= 0)) { toast("Bitte gültige Punkte eintragen.", "error"); return false; }
                patch.points = t.kind === "deduction" ? -p : p;
              }
              const ok = await guard(async () => { replaceTx(await ctx.store.updateTx(t.id, patch)); });
              ctx.render();
              if (!ok) return false;
              toast("Gespeichert.");
            },
          },
        ],
      });
    },

    async removeTx(t) {
      const what = { credit: "Diese Gutschrift", deduction: "Diesen Abzug", payout: "Diese Auszahlung" }[t.kind];
      const extra = t.kind === "payout" ? " Der Kontostand steigt dadurch wieder." : "";
      if (!(await confirmBox(`${what} (${t.task_name || ""}, ${fmtDateLong(parseISO(t.day))}) wirklich ${t.kind === "deduction" ? "zurücknehmen" : "löschen"}?${extra}`,
        { okLabel: t.kind === "deduction" ? "Zurücknehmen" : "Löschen", danger: true }))) return;
      await guard(async () => { await ctx.store.deleteTx(t.id); dropTx(t.id); });
      ctx.render();
    },

    // ---------------- Auszahlung ----------------
    async payout() {
      const P = ppe(ctx.data);
      const bal = balance(ctx.data.tx);
      if (bal <= 0) { toast("Es gibt nichts auszuzahlen (Kontostand ist 0 oder negativ).", "error"); return; }
      const euro = round2(bal / P);
      const ok = await confirmBox(
        `Es werden ${fmtNum(bal)} Punkte = ${fmtEuro(bal, P)} als ausgezahlt verbucht. Der Kontostand springt danach auf 0.`,
        { title: "Taschengeld ausgezahlt?", okLabel: "Ja, ausgezahlt" });
      if (!ok) return;
      await guard(async () => {
        const row = await ctx.store.insertTx({
          kind: "payout", day: iso(today()), task_name: "Auszahlung", points: -bal, euro, comment: "Taschengeld ausgezahlt",
        });
        ctx.data.tx.push(row);
      });
      ctx.render();
      toast(`${fmtEuro(bal, P)} Auszahlung verbucht 💶`);
    },

    // ---------------- Aufgaben ----------------
    async saveTask(id, values) {
      let ok;
      if (id) {
        ok = await guard(async () => {
          const row = await ctx.store.updateTask(id, values);
          const i = ctx.data.tasks.findIndex((t) => t.id === id);
          ctx.data.tasks[i] = row;
        });
      } else {
        const max = Math.max(0, ...ctx.data.tasks.map((t) => t.sort_order || 0));
        ok = await guard(async () => {
          ctx.data.tasks.push(await ctx.store.insertTask({ ...values, sort_order: max + 1 }));
        });
      }
      ctx.render();
      return ok;
    },

    async removeTask(task) {
      const used = ctx.data.tx.filter((t) => t.task_id === task.id).length;
      const msg = used
        ? `„${task.name}“ löschen? Die ${used} bisherigen Buchungen bleiben im Verlauf erhalten (ohne Verknüpfung zur Aufgabe).`
        : `„${task.name}“ löschen?`;
      if (!(await confirmBox(msg, { okLabel: "Löschen", danger: true }))) return;
      await guard(async () => { await ctx.store.deleteTask(task.id); });
      await ctx.reload();
    },

    // ---------------- Einstellungen ----------------
    async setPpe(value) {
      const ok = await guard(async () => {
        await ctx.store.setSetting("points_per_euro", value);
        ctx.data.settings.points_per_euro = value;
      });
      ctx.render();
      return ok;
    },

    async resetDemo() {
      if (!(await confirmBox("Alle Demo-Daten zurücksetzen?", { okLabel: "Zurücksetzen", danger: true }))) return;
      await ctx.store.reset();
      await ctx.reload();
      toast("Demo zurückgesetzt.");
    },
  };
  return actions;
}
