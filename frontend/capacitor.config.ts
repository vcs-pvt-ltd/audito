import type { CapacitorConfig } from "@capacitor/cli";

/**
 * Audito Auditor Android app.
 *
 * appId is PROVISIONAL. Replace it with the permanent application ID before any
 * release; the release build refuses to run while it is still the placeholder
 * (android/app/build.gradle). See README "Audito Auditor Android App".
 */
const config: CapacitorConfig = {
  appId: "com.company.audito",
  appName: "Audito",
  // The static export made by scripts/android/build-web.mjs (not .next/).
  webDir: "android-web",
  backgroundColor: "#053B36",
  // Pages are served from https://localhost inside the app; there is no live-reload server.
  server: {
    androidScheme: "https",
  },
  android: {
    allowMixedContent: false,
  },
  plugins: {
    // The logo splash stays until the app has loaded its first screen
    // (NativeAppShell hides it; it also hides itself after 10 seconds).
    SplashScreen: {
      launchAutoHide: false,
      launchFadeOutDuration: 250,
      backgroundColor: "#FFFFFF",
      androidScaleType: "CENTER_CROP",
      showSpinner: false,
    },
    // Keep the pages inside the status and navigation bars.
    SystemBars: {
      insetsHandling: "native",
    },
  },
};

export default config;
