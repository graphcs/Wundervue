// Generate a short, unguessable, URL-safe share slug.
//
// Uses crypto.getRandomValues (available in non-secure contexts too, unlike
// crypto.randomUUID which throws outside HTTPS/localhost) and falls back to
// Math.random if the Web Crypto API is unavailable.
export function randomShareSlug(len = 12): string {
  const alphabet = "0123456789abcdefghijklmnopqrstuvwxyz";
  try {
    const bytes = new Uint8Array(len);
    crypto.getRandomValues(bytes);
    return Array.from(bytes, (b) => alphabet[b % 36]).join("");
  } catch {
    let s = "";
    for (let i = 0; i < len; i++) s += alphabet[Math.floor(Math.random() * 36)];
    return s;
  }
}
