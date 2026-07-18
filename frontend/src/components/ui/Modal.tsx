"use client";

import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import IconButton from "./IconButton";

type Size = "sm" | "md" | "lg" | "xl";

const SIZE_CLASSES: Record<Size, string> = {
  sm: "max-w-sm",
  md: "max-w-lg",
  lg: "max-w-2xl",
  xl: "max-w-4xl",
};

export interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: React.ReactNode;
  description?: React.ReactNode;
  icon?: React.ReactNode;
  size?: Size;
  footer?: React.ReactNode;
  /** Optional compact actions rendered in the modal header before the close button. */
  headerActions?: React.ReactNode;
  hideClose?: boolean;
  /** Apply default padding to the body. Set false when the body manages its own layout. */
  bodyPadded?: boolean;
  children?: React.ReactNode;
}

/**
 * Shared modal shell — portal overlay + glass panel + header/close + optional footer.
 * Mirrors the inline modal markup used across the app so migrations are mechanical.
 */
export default function Modal({
  open,
  onClose,
  title,
  description,
  icon,
  size = "md",
  footer,
  headerActions,
  hideClose = false,
  bodyPadded = true,
  children,
}: ModalProps) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  if (!open || !mounted) return null;

  return createPortal(
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-md" onClick={onClose} />
      <div role="dialog" aria-modal="true" className={`relative glass bg-[#0b2118]/95 rounded-t-3xl sm:rounded-3xl w-full ${SIZE_CLASSES[size]} max-h-[92dvh] overflow-y-auto shadow-2xl border-white/15`}>
        {(title || icon || !hideClose) && (
          <div className="sticky top-0 z-10 flex items-center justify-between gap-3 p-5 sm:p-6 border-b border-white/10 bg-[#0b2118]/90 backdrop-blur-xl">
            <div className="flex items-center gap-3 min-w-0">
              {icon}
              <div className="min-w-0">
                {title && <h2 className="text-xl font-semibold tracking-tight text-white truncate">{title}</h2>}
                {description && <p className="text-xs text-gray-500 mt-0.5">{description}</p>}
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              {headerActions}
              {!hideClose && (
                <IconButton onClick={onClose} aria-label="Close">
                  <X size={20} />
                </IconButton>
              )}
            </div>
          </div>
        )}

        <div className={bodyPadded ? "p-5 sm:p-6" : ""}>{children}</div>

        {footer && <div className="flex flex-col-reverse gap-3 p-5 pt-0 sm:flex-row sm:justify-end">{footer}</div>}
      </div>
    </div>,
    document.body
  );
}
