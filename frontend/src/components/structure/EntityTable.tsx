"use client";

import { Pencil, Trash2, Lock, ChevronDown, ChevronUp } from "lucide-react";

export interface EntityRow {
  [key: string]: unknown;
  name: string;
  code: string;
  registration_number?: string | null;
  email?: string | null;
  country?: string | null;
  phone_number?: string | null;
  is_active?: boolean;
  is_linked?: boolean;
  in_tree?: boolean;
  parent_code?: string | null;
  parent_name?: string | null;
}

interface EntityTableProps {
  entities: EntityRow[];
  entityLabel: string;
  codeField: string;
  parentLabel?: string;
  onEdit: (entity: EntityRow) => void;
  onDelete: (entity: EntityRow) => void;
  startIndex?: number;
}

export default function EntityTable({
  entities,
  entityLabel,
  codeField,
  parentLabel,
  onEdit,
  onDelete,
  startIndex = 0,
}: EntityTableProps) {
  if (entities.length === 0) {
    return (
      <div className="glass rounded-xl p-10 text-center">
        <p className="text-gray-400 text-sm">
          No {entityLabel.toLowerCase()} found. Add your first one above.
        </p>
      </div>
    );
  }

  return (
    <div className="glass rounded-xl overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-white/10">
              <th className="text-left px-4 py-3 text-gray-400 font-medium w-12">
                #
              </th>
              <th className="text-left px-4 py-3 text-gray-400 font-medium">
                Name
              </th>
              
              {parentLabel && (
                <th className="text-left px-4 py-3 text-gray-400 font-medium">
                  {parentLabel}
                </th>
              )}
              <th className="text-left px-4 py-3 text-gray-400 font-medium">
                Email
              </th>
              <th className="text-left px-4 py-3 text-gray-400 font-medium">
                Country
              </th>
              <th className="text-left px-4 py-3 text-gray-400 font-medium">
                Status
              </th>
              <th className="text-right px-4 py-3 text-gray-400 font-medium">
                Actions
              </th>
            </tr>
          </thead>
          <tbody>
            {entities.map((entity, index) => (
              <tr
                key={`${entity.code}-${index}`}
                className="border-b border-white/5 hover:bg-white/[0.02] transition-colors"
              >
                <td className="px-4 py-3 text-gray-400 text-sm">
                  {startIndex + index + 1}
                </td>
                <td className="px-4 py-3 text-white font-medium">
                  {entity.name}
                </td>
               
                {parentLabel && (
                  <td className="px-4 py-3 text-gray-400 text-xs">
                    {entity.parent_name || entity.parent_code || "—"}
                  </td>
                )}
                <td className="px-4 py-3 text-gray-400">
                  {entity.email || "—"}
                </td>
                <td className="px-4 py-3 text-gray-400">
                  {entity.country || "—"}
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                      entity.is_active !== false
                        ? "bg-primary-500/15 text-primary-400"
                        : "bg-red-500/15 text-red-400"
                    }`}
                  >
                    {entity.is_active !== false ? "Active" : "Inactive"}
                  </span>
                </td>
                <td className="px-4 py-3 text-right">
                  <div className="flex items-center justify-end gap-1">
                    {entity.is_linked ? (
                      // Linked (partner-owned) entities are view-only — no edit/delete.
                      <span className="text-[11px] text-gray-500 italic">Linked</span>
                    ) : (
                      <>
                        <button
                          onClick={() => onEdit(entity)}
                          className="p-1.5 rounded-lg text-gray-400 hover:text-secondary-400 hover:bg-secondary-500/10 transition-all"
                          title="Edit"
                        >
                          <Pencil size={15} />
                        </button>
                        {entity.in_tree ? (
                          <button
                            onClick={() => onDelete(entity)}
                            className="p-1.5 rounded-lg text-gray-500 hover:text-amber-400 hover:bg-amber-500/10 transition-all"
                            title="Mapped in the organization tree. Click for details."
                          >
                            <Lock size={15} />
                          </button>
                        ) : (
                          <button
                            onClick={() => onDelete(entity)}
                            className="p-1.5 rounded-lg text-gray-400 hover:text-red-400 hover:bg-red-500/10 transition-all"
                            title="Delete"
                          >
                            <Trash2 size={15} />
                          </button>
                        )}
                      </>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
