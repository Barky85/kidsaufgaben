# 🌱 Taschengeld-App

Eine kleine Web-App, mit der Bob seine erledigten Aufgaben einträgt und dafür Punkte bekommt.
Die Punkte werden in Euro Taschengeld umgerechnet, die Eltern verwalten Aufgaben, Punkte und Abzüge.

- Vanilla HTML, CSS und JavaScript (ES-Module), **kein Build-Schritt**, läuft direkt als GitHub Page
- Daten in **Supabase** (Postgres), damit alle Geräte dieselben Daten sehen
- Diagramme als reines SVG (keine Bibliothek nötig), Oberfläche auf Deutsch, mobile first

## Inhalt

```
index.html          Einstiegsseite
config.js           ← hier Supabase-URL, anon key und Passwort-Hashes eintragen
css/style.css       Design (grün)
js/                 App-Code (Login, Store, Kalender, Auswertung, Verwaltung …)
supabase/schema.sql Tabellen, Startdaten, Row-Level-Security
```

## Schnellstart ohne Supabase (Demo-Modus)

Solange `SUPABASE_URL` und `SUPABASE_ANON_KEY` in `config.js` leer sind, läuft die App im **Demo-Modus**:
Die Daten liegen nur im Browser (localStorage), mit ein paar Beispieldaten. Zum Ausprobieren ideal.

ES-Module laufen nicht über `file://`. Lokal starten mit:

```bash
python3 -m http.server 8000
```

Dann `http://localhost:8000` öffnen.

---

## 1. Supabase einrichten

1. Auf [supabase.com](https://supabase.com) ein Konto anlegen und **New project** erstellen (Name z. B. `taschengeld`, Region in der Nähe, Datenbank-Passwort notieren).
2. Warten, bis das Projekt bereit ist.
3. Links **SQL Editor → New query** öffnen, den gesamten Inhalt von [`supabase/schema.sql`](supabase/schema.sql) einfügen und **Run** klicken.
   Das legt die Tabellen `tasks`, `transactions`, `settings` an, trägt die Startaufgaben und den Umrechnungsfaktor (10 Punkte = 1,00 €) ein und schaltet Row-Level-Security mit den Familien-Policies ein.
   Das Skript ist wiederholbar, doppeltes Ausführen schadet nicht.
4. Unter **Project Settings → API** (oder **Connect**) zwei Werte kopieren:
   - **Project URL**, z. B. `https://abcdxyz.supabase.co`
   - **anon public** key (der lange Schlüssel mit `eyJ…`; **nicht** den `service_role` key!)
5. Beides in [`config.js`](config.js) eintragen:

   ```js
   export const SUPABASE_URL = "https://abcdxyz.supabase.co";
   export const SUPABASE_ANON_KEY = "eyJ…";
   ```

Der anon key ist dafür gedacht, öffentlich im Browser zu stehen. Er darf im Repo liegen. Den `service_role` key darfst du **nie** ins Repo oder in die App legen.

## 2. GitHub Pages veröffentlichen

1. Änderungen nach `main` bringen (Pull Request mergen).
2. Im Repo **Settings → Pages**.
3. Unter **Build and deployment → Source** „Deploy from a branch“ wählen, **Branch: `main`**, **Folder: `/ (root)`**, dann **Save**.
4. Nach ca. einer Minute ist die App erreichbar unter `https://<dein-github-name>.github.io/kidsaufgaben/`.

Die App liegt bewusst im Repo-Root. Alle Pfade sind relativ, deshalb funktioniert sie auch unter dem Unterpfad `/kidsaufgaben/`.

---

## Login und Passwörter

Es gibt zwei Benutzer: **Bob** und **Eltern**. Die Passwörter stehen **nicht** im Klartext im Code, sondern nur als SHA-256-Hashes in [`config.js`](config.js).

| Benutzer | SHA-256-Hash des Passworts |
|----------|----------------------------|
| Bob      | `cd9fb1e148ccd8442e5aa74904cc73bf6fb54d1d54d333bd596aa9bb4bb4e961` |
| Eltern   | `3ef2e844ca4bd55d1a22cd19a90b104cf6a5b8422ee02de8b82647bb788d0ade` |

Beim Login wird das eingegebene Passwort mit der Web Crypto API gehasht und mit dem Hash verglichen. Die Sitzung bleibt per `sessionStorage` erhalten (bis der Tab geschlossen wird). Der Knopf „Abmelden“ beendet sie sofort.
Groß- und Kleinschreibung zählt.

### Passwörter ändern

1. Im Browser eine beliebige Seite öffnen, Entwicklerkonsole öffnen (F12) und ausführen (`NEUES PASSWORT` ersetzen):

   ```js
   crypto.subtle.digest("SHA-256", new TextEncoder().encode("NEUES PASSWORT".normalize("NFC")))
     .then(b => console.log([...new Uint8Array(b)].map(x => x.toString(16).padStart(2, "0")).join("")))
   ```

   Oder im Terminal (Umlaute werden als UTF-8 gehasht):

   ```bash
   printf '%s' 'NEUES PASSWORT' | sha256sum
   ```

2. Den ausgegebenen Hash in `config.js` bei `PASSWORD_HASHES` eintragen, committen, fertig.

### ⚠️ Ehrlicher Hinweis zur Sicherheit

Das ist ein **Schutz auf Familienniveau, kein echter Zugriffsschutz**:

- Der Login wird **im Browser** geprüft. Wer die Seite und ihren Code lesen kann, kann den Login umgehen (z. B. mit den Entwicklertools).
- Die Hashes stehen im Repo. Bei einem öffentlichen Repo kann sie jeder lesen. Kurze oder bekannte Passwörter lassen sich aus einem SHA-256-Hash in Sekunden zurückrechnen. **Verwende hier keine Passwörter, die du irgendwo sonst benutzt.**
- Weil URL und anon key im Browser stehen, kann jeder, der sie kennt, die Daten **direkt über die Supabase-API lesen und ändern**, auch ohne Login. Die RLS-Policies in `schema.sql` erlauben das bewusst.
- Gespeichert werden nur Aufgaben, Punkte und Beträge, keine sensiblen Daten. Für Taschengeld in der Familie ist das in der Regel in Ordnung. Das Risiko ist, dass jemand Punkte manipuliert, nicht dass Geheimnisse offenliegen.

### RLS-Policies später verschärfen

Wenn die App mehr Schutz braucht, ist der saubere Weg **Supabase Auth**:

1. Unter **Authentication → Users** zwei Benutzer anlegen (z. B. `bob@familie.example` und `eltern@familie.example`) und ihnen im Feld `app_metadata` eine Rolle geben, z. B. `{"role": "bob"}` bzw. `{"role": "eltern"}`.
2. In der App statt des Hash-Vergleichs `supabase.auth.signInWithPassword(...)` verwenden. Die Passwörter liegen dann sicher bei Supabase und nicht mehr im Repo.
3. Die Policies in `schema.sql` von `to anon, authenticated using (true)` auf Rollen umstellen, zum Beispiel:

   ```sql
   -- Alle angemeldeten Familienmitglieder dürfen lesen
   create policy "read" on public.transactions for select to authenticated using (true);

   -- Eltern dürfen alles schreiben
   create policy "parents_write" on public.transactions for all to authenticated
     using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'eltern')
     with check ((auth.jwt() -> 'app_metadata' ->> 'role') = 'eltern');

   -- Bob darf nur Gutschriften der aktuellen Woche anlegen
   create policy "bob_credits" on public.transactions for insert to authenticated
     with check ((auth.jwt() -> 'app_metadata' ->> 'role') = 'bob'
                 and kind = 'credit' and day between date_trunc('week', current_date)::date and current_date);
   ```

   Danach die alten `family_all`-Policies löschen und `anon` den Zugriff entziehen (`revoke ... from anon`), damit ohne Login nichts mehr geht.

---

## Bedienung

**Bob**

- **Kalender**: Wochenansicht (Standard) oder Monatsansicht. Aufgabe antippen = erledigt (✓, Punkte werden dem Tag gutgeschrieben), nochmal antippen = wieder austragen.
- Bob kann den **heutigen Tag** und **vergangene Tage der aktuellen Woche** ändern. Zukünftige Tage und frühere Wochen sind gesperrt.
- Oben stehen immer **Kontostand** (Punkte und Euro) und der Stand des **laufenden Monats**.
- **Abzüge**: Übersicht mit Datum, Aufgabe und Punkten. **Auswertung**: Diagramme für Woche oder Monat. **Verlauf**: alle Buchungen mit Kontostand.

**Eltern** (alles von Bob, zusätzlich)

- Im Kalender können beliebige vergangene Tage geändert werden (auch rückwirkend).
- Neben jeder nicht erledigten **täglichen** Aufgabe gibt es einen **−**-Knopf: Abzug in Höhe der Aufgabe oder frei wählbar, mit optionalem Kommentar. Ein Klick auf eine Aufgabe mit Abzug nimmt ihn zurück.
- **Verlauf**: Buchungen bearbeiten (Datum, Punkte, Kommentar) und löschen.
- **Verwaltung**: Aufgaben anlegen, bearbeiten, löschen (Name, Typ, Punkte, Icon), Umrechnungsfaktor ändern, Abzug verbuchen, **Monatsabschluss**.

### Wie die Punkte funktionieren

- Jede Aufgabe ist **täglich** oder **zusätzlich** und hat eine Punktzahl. Jede Aufgabe kann pro Tag **einmal** eingetragen werden.
- Startwerte: tägliche Aufgaben 1–2 Punkte, Zusatzaufgaben 2–8 Punkte. Alles ist im Elternbereich änderbar.
- Umrechnung: Standard **10 Punkte = 1,00 €**. Einstellbar unter Verwaltung. Gespeichert werden immer Punkte, nur die Anzeige rechnet in Euro um.
- Jede Gutschrift, jeder Abzug und jede Auszahlung ist eine **Buchung**. Der **Kontostand ist die Summe aller Buchungen**.
- Eine Buchung merkt sich Name und Punkte der Aufgabe zum Zeitpunkt der Buchung. Spätere Änderungen an der Aufgabe verändern die Historie nicht. Wird eine Aufgabe gelöscht, bleiben ihre Buchungen im Verlauf erhalten.
- **Monatsabschluss** („Taschengeld ausgezahlt“): bucht den aktuellen Kontostand als Auszahlung und setzt ihn auf 0. Die Auszahlung zählt nicht zum Monatsstand und lässt sich im Verlauf wieder löschen.
- **Erledigungsquote**: erledigte tägliche Aufgaben geteilt durch (Anzahl täglicher Aufgaben × bisher vergangene Tage im Zeitraum).

## Datenmodell

| Tabelle | Inhalt |
|---------|--------|
| `tasks` | `id`, `name`, `type` (`daily`/`extra`), `points`, `icon`, `sort_order` |
| `transactions` | `id`, `kind` (`credit`/`deduction`/`payout`), `day`, `task_id`, `task_name`, `task_type`, `points` (Abzug und Auszahlung negativ), `euro`, `comment` |
| `settings` | `key`/`value`, z. B. `points_per_euro` |

Pro Aufgabe und Tag gibt es höchstens eine Gutschrift **oder** einen Abzug (Unique-Index).

## Hinweise

- Geräte sehen Änderungen nach einem Neuladen der Seite, nach dem Zurückkehren in die App oder über „Daten neu laden“ im Elternbereich. Es gibt keine Echtzeit-Synchronisierung.
- Das Supabase-Skript wird beim ersten Laden der App per CDN geladen (`cdn.jsdelivr.net`). Im Demo-Modus braucht die App keine externen Dateien.
- Kostenlose Supabase-Projekte werden nach längerer Inaktivität pausiert. Dann im Dashboard auf „Restore“ klicken.
