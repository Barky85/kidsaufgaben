// ============================================================
//  Konfiguration der Taschengeld-App
// ============================================================

// 1) Supabase: URL und "anon public" key aus
//    Supabase → Project Settings → API eintragen.
//    Solange beide Felder leer sind, läuft die App im DEMO-MODUS
//    (Daten nur im eigenen Browser, gut zum Ausprobieren).
export const SUPABASE_URL = "https://ewjqytacrscqtbxncvpl.supabase.co/rest/v1/";
export const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV3anF5dGFjcnNjcXRieG5jdnBsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTQ2MDI4ODAsImV4cCI6MjExMDE3ODg4MH0.BIgz1EoGxsD--XcyDQVGGeXb5HTU5NpeZEWHXX2HTrI";

// 2) Login: SHA-256-Hashes der Passwörter (keine Klartext-Passwörter!).
//    Neuen Hash erzeugen: siehe README, Abschnitt "Passwörter ändern".
export const PASSWORD_HASHES = {
  bob: "cd9fb1e148ccd8442e5aa74904cc73bf6fb54d1d54d333bd596aa9bb4bb4e961",
  eltern: "3ef2e844ca4bd55d1a22cd19a90b104cf6a5b8422ee02de8b82647bb788d0ade",
};
