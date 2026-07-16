"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { useUiFeedback } from "@/context/UiFeedbackContext";
import { structureApi, authApi } from "@/lib/api";

import EntityTable, {
  type EntityRow,
} from "@/components/structure/EntityTable";
import AddEditEntityModal, {
  type EntityFormData,
} from "@/components/structure/AddEditEntityModal";
import { Plus, RefreshCw, Pencil, Trash2, Search, Crown, Lock, Building2 } from "lucide-react";
import LimitReachedModal from "@/components/modals/LimitReachedModal";
import TablePagination from "@/components/shared/TablePagination";
import EmptyState from "@/components/shared/EmptyState";
import { Button, IconButton } from "@/components/ui";

// ─── Configuration per entity type ───────────────────────────────

interface EntityConfig {
  label: string;
  labelPlural: string;
  codeField: string;
  accountTypes: string[];
  apiSlug: string;
  entityTypeBody: string;
}

const ENTITY_CONFIGS: Record<string, EntityConfig> = {
  // Company itself — only ever shown read-only to a linked Supplier (Customer account).
  // accountTypes[0] is "Company" so canCreateEntities is false for a Customer/Supplier.
  company: {
    label: "Company",
    labelPlural: "Companies",
    codeField: "comp_code",
    accountTypes: ["Company", "Customer"],
    apiSlug: "company",
    entityTypeBody: "Company",
  },
  "buying-office": {
    label: "Buying Office",
    labelPlural: "Buying Offices",
    codeField: "cbo_code",
    accountTypes: ["Customer"],
    apiSlug: "buying-office",
    entityTypeBody: "Buying Office",
  },
  supplier: {
    label: "Supplier",
    labelPlural: "Suppliers",
    codeField: "csup_code",
    accountTypes: ["Customer"],
    apiSlug: "supplier",
    entityTypeBody: "Supplier",
  },
  cluster: {
    label: "Cluster",
    labelPlural: "Clusters",
    codeField: "comp_clus_code",
    accountTypes: ["Company", "Customer"],
    apiSlug: "cluster",
    entityTypeBody: "Cluster",
  },
  factory: {
    label: "Factory",
    labelPlural: "Factories",
    codeField: "comp_fact_code",
    accountTypes: ["Company", "Customer"],
    apiSlug: "factory",
    entityTypeBody: "Factory",
  },
  unit: {
    label: "Unit",
    labelPlural: "Units",
    codeField: "comp_unit_code",
    accountTypes: ["Company", "Customer"],
    apiSlug: "unit",
    entityTypeBody: "Unit",
  },
  department: {
    label: "Department",
    labelPlural: "Departments",
    codeField: "comp_dept_code",
    accountTypes: ["Company", "Customer"],
    apiSlug: "department",
    entityTypeBody: "Department",
  },
  section: {
    label: "Section",
    labelPlural: "Sections",
    codeField: "comp_section_code",
    accountTypes: ["Company", "Customer"],
    apiSlug: "section",
    entityTypeBody: "Section",
  },
  branch: {
    label: "Branch",
    labelPlural: "Branches",
    codeField: "afc_branch_code",
    accountTypes: ["Audit Firm"],
    apiSlug: "branch",
    entityTypeBody: "Branch",
  },
  "audit-firm-department": {
    label: "Department",
    labelPlural: "Departments",
    codeField: "afc_dept_code",
    accountTypes: ["Audit Firm"],
    apiSlug: "audit-firm-department",
    entityTypeBody: "Audit Firm Department",
  },
};

const ORDER_BY_ACCOUNT: Record<string, string[]> = {
  Company: ["cluster", "factory", "unit", "department", "section"],
  Customer: ["buying-office", "supplier"],
  "Audit Firm": ["branch", "audit-firm-department"],
};

const FIRST_CHILD_BY_ROOT_ENTITY_TYPE: Record<string, string> = {
  Company: "Cluster",
  Cluster: "Factory",
  Factory: "Unit",
  Unit: "Department",
  Department: "Section",
  "Audit Firm Company": "Branch",
  Branch: "Audit Firm Department",
};

// ─── Page Component ──────────────────────────────────────────────

export default function SetupStructurePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { admin, accessToken, isLoading } = useAuth();
  const { alert, confirm, toast } = useUiFeedback();

  const entityType = searchParams.get("type") as string;
  const config = ENTITY_CONFIGS[entityType];

  const [entities, setEntities] = useState<EntityRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [limitModalOpen, setLimitModalOpen] = useState(false);
  const [editEntity, setEditEntity] = useState<EntityRow | null>(null);
  const [orderBlockMessage, setOrderBlockMessage] = useState<string | null>(null);
  const [orgRegistrationNumber, setOrgRegistrationNumber] = useState<string>("");
  const [orgCountry, setOrgCountry] = useState<string>("");

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    if (!isLoading && !admin) router.push("/login");
  }, [isLoading, admin, router]);

  // ─── Fetch organization registration number ────
  useEffect(() => {
    if (!accessToken) return;
    authApi
      .getMe(accessToken)
      .then((res) => {
        if (res.success && res.data) {
          const data = res.data as { organization?: { registration_number?: string; country?: string } };
          setOrgRegistrationNumber(data.organization?.registration_number || "");
          setOrgCountry(data.organization?.country || "");
        }
      })
      .catch(() => {
        setOrgRegistrationNumber("");
        setOrgCountry("");
      });
  }, [accessToken]);

  // ─── Fetch entities ────────────────────────
  const fetchEntities = useCallback(async () => {
    if (!accessToken || !config) return;
    setLoading(true);

    try {
      const entitiesRes = await structureApi.listByType(accessToken, config.apiSlug);

      if (entitiesRes.success && entitiesRes.data) {
        const data = entitiesRes.data as { items: EntityRow[] };
        setEntities(
          data.items.map((item, index) => ({
            ...item,
            code: item[config.codeField] ? String(item[config.codeField]) : `temp-${index}`,
          }))
        );
      }

      // Enforce ordered entity creation by account type:
      // cannot create a deeper level before its immediate parent level exists.
      if (admin?.role === "admin") {
        const LEVEL_MAP: Record<string, number> = {
          "buying-office": 7,
          "supplier": 7,
          "cluster": 4,
          "factory": 3,
          "unit": 2,
          "department": 1,
          "section": 0,
          "branch": 3,
          "audit-firm-department": 1,
        };

        const orgLevel = admin.org_level ?? 0;
        const fullOrder = ORDER_BY_ACCOUNT[admin.account_type || ""] || [];
        // Filter the order to only include levels below the admin's own level
        const order = fullOrder.filter(slug => orgLevel > (LEVEL_MAP[slug] ?? -1));

        const idx = order.indexOf(entityType);
        if (idx > 0) {
          const prevSlug = order[idx - 1];
          const prevConfig = ENTITY_CONFIGS[prevSlug];
          if (prevConfig) {
            const prevRes = await structureApi.listByType(accessToken, prevConfig.apiSlug);
            const prevCount = prevRes.success && prevRes.data ? (((prevRes.data as any).items || []).length) : 0;
            if (prevCount <= 0) {
              setOrderBlockMessage(`Create at least one ${prevConfig.label} before creating ${config.labelPlural}.`);
            } else {
              setOrderBlockMessage(null);
            }
          } else {
            setOrderBlockMessage(null);
          }
        } else {
          setOrderBlockMessage(null);
        }
      }
    } catch (err) {
      console.error("Data load failed", err);
    } finally {
      setLoading(false);
    }
  }, [accessToken, config, admin?.role, admin?.account_type, entityType]);

  useEffect(() => {
    fetchEntities();
  }, [fetchEntities]);

  const filtered = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return entities;
    return entities.filter(e => 
      e.name.toLowerCase().includes(query) || 
      (e.email as string)?.toLowerCase().includes(query) ||
      (e.country as string)?.toLowerCase().includes(query)
    );
  }, [entities, searchQuery]);

  // Reset page when search or filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, entityType]);

  const totalPages = Math.ceil(filtered.length / pageSize);
  const paginated = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, currentPage, pageSize]);

  if (isLoading) {
    return (
      <div className="h-screen bg-transparent flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-secondary-400 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }
  if (!admin) return null;

  // ─── Guard ─────────────────────────────────────────────────────
  if (!config) {
    return (
      <div className="min-h-full bg-transparent flex flex-col w-full">
        <main className="flex-1 p-6 lg:p-8 pt-20 lg:pt-8 ">
          <div className="text-center py-20">
            <p className="text-gray-400">Invalid entity type.</p>
          </div>
        </main>
      </div>
    );
  }

  if (!config.accountTypes.includes(admin.account_type || "")) {
    return (
      <div className="min-h-full bg-transparent flex flex-col w-full">
        <main className="flex-1 p-6 lg:p-8 pt-20 lg:pt-8 ">
          <div className="text-center py-20">
            <p className="text-gray-400">
              This entity type is not available for your account.
            </p>
          </div>
        </main>
      </div>
    );
  }

  const normalizedAccountType =
    admin.account_type === "Audit Firm Company" ? "Audit Firm" : admin.account_type || "";
  const canCreateEntities = config.accountTypes[0] === normalizedAccountType;

  const usesStructurePlanLimits = normalizedAccountType === "Company" || normalizedAccountType === "Audit Firm";
  const isFirstChildType = FIRST_CHILD_BY_ROOT_ENTITY_TYPE[admin.entity_type || ""] === config.entityTypeBody;
  const entityLimit = usesStructurePlanLimits
    ? (isFirstChildType ? admin.plan_limits?.company_level : admin.plan_limits?.department)
    : undefined;

  const isLimitExceeded = entityLimit !== undefined && entities.length >= entityLimit;

  const handleAdd = async () => {
    if (orderBlockMessage) {
      await alert({
        title: "Order Required",
        message: orderBlockMessage,
        variant: "warning",
      });
      return;
    }
    if (entityLimit !== undefined && entities.length >= entityLimit) {
      setLimitModalOpen(true);
      return;
    }
    setEditEntity(null);
    setModalOpen(true);
  };

  const handleEdit = (entity: EntityRow) => {
    setEditEntity(entity);
    setModalOpen(true);
  };

  const handleDelete = async (entity: EntityRow) => {
    if (!accessToken) return;
    // Safety net (in case the entity got mapped after the list loaded):
    // explain why it can't be deleted instead of firing a request that 403s.
    if (entity.in_tree) {
      await alert({
        title: "Cannot Delete",
        message: `"${entity.name}" is currently mapped in your organization tree. Remove it from the Organization page first, then delete it here.`,
        variant: "warning",
      });
      return;
    }
    const confirmed = await confirm({
      title: "Delete Entity",
      message: `Are you sure you want to delete "${entity.name}"?`,
      confirmText: "Delete",
      variant: "warning",
    });
    if (!confirmed) return;
    const res = await structureApi.deleteSubEntity(
      accessToken,
      config.apiSlug,
      entity.code
    );
    if (res.success) {
      toast("Entity deleted successfully.", "success");
      fetchEntities();
    } else {
      toast(res.message || "Failed to delete entity.", "error");
    }
  };

  const handleSubmit = async (formData: EntityFormData) => {
    if (!accessToken) return;

    if (editEntity) {
      const res = await structureApi.updateSubEntity(
        accessToken,
        config.apiSlug,
        editEntity.code,
        {
          name: formData.name,
          registration_number: formData.registration_number || null,
          email: formData.email.trim(),
          phone_number: formData.phone_number || null,
          address_line_1: formData.address_line_1 || null,
          address_line_2: formData.address_line_2 || null,
          address_line_3: formData.address_line_3 || null,
          country: formData.country || null,
        }
      );
      if (!res.success) {
        throw new Error(res.message || "Failed to update.");
      }
      toast("Entity updated successfully.", "success");
    } else {
      const body: Record<string, unknown> = {
        entity_type: config.entityTypeBody,
        name: formData.name,
        registration_number: formData.registration_number || null,
        email: formData.email.trim(),
        phone_number: formData.phone_number || null,
        address_line_1: formData.address_line_1 || null,
        address_line_2: formData.address_line_2 || null,
        address_line_3: formData.address_line_3 || null,
        country: formData.country || null,
      };
      const res = await structureApi.createSubEntity(accessToken, body);
      if (!res.success) {
        throw new Error(res.message || "Failed to create.");
      }
      toast("Entity added successfully.", "success");
    }
    fetchEntities();
  };

  // ─── Render ────────────────────────────────────────────────────
  return (
    <div className="min-h-full bg-transparent flex flex-col w-full h-full overflow-y-auto">
      <main className="flex-1 p-6 lg:p-8 pt-20 lg:pt-8 ">
        <LimitReachedModal
          isOpen={limitModalOpen}
          onClose={() => setLimitModalOpen(false)}
          title="Structure Entity Limit Reached"
          message={isFirstChildType
            ? "Your plan has reached the first hierarchy entity capacity. Upgrade to add more entities at this level."
            : "Your plan has reached the allowed number of this structure entity type. Upgrade to add more."}
          limit={entityLimit || 0}
        />
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-xl font-bold text-white flex items-center gap-2">
              <Plus size={22} className="text-secondary-400" />
              {config.labelPlural}
            </h1>
            <p className="hidden sm:block text-sm text-gray-400 mt-0.5">
              Define and manage {config.labelPlural.toLowerCase()} to build your organizational hierarchy.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <IconButton bordered size="lg" onClick={fetchEntities} title="Refresh">
              <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
            </IconButton>
            {canCreateEntities && (
              <Button
                onClick={handleAdd}
                disabled={!!orderBlockMessage}
                leftIcon={isLimitExceeded ? <Crown size={16} /> : <Plus size={16} />}
              >
                <span className="sm:hidden">{isLimitExceeded ? "Upgrade" : "Add"}</span>
                <span className="hidden sm:block">{isLimitExceeded ? "Upgrade" : `Add ${config.label}`}</span>
              </Button>
            )}
          </div>
        </div>

        {orderBlockMessage && (
          <div className="mb-5 rounded-xl border border-amber-500/25 bg-amber-500/10 px-4 py-3">
            <p className="text-sm text-amber-200">{orderBlockMessage}</p>
          </div>
        )}

        {/* Search Bar */}
        {!loading && entities.length > 0 && (
          <div className="mb-6 max-w-lg">
            <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl glass border border-white/[0.06]">
              <Search size={14} className="text-gray-500" />
              <input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={`Search ${config.labelPlural.toLowerCase()}...`}
                className="bg-transparent outline-none text-sm text-gray-200 placeholder:text-gray-600 w-full"
              />
            </div>
          </div>
        )}

        {/* Data */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-8 h-8 border-2 border-secondary-400 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : entities.length === 0 ? (
          <EmptyState
            icon={Building2}
            title={`No ${config.labelPlural.toLowerCase()} yet`}
            message={`Define and manage ${config.labelPlural.toLowerCase()} to build your organizational hierarchy.`}
            action={canCreateEntities ? (
              <button
                onClick={handleAdd}
                disabled={!!orderBlockMessage}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium bg-secondary-500 text-primary-950 hover:bg-secondary-400 transition-all disabled:opacity-20"
              >
                <Plus size={16} />
                {`Add ${config.label}`}
              </button>
            ) : undefined}
          />
        ) : filtered.length === 0 ? (
          <div className="glass rounded-xl p-16 text-center">
            <Search size={36} className="text-gray-600 mx-auto mb-4" />
            <p className="text-white font-medium mb-1">No matching results</p>
            <p className="text-gray-400 text-sm">Try adjusting your search query.</p>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="hidden md:block">
              <EntityTable
                entities={paginated}
                entityLabel={config.label}
                codeField={config.codeField}
                onEdit={handleEdit}
                onDelete={handleDelete}
                startIndex={(currentPage - 1) * pageSize}
              />
            </div>

            <div className="md:hidden space-y-3">
              {paginated.map((entity, index) => {
                const itemIndex = (currentPage - 1) * pageSize + index + 1;
                return (
                  <div key={`${entity.code}-${index}`} className="glass rounded-xl border border-white/10 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-xs text-gray-500">#{itemIndex}</p>
                        <h3 className="text-sm font-semibold text-white truncate">{entity.name}</h3>
                      </div>
                    </div>

                    <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                      <div className="rounded-lg bg-white/[0.03] border border-white/10 px-2.5 py-2">
                        <p className="text-gray-500">Email</p>
                        <p className="text-gray-300 mt-0.5 truncate">{(entity.email as string) || "-"}</p>
                      </div>
                      <div className="rounded-lg bg-white/[0.03] border border-white/10 px-2.5 py-2">
                        <p className="text-gray-500">Phone</p>
                        <p className="text-gray-300 mt-0.5 truncate">{(entity.phone_number as string) || "-"}</p>
                      </div>
                      <div className="col-span-2 rounded-lg bg-white/[0.03] border border-white/10 px-2.5 py-2">
                        <p className="text-gray-500">Country</p>
                        <p className="text-gray-300 mt-0.5 truncate">{(entity.country as string) || "-"}</p>
                      </div>
                    </div>

                    <div className="mt-3 flex items-center justify-end gap-1">
                      <button
                        onClick={() => handleEdit(entity)}
                        className="p-2 rounded-lg text-gray-400 hover:text-secondary-400 hover:bg-secondary-500/10 transition-all font-medium"
                        title="Edit"
                      >
                        <Pencil size={15} />
                      </button>
                      {entity.in_tree ? (
                        <button
                          onClick={() => handleDelete(entity)}
                          className="p-2 rounded-lg text-gray-500 hover:text-amber-400 hover:bg-amber-500/10 transition-all font-medium"
                          title="Mapped in the organization tree. Tap for details."
                        >
                          <Lock size={15} />
                        </button>
                      ) : (
                        <button
                          onClick={() => handleDelete(entity)}
                          className="p-2 rounded-lg text-gray-400 hover:text-red-400 hover:bg-red-500/10 transition-all font-medium"
                          title="Delete"
                        >
                          <Trash2 size={15} />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            <TablePagination
              currentPage={currentPage}
              totalPages={totalPages}
              pageSize={pageSize}
              totalItems={filtered.length}
              onPageChange={setCurrentPage}
              onPageSizeChange={setPageSize}
            />
          </div>
        )}

        {/* Modal */}
        <AddEditEntityModal
          open={modalOpen}
          onClose={() => setModalOpen(false)}
          onSubmit={handleSubmit}
          entityLabel={config.label}
          editData={
            editEntity
              ? {
                name: editEntity.name,
                registration_number:
                  (editEntity.registration_number as string) || "",
                email: (editEntity.email as string) || "",
                phone_number: (editEntity.phone_number as string) || "",
                address_line_1: (editEntity.address_line_1 as string) || "",
                address_line_2: (editEntity.address_line_2 as string) || "",
                address_line_3: (editEntity.address_line_3 as string) || "",
                country: (editEntity.country as string) || "",
                parent_code: "",
              }
              : null
          }
          orgRegistrationNumber={orgRegistrationNumber}
          orgCountry={orgCountry}
        />
      </main>
    </div>
  );
}
