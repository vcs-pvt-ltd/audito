const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8081/api";

interface ApiOptions {
  method?: string;
  body?: Record<string, unknown>;
  token?: string;
}

async function apiRequest<T = unknown>(
  endpoint: string,
  options: ApiOptions = {}
): Promise<{ success: boolean; data?: T; message?: string }> {
  const { method = "GET", body, token } = options;

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  try {
    const res = await fetch(`${API_BASE_URL}${endpoint}`, {
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
  } catch (err: any) {
    return {
      success: false,
      message: err?.message || 'Network error',
    };
  }
}

// ─── Auth API ─────────────────────────────────────────────────────

export type AllEntityType =
  | "Customer" | "Buying Office" | "Supplier"
  | "Company" | "Cluster" | "Factory" | "Unit" | "Department"
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
  nic?: string;
  email: string;
  phone_number?: string;
  password: string;
  plan_name?: string;
  billing_cycle?: string;
  timezone?: string;
}

export interface LoginPayload {
  email: string;
  password: string;
}

export interface OnboardingStatus {
  onboarding_completed: boolean;
  onboarding_skipped: boolean;
  onboarding_completed_at: string | null;
}

export const authApi = {
  register: (data: RegisterPayload) =>
    apiRequest("/auth/register", { method: "POST", body: data as unknown as Record<string, unknown> }),

  login: (data: LoginPayload) =>
    apiRequest("/auth/login", { method: "POST", body: data as unknown as Record<string, unknown> }),

  refreshToken: (refresh_token: string) =>
    apiRequest("/auth/refresh-token", {
      method: "POST",
      body: { refresh_token },
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

  switchAccount: (token: string, target_role: string, password: string) =>
    apiRequest("/auth/switch-account", {
      method: "POST",
      body: { target_role, password },
      token,
    }),

  updateProfile: (
    token: string,
    data: { first_name: string; last_name: string; phone_number?: string; nic?: string; country?: string; profile_image?: string | null }
  ) =>
    apiRequest("/auth/profile", {
      method: "PUT",
      body: data as unknown as Record<string, unknown>,
      token,
    }),

  updateOrganization: (
    token: string,
    data: { name: string; registration_number?: string; email?: string; address_line_1?: string; address_line_2?: string; address_line_3?: string; country?: string; phone_number?: string }
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

  removeNode: (token: string, id: number) =>
    apiRequest(`/org-tree/${id}`, { method: "DELETE", token }),

  listEntities: (token: string, entityType: string) =>
    apiRequest(`/org-tree/entities/${entityType}`, { token }),

  syncTree: (
    token: string,
    data: {
      adds: { parent_code: string; parent_edge_id?: number | null; child_type: string; child_code: string }[];
      removes: number[];
    }
  ) =>
    apiRequest("/org-tree/sync", {
      method: "POST",
      body: data as unknown as Record<string, unknown>,
      token,
    }),
};

// ─── Links API ────────────────────────────────────────────────────

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
    target_email: string
  ) =>
    apiRequest("/links", {
      method: "POST",
      body: { target_email },
      token,
    }),

  respondToLink: (token: string, linkCode: string, action: "accept" | "reject", verification_key?: string) =>
    apiRequest(`/links/${linkCode}/respond`, {
      method: "PUT",
      body: verification_key ? { action, verification_key } : { action },
      token,
    }),

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
  nic?: string;
  country?: string;
  user_type: string;
  assigned_entity_code?: string;
  assigned_entity_type?: string;
  assigned_org_tree_id?: number;
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

  createFromAdmin: (token: string, data: { email: string; user_type: string; assigned_entity_code?: string; assigned_entity_type?: string; assigned_org_tree_id?: number }) =>
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
  entity_code: string;
  org_tree_id?: number | null;
  entity_type: string;
  entity_name?: string;
  question_text: string;
  answer_type: "free_text" | "single_option" | "multiple_options" | "dropdown";
  total_marks?: number;
  order_index?: number;
  options?: QuestionOption[];
}

export const checklistApi = {
  // Checklist types
  listTypes: (token: string) =>
    apiRequest("/checklists/types", { token }),
  createType: (token: string, data: ChecklistTypePayload) =>
    apiRequest("/checklists/types", { method: "POST", body: data as unknown as Record<string, unknown>, token }),
  updateType: (token: string, id: number | string, data: ChecklistTypePayload) =>
    apiRequest(`/checklists/types/${id}`, { method: "PUT", body: data as unknown as Record<string, unknown>, token }),
  deactivateType: (token: string, id: number | string) =>
    apiRequest(`/checklists/types/${id}`, { method: "DELETE", token }),

  // Checklists
  list: (token: string) =>
    apiRequest("/checklists", { token }),
  create: (token: string, data: ChecklistPayload) =>
    apiRequest("/checklists", { method: "POST", body: data as unknown as Record<string, unknown>, token }),
  get: (token: string, id: number | string) =>
    apiRequest(`/checklists/${id}`, { token }),
  update: (token: string, id: number | string, data: ChecklistPayload) =>
    apiRequest(`/checklists/${id}`, { method: "PUT", body: data as unknown as Record<string, unknown>, token }),
  deactivate: (token: string, id: number | string) =>
    apiRequest(`/checklists/${id}`, { method: "DELETE", token }),

  // Questions
  addQuestions: (token: string, checklistId: number | string, questions: QuestionPayload[]) =>
    apiRequest(`/checklists/${checklistId}/questions`, {
      method: "POST",
      body: { questions } as unknown as Record<string, unknown>,
      token,
    }),
  updateQuestion: (token: string, qid: number | string, data: Partial<QuestionPayload>) =>
    apiRequest(`/checklists/questions/${qid}`, {
      method: "PUT",
      body: data as unknown as Record<string, unknown>,
      token,
    }),
  deleteQuestion: (token: string, qid: number | string) =>
    apiRequest(`/checklists/questions/${qid}`, { method: "DELETE", token }),

  // Media upload
  uploadMedia: async (token: string, file: File) => {
    const formData = new FormData();
    formData.append("media_file", file);
    const res = await fetch(`${API_BASE_URL}/checklists/upload-media`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: formData,
    });
    return res.json();
  },

  // Excel template download (with auth token)
  downloadExcelTemplate: async (token: string) => {
    const res = await fetch(`${API_BASE_URL}/checklists/excel-template`, {
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
  },

  // Excel upload
  uploadQuestionsExcel: async (token: string, checklistId: number | string, file: File) => {
    const formData = new FormData();
    formData.append("questions_file", file);
    const res = await fetch(`${API_BASE_URL}/checklists/${checklistId}/questions/upload`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: formData,
    });
    return res.json();
  },

  // Excel preview (no DB writes)
  previewQuestionsExcel: async (token: string, file: File) => {
    const formData = new FormData();
    formData.append("questions_file", file);
    const res = await fetch(`${API_BASE_URL}/checklists/questions/preview-upload`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: formData,
    });
    return res.json();
  },
};


export interface AuditPayload {
  checklist_id: number | string;
  title: string;
  audit_type: "internal" | "external";
  assigned_auditor_code?: string;
  assigned_firm_code?: string;
  assigned_org_tree_id?: number | null;
  budget?: number | string;
  currency?: string;
  num_workers?: number | string;
  start_date: string;
  end_date: string;
  notes?: string;
  status?: "plan" | "in_progress" | "completed";
  entities: Array<{ org_tree_id?: number | null; entity_code: string; entity_type: string; entity_name: string }>;
}

export const auditApi = {
  getChecklistEntities: (token: string, checklistId: number | string) =>
    apiRequest(`/audits/checklist/${checklistId}/entities`, { token }),

  create: (token: string, data: AuditPayload) =>
    apiRequest("/audits", { method: "POST", body: data as unknown as Record<string, unknown>, token }),

  list: (token: string) =>
    apiRequest("/audits", { token }),

  get: (token: string, id: number | string) =>
    apiRequest(`/audits/${id}`, { token }),

  update: (token: string, id: number | string, data: Partial<AuditPayload>) =>
    apiRequest(`/audits/${id}`, { method: "PUT", body: data as unknown as Record<string, unknown>, token }),

  delete: (token: string, id: number | string) =>
    apiRequest(`/audits/${id}`, { method: "DELETE", token }),

  cancel: (token: string, id: number | string) =>
    apiRequest(`/audits/${id}/cancel`, { method: "POST", token }),

  count: (token: string) =>
    apiRequest<{ count: number }>("/audits/count", { token }),
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

  getDetail: (token: string, id: number | string) =>
    apiRequest(`/audit-execution/${id}`, { token }),

  getEntityTree: (token: string, id: number | string) =>
    apiRequest(`/audit-execution/${id}/entity-tree`, { token }),

  getCorrectiveActions: (token: string, id: number | string) =>
    apiRequest(`/audit-execution/${id}/corrective-actions`, { token }),

  saveCorrectiveActions: (token: string, id: number | string, actions: Array<{
    response_id: number;
    entity_code: string;
    question_id: number;
    assigned_org_tree_id?: number | null;
    due_date?: string | null;
  }>) =>
    apiRequest(`/audit-execution/${id}/corrective-actions`, {
      method: "PUT",
      body: { actions } as unknown as Record<string, unknown>,
      token,
    }),

  start: (token: string, id: number | string) =>
    apiRequest(`/audit-execution/${id}/start`, { method: "POST", token }),

  respond: (token: string, id: number | string, data: {
    org_tree_id: number;
    entity_code: string;
    question_id: number;
    answer_text?: string;
    selected_option_ids?: number[];
    marks_obtained: number;
    remarks?: string;
    cap_required?: boolean;
  }) =>
    apiRequest(`/audit-execution/${id}/respond`, {
      method: "POST",
      body: data as unknown as Record<string, unknown>,
      token,
    }),

  getResponses: (token: string, id: number | string) =>
    apiRequest(`/audit-execution/${id}/responses`, { token }),

  getEntityResponses: (token: string, id: number | string, entityCode: string, orgTreeId: number) =>
    apiRequest(`/audit-execution/${id}/responses/${entityCode}?org_tree_id=${encodeURIComponent(String(orgTreeId))}`, { token }),

  uploadEvidence: async (token: string, id: number | string, responseId: number, file: File, fileType: string) => {
    const formData = new FormData();
    formData.append("evidence_file", file);
    formData.append("response_id", String(responseId));
    formData.append("file_type", fileType);
    const res = await fetch(`${API_BASE_URL}/audit-execution/${id}/evidence`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: formData,
    });
    return res.json();
  },

  deleteEvidence: (token: string, evidenceId: number) =>
    apiRequest(`/audit-execution/evidence/${evidenceId}`, { method: "DELETE", token }),

  getProgress: (token: string, id: number | string) =>
    apiRequest(`/audit-execution/${id}/progress`, { token }),

  complete: (token: string, id: number | string) =>
    apiRequest(`/audit-execution/${id}/complete`, { method: "POST", token }),

  getReport: (token: string, id: number | string) =>
    apiRequest(`/audit-execution/${id}/report`, { token }),

  submitFollowUp: (token: string, id: number | string, data: {
    cap_id: number;
    verification: "pending" | "verified" | "rejected";
    notes?: string;
  }) =>
    apiRequest(`/audit-execution/${id}/follow-up-respond`, {
      method: "POST",
      body: data as unknown as Record<string, unknown>,
      token,
    }),

  getFollowUpResponses: (token: string, id: number | string) =>
    apiRequest(`/audit-execution/${id}/follow-up-responses`, { token }),
};

// ─── CAP API ──────────────────────────────────────────────────────

export const capApi = {
  // Create a CAP plan from corrective actions of a completed audit
  create: (token: string, data: {
    audit_id: number | string;
    parent_cap_id?: number | string;
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

  listByAudit: (token: string, auditId: number | string) =>
    apiRequest(`/caps/audit/${auditId}`, { token }),

  get: (token: string, id: number | string) =>
    apiRequest(`/caps/${id}`, { token }),

  // Get CAP questions for execution view
  getItems: (token: string, id: number | string) =>
    apiRequest(`/caps/${id}/items`, { token }),

  // Submit a response to a CAP question
  respond: (token: string, id: number | string, data: {
    cap_question_id: number;
    response_text?: string;
  }) =>
    apiRequest(`/caps/${id}/respond`, {
      method: "POST",
      body: data as unknown as Record<string, unknown>,
      token,
    }),

  // Get all responses for a CAP
  getResponses: (token: string, id: number | string) =>
    apiRequest(`/caps/${id}/responses`, { token }),

  // Get entity-level progress for a CAP
  getProgress: (token: string, id: number | string) =>
    apiRequest(`/caps/${id}/progress`, { token }),

  // Mark CAP as completed
  complete: (token: string, id: number | string) =>
    apiRequest(`/caps/${id}/complete`, { method: "POST", token }),

  assign: (token: string, id: number | string, data: {
    responsible_person_code: string;
    responsible_person_name?: string;
    due_date: string;
  }) =>
    apiRequest(`/caps/${id}/assign`, {
      method: "PUT",
      body: data as unknown as Record<string, unknown>,
      token,
    }),

  updateStatus: (token: string, id: number | string, data: {
    status: string;
    resolution_notes?: string;
  }) =>
    apiRequest(`/caps/${id}/status`, {
      method: "PUT",
      body: data as unknown as Record<string, unknown>,
      token,
    }),

  resolve: (token: string, id: number | string, resolution_notes?: string) =>
    apiRequest(`/caps/${id}/resolve`, {
      method: "PUT",
      body: { resolution_notes } as unknown as Record<string, unknown>,
      token,
    }),

  uploadEvidence: async (token: string, capId: number | string, responseId: number, file: File, fileType: string) => {
    const formData = new FormData();
    formData.append("evidence_file", file);
    formData.append("response_id", String(responseId));
    formData.append("file_type", fileType);
    const res = await fetch(`${API_BASE_URL}/caps/${capId}/evidence`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: formData,
    });
    return res.json();
  },

  deleteEvidence: (token: string, evidenceId: number) =>
    apiRequest(`/caps/evidence/${evidenceId}`, { method: "DELETE", token }),

  createFollowUp: (token: string, data: {
    parent_audit_id: number;
    title: string;
    assigned_auditor_code?: string;
    start_date: string;
    end_date: string;
    notes?: string;
  }) =>
    apiRequest("/caps/create-follow-up", {
      method: "POST",
      body: data as unknown as Record<string, unknown>,
      token,
    }),

  getCorrectiveActions: (token: string, id: number | string) =>
    apiRequest(`/caps/${id}/corrective-actions`, { token }),

  saveCorrectiveActions: (token: string, id: number | string, actions: Array<{
    response_id: number;
    entity_code: string;
    question_id: number;
    assigned_org_tree_id?: number | null;
    due_date?: string | null;
  }>) =>
    apiRequest(`/caps/${id}/corrective-actions`, {
      method: "PUT",
      body: { actions } as unknown as Record<string, unknown>,
      token,
    }),

  getEntityHeads: (token: string, entityCode: string) =>
    apiRequest(`/caps/entity-heads/${entityCode}`, { token }),
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

    while (offset < total) {
      const res = await fetch(`${COUNTRIES_API}?limit=${limit}&offset=${offset}`);
      const json = await res.json();
      if (!json.success || !json.data) break;
      all.push(...json.data);
      total = json.pagination?.total ?? json.data.length;
      offset += limit;
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

    const seen = new Set<string>();
    return all
      .filter((tz) => {
        if (!tz?.timezone_value || tz.isActive === 0) return false;
        if (seen.has(tz.timezone_value)) return false;
        seen.add(tz.timezone_value);
        return true;
      })
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

  updateNotice: (token: string, id: number, payload: Record<string, unknown>) =>
    apiRequest(`/settings/notices/${id}`, { method: 'PUT', body: payload, token }),

  deleteNotice: (token: string, id: number) =>
    apiRequest(`/settings/notices/${id}`, { method: 'DELETE', token }),
};

// ─── Notices API ───────────────────────────────────────────────────

export const noticeApi = {
  getMyNotices: (token: string) => apiRequest<{ notices: unknown[] }>('/notices', { token }),
  markRead: (token: string, id: number) =>
    apiRequest(`/notices/${id}/read`, { method: 'PATCH', token }),
  markUnread: (token: string, id: number) =>
    apiRequest(`/notices/${id}/unread`, { method: 'PATCH', token }),
  deleteMine: (token: string, id: number) =>
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

    const res = await fetch(`${API_BASE_URL}/auditor-profile`, {
      method: "PUT",
      headers: { Authorization: `Bearer ${token}` },
      body: formData,
    });
    return res.json();
  },

  addExperience: (token: string, data: Record<string, any>) =>
    apiRequest("/auditor-profile/experiences", { method: "POST", body: data, token }),

  updateExperience: (token: string, id: number, data: Record<string, any>) =>
    apiRequest(`/auditor-profile/experiences/${id}`, { method: "PUT", body: data, token }),

  deleteExperience: (token: string, id: number) =>
    apiRequest(`/auditor-profile/experiences/${id}`, { method: "DELETE", token }),

  addQualification: async (token: string, data: Record<string, any>, file?: File) => {
    const formData = new FormData();
    Object.entries(data).forEach(([key, val]) => {
      if (val !== undefined && val !== null) formData.append(key, String(val));
    });
    if (file) formData.append("certificate_file", file);

    const res = await fetch(`${API_BASE_URL}/auditor-profile/qualifications`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: formData,
    });
    return res.json();
  },

  updateQualification: async (token: string, id: number, data: Record<string, any>, file?: File) => {
    const formData = new FormData();
    Object.entries(data).forEach(([key, val]) => {
      if (val !== undefined && val !== null) formData.append(key, String(val));
    });
    if (file) formData.append("certificate_file", file);

    const res = await fetch(`${API_BASE_URL}/auditor-profile/qualifications/${id}`, {
      method: "PUT",
      headers: { Authorization: `Bearer ${token}` },
      body: formData,
    });
    return res.json();
  },

  deleteQualification: (token: string, id: number) =>
    apiRequest(`/auditor-profile/qualifications/${id}`, { method: "DELETE", token }),

  addTraining: async (token: string, data: Record<string, any>, file?: File) => {
    const formData = new FormData();
    Object.entries(data).forEach(([key, val]) => {
      if (val !== undefined && val !== null) formData.append(key, String(val));
    });
    if (file) formData.append("certificate_file", file);

    const res = await fetch(`${API_BASE_URL}/auditor-profile/trainings`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: formData,
    });
    return res.json();
  },

  updateTraining: async (token: string, id: number, data: Record<string, any>, file?: File) => {
    const formData = new FormData();
    Object.entries(data).forEach(([key, val]) => {
      if (val !== undefined && val !== null) formData.append(key, String(val));
    });
    if (file) formData.append("certificate_file", file);

    const res = await fetch(`${API_BASE_URL}/auditor-profile/trainings/${id}`, {
      method: "PUT",
      headers: { Authorization: `Bearer ${token}` },
      body: formData,
    });
    return res.json();
  },

  deleteTraining: (token: string, id: number) =>
    apiRequest(`/auditor-profile/trainings/${id}`, { method: "DELETE", token }),
};

export const learningApi = {
  // Trainings
  listTrainings: (token: string) => apiRequest('/learning/trainings', { token }),
  createTraining: (token: string, body: Record<string, any>) => apiRequest('/learning/trainings', { method: 'POST', body, token }),
  updateTraining: (token: string, id: number, body: Record<string, any>) => apiRequest(`/learning/trainings/${id}`, { method: 'PUT', body, token }),
  deleteTraining: (token: string, id: number) => apiRequest(`/learning/trainings/${id}`, { method: 'DELETE', token }),
  assignTraining: (token: string, id: number, auditor_codes: string[]) => apiRequest(`/learning/trainings/${id}/assign`, { method: 'POST', body: { auditor_codes }, token }),

  // Field visits
  listFieldVisits: (token: string) => apiRequest('/learning/field-visits', { token }),
  createFieldVisit: (token: string, body: Record<string, any>) => apiRequest('/learning/field-visits', { method: 'POST', body, token }),
  updateFieldVisit: (token: string, id: number, body: Record<string, any>) => apiRequest(`/learning/field-visits/${id}`, { method: 'PUT', body, token }),
  deleteFieldVisit: (token: string, id: number) => apiRequest(`/learning/field-visits/${id}`, { method: 'DELETE', token }),
  assignFieldVisit: (token: string, id: number, auditor_codes: string[]) => apiRequest(`/learning/field-visits/${id}/assign`, { method: 'POST', body: { auditor_codes }, token }),

  // Evaluation papers
  listEvaluationPapers: (token: string) => apiRequest('/learning/evaluation-papers', { token }),
  createEvaluationPaper: (token: string, body: Record<string, any>) => apiRequest('/learning/evaluation-papers', { method: 'POST', body, token }),
  updateEvaluationPaper: (token: string, id: number, body: Record<string, any>) => apiRequest(`/learning/evaluation-papers/${id}`, { method: 'PUT', body, token }),
  deleteEvaluationPaper: (token: string, id: number) => apiRequest(`/learning/evaluation-papers/${id}`, { method: 'DELETE', token }),
  setEvaluationQuestions: (token: string, id: number, questions: any[]) => apiRequest(`/learning/evaluation-papers/${id}/questions`, { method: 'POST', body: { questions }, token }),
  evaluationExcelTemplateUrl: () => `${API_BASE_URL}/learning/evaluation-papers/excel-template`,

  downloadEvaluationExcelTemplate: async (token: string) => {
    const res = await fetch(`${API_BASE_URL}/learning/evaluation-papers/excel-template`, {
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
  },

  previewEvaluationQuestionsExcel: async (token: string, file: File) => {
    const formData = new FormData();
    formData.append('questions_file', file);
    const res = await fetch(`${API_BASE_URL}/learning/evaluation-papers/questions/preview-upload`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: formData,
    });
    return res.json();
  },

  uploadEvaluationQuestionsExcel: async (token: string, paperId: number, file: File) => {
    const formData = new FormData();
    formData.append('questions_file', file);
    const res = await fetch(`${API_BASE_URL}/learning/evaluation-papers/${paperId}/questions/upload`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: formData,
    });
    return res.json();
  },
  assignEvaluationPaper: (token: string, id: number, auditor_codes: string[], due_date?: string) => apiRequest(`/learning/evaluation-papers/${id}/assign`, { method: 'POST', body: { auditor_codes, due_date }, token }),
};

// Backward-compatible alias for existing imports; can be removed after UI refactor.
export const auditFirmLearningApi = learningApi;

export const myLearningApi = {
  // Trainings
  myTrainings: (token: string) => apiRequest('/my-learning/trainings', { token }),
  completeTraining: (token: string, assignmentId: number) => apiRequest(`/my-learning/trainings/${assignmentId}/complete`, { method: 'POST', token }),

  // Field visits
  myFieldVisits: (token: string) => apiRequest('/my-learning/field-visits', { token }),
  completeFieldVisit: (token: string, assignmentId: number) => apiRequest(`/my-learning/field-visits/${assignmentId}/complete`, { method: 'POST', token }),

  // Evaluation papers
  myEvaluationPapers: (token: string) => apiRequest('/my-learning/evaluation-papers', { token }),
  getEvaluationPaper: (token: string, paperId: number) => apiRequest(`/my-learning/evaluation-papers/${paperId}`, { token }),
  submitEvaluationPaper: (
    token: string,
    paperId: number,
    answers: Array<
      | { question_id: number; answer_text: string }
      | { question_id: number; selected_option_id: number | null }
      | { question_id: number; selected_option_ids: number[] }
    >
  ) =>
    apiRequest(`/my-learning/evaluation-papers/${paperId}/submit`, { method: 'POST', body: { answers }, token }),
};

export const landingApi = {
  submitContact: (data: { name: string; email: string; company?: string; phone?: string; message: string }) =>
    apiRequest("/landing/contact", { method: "POST", body: data as unknown as Record<string, unknown> }),
};

// ─── Payments API ──────────────────────────────────────────────────

export interface PaymentDetails {
  payment_code: string;
  purpose?: "registration" | "upgrade" | "renewal";
  plan_name: string;
  billing_cycle: string;
  amount: number;
  currency: string;
  status?: "pending" | "paid" | "failed" | "cancelled";
  payer_name?: string | null;
  payer_email?: string | null;
  org_name?: string | null;
  invoice_number?: string | null;
  period_start?: string | null;
  period_end?: string | null;
  paid_at?: string | null;
  created_at?: string | null;
}

export const paymentApi = {
  // Public — payment page lookup & confirmation (temporary; gateway webhook later)
  get: (code: string) => apiRequest<{ payment: PaymentDetails }>(`/payments/${code}`),
  confirm: (code: string) =>
    apiRequest<{ payment: PaymentDetails }>(`/payments/${code}/confirm`, { method: "POST" }),

  // Authenticated (admin)
  checkout: (token: string, body: { plan_name: string; billing_cycle: string; purpose: "upgrade" | "renewal" }) =>
    apiRequest<{ payment: PaymentDetails }>("/payments/checkout", {
      method: "POST",
      body: body as unknown as Record<string, unknown>,
      token,
    }),
  list: (token: string) => apiRequest<{ payments: PaymentDetails[] }>("/payments", { token }),
};