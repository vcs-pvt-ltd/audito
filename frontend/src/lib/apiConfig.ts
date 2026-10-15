import { IS_ANDROID_BUILD, isNativeApp } from "@/lib/native/platform";

/**
 * Where the API and uploaded media live.
 *
 * Website: NEXT_PUBLIC_API_URL / NEXT_PUBLIC_MEDIA_URL with the existing local
 * defaults. Android app: the HTTPS address from frontend/.env.android. The app
 * never falls back to localhost or to its own WebView origin; when the address
 * is missing or unsafe, requests fail with a clear message instead.
 */

const RAW_API_URL = process.env.NEXT_PUBLIC_API_URL || "";
const RAW_MEDIA_URL = process.env.NEXT_PUBLIC_MEDIA_URL || "";

const WEB_DEFAULT_API_URL = "http://localhost:8081/api";
const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "0.0.0.0", "10.0.2.2", "[::1]"]);

/** Why an address cannot be used by the Android app, or null when it can. */
export function nativeAddressProblem(value: string, label: string): string | null {
  if (!value) return `${label} is not set for the Android app.`;
  let url: URL;
  try { url = new URL(value); } catch { return `${label} is not a valid address.`; }
  if (url.protocol !== "https:") return `${label} must use HTTPS.`;
  if (LOCAL_HOSTS.has(url.hostname) || url.hostname.endsWith(".localhost")) return `${label} cannot point to this device.`;
  return null;
}

/** The problem with the Android app's API configuration, or null when it is usable (always null on the website). */
export function nativeApiConfigProblem(): string | null {
  if (!isNativeApp()) return null;
  if (!IS_ANDROID_BUILD) return "This app was not built with the Android configuration.";
  return nativeAddressProblem(RAW_API_URL, "The API address") || (RAW_MEDIA_URL ? nativeAddressProblem(RAW_MEDIA_URL, "The media address") : null);
}

/** API base ending in /api. Empty in the Android app when its configuration is unusable. */
export function apiBaseUrl(): string {
  if (isNativeApp()) return nativeApiConfigProblem() ? "" : RAW_API_URL.replace(/\/+$/, "");
  return RAW_API_URL || WEB_DEFAULT_API_URL;
}

/** Origin that serves uploaded files (e.g. /uploads/...). */
export function mediaOrigin(): string {
  if (isNativeApp()) {
    if (nativeApiConfigProblem()) return "";
    return (RAW_MEDIA_URL || RAW_API_URL.replace(/\/api\/?$/, "")).replace(/\/+$/, "");
  }
  return RAW_MEDIA_URL || (RAW_API_URL || "http://localhost:5000/api").replace(/\/api\/?$/, "");
}

/** Full URL for a stored file path; absolute http(s), blob: and data: URLs are returned unchanged. */
export function mediaUrl(filePath: string | null | undefined): string {
  if (!filePath) return "";
  if (/^(https?:|blob:|data:)/i.test(filePath)) return filePath;
  const origin = mediaOrigin();
  if (!origin) return "";
  return `${origin}${filePath.startsWith("/") ? filePath : `/${filePath}`}`;
}
