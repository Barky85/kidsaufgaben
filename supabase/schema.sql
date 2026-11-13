-- ============================================================
--  Taschengeld-App – Datenbankschema für Supabase (Postgres)
--  Im Supabase-Dashboard: SQL Editor → New query → alles einfügen → Run.
--  Das Skript ist wiederholbar (idempotent): doppeltes Ausführen schadet nicht.
-- ============================================================

-- ---------- Tabellen ----------

-- Aufgaben (täglich oder zusätzlich)
create table if not exists public.tasks (
  id          uuid primary key default gen_random_uuid(),
  name        text    not null check (char_length(name) between 1 and 80),
  type        text    not null check (type in ('daily', 'extra')),
  points      integer not null check (points >= 0),
  icon        text    not null default '⭐',
  sort_order  integer not null default 0,
  created_at  timestamptz not null default now()
);

-- Alle Buchungen: Gutschrift (erledigte Aufgabe), Abzug, Auszahlung.
-- Der Kontostand ist die Summe von "points". Name/Typ der Aufgabe werden
-- mitgespeichert, damit der Verlauf auch nach Änderungen/Löschen stimmt.
create table if not exists public.transactions (
  id          uuid primary key default gen_random_uuid(),
  kind        text    not null check (kind in ('credit', 'deduction', 'payout')),
  day         date    not null,
  task_id     uuid    references public.tasks (id) on delete set null,
  task_name   text,
  task_type   text    check (task_type in ('daily', 'extra')),
  points      integer not null,          -- Gutschrift > 0, Abzug/Auszahlung < 0
  euro        numeric(10, 2),            -- nur bei Auszahlungen: ausgezahlter Betrag
  comment     text,
  created_at  timestamptz not null default now(),
  constraint transactions_sign check (
    (kind = 'credit' and points >= 0) or (kind in ('deduction', 'payout') and points <= 0)
  )
);

-- Pro Aufgabe und Tag höchstens eine Gutschrift ODER ein Abzug
create unique index if not exists transactions_task_day_uniq
  on public.transactions (task_id, day)
  where task_id is not null and kind in ('credit', 'deduction');

create index if not exists transactions_day_idx on public.transactions (day);

-- Einstellungen (key/value), z. B. points_per_euro
create table if not exists public.settings (
  key    text primary key,
  value  jsonb not null
);

-- ---------- Seed-Daten (nur wenn noch leer) ----------

insert into public.tasks (name, type, points, icon, sort_order)
select v.name, v.type, v.points, v.icon, v.sort_order
from (values
  ('Akkordeon geübt',                   'daily',  2, '🪗',  1),
  ('Schulranzen gepackt',               'daily',  1, '🎒',  2),
  ('Flasche und Brotbüchse ausgeräumt', 'daily',  1, '🥪',  3),
  ('Hasen rausgelassen',                'daily',  1, '🐇',  4),
  ('Hasen eingesperrt',                 'daily',  1, '🏡',  5),
  ('Für die Schule gelernt',            'daily',  2, '📚',  6),
  ('Hasenstall saubergemacht',          'extra',  8, '🧹',  7),
  ('Müll rausgebracht',                 'extra',  3, '🗑️',  8),
  ('Schreibtisch aufgeräumt',           'extra',  4, '🖊️',  9),
  ('Zimmer aufgeräumt',                 'extra',  5, '🛏️', 10),
  ('Esstisch gedeckt',                  'extra',  2, '🍽️', 11),
  ('Esstisch abgeräumt',                'extra',  2, '🧽', 12)
) as v (name, type, points, icon, sort_order)
where not exists (select 1 from public.tasks);

-- Startwert: 10 Punkte = 1,00 €
insert into public.settings (key, value)
values ('points_per_euro', '10'::jsonb)
on conflict (key) do nothing;

-- ---------- Row Level Security ----------
-- ACHTUNG: Diese Policies erlauben jedem, der URL + anon key kennt, alles zu
-- lesen und zu ändern. Das passt zum "Familien-Login" im Browser, ist aber
-- KEIN echter Schutz. Siehe README → "RLS-Policies später verschärfen".

alter table public.tasks        enable row level security;
alter table public.transactions enable row level security;
alter table public.settings     enable row level security;

drop policy if exists "family_all" on public.tasks;
create policy "family_all" on public.tasks
  for all to anon, authenticated using (true) with check (true);

drop policy if exists "family_all" on public.transactions;
create policy "family_all" on public.transactions
  for all to anon, authenticated using (true) with check (true);

drop policy if exists "family_all" on public.settings;
create policy "family_all" on public.settings
  for all to anon, authenticated using (true) with check (true);

grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on public.tasks, public.transactions, public.settings
  to anon, authenticated;
