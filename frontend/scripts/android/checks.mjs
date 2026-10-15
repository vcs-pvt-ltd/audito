// Shared checks for the Android build scripts.

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "0.0.0.0", "10.0.2.2", "[::1]"]);

/** Why an address cannot be used by the Android app, or null when it can. */
export function validateAndroidAddress(value, name) {
  if (!value) return `${name} is not set in .env.android.`;
  let url;
  try { url = new URL(value); } catch { return `${name} is not a valid URL (${value}).`; }
  if (url.protocol !== "https:") return `${name} must use HTTPS (${value}).`;
  if (LOCAL_HOSTS.has(url.hostname) || url.hostname.endsWith(".localhost")) return `${name} cannot point to localhost or the device (${value}).`;
  return null;
}

// Things that must never be inside the app: server secrets, keys, private env values.
const SECRET_PATTERNS = [
  [/-----BEGIN [A-Z ]*PRIVATE KEY-----/, "a private key"],
  [/\bJWT_(REFRESH_)?SECRET\b/, "a JWT secret name"],
  [/\bOPENAI_API_KEY\b|\bsk-(proj-)?[A-Za-z0-9_-]{20,}/, "an OpenAI key"],
  [/\b(DB|DATABASE|POSTGRES|PG)_PASSWORD\b|postgres(ql)?:\/\/[^\s"']+:[^\s"']+@/, "database credentials"],
  [/\bSAMPATH_[A-Z_]*SECRET\b|\bSMTP_PASS(WORD)?\b|\bMAIL_PASSWORD\b/, "a server credential name"],
  [/\bAKIA[0-9A-Z]{16}\b/, "an AWS access key"],
  [/\bstorePassword\b|\bkeyPassword\b/, "signing passwords"],
];

/** Describes the first secret-looking content in text, or null. */
export function findSecretLikeContent(text) {
  for (const [pattern, label] of SECRET_PATTERNS) {
    if (pattern.test(text)) return label;
  }
  return null;
}
