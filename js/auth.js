// Login auf Familienniveau: Passwort-Hash (SHA-256) wird im Browser verglichen.
// ACHTUNG: Das ist kein echter Zugriffsschutz – siehe README.

const SESSION_KEY = "taschengeld.session";

export async function sha256(text) {
  const bytes = new TextEncoder().encode(text.normalize("NFC"));
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** @param {"bob"|"eltern"} user */
export async function checkPassword(user, password, hashes) {
  const expected = hashes?.[user];
  if (!expected) return false;
  return (await sha256(password)) === expected.toLowerCase();
}

export function getSession() {
  try {
    const v = sessionStorage.getItem(SESSION_KEY);
    return v === "bob" || v === "eltern" ? v : null;
  } catch { return null; }
}
export function setSession(role) {
  try { sessionStorage.setItem(SESSION_KEY, role); } catch { /* ignorieren */ }
}
export function clearSession() {
  try { sessionStorage.removeItem(SESSION_KEY); } catch { /* ignorieren */ }
}
