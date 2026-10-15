"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { App as NativeApp } from "@capacitor/app";
import { SplashScreen } from "@capacitor/splash-screen";
import { AlertTriangle, WifiOff } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { nativeApiConfigProblem } from "@/lib/apiConfig";
import { runNativeBackHandlers } from "@/lib/native/backButton";
import { removeOldReportFiles } from "@/lib/native/reportFiles";
import { IS_ANDROID_BUILD, isNativeApp } from "@/lib/native/platform";
import { NATIVE_ROOT_ROUTES, isNativeRouteAllowed, nativeFallbackRoute, normalizePath } from "@/lib/native/routes";

/**
 * The Audito Auditor Android app around the shared pages. On the website it
 * renders its children unchanged.
 *
 * - Shows only auditor screens (lib/native/routes); others redirect away.
 * - Signs out any session that is not an auditor's.
 * - Android back: dialogs and pages first, then history, then leaves the app.
 * - Says so when the connection is lost; nothing is synced offline.
 */
export default function NativeAppShell({ children }: { children: ReactNode }) {
  // The Android build shows nothing until it knows it runs in the app, so no
  // website-only screen flashes at launch. The website build renders at once.
  const [mode, setMode] = useState<"pending" | "web" | "native">(IS_ANDROID_BUILD ? "pending" : "web");
  useEffect(() => { setMode(isNativeApp() ? "native" : "web"); }, []);
  if (mode === "pending") return null;
  if (mode === "web") return <>{children}</>;
  return <AndroidShell>{children}</AndroidShell>;
}

function AndroidShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { admin, isLoading, logout } = useAuth();
  const [online, setOnline] = useState(() => typeof navigator === "undefined" || navigator.onLine);
  const configProblem = nativeApiConfigProblem();

  const signedIn = Boolean(admin);
  const allowed = isNativeRouteAllowed(pathname, signedIn);
  const wrongRole = Boolean(admin && admin.role !== "auditor");

  useEffect(() => {
    if (isLoading) return;
    if (wrongRole) { void logout(); return; }
    if (!allowed) router.replace(nativeFallbackRoute(signedIn));
  }, [isLoading, wrongRole, allowed, signedIn, router, logout]);

  // Latest values for the back button listener, which is registered once.
  const backState = useRef({ pathname, signedIn });
  backState.current = { pathname, signedIn };

  useEffect(() => {
    const listener = NativeApp.addListener("backButton", ({ canGoBack }) => {
      if (runNativeBackHandlers()) return;
      const path = normalizePath(backState.current.pathname);
      if (NATIVE_ROOT_ROUTES.includes(path)) { void NativeApp.minimizeApp(); return; }
      if (canGoBack) window.history.back();
      else router.replace(nativeFallbackRoute(backState.current.signedIn));
    });
    return () => { void listener.then((handle) => handle.remove()); };
  }, [router]);

  useEffect(() => {
    void removeOldReportFiles();
    const update = () => setOnline(navigator.onLine);
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);

  // Hide the logo splash once the first screen is ready (or can't start), at the latest after 10 s.
  const ready = Boolean(configProblem) || (!isLoading && allowed && !wrongRole);
  useEffect(() => {
    if (ready) { void SplashScreen.hide(); return; }
    const timer = window.setTimeout(() => { void SplashScreen.hide(); }, 10000);
    return () => window.clearTimeout(timer);
  }, [ready]);

  if (configProblem) {
    return (
      <div className="flex min-h-dvh items-center justify-center p-6">
        <div className="w-full max-w-sm rounded-2xl border border-red-400/25 bg-[#053B36] p-6 text-center">
          <AlertTriangle size={28} className="mx-auto mb-3 text-red-300" />
          <h1 className="text-lg font-semibold text-white">Audito cannot start</h1>
          <p className="mt-2 text-sm text-gray-300">{configProblem}</p>
          <p className="mt-3 text-xs text-gray-500">This build needs a valid HTTPS server address. Please install a corrected version of the app.</p>
        </div>
      </div>
    );
  }

  // Nothing outside the auditor screens is shown, not even while redirecting.
  if (isLoading || !allowed || wrongRole) return null;

  return (
    <>
      {!online && (
        // Above the bottom navigation, and taps pass through, so nothing is hidden or blocked.
        <div role="status" className="pointer-events-none fixed inset-x-4 bottom-[96px] z-[80] mx-auto flex max-w-md items-start gap-2 rounded-xl bg-amber-500 px-3 py-2 text-xs font-semibold text-primary-950 shadow-lg lg:bottom-4">
          <WifiOff size={14} className="mt-0.5 shrink-0" aria-hidden />
          <span>No connection. Answers stay on this device until you save, and saving needs a connection.</span>
        </div>
      )}
      {children}
    </>
  );
}
