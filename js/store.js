// Datenhaltung: Supabase (echt) oder Demo-Modus (localStorage)
import { uuid, iso, addDays, today } from "./util.js";

const SUPABASE_CDN = "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/+esm";
const DEMO_KEY = "taschengeld.demo.v1";

export const SEED_TASKS = [
  // täglich
  { name: "Akkordeon geübt", type: "daily", points: 2, icon: "🪗" },
  { name: "Schulranzen gepackt", type: "daily", points: 1, icon: "🎒" },
  { name: "Flasche und Brotbüchse ausgeräumt", type: "daily", points: 1, icon: "🥪" },
  { name: "Hasen rausgelassen", type: "daily", points: 1, icon: "🐇" },
  { name: "Hasen eingesperrt", type: "daily", points: 1, icon: "🏡" },
  { name: "Für die Schule gelernt", type: "daily", points: 2, icon: "📚" },
  // zusätzlich
  { name: "Hasenstall saubergemacht", type: "extra", points: 8, icon: "🧹" },
  { name: "Müll rausgebracht", type: "extra", points: 3, icon: "🗑️" },
  { name: "Schreibtisch aufgeräumt", type: "extra", points: 4, icon: "🖊️" },
  { name: "Zimmer aufgeräumt", type: "extra", points: 5, icon: "🛏️" },
  { name: "Esstisch gedeckt", type: "extra", points: 2, icon: "🍽️" },
  { name: "Esstisch abgeräumt", type: "extra", points: 2, icon: "🧽" },
];

export async function createStore(cfg) {
  if (cfg.SUPABASE_URL && cfg.SUPABASE_ANON_KEY) return supabaseStore(cfg);
  return demoStore();
}

// ------------------------------------------------------------
// Supabase
// ------------------------------------------------------------
async function supabaseStore({ SUPABASE_URL, SUPABASE_ANON_KEY }) {
  const { createClient } = await import(SUPABASE_CDN);
  const sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { auth: { persistSession: false } });

  const unwrap = ({ data, error }) => {
    if (error) {
      const e = new Error(error.message);
      e.code = error.code;
      throw e;
    }
    return data;
  };

  async function fetchAll(table, orderBy) {
    const rows = [];
    for (let from = 0; ; from += 1000) {
      let q = sb.from(table).select("*");
      for (const o of orderBy) q = q.order(o);
      const part = unwrap(await q.range(from, from + 999));
      rows.push(...part);
      if (part.length < 1000) break;
    }
    return rows;
  }

  return {
    mode: "supabase",
    async load() {
      const [tasks, tx, settingRows] = await Promise.all([
        fetchAll("tasks", ["sort_order", "created_at"]),
        fetchAll("transactions", ["day", "created_at"]),
        fetchAll("settings", ["key"]),
      ]);
      const settings = Object.fromEntries(settingRows.map((r) => [r.key, r.value]));
      return { tasks, tx, settings };
    },
    async insertTask(t) { return unwrap(await sb.from("tasks").insert(t).select().single()); },
    async updateTask(id, patch) { return unwrap(await sb.from("tasks").update(patch).eq("id", id).select().single()); },
    async deleteTask(id) { unwrap(await sb.from("tasks").delete().eq("id", id)); },
    async insertTx(t) { return unwrap(await sb.from("transactions").insert(t).select().single()); },
    async updateTx(id, patch) { return unwrap(await sb.from("transactions").update(patch).eq("id", id).select().single()); },
    async deleteTx(id) { unwrap(await sb.from("transactions").delete().eq("id", id)); },
    async setSetting(key, value) { unwrap(await sb.from("settings").upsert({ key, value })); },
  };
}

// ------------------------------------------------------------
// Demo-Modus (localStorage)
// ------------------------------------------------------------
function demoStore() {
  let db = readDemo() ?? seedDemo();

  function readDemo() {
    try { return JSON.parse(localStorage.getItem(DEMO_KEY)); } catch { return null; }
  }
  function save() {
    try { localStorage.setItem(DEMO_KEY, JSON.stringify(db)); } catch { /* ignorieren */ }
  }
  function conflict() {
    const e = new Error("Eintrag existiert bereits");
    e.code = "23505";
    return e;
  }
  const now = () => new Date().toISOString();
  const clone = (x) => JSON.parse(JSON.stringify(x));
  save();

  return {
    mode: "demo",
    async load() { return clone(db); },
    async insertTask(t) {
      const row = { id: uuid(), sort_order: 0, created_at: now(), ...t };
      db.tasks.push(row); save(); return clone(row);
    },
    async updateTask(id, patch) {
      const row = db.tasks.find((t) => t.id === id);
      Object.assign(row, patch); save(); return clone(row);
    },
    async deleteTask(id) {
      db.tasks = db.tasks.filter((t) => t.id !== id);
      db.tx.forEach((t) => { if (t.task_id === id) t.task_id = null; });
      save();
    },
    async insertTx(t) {
      if (t.task_id && (t.kind === "credit" || t.kind === "deduction")
        && db.tx.some((x) => x.task_id === t.task_id && x.day === t.day && (x.kind === "credit" || x.kind === "deduction"))) throw conflict();
      const row = { id: uuid(), task_id: null, task_name: null, task_type: null, euro: null, comment: null, created_at: now(), ...t };
      db.tx.push(row); save(); return clone(row);
    },
    async updateTx(id, patch) {
      const row = db.tx.find((t) => t.id === id);
      const next = { ...row, ...patch };
      if (next.task_id && (next.kind === "credit" || next.kind === "deduction")
        && db.tx.some((x) => x.id !== id && x.task_id === next.task_id && x.day === next.day && (x.kind === "credit" || x.kind === "deduction"))) throw conflict();
      Object.assign(row, patch); save(); return clone(row);
    },
    async deleteTx(id) { db.tx = db.tx.filter((t) => t.id !== id); save(); },
    async setSetting(key, value) { db.settings[key] = value; save(); },
    /** Demo zurücksetzen (nur Demo-Modus) */
    async reset() { db = seedDemo(); save(); },
  };
}

function seedDemo() {
  const tasks = SEED_TASKS.map((t, i) => ({ id: uuid(), sort_order: i + 1, created_at: new Date(2024, 0, 1, 0, 0, i).toISOString(), ...t }));
  const tx = [];
  // deterministische Pseudo-Zufallszahlen, damit die Demo stabil aussieht
  let seed = 7;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const t0 = today();
  let n = 0;
  for (let back = 18; back >= 1; back--) {
    const day = iso(addDays(t0, -back));
    for (const task of tasks) {
      const p = task.type === "daily" ? 0.8 : 0.15;
      if (rnd() < p) {
        tx.push({ id: uuid(), kind: "credit", day, task_id: task.id, task_name: task.name, task_type: task.type, points: task.points, euro: null, comment: null, created_at: new Date(Date.UTC(2024, 0, 1, 12, 0, n++)).toISOString() });
      } else if (task.type === "daily" && rnd() < 0.2) {
        tx.push({ id: uuid(), kind: "deduction", day, task_id: task.id, task_name: task.name, task_type: task.type, points: -task.points, euro: null, comment: "Vergessen", created_at: new Date(Date.UTC(2024, 0, 1, 12, 0, n++)).toISOString() });
      }
    }
  }
  return { tasks, tx, settings: { points_per_euro: 10 } };
}
