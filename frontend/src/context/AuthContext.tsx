"use client";

import { createContext, useContext, useState, useEffect, useCallback, useRef, type ReactNode } from "react";
import { App as NativeApp } from "@capacitor/app";
import { authApi, setSessionRefresher, type LoginPayload, type RegisterPayload, type PaymentDetails } from "@/lib/api";
import { apiBaseUrl, nativeApiConfigProblem } from "@/lib/apiConfig";
import { AUTH_STORAGE_KEY, clearStoredAuth, readStoredAuth, writeStoredAuth } from "@/lib/native/authStorage";
import { isNativeApp } from "@/lib/native/platform";

/** The only role that can use the Audito Auditor Android app. */
const NATIVE_APP_ROLE = "auditor";

interface Admin {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  role: string;
  account_type: string | null;
  entity_type: string | null;
  entity_code: string | null;
  org_level: number;
  user_type?: string | null;
  auditor_origin?: string | null;
  assigned_entity_type?: string | null;
  assigned_entity_code?: string | null;
  assigned_org_tree_id?: number | null;
  created_by_entity_code?: string | null;
  auditor_type?: string | null;
  plan_limits?: {
    company_level: number;
    department: number;
    audits: number;
    checklists: number;
    auditors: number;
    auditor_eval: boolean;
    company_to_company: boolean;
  };
  onboarding_completed?: boolean;
  onboarding_skipped?: boolean;
  onboarding_completed_at?: string | null;
  profile_image?: string | null;
}

export interface AccountInfo {
  role: string;
  user_code: string;
  first_name: string;
  last_name: string;
  account_type: string | null;
  entity_type: string | null;
  entity_code: string | null;
  org_level: number;
  user_type: string | null;
  auditor_origin?: string | null;
  auditor_type?: string | null;
  profile_image?: string | null;
}

/** The workspace package: "Package" (Company package) or "Custom" (quoted account); null until paid. */
export interface SubscriptionStatus {
  has_subscription: boolean;
  plan_name: string | null;
  billing_cycle: string | null;
  start_date: string | null;
  end_date: string | null;
  is_active: boolean;
  is_expired: boolean;
}

interface AuthState {
  admin: Admin | null;
  accounts: AccountInfo[];
  subscription: SubscriptionStatus | null;
  accessToken: string | null;
  refreshToken: string | null;
  isLoading: boolean;
}

interface AuthContextType extends AuthState {
  login: (payload: LoginPayload) => Promise<{ success: boolean; message?: string; role?: string; subscriptionExpired?: boolean; subscription?: SubscriptionStatus; paymentRequired?: boolean; customSolutionPending?: boolean; emailVerificationRequired?: boolean; email?: string; payment?: PaymentDetails | null }>;
  register: (payload: RegisterPayload) => Promise<{ success: boolean; message?: string }>;
  logout: () => Promise<void>;
  switchAccount: (targetRole: string, password?: string) => Promise<{ success: boolean; message?: string; needsPassword?: boolean }>;
  refreshMe: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

function normalizeAccountType(accountType: string | null | undefined): string | null {
  if (!accountType) return null;
  // Backend stores audit firms as "Audit Firm Company"; UI treats this as "Audit Firm".
  if (accountType === "Audit Firm Company") return "Audit Firm";
  return accountType;
}

function normalizeRole(role: string | null | undefined): string {
  return role === "entity_head" ? "organization_user" : String(role || "");
}

const LAST_ROLE_BY_EMAIL_STORAGE_KEY = "audito_last_role_by_email";

function normalizedEmail(email: string | null | undefined) {
  return String(email || "").trim().toLowerCase();
}

function getLastRoleForEmail(email: string) {
  try {
    const roles = JSON.parse(localStorage.getItem(LAST_ROLE_BY_EMAIL_STORAGE_KEY) || "{}") as Record<string, string>;
    const role = roles[normalizedEmail(email)];
    return role ? normalizeRole(role) : undefined;
  } catch {
    return undefined;
  }
}

function rememberLastRoleForEmail(email: string | null | undefined, role: string | null | undefined) {
  const key = normalizedEmail(email);
  if (!key || !role) return;
  try {
    const roles = JSON.parse(localStorage.getItem(LAST_ROLE_BY_EMAIL_STORAGE_KEY) || "{}") as Record<string, string>;
    roles[key] = normalizeRole(role);
    localStorage.setItem(LAST_ROLE_BY_EMAIL_STORAGE_KEY, JSON.stringify(roles));
  } catch {
    // A saved role is only a convenience preference. Login remains fully functional without it.
  }
}

function normalizeBoolean(value: unknown): boolean {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") {
    const normalized = value.toLowerCase().trim();
    return normalized === "yes" || normalized === "true" || normalized === "1";
  }
  if (typeof value === "number") return value === 1;
  return false;
}

function normalizeAuthState(input: AuthState): AuthState {
  return {
    ...input,
    admin: input.admin
      ? {
          ...input.admin,
          role: normalizeRole(input.admin.role),
          account_type: normalizeAccountType(input.admin.account_type),
          plan_limits: input.admin.plan_limits
            ? {
                ...input.admin.plan_limits,
                auditor_eval: normalizeBoolean(input.admin.plan_limits.auditor_eval),
                company_to_company: normalizeBoolean(input.admin.plan_limits.company_to_company),
              }
            : undefined,
        }
      : null,
    accounts: (input.accounts || []).map((a) => ({
      ...a,
      role: normalizeRole(a.role),
      account_type: normalizeAccountType(a.account_type),
    })),
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({
    admin: null,
    accounts: [],
    subscription: null,
    accessToken: null,
    refreshToken: null,
    isLoading: true,
  });
  const loginPasswordRef = useRef<string | null>(null);
  // Latest session, readable from callbacks that outlive a render (token refresh).
  const stateRef = useRef<AuthState>(state);
  stateRef.current = state;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const stored = await readStoredAuth().catch(() => null);
      let restored: AuthState | null = null;
      if (stored) {
        try {
          restored = normalizeAuthState({ accounts: [], ...JSON.parse(stored), isLoading: false } as AuthState);
        } catch {
          restored = null;
        }
      }
      // The Android app only ever restores an auditor session.
      if (restored && isNativeApp() && restored.admin?.role !== NATIVE_APP_ROLE) {
        await clearStoredAuth();
        restored = null;
      }
      if (cancelled) return;
      if (restored) {
        stateRef.current = restored;
        setState(restored);
      } else {
        setState((s) => ({ ...s, isLoading: false }));
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const persist = useCallback((admin: Admin, accounts: AccountInfo[], accessToken: string, refreshToken: string, subscription: SubscriptionStatus | null = null) => {
    const data: AuthState = normalizeAuthState({
      admin,
      accounts,
      subscription,
      accessToken,
      refreshToken,
      isLoading: false,
    });
    // Updated at once so a request that refreshes right after uses the new tokens.
    stateRef.current = data;
    void writeStoredAuth(JSON.stringify(data)).catch(() => { /* the session still works until the app closes */ });
    setState(data);
  }, []);

  const clearSession = useCallback(() => {
    loginPasswordRef.current = null;
    const signedOut: AuthState = { admin: null, accounts: [], subscription: null, accessToken: null, refreshToken: null, isLoading: false };
    stateRef.current = signedOut;
    void clearStoredAuth();
    setState(signedOut);
  }, []);

  const login = useCallback(
    async (payload: LoginPayload) => {
      const native = isNativeApp();
      if (native) {
        const configProblem = nativeApiConfigProblem();
        if (configProblem) return { success: false, message: configProblem };
      }
      const preferredRole = native ? undefined : getLastRoleForEmail(payload.email);
      // The Android app asks the server for the auditor account only; it never falls back to another role.
      const res = await authApi.login(native
        ? { email: payload.email, password: payload.password, required_role: NATIVE_APP_ROLE }
        : { ...payload, ...(preferredRole ? { preferred_role: preferredRole } : {}) }) as {
        success: boolean;
        data?: { admin?: Admin; accounts?: AccountInfo[]; subscription?: SubscriptionStatus; subscription_expired?: boolean; payment_required?: boolean; custom_solution_pending?: boolean; email_verification_required?: boolean; email?: string; payment?: PaymentDetails | null; tokens?: { accessToken: string; refreshToken: string } };
        message?: string;
      };
      // Expired plan: backend returns success with a flag (no tokens). Block the
      // sign-in so the login page shows the renew modal instead of navigating.
      if (res.success && res.data?.subscription_expired) {
        return { success: false, message: res.message, subscriptionExpired: true, subscription: res.data.subscription, payment: res.data.payment ?? null };
      }
      // Registration payment never completed: block sign-in and send to payment.
      if (res.success && res.data?.payment_required) {
        return { success: false, message: res.message, paymentRequired: true, payment: res.data.payment ?? null };
      }
      // Custom registrations wait for an Audito admin to set the tailored
      // price. Do not establish a session until that review is complete.
      if (res.success && res.data?.custom_solution_pending) {
        return { success: false, message: res.message, customSolutionPending: true };
      }
      if (res.success && res.data?.email_verification_required) {
        return { success: false, message: res.message, emailVerificationRequired: true, email: res.data.email };
      }
      if (res.success && res.data?.admin && res.data?.tokens) {
        // Checked before anything is stored: the app keeps auditor sessions only.
        if (native && normalizeRole(res.data.admin.role) !== NATIVE_APP_ROLE) {
          void authApi.logout(res.data.tokens.refreshToken).catch(() => { });
          return { success: false, message: "The Audito app is for auditor accounts. Sign in with your auditor email and password." };
        }
        if (!native) loginPasswordRef.current = payload.password;
        rememberLastRoleForEmail(res.data.admin.email, res.data.admin.role);
        persist(res.data.admin, res.data.accounts || [], res.data.tokens.accessToken, res.data.tokens.refreshToken, res.data.subscription ?? null);
        // Return the role so login page can redirect correctly
        return { success: true, message: res.message, role: res.data.admin.role };
      }
      return { success: res.success, message: res.message };
    },
    [persist]
  );

  const register = useCallback(
    async (payload: RegisterPayload) => {
      const res = await authApi.register(payload) as {
        success: boolean;
        data?: { admin: Admin; tokens: { accessToken: string; refreshToken: string } };
        message?: string;
      };
      if (res.success && res.data) {
        persist(res.data.admin, [], res.data.tokens.accessToken, res.data.tokens.refreshToken);
      }
      return { success: res.success, message: res.message };
    },
    [persist]
  );

  const switchAccount = useCallback(
    async (targetRole: string, password?: string) => {
      if (!state.accessToken) return { success: false, message: "Not authenticated" };
      if (isNativeApp()) return { success: false, message: "Switching accounts is not available in the Audito app." };

      const pw = password ?? loginPasswordRef.current;
      if (!pw) return { success: false, message: "Password required.", needsPassword: true };

      const res = await authApi.switchAccount(state.accessToken, targetRole, pw) as {
        success: boolean;
        data?: { admin: Admin; subscription?: SubscriptionStatus; tokens: { accessToken: string; refreshToken: string } };
        message?: string;
      };
      if (res.success && res.data) {
        loginPasswordRef.current = pw;
        rememberLastRoleForEmail(res.data.admin.email, res.data.admin.role);
        persist(res.data.admin, state.accounts, res.data.tokens.accessToken, res.data.tokens.refreshToken, res.data.subscription ?? null);
        return { success: true };
      }

      // If auto-try with stored password failed and no explicit password was given, signal modal
      if (!password && loginPasswordRef.current) {
        return { success: false, message: res.message, needsPassword: true };
      }
      return { success: res.success, message: res.message };
    },
    [state.accessToken, state.accounts, persist]
  );

  const logout = useCallback(async () => {
    if (state.refreshToken) {
      await authApi.logout(state.refreshToken).catch(() => { });
    }
    clearSession();
  }, [state.refreshToken, clearSession]);

  // ── Auto-logout when API returns 401 (token expired) ───────────
  useEffect(() => {
    const handleExpired = () => {
      // Only act if a session exists — avoids firing on login page 401s
      const hasSession = isNativeApp() ? Boolean(stateRef.current.accessToken) : Boolean(localStorage.getItem(AUTH_STORAGE_KEY));
      if (!hasSession) return;
      clearSession();
    };
    window.addEventListener("auth:expired", handleExpired);
    return () => window.removeEventListener("auth:expired", handleExpired);
  }, [clearSession]);

  // ── Android app: renew the session with the refresh token ──────
  useEffect(() => {
    if (!isNativeApp()) return;
    setSessionRefresher(async () => {
      const current = stateRef.current;
      if (!current.admin || !current.refreshToken) return null;
      try {
        const res = await fetch(`${apiBaseUrl()}/auth/refresh-token`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ refresh_token: current.refreshToken, required_role: NATIVE_APP_ROLE }),
        });
        // A server error is not a sign-out: keep the session and let the user retry.
        if (res.status >= 500) return "offline";
        const json = await res.json().catch(() => null);
        const tokens = json?.data?.tokens;
        if (!res.ok || !json?.success || !tokens?.accessToken || !tokens?.refreshToken) return null;
        // Another refresh or sign-out may have happened meanwhile; keep only a still-current session.
        if (stateRef.current.refreshToken !== current.refreshToken || !stateRef.current.admin) return null;
        persist(stateRef.current.admin, stateRef.current.accounts, tokens.accessToken, tokens.refreshToken, stateRef.current.subscription);
        return tokens.accessToken as string;
      } catch {
        return "offline";
      }
    });
    return () => setSessionRefresher(null);
  }, [persist]);

  // Sync auth state across tabs
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === "audito_auth") {
        if (e.newValue) {
          try {
            const parsed = JSON.parse(e.newValue);
            setState(normalizeAuthState({ accounts: [], ...parsed, isLoading: false } as AuthState));
          } catch {
            // fallback
          }
        } else {
          // Logged out in another tab
          setState({ admin: null, accounts: [], subscription: null, accessToken: null, refreshToken: null, isLoading: false });
        }
      }
    };

    window.addEventListener("storage", handleStorageChange);
    return () => window.removeEventListener("storage", handleStorageChange);
  }, []);

  // Auto-logout after 30 minutes of inactivity
  useEffect(() => {
    if (!state.accessToken) return;

    let timeoutId: NodeJS.Timeout;

    const resetTimer = () => {
      if (timeoutId) clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        logout();
      }, 30 * 60 * 1000); // 30 minutes
    };

    const activityEvents = ["mousedown", "mousemove", "keypress", "scroll", "touchstart"];
    
    activityEvents.forEach((event) => {
      window.addEventListener(event, resetTimer);
    });

    resetTimer(); // Initialize timer

    return () => {
      if (timeoutId) clearTimeout(timeoutId);
      activityEvents.forEach((event) => {
        window.removeEventListener(event, resetTimer);
      });
    };
  }, [state.accessToken, logout]);

  const refreshMe = useCallback(async () => {
    if (!state.accessToken) return;
    const res = await authApi.getMe(state.accessToken) as {
      success: boolean;
      data?: { admin: Admin; accounts: AccountInfo[]; subscription?: SubscriptionStatus };
    };
    // Tokens may have been renewed while this request ran; keep the newest.
    const latest = stateRef.current;
    if (res.success && res.data && latest.accessToken && latest.refreshToken) {
      if (isNativeApp() && normalizeRole(res.data.admin.role) !== NATIVE_APP_ROLE) {
        await logout();
        return;
      }
      persist(res.data.admin, res.data.accounts || latest.accounts, latest.accessToken, latest.refreshToken, res.data.subscription ?? null);
    }
  }, [state.accessToken, persist, logout]);

  // ── Android app: confirm the session on start and whenever the app returns ──
  // Expired tokens are renewed, revoked or deactivated accounts are signed out.
  const refreshMeRef = useRef(refreshMe);
  refreshMeRef.current = refreshMe;
  const sessionChecked = useRef(false);
  useEffect(() => {
    if (!isNativeApp() || state.isLoading || !state.accessToken || sessionChecked.current) return;
    sessionChecked.current = true;
    void refreshMeRef.current();
  }, [state.isLoading, state.accessToken]);
  useEffect(() => {
    if (!isNativeApp()) return;
    const listener = NativeApp.addListener("resume", () => {
      if (stateRef.current.accessToken) void refreshMeRef.current();
    });
    return () => { void listener.then((handle) => handle.remove()); };
  }, []);

  return (
    <AuthContext.Provider value={{ ...state, login, register, logout, switchAccount, refreshMe }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
