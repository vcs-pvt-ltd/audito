import { SecureStoragePlugin } from "capacitor-secure-storage-plugin";
import { isNativeApp } from "./platform";

/**
 * Where the signed-in session (tokens and profile) is kept.
 *
 * Website: localStorage "audito_auth", as before. Android app: encrypted with
 * an Android Keystore key, never in WebView localStorage.
 */

export const AUTH_STORAGE_KEY = "audito_auth";

export async function readStoredAuth(): Promise<string | null> {
  if (!isNativeApp()) return localStorage.getItem(AUTH_STORAGE_KEY);
  // Never keep a session in WebView storage inside the app.
  try { localStorage.removeItem(AUTH_STORAGE_KEY); } catch { /* storage unavailable */ }
  try {
    const { value } = await SecureStoragePlugin.get({ key: AUTH_STORAGE_KEY });
    return value || null;
  } catch {
    return null; // nothing stored yet, or the key was lost (e.g. after a restore): sign in again
  }
}

export async function writeStoredAuth(value: string): Promise<void> {
  if (!isNativeApp()) {
    localStorage.setItem(AUTH_STORAGE_KEY, value);
    return;
  }
  await SecureStoragePlugin.set({ key: AUTH_STORAGE_KEY, value });
}

export async function clearStoredAuth(): Promise<void> {
  if (!isNativeApp()) {
    localStorage.removeItem(AUTH_STORAGE_KEY);
    return;
  }
  try { await SecureStoragePlugin.remove({ key: AUTH_STORAGE_KEY }); } catch { /* already removed */ }
}

/** Seconds until a JWT expires (negative once expired), or null when it cannot be read. */
export function secondsUntilExpiry(jwt: string | null | undefined): number | null {
  if (!jwt) return null;
  try {
    const part = jwt.split(".")[1];
    const json = atob(part.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(part.length / 4) * 4, "="));
    const exp = Number(JSON.parse(json)?.exp);
    return Number.isFinite(exp) ? exp - Date.now() / 1000 : null;
  } catch {
    return null;
  }
}
