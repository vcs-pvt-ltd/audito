import { Capacitor } from "@capacitor/core";

/**
 * True inside the Audito Auditor Android app (Capacitor), false in a browser
 * and during the static build. This is the one place that decides it.
 */
export function isNativeApp(): boolean {
  return typeof window !== "undefined" && Capacitor.isNativePlatform();
}

/** Set by the Android web build (scripts/android/build-web.mjs). */
export const IS_ANDROID_BUILD = process.env.NEXT_PUBLIC_APP_TARGET === "android";
