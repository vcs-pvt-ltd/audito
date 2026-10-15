/**
 * Screens the Audito Auditor Android app may show. Everything else (home page,
 * registration, pricing, payments, organization setup, checklists, users,
 * admin and organization-user pages) is redirected away.
 *
 * This only shapes the app. The API still authorizes every request by role.
 */

/** Reachable without signing in. */
const SIGNED_OUT_ROUTES = ["/login", "/forgot-password", "/verify-email", "/privacy-policies"];

/** Reachable by a signed-in auditor. */
const AUDITOR_ROUTES = [
  "/dashboard",
  "/my-audits",
  "/my-caps",
  "/ai-site-scan",
  "/profile",
  "/onboarding",
  "/my-learning",
  "/settings/notices",
  "/settings/help",
  "/privacy-policies",
];

/** Screens where Android back leaves the app instead of going back. */
export const NATIVE_ROOT_ROUTES = ["/dashboard", "/login"];

export function normalizePath(pathname: string): string {
  const path = (pathname || "/").split(/[?#]/)[0];
  return path.length > 1 ? path.replace(/\/+$/, "") : path;
}

function matches(path: string, routes: string[]) {
  return routes.some((route) => path === route || path.startsWith(`${route}/`));
}

/** Whether the Android app may show this path for the current sign-in state. */
export function isNativeRouteAllowed(pathname: string, signedIn: boolean): boolean {
  const path = normalizePath(pathname);
  return signedIn ? matches(path, AUDITOR_ROUTES) : matches(path, SIGNED_OUT_ROUTES);
}

/** Where the Android app goes instead of a screen it does not show. */
export function nativeFallbackRoute(signedIn: boolean): string {
  return signedIn ? "/dashboard" : "/login";
}
