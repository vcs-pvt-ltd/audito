import type { AuditoContact } from "./auditoContact";
import { apiBaseUrl, nativeApiConfigProblem } from "./apiConfig";
import { isNativeApp } from "./native/platform";

const NETWORK_ERROR_MESSAGE = "Unable to connect right now. Please check your connection and try again.";

function getFriendlyNetworkErrorMessage(error: unknown, fallback = NETWORK_ERROR_MESSAGE): string {
  if (error instanceof Error && /failed to fetch|networkerror|load failed/i.test(error.message)) {
    return NETWORK_ERROR_MESSAGE;
  }

  return fallback;
}

// ─── Android app session refresh ──────────────────────────────────
// The website signs out when an access token expires. The Android app first
// exchanges its refresh token (AuthContext registers how) and retries once.

/** A new access token, "offline" when the server could not be reached, or null when the session is over. */
type SessionRefresher = () => Promise<string | "offline" | null>;

let sessionRefresher: SessionRefresher | null = null;
let refreshInFlight: Promise<string | "offline" | null> | null = null;

export function setSessionRefresher(refresher: SessionRefresher | null) {
  sessionRefresher = refresher;
}

/** Refreshes the Android app session once, however many requests ask at the same time. */
export function refreshNativeSession(): Promise<string | "offline" | null> {
  if (!sessionRefresher) return Promise.resolve(null);
  if (!refreshInFlight) {
    refreshInFlight = sessionRefresher().finally(() => { refreshInFlight = null; });
  }
  return refreshInFlight;
}

function sessionEnded() {
  if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent("auth:expired"));
}

async function formDataRequest(
  endpoint: string,
  token: string,
  formData: FormData,
  method = "POST",
  retried = false
): Promise<any> {
  const configProblem = nativeApiConfigProblem();
  if (configProblem) return { success: false, message: configProblem };
  try {
    const res = await fetch(`${apiBaseUrl()}${endpoint}`, {
      method,
      headers: { Authorization: `Bearer ${token}` },
      body: formData,
    });
    const json = await res.json().catch(() => null);

    if (res.status === 401 && token && isNativeApp()) {
      const fresh = retried ? null : await refreshNativeSession();
      if (fresh === "offline") return { success: false, message: NETWORK_ERROR_MESSAGE };
      if (fresh) return formDataRequest(endpoint, fresh, formData, method, true);
      sessionEnded();
      return { success: false, message: "Your session has ended. Please sign in again." };
    }

    if (json) return json;
    return { success: false, message: `Request failed (${res.status}).` };
  } catch (error) {
    return { success: false, message: getFriendlyNetworkErrorMessage(error) };
  }
}

interface ApiOptions {
  method?: string;
  body?: Record<string, unknown>;
  token?: string;
  /** Internal: the request was already retried after an Android session refresh. */
  retried?: boolean;
}

async function apiRequest<T = unknown>(
  endpoint: string,
  options: ApiOptions = {}
): Promise<{ success: boolean; data?: T; message?: string }> {
  const { method = "GET", body, token } = options;

  if (endpoint.includes("undefined")) {
    console.error(`apiRequest: endpoint contains "undefined": ${method} ${endpoint}`);
    return { success: false, message: "Invalid request: missing identifier." };
  }

  const configProblem = nativeApiConfigProblem();
  if (configProblem) return { success: false, message: configProblem };

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  try {
    const res = await fetch(`${apiBaseUrl()}${endpoint}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });

    let json: any = null;
    try {
      json = await res.json();
    } catch {
      json = null;
    }

    // Android app: renew an expired session once and repeat the request.
    if (res.status === 401 && token && isNativeApp() && !options.retried && endpoint !== "/auth/refresh-token") {
      const fresh = await refreshNativeSession();
      if (fresh === "offline") return { success: false, message: NETWORK_ERROR_MESSAGE };
      if (fresh) return apiRequest<T>(endpoint, { ...options, token: fresh, retried: true });
    }

    // Android app: a deactivated account ends the session at once.
    if (res.status === 403 && token && isNativeApp() && json?.message === "Account is deactivated.") {
      sessionEnded();
      return { success: false, message: "This account has been deactivated." };
    }

    // Expired/invalid session on an authenticated request: broadcast so
    // AuthContext can auto-logout, and swallow the backend message so the
    // UI never surfaces "Token expired". Gated on `token` so login/public
    // 401s (e.g. wrong credentials) still return their message normally.
    if (res.status === 401 && token) {
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("auth:expired"));
      }
      return { success: false };
    }

    if (json && typeof json.success === 'boolean') {
      return json;
    }

    if (!res.ok) {
      return {
        success: false,
        message: (json && (json.message as string)) || `Request failed (${res.status})`,
      };
    }

    return {
      success: true,
      data: (json as T) ?? (undefined as unknown as T),
    };
  } catch (err: unknown) {
    return {
      success: false,
      message: getFriendlyNetworkErrorMessage(err),
    };
  }
}

// ─── Auth API ─────────────────────────────────────────────────────

export type AllEntityType =
  | "Customer" | "Buying Office" | "Supplier"
  | "Company" | "Cluster" | "Factory" | "Unit" | "Department" | "Section"
  | "Audit Firm" | "Audit Firm Company" | "Branch" | "Audit Firm Department";

export interface RegisterPayload {
  entity_type: AllEntityType;
  org_name: string;
  registration_number?: string;
  org_email?: string;
  address_line_1?: string;
  address_line_2?: string;
  address_line_3?: string;
  country?: string;
  org_phone_number?: string;
  company_type?: string;
  first_name: string;
  last_name: string;
  email: string;
  phone_number?: string;
  password: string;
  plan_name?: string;
  billing_cycle?: string;
  timezone?: string;
  organization_logo?: string | null;
  privacy_policy_id?: string;
  custom_solution?: {
    max_company_levels: number;
    max_departments: number;
    max_audits: number;
    max_checklists: number;
    max_auditors: number;
    allow_auditor_eval: boolean;
    allow_company_to_company: boolean;
  };
  package_selection?: { company_levels: number; departments: number; lines_per_audit: number; expected_token_unit_price: number; pricing_version: number };
}

export interface PrivacyPolicySection { title: string; content: string; }
export interface PrivacyPolicy {
  privacy_policy_id: string;
  title: string;
  version: string;
  intro: string;
  sections: PrivacyPolicySection[];
  status?: "draft" | "published" | "archived";
  is_current?: boolean;
  effective_date?: string | null;
  published_at?: string | null;
  agreement_count?: number;
  created_at?: string;
  updated_at?: string;
}

export interface LoginPayload {
  email: string;
  password: string;
  preferred_role?: string;
  /** "auditor" from the Android app: sign in to the auditor account only. */
  required_role?: "auditor";
}

export interface OnboardingStatus {
  onboarding_completed: boolean;
  onboarding_skipped: boolean;
  onboarding_completed_at: string | null;
}

export const authApi = {
  getQuoteRegistration: (token: string) =>
    apiRequest<{ quote: QuoteRegistrationView; contact: AuditoContact }>(`/auth/quote-registration/${encodeURIComponent(token)}`),
  registerFromQuote: (data: QuoteRegistrationPayload) =>
    apiRequest<{ payment: { payment_code: string; plan_name: string; amount: number; currency: string } }>("/auth/quote-registration", { method: "POST", body: data as unknown as Record<string, unknown> }),
  register: (data: RegisterPayload) =>
    apiRequest("/auth/register", { method: "POST", body: data as unknown as Record<string, unknown> }),

  login: (data: LoginPayload) =>
    apiRequest("/auth/login", { method: "POST", body: data as unknown as Record<string, unknown> }),

  refreshToken: (refresh_token: string, required_role?: "auditor") =>
    apiRequest("/auth/refresh-token", {
      method: "POST",
      body: { refresh_token, ...(required_role ? { required_role } : {}) },
    }),

  logout: (refresh_token: string) =>
    apiRequest("/auth/logout", { method: "POST", body: { refresh_token } }),

  getMe: (token: string) =>
    apiRequest("/auth/me", { token }),

  changePassword: (
    token: string,
    current_password: string,
    new_password: string
  ) =>
    apiRequest("/auth/change-password", {
      method: "PUT",
      body: { current_password, new_password },
      token,
    }),

  forgotPassword: (email: string) =>
    apiRequest("/auth/forgot-password", {
      method: "POST",
      body: { email },
    }),

  resendVerification: (email: string) =>
    apiRequest("/auth/resend-verification", {
      method: "POST",
      body: { email },
    }),

  verifyOtp: (email: string, otp: string) =>
    apiRequest("/auth/verify-otp", {
      method: "POST",
      body: { email, otp },
    }),

  verifyEmail: (token: string) =>
    apiRequest("/auth/verify-email", {
      method: "POST",
      body: { token },
    }),

  resetPassword: (email: string, reset_token: string, new_password: string) =>
    apiRequest("/auth/reset-password", {
      method: "POST",
      body: { email, reset_token, new_password },
    }),

  setAdminPassword: (token: string, password: string) =>
    apiRequest("/auth/set-admin-password", {
      method: "POST",
      body: { token, password },
    }),

  checkRegistrationEmail: (email: string) =>
    apiRequest<{ available: boolean }>("/auth/check-registration-email", {
      method: "POST",
      body: { email },
    }),

  switchAccount: (token: string, target_role: string, password: string) =>
    apiRequest("/auth/switch-account", {
      method: "POST",
      body: { target_role, password },
      token,
    }),

  updateProfile: (
    token: string,
    data: { first_name: string; last_name: string; phone_number?: string; country?: string; profile_image?: string | null }
  ) =>
    apiRequest("/auth/profile", {
      method: "PUT",
      body: data as unknown as Record<string, unknown>,
      token,
    }),

  updateOrganization: (
    token: string,
    data: { name: string; registration_number?: string; email?: string; address_line_1?: string; address_line_2?: string; address_line_3?: string; country?: string; phone_number?: string; organization_logo?: string | null }
  ) =>
    apiRequest("/auth/organization", {
      method: "PUT",
      body: data as unknown as Record<string, unknown>,
      token,
    }),

  getOnboarding: (token: string) =>
    apiRequest<OnboardingStatus>("/auth/onboarding", { token }),

  updateOnboarding: (token: string, action: "complete" | "skip" | "reset") =>
    apiRequest<OnboardingStatus>("/auth/onboarding", {
      method: "PUT",
      body: { action },
      token,
    }),
};

// ─── Hierarchy API ────────────────────────────────────────────────

export const structureApi = {
  listByType: (token: string, entityType: string) =>
    apiRequest(`/structure/list/${entityType}`, { token }),

  createSubEntity: (token: string, data: Record<string, unknown>) =>
    apiRequest("/structure", { method: "POST", body: data, token }),

  updateSubEntity: (
    token: string,
    entityType: string,
    code: string,
    data: Record<string, unknown>
  ) =>
    apiRequest(`/structure/${entityType}/${code}`, {
      method: "PUT",
      body: data,
      token,
    }),

  deleteSubEntity: (token: string, entityType: string, code: string) =>
    apiRequest(`/structure/${entityType}/${code}`, {
      method: "DELETE",
      token,
    }),
};

// ─── Organization Tree API ────────────────────────────────────────

export const orgTreeApi = {
  getTree: (token: string) =>
    apiRequest("/org-tree", { token }),

  addNode: (
    token: string,
    data: { parent_code: string; child_type: string; child_code: string }
  ) =>
    apiRequest("/org-tree", {
      method: "POST",
      body: data as unknown as Record<string, unknown>,
      token,
    }),

  removeNode: (token: string, id: string) =>
    apiRequest(`/org-tree/${id}`, { method: "DELETE", token }),

  listEntities: (token: string, entityType: string) =>
    apiRequest(`/org-tree/entities/${entityType}`, { token }),

  syncTree: (
    token: string,
    data: {
      adds: { parent_code: string; parent_edge_id?: string | null; child_type: string; child_code: string }[];
      removes: string[];
    }
  ) =>
    apiRequest("/org-tree/sync", {
      method: "POST",
      body: data as unknown as Record<string, unknown>,
      token,
    }),
};

// ─── AI Organization Setup API ────────────────────────────────────

export interface OrganizationAiDraftNode {
  id: string;
  parent_id: string | null;
  name: string;
  entity_type: string;
  confidence: number | null;
  is_ai_generated: boolean;
  source_entity_code?: string | null;
  source_edge_id?: string | null;
  reuse_source_node_id?: string | null;
  baseline_name?: string | null;
  baseline_parent_id?: string | null;
  is_removed?: boolean;
  is_locked?: boolean;
  lock_reasons?: string[];
  change_type?: "added" | "updated" | "removed" | "unchanged";
}

export interface OrganizationAiSetupSession {
  onboarding_draft?: OnboardingDraft | null;
  published_checklist_id?: string | null;
  organization_ai_setup_session_id: string;
  root_entity_code: string;
  root_entity_type: string;
  account_type: string;
  setup_mode: "create" | "update";
  status: "draft" | "analyzing" | "ready" | "publishing" | "published" | "failed" | "discarded";
  summary: string | null;
  warnings: string[];
  error_message?: string | null;
  model_name?: string | null;
  updated_at?: string;
}

export interface OrganizationAiSetupPayload {
  review_token?: string | null;
  evidence_available?: boolean;
  plan_issue?: string | null;
  analysis_progress?: { stage: string; done: number; total: number } | null;
  root_entity_name?: string | null;
  /** Existing entity records of the organization that are not in this draft. */
  entity_catalog?: { code: string; name: string; entity_type: string }[];
  session: OrganizationAiSetupSession;
  nodes: OrganizationAiDraftNode[];
}

export interface OrganizationAiSetupResponse extends OrganizationAiSetupPayload {
  assistant_message?: string;
}

export interface OrganizationAiChatMessage {
  role: "user" | "assistant";
  content: string;
}

export interface OnboardingQuestion {
  id: string;
  node_id: string | null;
  section?: string;
  question_text: string;
  answer_type: string;
  options: { option_text: string; marks: number | null }[];
  source_reference: string;
  origin: string;
  /** Provenance of the area, answer type and scores. */
  details_origin?: string;
  selected: boolean;
}
export interface OnboardingDraft {
  checklist: {
    name: string; description: string; type_name: string; checklist_type_id: string;
    time_period_value: number | null; time_period_unit: string;
    repeat_duration_value: number | null; repeat_duration_unit: string; source_reference: string;
    /** Entered by the user, not read from the document. */
    budget: number | null; currency: string; num_workers: number | null;
  };
  questions: OnboardingQuestion[];
  node_evidence: Record<string, { source_reference: string; origin: string; parent_origin?: string }>;
  entity_catalog_included?: boolean;
  /** Setup reads the organization first, then the questions after it is verified. */
  structure_read?: boolean;
  questions_generated?: boolean;
  part_roles?: Record<string, string>;
}

export const organizationAiSetupApi = {
  completion: (token: string) => apiRequest<{ completed: boolean }>("/organization-ai-setup/completion", { token }),
  current: (token: string) =>
    apiRequest<OrganizationAiSetupPayload | null>("/organization-ai-setup/current", { token }),

  create: (token: string, combined = false) =>
    apiRequest<OrganizationAiSetupPayload>("/organization-ai-setup", { method: "POST", body: { combined }, token }),

  get: (token: string, id: string) =>
    apiRequest<OrganizationAiSetupPayload>(`/organization-ai-setup/${id}`, { token }),

  analyze: (token: string, id: string, documents: File[]) => {
    const formData = new FormData();
    documents.forEach((document) => formData.append("documents", document));
    return formDataRequest(`/organization-ai-setup/${id}/analyze`, token, formData) as Promise<{ success: boolean; data?: OrganizationAiSetupResponse; message?: string }>;
  },

  /** Reads the audit questions onto the saved, verified organization. */
  generateQuestions: (token: string, id: string) =>
    apiRequest<OrganizationAiSetupPayload>(`/organization-ai-setup/${id}/questions`, { method: "POST", token }),

  chat: (token: string, id: string, message: string, history: OrganizationAiChatMessage[]) =>
    apiRequest<OrganizationAiSetupResponse>(`/organization-ai-setup/${id}/chat`, { method: "POST", body: { message, history }, token }),

  update: (token: string, id: string, data: { nodes: OrganizationAiDraftNode[]; summary?: string; warnings?: string[]; onboarding_draft?: OnboardingDraft; review_token?: string | null }) =>
    apiRequest<OrganizationAiSetupPayload>(`/organization-ai-setup/${id}`, { method: "PUT", body: data as unknown as Record<string, unknown>, token }),

  discard: (token: string, id: string) =>
    apiRequest<null>(`/organization-ai-setup/${id}/discard`, { method: "POST", token }),

  publish: (token: string, id: string, reviewToken?: string | null) =>
    apiRequest<{ created_count?: number; updated_count?: number; removed_count?: number; checklist_id?: string | null; already_published?: boolean }>(`/organization-ai-setup/${id}/publish`, { method: "POST", body: { review_token: reviewToken }, token }),
};

// ─── Links API ────────────────────────────────────────────────────

export interface VisualScanTreeNode {
  org_tree_id: string | null;
  entity_code: string;
  entity_type: string;
  name: string;
  children: VisualScanTreeNode[];
}

export interface VisualScanIssue {
  summary: string;
  severity: "low" | "medium" | "high" | "critical";
  observations: string[];
  evidence_count: number;
}

export interface VisualScanResult {
  scene_summary: string;
  issue_summary: string;
  image_quality: "good" | "usable" | "poor";
  needs_another_image: boolean;
  safety_message: string;
  issues: VisualScanIssue[];
  location: {
    entity_code: string;
    org_tree_id: string | null;
    entity_type: string;
    name: string;
  };
  context_used: {
    internal_evidence_records: number;
    historical_issue_examples: number;
    historical_comparison_examples: number;
  };
}

export const visualScanApi = {
  getContext: (token: string) =>
    apiRequest<{ tree: VisualScanTreeNode }>("/visual-scans/context", { token }),

  analyze: (token: string, image: File, payload: {
    entity_code: string;
    org_tree_id: string | null;
    notes?: string;
  }) => {
    const formData = new FormData();
    formData.append("image", image);
    formData.append("entity_code", payload.entity_code);
    if (payload.org_tree_id) formData.append("org_tree_id", payload.org_tree_id);
    if (payload.notes?.trim()) formData.append("notes", payload.notes.trim());
    return formDataRequest("/visual-scans/analyze", token, formData) as Promise<{
      success: boolean;
      data?: VisualScanResult;
      message?: string;
    }>;
  },
};

export const linksApi = {
  getMyLinks: (token: string) =>
    apiRequest("/links", { token }),

  getPendingLinks: (token: string) =>
    apiRequest("/links/pending", { token }),

  previewTarget: (token: string, target_email: string) =>
    apiRequest("/links/preview", {
      method: "POST",
      body: { target_email },
      token,
    }),

  createLink: (
    token: string,
    target_email: string,
    target: {
      entity_type: string;
      entity_code: string;
      target_org_tree_id: string | null;
    }
  ) =>
    apiRequest("/links", {
      method: "POST",
      body: {
        target_email,
        target_entity_type: target.entity_type,
        target_entity_code: target.entity_code,
        target_org_tree_id: target.target_org_tree_id,
      },
      token,
    }),

  respondToLink: (token: string, linkCode: string, action: "accept" | "reject", verification_key?: string) =>
    apiRequest(`/links/${linkCode}/respond`, {
      method: "PUT",
      body: verification_key ? { action, verification_key } : { action },
      token,
    }),

  regenerateVerificationKey: (token: string, linkCode: string) =>
    apiRequest(`/links/${linkCode}/key`, { method: "POST", token }),

  removeLink: (token: string, linkCode: string) =>
    apiRequest(`/links/${linkCode}`, { method: "DELETE", token }),

  getLinkedData: (token: string, linkCode: string) =>
    apiRequest(`/links/${linkCode}/data`, { token }),
};

// ─── Users API ────────────────────────────────────────────────────

export interface CreateUserPayload {
  first_name: string;
  last_name: string;
  email: string;
  phone_number?: string;
  country?: string;
  user_type: string;
  assigned_entity_code?: string;
  assigned_entity_type?: string;
  assigned_org_tree_id?: string;
  scopes?: OrganizationUserScopePayload[];
}

export interface OrganizationUserScopePayload {
  org_tree_id: string | null;
  entity_code: string;
  entity_type?: string | null;
  scope_mode: "EXACT" | "SUBTREE";
}

export const usersApi = {
  create: (token: string, data: CreateUserPayload) =>
    apiRequest("/users", {
      method: "POST",
      body: data as unknown as Record<string, unknown>,
      token,
    }),

  list: (token: string, userType?: string) =>
    apiRequest(
      `/users${userType ? `?user_type=${encodeURIComponent(userType)}` : ""}`,
      { token }
    ),

  get: (token: string, userCode: string) =>
    apiRequest(`/users/${userCode}`, { token }),

  update: (token: string, userCode: string, data: Record<string, unknown>) =>
    apiRequest(`/users/${userCode}`, { method: "PUT", body: data, token }),

  deleteUser: (token: string, userCode: string) =>
    apiRequest(`/users/${userCode}`, { method: "DELETE", token }),

  resendVerification: (token: string, userCode: string) =>
    apiRequest(`/users/${userCode}/resend`, { method: "POST", token }),

  checkAdminEmail: (token: string, email: string) =>
    apiRequest("/users/check-admin-email", {
      method: "POST",
      body: { email },
      token,
    }),

  createFromAdmin: (token: string, data: {
    email: string;
    user_type: string;
    assigned_entity_code?: string;
    assigned_entity_type?: string;
    assigned_org_tree_id?: string;
    scopes?: OrganizationUserScopePayload[];
  }) =>
    apiRequest("/users/create-from-admin", {
      method: "POST",
      body: data as unknown as Record<string, unknown>,
      token,
    }),

  // Public (no auth)
  verifyEmail: (emailToken: string) =>
    apiRequest("/users/verify-email", {
      method: "POST",
      body: { token: emailToken },
    }),

  setPassword: (email: string, password: string) =>
    apiRequest("/users/set-password", {
      method: "POST",
      body: { email, password },
    }),
};

// ─── Checklists API ───────────────────────────────────────────────

export interface ChecklistTypePayload {
  name: string;
  description?: string;
}

export interface ChecklistPayload {
  name: string;
  description?: string;
  media_path?: string;
  checklist_type_id?: number | string;
  time_period_value?: number | string;
  time_period_unit?: string;
  repeat_duration_value?: number | string;
  repeat_duration_unit?: string;
  budget?: number | string;
  currency?: string;
  num_workers?: number | string;
}

export interface QuestionOption {
  option_text: string;
  marks: number;
}

export interface QuestionPayload {
  checklist_question_id?: string;
  entity_code: string;
  org_tree_id?: string | null;
  entity_type: string;
  entity_name?: string;
  question_text: string;
  answer_type: "free_text" | "single_option" | "multiple_options" | "dropdown";
  total_marks?: number;
  order_index?: number;
  options?: QuestionOption[];
}

export interface AiChecklistQuestionSuggestion {
  ai_checklist_suggestion_id: string;
  entity_code: string;
  org_tree_id?: string | null;
  entity_type: string;
  entity_name: string;
  question_text: string;
  answer_type: QuestionPayload["answer_type"];
  options: Array<{ option_text: string; marks: number }>;
  source_reference?: string;
  rationale?: string;
}

export const checklistApi = {
  // Checklist types
  listTypes: (token: string) =>
    apiRequest("/checklists/types", { token }),
  createType: (token: string, data: ChecklistTypePayload) =>
    apiRequest("/checklists/types", { method: "POST", body: data as unknown as Record<string, unknown>, token }),
  updateType: (token: string, id: string, data: ChecklistTypePayload) =>
    apiRequest(`/checklists/types/${id}`, { method: "PUT", body: data as unknown as Record<string, unknown>, token }),
  deactivateType: (token: string, id: string) =>
    apiRequest(`/checklists/types/${id}`, { method: "DELETE", token }),

  // Checklists
  list: (token: string) =>
    apiRequest("/checklists", { token }),
  create: (token: string, data: ChecklistPayload) =>
    apiRequest("/checklists", { method: "POST", body: data as unknown as Record<string, unknown>, token }),
  get: (token: string, id: string) =>
    apiRequest(`/checklists/${id}`, { token }),
  update: (token: string, id: string, data: ChecklistPayload) =>
    apiRequest(`/checklists/${id}`, { method: "PUT", body: data as unknown as Record<string, unknown>, token }),
  deactivate: (token: string, id: string) =>
    apiRequest(`/checklists/${id}`, { method: "DELETE", token }),

  // Questions
  addQuestions: (token: string, checklistId: string, questions: QuestionPayload[]) =>
    apiRequest(`/checklists/${checklistId}/questions`, {
      method: "POST",
      body: { questions } as unknown as Record<string, unknown>,
      token,
    }),
  syncQuestions: (token: string, checklistId: string, questions: QuestionPayload[]) =>
    apiRequest(`/checklists/${checklistId}/questions`, {
      method: "PUT",
      body: { questions } as unknown as Record<string, unknown>,
      token,
    }),
  updateQuestion: (token: string, qid: string, data: Partial<QuestionPayload>) =>
    apiRequest(`/checklists/questions/${qid}`, {
      method: "PUT",
      body: data as unknown as Record<string, unknown>,
      token,
    }),
  deleteQuestion: (token: string, qid: string) =>
    apiRequest(`/checklists/questions/${qid}`, { method: "DELETE", token }),

  // Media upload
  uploadMedia: async (token: string, file: File) => {
    const formData = new FormData();
    formData.append("media_file", file);
    return formDataRequest("/checklists/upload-media", token, formData);
  },

  // Excel template download (with auth token)
  downloadExcelTemplate: async (token: string) => {
    try {
      const res = await fetch(`${apiBaseUrl()}/checklists/excel-template`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const json = await res.json().catch(() => null);
        throw new Error(json?.message || "Failed to download template.");
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "checklist_questions_template.xlsx";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      throw new Error(getFriendlyNetworkErrorMessage(error, "Unable to download the template. Please try again."));
    }
  },

  // Excel upload
  uploadQuestionsExcel: async (token: string, checklistId: string, file: File) => {
    const formData = new FormData();
    formData.append("questions_file", file);
    return formDataRequest(`/checklists/${checklistId}/questions/upload`, token, formData);
  },

  // Excel preview (no DB writes)
  previewQuestionsExcel: async (token: string, file: File) => {
    const formData = new FormData();
    formData.append("questions_file", file);
    return formDataRequest("/checklists/questions/preview-upload", token, formData);
  },

  // AI document analysis. Suggestions are returned as drafts and are not saved to a checklist.
  generateAiQuestions: async (token: string, file: File, payload: {
    focus?: string;
    checklistType?: string;
    scopeEntityCode?: string;
    scopeOrgTreeId?: string | null;
    existingQuestions?: string[];
    continueGeneration?: boolean;
  }) => {
    const formData = new FormData();
    formData.append("source_document", file);
    if (payload.focus) formData.append("focus", payload.focus);
    if (payload.checklistType) formData.append("checklist_type", payload.checklistType);
    if (payload.scopeEntityCode) formData.append("scope_entity_code", payload.scopeEntityCode);
    if (payload.scopeOrgTreeId) formData.append("scope_org_tree_id", payload.scopeOrgTreeId);
    if (payload.existingQuestions?.length) formData.append("existing_questions", JSON.stringify(payload.existingQuestions));
    if (payload.continueGeneration) formData.append("continue_generation", "true");
    return formDataRequest("/checklists/ai/generate-questions", token, formData);
  },

  finalizeAiSuggestions: (token: string, jobId: string, acceptedIds: string[]) =>
    apiRequest<{ accepted_count: number }>(`/checklists/ai/jobs/${jobId}/suggestions`, {
      method: "PUT",
      body: { accepted_ids: acceptedIds },
      token,
    }),
};


export interface AuditPayload {
  checklist_id: string;
  title: string;
  audit_type: "internal" | "external";
  assigned_auditor_id?: string;
  assigned_firm_code?: string;
  send_assignment_email?: boolean;
  assigned_org_tree_id?: string | null;
  budget?: number | string;
  currency?: string;
  num_workers?: number | string;
  start_date: string;
  end_date: string;
  notes?: string;
  status?: "plan" | "in_progress" | "completed";
  entities: Array<{ org_tree_id?: string | null; entity_code: string; entity_type: string; entity_name: string }>;
}

export interface AuditorRating {
  auditor_rating_id: string;
  audit_id: string;
  auditor_id: string;
  rated_by_admin_id: string;
  stars: number;
  comment: string | null;
  created_at: string;
  updated_at: string;
}

export const auditApi = {
  getChecklistEntities: (token: string, checklistId: string) =>
    apiRequest(`/audits/checklist/${checklistId}/entities`, { token }),

  create: (token: string, data: AuditPayload) =>
    apiRequest("/audits", { method: "POST", body: data as unknown as Record<string, unknown>, token }),

  quote: (token: string, data: Pick<AuditPayload, "checklist_id" | "entities" | "start_date">) =>
    apiRequest<{ quote: { required_tokens: number; available_tokens: number; shortage_tokens: number; can_assign: boolean } }>(
      "/audits/quote", { method: "POST", body: data as unknown as Record<string, unknown>, token }
    ),

  list: (token: string) =>
    apiRequest("/audits", { token }),

  get: (token: string, id: string) =>
    apiRequest(`/audits/${id}`, { token }),

  getAuditorRating: (token: string, id: string) =>
    apiRequest<{ rating: AuditorRating | null }>(`/audits/${id}/auditor-rating`, { token }),

  saveAuditorRating: (token: string, id: string, data: Pick<AuditorRating, "stars" | "comment">) =>
    apiRequest<{ rating: AuditorRating }>(`/audits/${id}/auditor-rating`, { method: "PUT", body: data, token }),

  update: (token: string, id: string, data: Partial<AuditPayload>) =>
    apiRequest(`/audits/${id}`, { method: "PUT", body: data as unknown as Record<string, unknown>, token }),

  delete: (token: string, id: string, password: string) =>
    apiRequest<{ deleted_caps: number; removed_media_files: number; media_cleanup_failed: number }>(
      `/audits/${id}`,
      { method: "DELETE", body: { password }, token }
    ),

  cancel: (token: string, id: string) =>
    apiRequest(`/audits/${id}/cancel`, { method: "POST", token }),

  restore: (token: string, id: string) =>
    apiRequest(`/audits/${id}/restore`, { method: "POST", token }),

  count: (token: string) =>
    apiRequest<{ count: number }>("/audits/count", { token }),

  comparisonCandidates: (token: string) =>
    apiRequest<{
      audits: Array<{
        audit_id: string;
        checklist_id: string;
        checklist_name: string;
        title: string;
        audit_type: "internal" | "external";
        start_date: string | null;
        end_date: string | null;
        completed_at: string | null;
        marks_obtained: number;
        total_marks: number;
        percentage: number;
      }>;
    }>("/audits/comparison/candidates", { token }),

  compare: (token: string, auditIds: string[]) =>
    apiRequest<{
      checklist: { name: string };
      audits: Array<{
        audit_id: string;
        title: string;
        audit_type: "internal" | "external";
        start_date: string | null;
        end_date: string | null;
        completed_at: string | null;
        marks_obtained: number;
        total_marks: number;
        percentage: number;
      }>;
      entity_tree: {
        code: string;
        name: string;
        entity_type: string;
        edge_id?: string | null;
        children: Array<unknown>;
      } | null;
      entities: Array<{
        entity_code: string;
        org_tree_id: string | null;
        entity_type: string;
        audits: Array<{
          audit_id: string;
          available: boolean;
          marks_obtained: number;
          total_marks: number;
          percentage: number;
          corrective_action_count: number;
          open_corrective_action_count: number;
        }>;
      }>;
      /** Retained temporarily for compatibility with older clients. The server no longer returns question-level comparison data. */
      sections: Array<{
        entity_type: string;
        audits: Array<{
          audit_id: string;
          marks_obtained: number;
          total_marks: number;
          percentage: number;
          answered_count: number;
          corrective_action_count: number;
          open_corrective_action_count: number;
        }>;
      }>;
      questions: Array<{
        entity_type: string;
        question_text: string;
        audits: Array<{
          audit_id: string;
          available: boolean;
          marks_obtained?: number;
          total_marks?: number;
          percentage?: number;
          status?: string;
          answer_summary?: string | null;
          remarks_summary?: string | null;
          evidence_count?: number;
          corrective_action_count?: number;
          open_corrective_action_count?: number;
        }>;
      }>;
      comparison_basis: string;
    }>("/audits/comparison", { method: "POST", body: { audit_ids: auditIds } as Record<string, unknown>, token }),
};

export interface DashboardFilters {
  from?: string;
  to?: string;
  status?: string;
  audit_type?: string;
  entity_code?: string;
  audit_code?: string;
}

export const dashboardApi = {
  overview: (token: string, filters: DashboardFilters = {}) => {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([key, value]) => {
      if (value) params.set(key, value);
    });
    const qs = params.toString();
    return apiRequest(`/dashboard/overview${qs ? `?${qs}` : ""}`, { token });
  },
};

// ─── Audit Execution API (Auditor) ───────────────────────────────

export const auditExecutionApi = {
  myAudits: (token: string) =>
    apiRequest("/audit-execution/my-audits", { token }),

  getDetail: (token: string, id: string) =>
    apiRequest(`/audit-execution/${id}`, { token }),

  getFirmProgressDetail: (token: string, id: string) =>
    apiRequest(`/audit-execution/${id}/firm-progress`, { token }),

  getEntityTree: (token: string, id: string) =>
    apiRequest(`/audit-execution/${id}/entity-tree`, { token }),

  getCorrectiveActions: (token: string, id: string) =>
    apiRequest(`/audit-execution/${id}/corrective-actions`, { token }),

  saveCorrectiveActions: (token: string, id: string, actions: Array<{
    response_id: string;
    entity_code: string;
    question_id: string;
    assigned_org_tree_id?: string | null;
    due_date?: string | null;
  }>) =>
    apiRequest(`/audit-execution/${id}/corrective-actions`, {
      method: "PUT",
      body: { actions } as unknown as Record<string, unknown>,
      token,
    }),

  start: (token: string, id: string) =>
    apiRequest(`/audit-execution/${id}/start`, { method: "POST", token }),

  respond: (token: string, id: string, data: {
    org_tree_id: string | null;
    entity_code: string;
    question_id: string;
    answer_text?: string;
    selected_option_ids?: string[];
    marks_obtained: number;
    remarks?: string;
    cap_required?: boolean;
  }) =>
    apiRequest(`/audit-execution/${id}/respond`, {
      method: "POST",
      body: data as unknown as Record<string, unknown>,
      token,
    }),

  getResponses: (token: string, id: string) =>
    apiRequest(`/audit-execution/${id}/responses`, { token }),

  getEntityResponses: (token: string, id: string, entityCode: string, orgTreeId: string) =>
    apiRequest(`/audit-execution/${id}/responses/${entityCode}?org_tree_id=${encodeURIComponent(orgTreeId)}`, { token }),

  uploadEvidence: async (token: string, id: string, responseId: string, file: File, fileType: string) => {
    const formData = new FormData();
    formData.append("evidence_file", file);
    formData.append("response_id", responseId);
    formData.append("file_type", fileType);
    return formDataRequest(`/audit-execution/${id}/evidence`, token, formData);
  },

  deleteEvidence: (token: string, evidenceId: string) =>
    apiRequest(`/audit-execution/evidence/${evidenceId}`, { method: "DELETE", token }),

  getProgress: (token: string, id: string) =>
    apiRequest(`/audit-execution/${id}/progress`, { token }),

  complete: (token: string, id: string) =>
    apiRequest(`/audit-execution/${id}/complete`, { method: "POST", token }),

  getReport: (token: string, id: string) =>
    apiRequest(`/audit-execution/${id}/report`, { token }),

  submitFollowUp: (token: string, id: string, data: {
    cap_id: string;
    verification: "pending" | "verified" | "rejected";
    notes?: string;
  }) =>
    apiRequest(`/audit-execution/${id}/follow-up-respond`, {
      method: "POST",
      body: data as unknown as Record<string, unknown>,
      token,
    }),

  getFollowUpResponses: (token: string, id: string) =>
    apiRequest(`/audit-execution/${id}/follow-up-responses`, { token }),
};

// ─── CAP API ──────────────────────────────────────────────────────

export const capApi = {
  // Create a CAP plan from corrective actions of a completed audit
  create: (token: string, data: {
    audit_id: string;
    parent_cap_id?: string;
    title?: string;
    description?: string;
  }) =>
    apiRequest("/caps", {
      method: "POST",
      body: data as unknown as Record<string, unknown>,
      token,
    }),

  list: (token: string, options?: { includeSubCaps?: boolean }) => {
    const qs = options?.includeSubCaps ? "?include_sub_caps=1" : "";
    return apiRequest(`/caps${qs}`, { token });
  },

  listByAudit: (token: string, auditId: string) =>
    apiRequest(`/caps/audit/${auditId}`, { token }),

  get: (token: string, id: string) =>
    apiRequest(`/caps/${id}`, { token }),

  delete: (token: string, id: string, password: string) =>
    apiRequest<{ deleted_caps: number; removed_media_files: number; media_cleanup_failed: number }>(
      `/caps/${id}`,
      { method: "DELETE", body: { password }, token }
    ),

  getFirmProgressDetail: (token: string, id: string) =>
    apiRequest(`/caps/${id}/firm-progress`, { token }),

  // Get CAP questions for execution view
  getItems: (token: string, id: string) =>
    apiRequest(`/caps/${id}/items`, { token }),

  // Submit a response to a CAP question
  respond: (token: string, id: string, data: {
    cap_question_id: string;
    response_text?: string;
  }) =>
    apiRequest(`/caps/${id}/respond`, {
      method: "POST",
      body: data as unknown as Record<string, unknown>,
      token,
    }),

  // Get all responses for a CAP
  getResponses: (token: string, id: string) =>
    apiRequest(`/caps/${id}/responses`, { token }),

  // Get entity-level progress for a CAP
  getProgress: (token: string, id: string) =>
    apiRequest(`/caps/${id}/progress`, { token }),

  // Mark CAP as completed
  complete: (token: string, id: string) =>
    apiRequest(`/caps/${id}/complete`, { method: "POST", token }),

  assign: (token: string, id: string, data: {
    responsible_person_code: string;
    responsible_person_name?: string;
    due_date: string;
  }) =>
    apiRequest(`/caps/${id}/assign`, {
      method: "PUT",
      body: data as unknown as Record<string, unknown>,
      token,
    }),

  updateStatus: (token: string, id: string, data: {
    status: string;
    resolution_notes?: string;
  }) =>
    apiRequest(`/caps/${id}/status`, {
      method: "PUT",
      body: data as unknown as Record<string, unknown>,
      token,
    }),

  resolve: (token: string, id: string, resolution_notes?: string) =>
    apiRequest(`/caps/${id}/resolve`, {
      method: "PUT",
      body: { resolution_notes } as unknown as Record<string, unknown>,
      token,
    }),

  uploadEvidence: async (token: string, capId: string, responseId: string, file: File, fileType: string) => {
    const formData = new FormData();
    formData.append("evidence_file", file);
    formData.append("response_id", responseId);
    formData.append("file_type", fileType);
    return formDataRequest(`/caps/${capId}/evidence`, token, formData);
  },

  deleteEvidence: (token: string, evidenceId: string) =>
    apiRequest(`/caps/evidence/${evidenceId}`, { method: "DELETE", token }),

  createFollowUp: (token: string, data: {
    parent_audit_id: string;
    title: string;
  assigned_auditor_id?: string;
    start_date: string;
    end_date: string;
    notes?: string;
  }) =>
    apiRequest("/caps/create-follow-up", {
      method: "POST",
      body: data as unknown as Record<string, unknown>,
      token,
    }),

  getCorrectiveActions: (token: string, id: string) =>
    apiRequest(`/caps/${id}/corrective-actions`, { token }),

  saveCorrectiveActions: (token: string, id: string, actions: Array<{
    response_id: string;
    entity_code: string;
    question_id: string;
    assigned_org_tree_id?: string | null;
    due_date?: string | null;
  }>) =>
    apiRequest(`/caps/${id}/corrective-actions`, {
      method: "PUT",
      body: { actions } as unknown as Record<string, unknown>,
      token,
    }),

  getOrganizationUsers: (token: string, entityCode: string) =>
    apiRequest(`/caps/organization-users/${entityCode}`, { token }),
};

// ─── Countries API (external) ─────────────────────────────────────

const COUNTRIES_API = "https://general.apivcm.shop/api/countries";

export interface Country {
  id: number;
  country: string;
  country_code: string;
  international_dialing: string;
  flag: string;
}

export const countriesApi = {
  /** Fetch all countries (handles pagination automatically) */
  getAll: async (): Promise<Country[]> => {
    const all: Country[] = [];
    let offset = 0;
    const limit = 100;
    let total = Infinity;

    try {
      while (offset < total) {
        const res = await fetch(`${COUNTRIES_API}?limit=${limit}&offset=${offset}`);
        const json = await res.json();
        if (!json.success || !json.data) break;
        all.push(...json.data);
        total = json.pagination?.total ?? json.data.length;
        offset += limit;
      }
    } catch {
      return [];
    }

    // Sort alphabetically by country name
    return all.sort((a, b) => a.country.localeCompare(b.country));
  },
};

// ─── Settings API ──────────────────────────────────────────────────

const TIMEZONES_API = "https://general.apivcm.shop/api/timezones";

export interface TimezoneOption {
  id: number;
  timezone_value: string;
  timezone_label: string;
  timezone_offset: string;
  isActive?: number;
}

export const timezonesApi = {
  /** Fetch all active timezones from the shared general API. */
  getAll: async (): Promise<TimezoneOption[]> => {
    const all: TimezoneOption[] = [];
    let offset = 0;
    const limit = 100;
    let total = Infinity;

    try {
      while (offset < total) {
        const res = await fetch(`${TIMEZONES_API}?limit=${limit}&offset=${offset}`);
        const json = await res.json();
        const data = Array.isArray(json) ? json : json?.data;

        if (!Array.isArray(data)) break;

        all.push(...data);
        total = json?.pagination?.total ?? data.length;

        if (Array.isArray(json) || data.length < limit) break;
        offset += limit;
      }
    } catch {
      return [];
    }

    const seen = new Set<string>();
    return all
      .filter((tz) => {
        if (!tz?.timezone_value || tz.isActive === 0) return false;
        if (seen.has(tz.timezone_value)) return false;
        seen.add(tz.timezone_value);
        return true;
      })
      .map((tz) => ({
        ...tz,
        timezone_value: String(tz.timezone_value),
        timezone_label: String(tz.timezone_label || tz.timezone_value),
        timezone_offset: String(tz.timezone_offset || ""),
      }))
      .sort((a, b) => a.timezone_label.localeCompare(b.timezone_label));
  },
};

export const settingsApi = {
  getTimezone: (token: string) =>
    apiRequest<{ timezone: string }>("/settings/timezone", { token }),

  setTimezone: (token: string, timezone: string) =>
    apiRequest("/settings/timezone", {
      method: "PUT",
      body: { timezone },
      token,
    }),

  listNoticeAuditors: (token: string) =>
    apiRequest<{ auditors: unknown[] }>('/settings/notices/auditors', { token }),

  getNotices: (token: string) =>
    apiRequest<{ notices: unknown[] }>('/settings/notices', { token }),

  createNotice: (token: string, payload: Record<string, unknown>) =>
    apiRequest('/settings/notices', { method: 'POST', body: payload, token }),

  updateNotice: (token: string, id: string, payload: Record<string, unknown>) =>
    apiRequest(`/settings/notices/${id}`, { method: 'PUT', body: payload, token }),

  deleteNotice: (token: string, id: string) =>
    apiRequest(`/settings/notices/${id}`, { method: 'DELETE', token }),
};

// ─── Notices API ───────────────────────────────────────────────────

export const noticeApi = {
  getMyNotices: (token: string) => apiRequest<{ notices: unknown[] }>('/notices', { token }),
  markAllRead: (token: string) => apiRequest('/notices/read-all', { method: 'PATCH', token }),
  markRead: (token: string, id: string) =>
    apiRequest(`/notices/${id}/read`, { method: 'PATCH', token }),
  markUnread: (token: string, id: string) =>
    apiRequest(`/notices/${id}/unread`, { method: 'PATCH', token }),
  deleteMine: (token: string, id: string) =>
    apiRequest(`/notices/${id}`, { method: 'DELETE', token }),
};

// ─── Auditor Profile API ──────────────────────────────────────────

export const auditorProfileApi = {
  getProfile: (token: string) =>
    apiRequest("/auditor-profile", { token }),

  updateProfile: async (token: string, data: Record<string, any>, files?: { profile_picture?: File; signature_path?: File; cv_path?: File }) => {
    const formData = new FormData();
    Object.entries(data).forEach(([key, val]) => {
      if (val !== undefined && val !== null) formData.append(key, String(val));
    });
    if (files?.profile_picture) formData.append("profile_picture", files.profile_picture);
    if (files?.signature_path) formData.append("signature_path", files.signature_path);
    if (files?.cv_path) formData.append("cv_path", files.cv_path);

    return formDataRequest("/auditor-profile", token, formData, "PUT");
  },

  addExperience: (token: string, data: Record<string, any>) =>
    apiRequest("/auditor-profile/experiences", { method: "POST", body: data, token }),

  updateExperience: (token: string, id: string, data: Record<string, any>) =>
    apiRequest(`/auditor-profile/experiences/${id}`, { method: "PUT", body: data, token }),

  deleteExperience: (token: string, id: string) =>
    apiRequest(`/auditor-profile/experiences/${id}`, { method: "DELETE", token }),

  addQualification: async (token: string, data: Record<string, any>, file?: File) => {
    const formData = new FormData();
    Object.entries(data).forEach(([key, val]) => {
      if (val !== undefined && val !== null) formData.append(key, String(val));
    });
    if (file) formData.append("certificate_file", file);

    return formDataRequest("/auditor-profile/qualifications", token, formData);
  },

  updateQualification: async (token: string, id: string, data: Record<string, any>, file?: File) => {
    const formData = new FormData();
    Object.entries(data).forEach(([key, val]) => {
      if (val !== undefined && val !== null) formData.append(key, String(val));
    });
    if (file) formData.append("certificate_file", file);

    return formDataRequest(`/auditor-profile/qualifications/${id}`, token, formData, "PUT");
  },

  deleteQualification: (token: string, id: string) =>
    apiRequest(`/auditor-profile/qualifications/${id}`, { method: "DELETE", token }),

  addTraining: async (token: string, data: Record<string, any>, file?: File) => {
    const formData = new FormData();
    Object.entries(data).forEach(([key, val]) => {
      if (val !== undefined && val !== null) formData.append(key, String(val));
    });
    if (file) formData.append("certificate_file", file);

    return formDataRequest("/auditor-profile/trainings", token, formData);
  },

  updateTraining: async (token: string, id: string, data: Record<string, any>, file?: File) => {
    const formData = new FormData();
    Object.entries(data).forEach(([key, val]) => {
      if (val !== undefined && val !== null) formData.append(key, String(val));
    });
    if (file) formData.append("certificate_file", file);

    return formDataRequest(`/auditor-profile/trainings/${id}`, token, formData, "PUT");
  },

  deleteTraining: (token: string, id: string) =>
    apiRequest(`/auditor-profile/trainings/${id}`, { method: "DELETE", token }),
};

export const learningApi = {
  // Trainings
  listTrainings: (token: string) => apiRequest('/learning/trainings', { token }),
  createTraining: (token: string, body: Record<string, any>) => apiRequest('/learning/trainings', { method: 'POST', body, token }),
  getTrainingForEdit: (token: string, id: string) => apiRequest(`/learning/trainings/${id}`, { token }),
  updateTraining: (token: string, id: string, body: Record<string, any>) => apiRequest(`/learning/trainings/${id}`, { method: 'PUT', body, token }),
  deleteTraining: (token: string, id: string) => apiRequest(`/learning/trainings/${id}`, { method: 'DELETE', token }),
  assignTraining: (token: string, id: string, auditor_codes: string[], send_assignment_email = true) => apiRequest(`/learning/trainings/${id}/assign`, { method: 'POST', body: { auditor_codes, send_assignment_email }, token }),
  deleteTrainingAssignment: (token: string, id: string, assignmentId: string) => apiRequest(`/learning/trainings/${id}/assignments/${assignmentId}`, { method: 'DELETE', token }),

  // Field visits
  listFieldVisits: (token: string) => apiRequest('/learning/field-visits', { token }),
  createFieldVisit: (token: string, body: Record<string, any>) => apiRequest('/learning/field-visits', { method: 'POST', body, token }),
  getFieldVisitForEdit: (token: string, id: string) => apiRequest(`/learning/field-visits/${id}`, { token }),
  updateFieldVisit: (token: string, id: string, body: Record<string, any>) => apiRequest(`/learning/field-visits/${id}`, { method: 'PUT', body, token }),
  deleteFieldVisit: (token: string, id: string) => apiRequest(`/learning/field-visits/${id}`, { method: 'DELETE', token }),
  assignFieldVisit: (token: string, id: string, auditor_codes: string[], send_assignment_email = true) => apiRequest(`/learning/field-visits/${id}/assign`, { method: 'POST', body: { auditor_codes, send_assignment_email }, token }),
  deleteFieldVisitAssignment: (token: string, id: string, assignmentId: string) => apiRequest(`/learning/field-visits/${id}/assignments/${assignmentId}`, { method: 'DELETE', token }),

  // Evaluation papers
  listEvaluationPapers: (token: string) => apiRequest('/learning/evaluation-papers', { token }),
  createEvaluationPaper: (token: string, body: Record<string, any>) => apiRequest('/learning/evaluation-papers', { method: 'POST', body, token }),
  getEvaluationPaperForEdit: (token: string, id: string) => apiRequest(`/learning/evaluation-papers/${id}/questions`, { token }),
  updateEvaluationPaper: (token: string, id: string, body: Record<string, any>) => apiRequest(`/learning/evaluation-papers/${id}`, { method: 'PUT', body, token }),
  deleteEvaluationPaper: (token: string, id: string) => apiRequest(`/learning/evaluation-papers/${id}`, { method: 'DELETE', token }),
  setEvaluationQuestions: (token: string, id: string, questions: any[]) => apiRequest(`/learning/evaluation-papers/${id}/questions`, { method: 'POST', body: { questions }, token }),
  evaluationExcelTemplateUrl: () => `${apiBaseUrl()}/learning/evaluation-papers/excel-template`,

  downloadEvaluationExcelTemplate: async (token: string) => {
    try {
      const res = await fetch(`${apiBaseUrl()}/learning/evaluation-papers/excel-template`, {
        method: 'GET',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        let msg = `Request failed (${res.status})`;
        try {
          const j = await res.json();
          if (j?.message) msg = j.message;
        } catch {
          // ignore
        }
        return { success: false as const, message: msg };
      }
      const blob = await res.blob();
      return { success: true as const, blob };
    } catch (error) {
      return { success: false as const, message: getFriendlyNetworkErrorMessage(error) };
    }
  },

  previewEvaluationQuestionsExcel: async (token: string, file: File) => {
    const formData = new FormData();
    formData.append('questions_file', file);
    try {
      const res = await fetch(`${apiBaseUrl()}/learning/evaluation-papers/questions/preview-upload`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      return res.json();
    } catch (error) {
      return { success: false, message: getFriendlyNetworkErrorMessage(error) };
    }
  },

  uploadEvaluationQuestionsExcel: async (token: string, paperId: string, file: File) => {
    const formData = new FormData();
    formData.append('questions_file', file);
    try {
      const res = await fetch(`${apiBaseUrl()}/learning/evaluation-papers/${paperId}/questions/upload`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      return res.json();
    } catch (error) {
      return { success: false, message: getFriendlyNetworkErrorMessage(error) };
    }
  },
  assignEvaluationPaper: (token: string, id: string, auditor_codes: string[], due_date?: string, send_assignment_email = true) => apiRequest(`/learning/evaluation-papers/${id}/assign`, { method: 'POST', body: { auditor_codes, due_date, send_assignment_email }, token }),
  deleteEvaluationAssignment: (token: string, id: string, assignmentId: string) => apiRequest(`/learning/evaluation-papers/${id}/assignments/${assignmentId}`, { method: 'DELETE', token }),
};

// Backward-compatible alias for existing imports; can be removed after UI refactor.
export const auditFirmLearningApi = learningApi;

export const myLearningApi = {
  // Trainings
  myTrainings: (token: string) => apiRequest('/my-learning/trainings', { token }),
  saveTrainingProgress: (token: string, assignmentId: string, action: "start" | "heartbeat" | "pause", playback_position_seconds = 0) =>
    apiRequest(`/my-learning/trainings/${assignmentId}/progress`, { method: 'POST', body: { action, playback_position_seconds }, token }),
  completeTraining: (token: string, assignmentId: string) => apiRequest(`/my-learning/trainings/${assignmentId}/complete`, { method: 'POST', token }),

  // Field visits
  myFieldVisits: (token: string) => apiRequest('/my-learning/field-visits', { token }),
  completeFieldVisit: (token: string, assignmentId: string) => apiRequest(`/my-learning/field-visits/${assignmentId}/complete`, { method: 'POST', token }),

  // Evaluation papers
  myEvaluationPapers: (token: string) => apiRequest('/my-learning/evaluation-papers', { token }),
  getEvaluationPaper: (token: string, paperId: string) => apiRequest(`/my-learning/evaluation-papers/${paperId}`, { token }),
  startEvaluationPaper: (token: string, paperId: string) => apiRequest(`/my-learning/evaluation-papers/${paperId}/start`, { method: 'POST', token }),
  submitEvaluationPaper: (
    token: string,
    paperId: string,
    answers: Array<
      | { question_id: string; answer_text: string }
      | { question_id: string; selected_option_id: string | null }
      | { question_id: string; selected_option_ids: string[] }
    >
  ) =>
    apiRequest(`/my-learning/evaluation-papers/${paperId}/submit`, { method: 'POST', body: { answers }, token }),
};

export const landingApi = {
  submitContactReview: (data: ContactReviewInput) =>
    apiRequest<ContactReviewSubmitResult>("/landing/contact-review", { method: "POST", body: data as unknown as Record<string, unknown> }),
  getContactDetails: () => apiRequest<AuditoContact>("/landing/contact-details"),
  submitContact: (data: { name: string; email: string; company?: string; phone?: string; country?: string; message: string }) =>
    apiRequest("/landing/contact", { method: "POST", body: data as unknown as Record<string, unknown> }),
  getPrivacyPolicy: () => apiRequest<PrivacyPolicy>("/landing/privacy-policy"),
  askAssistant: (message: string, history: LandingAssistantHistoryMessage[] = []) =>
    apiRequest<LandingAssistantReply>("/landing/assistant/message", { method: "POST", body: { message, history } }),
  createAssistantVoiceSession: (history: LandingAssistantHistoryMessage[] = []) =>
    apiRequest<LandingAssistantVoiceSession>("/landing/assistant/voice/session", { method: "POST", body: { history } }),
};

export interface LandingAssistantHistoryMessage {
  role: "assistant" | "user";
  content: string;
}

export interface LandingAssistantAction {
  label: string;
  target: "pricing" | "features" | "register" | "custom-solution" | "contact";
}

export interface LandingAssistantReply {
  answer: string;
  actions: LandingAssistantAction[];
}

export interface LandingAssistantVoiceSession {
  value: string;
  expires_at: number;
  model: string;
  voice: string;
}

export interface PromotionCampaign {
  campaign_id: string;
  name: string;
  description: string | null;
  discount_type: "percentage" | "fixed";
  discount_value: number;
  priority: number;
  starts_at: string;
  ends_at: string;
  applies_to_registration: boolean;
  applies_to_upgrade: boolean;
  applies_to_renewal: boolean;
  applies_to_token_reload: boolean;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface PackagePricing {
  pricing_version: number;
  company_level_charges: Record<number, number>;
  token_unit_price: number;
  free_company_levels: number;
  free_departments: number;
  company_level_price: number;
  department_price: number;
  /** Line tokens included free with the free levels (pricing v4+). */
  free_line_tokens?: number;
  updated_at?: string;
}

export interface ContactReviewInput {
  account_type: string;
  entity_type: string;
  organization_name: string;
  contact_name: string;
  email: string;
  phone: string;
  country: string;
  departments: number;
  lines_per_audit: number;
  notes?: string;
}

export interface ContactReviewRequest extends Omit<ContactReviewInput, "departments" | "lines_per_audit"> {
  request_id: string;
  /** Older requests were sent before these were asked. */
  departments: number | null;
  lines_per_audit: number | null;
  status: "pending" | "quoted" | "closed";
  assigned_price: number | string | null;
  /** Message sent to the requester with the quote. */
  admin_notes: string | null;
  /** Notes for the Audito team only. */
  internal_notes?: string | null;
  email_verified: number | boolean;
  quoted_at?: string | null;
  closed_at?: string | null;
  /** Tokens included in the quote (everything paid becomes tokens). */
  quoted_tokens?: number | null;
  token_unit_price?: number | string | null;
  registration_expires_at?: string | null;
  registration_link_active?: boolean;
  registered_at?: string | null;
  registered_root_entity_code?: string | null;
  payment_code?: string | null;
  payment_status?: "pending" | "processing" | "paid" | "failed" | "cancelled" | null;
  payment_amount?: number | string | null;
  paid_at?: string | null;
  created_at: string;
  updated_at?: string;
}

/** A quoted Customer or Audit Firm request, as shown on its registration page. */
export interface QuoteRegistrationView {
  organization_name: string;
  contact_name: string;
  email: string;
  phone: string;
  account_type: string;
  entity_type: string;
  country: string;
  departments: number | null;
  lines_per_audit: number | null;
  price: number;
  tokens: number;
  token_unit_price: number;
  currency: string;
  message: string;
  expires_at: string;
}

export interface QuoteRegistrationPayload {
  token: string;
  org_name: string;
  registration_number?: string;
  org_phone_number: string;
  country: string;
  address_line_1: string;
  address_line_2: string;
  address_line_3?: string;
  timezone?: string;
  first_name: string;
  last_name: string;
  phone_number: string;
  password: string;
  privacy_policy_id: string;
}

export interface ContactReviewSubmitResult {
  request_id: string;
  email_sent: boolean;
  contact: AuditoContact;
}

export const packagePricingApi = {
  get: () => apiRequest<PackagePricing>("/landing/package-pricing"),
};

// ─── Payments API ──────────────────────────────────────────────────

export interface PaymentDetails {
  payment_code: string;
  purpose?: "registration" | "upgrade" | "renewal" | "plan_activation" | "plan_upgrade" | "token_reload";
  plan_name: string;
  billing_cycle: string;
  amount: number;
  token_quantity?: number;
  bonus_token_quantity?: number;
  token_unit_price?: number | null;
  pricing_snapshot?: Record<string, unknown> | null;
  currency: string;
  status?: "pending" | "processing" | "paid" | "failed" | "cancelled";
  payer_name?: string | null;
  payer_email?: string | null;
  org_name?: string | null;
  invoice_number?: string | null;
  period_start?: string | null;
  period_end?: string | null;
  paid_at?: string | null;
  created_at?: string | null;
  list_amount?: number;
  promotion_discount_amount?: number;
  promotion_campaign_id?: string | null;
  promo_code?: string | null;
  promo_discount_amount?: number;
  manual_approval_status?: "not_requested" | "requested" | "approved";
  manual_approval_requested_at?: string | null;
  manual_approval_reviewed_at?: string | null;
}

export interface PaymentPageData {
  payment: PaymentDetails;
  payment_mode: "manual_approval" | "gateway";
  payment_contact_email: string;
}

export interface SavedPaymentMethod {
  payment_method_id: string;
  gateway: string;
  card_brand: string | null;
  card_last4: string | null;
  expiry_month: number | null;
  expiry_year: number | null;
  is_default: number | boolean;
  consented_at: string;
  created_at: string;
}

export interface AdminDashboardStats {
  counts: {
    messages: number;
    messages_unread: number;
    promo_codes: number;
    promo_codes_active: number;
    contact_reviews: number;
    contact_reviews_pending: number;
    organizations: number;
    organizations_paid: number;
    audito_admins: number;
  };
  charts: {
    registrations: { period_label: string; count: number }[];
    plan_distribution: { plan_name: string; count: number }[];
    income_distribution: { period_label: string; amount: number }[];
  };
}

export interface AdminPayment {
  transaction_id: string;
  payment_code: string;
  amount: number;
  currency: string;
  status: string;
  gateway: string | null;
  purpose: string;
  org_name: string | null;
  org_name_resolved: string | null;
  plan_name: string;
  token_quantity: number;
  bonus_token_quantity: number;
  token_unit_price: number | null;
  pricing_snapshot: Record<string, unknown> | string | null;
  fulfillment_type: string | null;
  fulfilled_token_quantity: number | null;
  invoice_number: string | null;
  paid_at: string | null;
  created_at: string;
  admin_first_name: string | null;
  admin_last_name: string | null;
  admin_email: string | null;
  entity_type: string | null;
  manual_approval_status: "not_requested" | "requested" | "approved";
  manual_approval_requested_at: string | null;
  manual_approval_reviewed_at: string | null;
  manual_approval_reviewed_by: string | null;
  approval_reviewer_first_name: string | null;
  approval_reviewer_last_name: string | null;
}

export interface RegisteredOrganization {
  root_entity_code: string;
  /** "Package" (Company package) or "Custom" (quoted account). */
  plan_name: string;
  /** Status of the workspace's registration payment. */
  payment_status: string;
  /** 1 once the registration payment is paid. */
  is_active: number;
  activated_at: string | null;
  created_at: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  account_type: string | null;
  entity_type: string | null;
  country: string | null;
  phone_number: string | null;
  admin_active: number | null;
  email_verified: number | null;
  org_name: string | null;
}

export const paymentApi = {
  // Public — payment page lookup & confirmation (temporary; gateway webhook later)
  get: (code: string) => apiRequest<PaymentPageData>(`/payments/${code}`),
  applyPromoCode: (code: string, promoCode: string) =>
    apiRequest<PaymentPageData>(`/payments/${code}/promo-code`, { method: "POST", body: { code: promoCode } }),
  removePromoCode: (code: string) =>
    apiRequest<PaymentPageData>(`/payments/${code}/promo-code`, { method: "DELETE" }),
  completeFree: (code: string) =>
    apiRequest<PaymentPageData>(`/payments/${code}/complete-free`, { method: "POST" }),
  initiate: (code: string, body: { save_payment_method?: boolean } = {}) =>
    apiRequest<{ payment: PaymentDetails; checkout: { action: string; method: "GET" | "POST"; fields: Record<string, string> } }>(`/payments/${code}/initiate`, { method: "POST", body }),
  requestManualApproval: (code: string) =>
    apiRequest<PaymentPageData>(`/payments/${code}/manual-approval-request`, { method: "POST" }),

  // Authenticated (admin)
  list: (token: string) => apiRequest<{ payments: PaymentDetails[] }>("/payments", { token }),
  listMethods: (token: string) => apiRequest<{ methods: SavedPaymentMethod[] }>("/payments/methods", { token }),
  setDefaultMethod: (token: string, id: string) =>
    apiRequest<{ method: SavedPaymentMethod }>(`/payments/methods/${id}/default`, { method: "POST", token }),
  deleteMethod: (token: string, id: string) =>
    apiRequest(`/payments/methods/${id}`, { method: "DELETE", token }),
};

export interface TokenWallet {
  root_entity_code: string;
  available_tokens: number;
  held_tokens: number;
  lifetime_burned_tokens: number;
  plan_name: string;
  token_unit_price: number;
  daily_free_tokens: number;
  wallet_members?: Array<{
    root_entity_code: string;
    source: "workspace" | "linked_requester";
    link_code: string | null;
    display_name: string | null;
    entity_type: string | null;
    available_tokens: number;
    held_tokens: number;
    lifetime_burned_tokens: number;
  }>;
}

export interface TokenReloadPackage {
  token_reload_package_id: string;
  display_name: string;
  token_quantity: number;
  bonus_token_quantity: number;
  amount: number;
  currency: string;
}

export interface AdminTokenReloadPackage {
  id: number;
  token_reload_package_id: string;
  display_name: string;
  token_quantity: number;
  bonus_token_quantity: number;
  is_active: boolean | number;
  created_at?: string;
  updated_at?: string;
}

export type TokenReloadPackageInput = Pick<AdminTokenReloadPackage,
  "display_name" | "token_quantity" | "bonus_token_quantity" | "is_active"
>;

export interface TokenLedgerEntry {
  token_ledger_entry_id: string;
  root_entity_code: string;
  entry_type: "grant" | "reserve" | "release" | "burn" | "expire" | "adjustment";
  available_delta: number;
  held_delta: number;
  burned_delta: number;
  description: string | null;
  audit_title: string | null;
  auditor_name: string | null;
  created_at: string;
}

export const tokenApi = {
  wallet: (token: string) => apiRequest<{ wallet: TokenWallet }>("/tokens/wallet", { token }),
  packages: (token: string) => apiRequest<{ plan_name: string; token_unit_price: number; packages: TokenReloadPackage[] }>("/tokens/packages", { token }),
  ledger: (token: string, limit = 100) => apiRequest<{ entries: TokenLedgerEntry[] }>(`/tokens/ledger?limit=${limit}`, { token }),
  checkout: (token: string, packageId: string) => apiRequest<{ payment: PaymentDetails }>("/tokens/checkout", {
    method: "POST", body: { package_id: packageId }, token,
  }),
  /** Current department limit, departments in use, and the price of `departments`. */
  departmentUpgrade: (token: string, departments?: number) =>
    apiRequest<DepartmentUpgradeInfo>(`/tokens/department-upgrade${departments ? `?departments=${departments}` : ""}`, { token }),
  buyDepartments: (token: string, departments: number) =>
    apiRequest<{ applied: boolean; departments?: number; payment?: { payment_code: string; amount: number; currency: string } }>("/tokens/department-upgrade", {
      method: "POST", body: { departments }, token,
    }),
};

export interface DepartmentUpgradeInfo {
  current: number;
  used: number;
  plan_name: string;
  quote: {
    from_departments: number; departments: number;
    previous_department_charge: number; department_charge: number;
    token_unit_price: number; total_tokens: number; total_price: number;
    free_departments: number; department_price: number;
  };
}

// ─── Admin API ────────────────────────────────────────────────────
export interface ContactMessage {
  contact_message_id: string;
  id?: number;
  name: string;
  email: string;
  company: string | null;
  phone: string | null;
  country?: string | null;
  message: string;
  status: 'unread' | 'read' | 'replied';
  reply_content: string | null;
  replied_at: string | null;
  created_at: string;
}

export interface PromoCode {
  promo_code_id: string;
  id?: number;
  code: string;
  discount_percentage: number;
  is_active: boolean | number;
  expires_at: string | null;
  max_redemptions?: number | null;
  /** Paid checkouts that used this code. */
  redemptions?: number;
  total_discount?: number | string;
  created_at: string;
}

export interface AdminUser {
  admin_id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone_number: string | null;
  role: 'admin' | 'audito_admin';
  is_active: boolean;
  is_verified: boolean;
  created_at: string;
}

export const adminApi = {
  getPackagePricing: (token: string) => apiRequest<PackagePricing>("/admin/package-pricing", { token }),
  updatePackagePricing: (token: string, token_unit_price: number) =>
    apiRequest<PackagePricing>("/admin/package-pricing", { method: "PUT", body: { token_unit_price }, token }),
  listContactReviews: (token: string) => apiRequest<ContactReviewRequest[]>("/admin/contact-reviews", { token }),
  quoteContactReview: (token: string, requestId: string, assigned_price: number, admin_notes: string) =>
    apiRequest<ContactReviewRequest>(`/admin/contact-reviews/${encodeURIComponent(requestId)}/quote`, { method: "POST", body: { assigned_price, admin_notes }, token }),
  resendContactReviewQuote: (token: string, requestId: string) =>
    apiRequest<ContactReviewRequest>(`/admin/contact-reviews/${encodeURIComponent(requestId)}/resend-quote`, { method: "POST", token }),
  closeContactReview: (token: string, requestId: string) =>
    apiRequest<ContactReviewRequest>(`/admin/contact-reviews/${encodeURIComponent(requestId)}/close`, { method: "POST", token }),
  reopenContactReview: (token: string, requestId: string) =>
    apiRequest<ContactReviewRequest>(`/admin/contact-reviews/${encodeURIComponent(requestId)}/reopen`, { method: "POST", token }),
  updateContactReviewNotes: (token: string, requestId: string, internal_notes: string) =>
    apiRequest<ContactReviewRequest>(`/admin/contact-reviews/${encodeURIComponent(requestId)}/notes`, { method: "PUT", body: { internal_notes }, token }),
  resendContactReviewVerification: (token: string, requestId: string) =>
    apiRequest<ContactReviewRequest>(`/admin/contact-reviews/${encodeURIComponent(requestId)}/resend-verification`, { method: "POST", token }),
  listPrivacyPolicies: (token: string) => apiRequest<PrivacyPolicy[]>("/admin/privacy-policies", { token }),
  createPrivacyPolicy: (token: string, data: Pick<PrivacyPolicy, "title" | "intro" | "sections">) =>
    apiRequest<{ policy: PrivacyPolicy }>("/admin/privacy-policies", { method: "POST", body: data as unknown as Record<string, unknown>, token }),
  updatePrivacyPolicy: (token: string, policyId: string, data: Pick<PrivacyPolicy, "title" | "intro" | "sections">) =>
    apiRequest<{ policy: PrivacyPolicy }>(`/admin/privacy-policies/${encodeURIComponent(policyId)}`, { method: "PUT", body: data as unknown as Record<string, unknown>, token }),
  publishPrivacyPolicy: (token: string, policyId: string) =>
    apiRequest<{ policy: PrivacyPolicy }>(`/admin/privacy-policies/${encodeURIComponent(policyId)}/publish`, { method: "POST", token }),
  deletePrivacyPolicy: (token: string, policyId: string) =>
    apiRequest<null>(`/admin/privacy-policies/${encodeURIComponent(policyId)}`, { method: "DELETE", token }),

  listTokenPackages: (token: string) =>
    apiRequest<{ packages: AdminTokenReloadPackage[] }>("/admin/token-packages", { token }),

  createTokenPackage: (token: string, data: TokenReloadPackageInput) =>
    apiRequest<{ package: AdminTokenReloadPackage }>("/admin/token-packages", {
      method: "POST", body: data as unknown as Record<string, unknown>, token,
    }),

  updateTokenPackage: (token: string, packageId: string, data: TokenReloadPackageInput) =>
    apiRequest<{ package: AdminTokenReloadPackage }>(`/admin/token-packages/${encodeURIComponent(packageId)}`, {
      method: "PUT", body: data as unknown as Record<string, unknown>, token,
    }),

  deleteTokenPackage: (token: string, packageId: string) =>
    apiRequest<null>(`/admin/token-packages/${encodeURIComponent(packageId)}`, {
      method: "DELETE", token,
    }),

  listPromotionCampaigns: (token: string) =>
    apiRequest<PromotionCampaign[]>("/admin/promotion-campaigns", { token }),

  createPromotionCampaign: (token: string, data: Omit<PromotionCampaign, "campaign_id" | "created_at" | "updated_at">) =>
    apiRequest<{ campaign: PromotionCampaign }>("/admin/promotion-campaigns", {
      method: "POST", body: data as unknown as Record<string, unknown>, token,
    }),

  updatePromotionCampaign: (token: string, campaignId: string, data: Omit<PromotionCampaign, "campaign_id" | "created_at" | "updated_at">) =>
    apiRequest<{ campaign: PromotionCampaign }>(`/admin/promotion-campaigns/${encodeURIComponent(campaignId)}`, {
      method: "PUT", body: data as unknown as Record<string, unknown>, token,
    }),

  setPromotionCampaignStatus: (token: string, campaignId: string, is_active: boolean) =>
    apiRequest<{ campaign: PromotionCampaign }>(`/admin/promotion-campaigns/${encodeURIComponent(campaignId)}/status`, {
      method: "PUT", body: { is_active }, token,
    }),

  listMessages: (token: string) =>
    apiRequest<ContactMessage[]>("/admin/messages", { token }),
  
  replyMessage: (token: string, id: string, reply_content: string) =>
    apiRequest(`/admin/messages/${id}/reply`, {
      method: "POST",
      body: { reply_content },
      token,
    }),
  
  listPromoCodes: (token: string) =>
    apiRequest<PromoCode[]>("/admin/promo-codes", { token }),
  
  createPromoCode: (token: string, data: { code: string; discount_percentage: number; expires_at?: string | null; max_redemptions?: number | null }) =>
    apiRequest("/admin/promo-codes", {
      method: "POST",
      body: data as unknown as Record<string, unknown>,
      token,
    }),

  deactivatePromoCode: (token: string, id: string) =>
    apiRequest(`/admin/promo-codes/${id}/deactivate`, {
      method: "POST",
      token,
    }),

  activatePromoCode: (token: string, id: string) =>
    apiRequest(`/admin/promo-codes/${id}/activate`, {
      method: "POST",
      token,
    }),

  deletePromoCode: (token: string, id: string) =>
    apiRequest(`/admin/promo-codes/${id}`, {
      method: "DELETE",
      token,
    }),

  // Admin user management
  listAdmins: (token: string, params?: { role?: string; is_active?: string; search?: string }) => {
    const qs = new URLSearchParams();
    if (params?.role) qs.set('role', params.role);
    if (params?.is_active) qs.set('is_active', params.is_active);
    if (params?.search) qs.set('search', params.search);
    const query = qs.toString();
    return apiRequest<AdminUser[]>(`/admin/admins${query ? `?${query}` : ""}`, { token });
  },

  createAdmin: (token: string, data: { first_name: string; last_name: string; email: string }) =>
    apiRequest("/admin/admins", {
      method: "POST",
      body: data as unknown as Record<string, unknown>,
      token,
    }),

  toggleAdminStatus: (token: string, adminId: string) =>
    apiRequest(`/admin/admins/${adminId}/toggle-status`, {
      method: "POST",
      token,
    }),

  deleteAdmin: (token: string, adminId: string) =>
    apiRequest(`/admin/admins/${adminId}`, {
      method: "DELETE",
      token,
    }),

  // Dashboard stats
  getDashboardStats: (token: string, period: string = "monthly", incomePeriod: string = period) =>
    apiRequest<AdminDashboardStats>(`/admin/stats?period=${encodeURIComponent(period)}&income_period=${encodeURIComponent(incomePeriod)}`, { token }),

  // Registered organizations
  listOrganizations: (token: string) =>
    apiRequest<RegisteredOrganization[]>("/admin/organizations", { token }),

  // Payment transactions
  listPayments: (token: string) =>
    apiRequest<AdminPayment[]>("/admin/payments", { token }),
  approvePayment: (token: string, transactionId: string) =>
    apiRequest<{ payment: PaymentDetails; credit_applied: number; net_amount: number }>(`/admin/payments/${transactionId}/approve`, { method: "POST", token }),
};
