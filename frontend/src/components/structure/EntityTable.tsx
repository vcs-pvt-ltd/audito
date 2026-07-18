"use client";

import { Pencil, Trash2, Lock } from "lucide-react";
import { Table, THead, Th, TBody, Tr, Td, IconButton } from "@/components/ui";

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
  created_at?: string | null;
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
    <Table>
      <THead>
        <Th className="w-12">#</Th>
        <Th>Name</Th>
        {parentLabel && <Th>{parentLabel}</Th>}
        <Th>Email</Th>
        <Th>Country</Th>
        <Th>Created At</Th>
        <Th align="right">Actions</Th>
      </THead>
      <TBody>
        {entities.map((entity, index) => (
          <Tr key={`${entity.code}-${index}`}>
            <Td className="text-gray-400 text-sm">{startIndex + index + 1}</Td>
            <Td className="text-white font-medium">{entity.name}</Td>
            {parentLabel && (
              <Td className="text-gray-400 text-xs">
                {entity.parent_name || entity.parent_code || "—"}
              </Td>
            )}
            <Td className="text-gray-400">{entity.email || "—"}</Td>
            <Td className="text-gray-400">{entity.country || "—"}</Td>
            <Td className="text-gray-400 text-xs">
              {entity.created_at ? new Date(entity.created_at).toLocaleDateString() : "—"}
            </Td>
            <Td align="right">
              <div className="flex items-center justify-end gap-1">
                {entity.is_linked ? (
                  // Linked (partner-owned) entities are view-only — no edit/delete.
                  <span className="text-[11px] text-gray-500 italic">Linked</span>
                ) : (
                  <>
                    <IconButton tone="secondary" onClick={() => onEdit(entity)} title="Edit">
                      <Pencil size={15} />
                    </IconButton>
                    {entity.in_tree ? (
                      <IconButton tone="warning" onClick={() => onDelete(entity)} title="Mapped in the organization tree. Click for details.">
                        <Lock size={15} />
                      </IconButton>
                    ) : (
                      <IconButton tone="danger" onClick={() => onDelete(entity)} title="Delete">
                        <Trash2 size={15} />
                      </IconButton>
                    )}
                  </>
                )}
              </div>
            </Td>
          </Tr>
        ))}
      </TBody>
    </Table>
  );
}
