"use client";

import { createContext, useContext, useState, useEffect, useCallback, useRef, type ReactNode } from "react";
import { authApi, type LoginPayload, type RegisterPayload, type PaymentDetails } from "@/lib/api";

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

export interface SubscriptionStatus {
  has_subscription: boolean;
  plan_name: string;
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
  login: (payload: LoginPayload) => Promise<{ success: boolean; message?: string; subscriptionExpired?: boolean; subscription?: SubscriptionStatus; paymentRequired?: boolean; payment?: PaymentDetails | null }>;
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

  useEffect(() => {
    const stored = localStorage.getItem("audito_auth");
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        setState(
          normalizeAuthState({ accounts: [], ...parsed, isLoading: false } as AuthState)
        );
      } catch {
        setState((s) => ({ ...s, isLoading: false }));
      }
    } else {
      setState((s) => ({ ...s, isLoading: false }));
    }
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
    localStorage.setItem("audito_auth", JSON.stringify(data));
    setState(data);
  }, []);

  const login = useCallback(
    async (payload: LoginPayload) => {
      const res = await authApi.login(payload) as {
        success: boolean;
        data?: { admin?: Admin; accounts?: AccountInfo[]; subscription?: SubscriptionStatus; subscription_expired?: boolean; payment_required?: boolean; payment?: PaymentDetails | null; tokens?: { accessToken: string; refreshToken: string } };
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
      if (res.success && res.data?.admin && res.data?.tokens) {
        loginPasswordRef.current = payload.password;
        persist(res.data.admin, res.data.accounts || [], res.data.tokens.accessToken, res.data.tokens.refreshToken, res.data.subscription ?? null);
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

      const pw = password ?? loginPasswordRef.current;
      if (!pw) return { success: false, message: "Password required.", needsPassword: true };

      const res = await authApi.switchAccount(state.accessToken, targetRole, pw) as {
        success: boolean;
        data?: { admin: Admin; subscription?: SubscriptionStatus; tokens: { accessToken: string; refreshToken: string } };
        message?: string;
      };
      if (res.success && res.data) {
        loginPasswordRef.current = pw;
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
    loginPasswordRef.current = null;
    localStorage.removeItem("audito_auth");
    setState({ admin: null, accounts: [], subscription: null, accessToken: null, refreshToken: null, isLoading: false });
  }, [state.refreshToken]);

  // ── Auto-logout when API returns 401 (token expired) ───────────
  useEffect(() => {
    const handleExpired = () => {
      // Only act if a session exists — avoids firing on login page 401s
      if (!localStorage.getItem("audito_auth")) return;
      loginPasswordRef.current = null;
      localStorage.removeItem("audito_auth");
      setState({ admin: null, accounts: [], subscription: null, accessToken: null, refreshToken: null, isLoading: false });
    };
    window.addEventListener("auth:expired", handleExpired);
    return () => window.removeEventListener("auth:expired", handleExpired);
  }, []);

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
    if (res.success && res.data && state.refreshToken) {
      persist(res.data.admin, res.data.accounts || state.accounts, state.accessToken, state.refreshToken, res.data.subscription ?? null);
    }
  }, [state.accessToken, state.refreshToken, state.accounts, persist]);

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