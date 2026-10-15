"use client";

import { Mail, MessageCircle } from "lucide-react";
import { DEFAULT_AUDITO_CONTACT, type AuditoContact } from "@/lib/auditoContact";

/** WhatsApp and email buttons for reaching the Audito team. */
export default function AuditoContactCard({ contact = DEFAULT_AUDITO_CONTACT, title = "Talk to the Audito team", description, message }: {
  contact?: AuditoContact | null;
  title?: string;
  description?: string;
  /** Pre-filled WhatsApp and email text, for example the organization name. */
  message?: string;
}) {
  const details = contact || DEFAULT_AUDITO_CONTACT;
  const text = message ? encodeURIComponent(message) : "";
  const whatsappHref = details.whatsapp_url ? `${details.whatsapp_url}${text ? `?text=${text}` : ""}` : null;
  const mailHref = `mailto:${details.email}${text ? `?subject=${encodeURIComponent("Audito account request")}&body=${text}` : ""}`;
  return <section aria-label={title} className="rounded-2xl border border-secondary-500/20 bg-secondary-500/[0.06] p-4 text-left">
    <p className="text-sm font-semibold text-white">{title}</p>
    {description && <p className="mt-1 text-xs leading-relaxed text-gray-400">{description}</p>}
    <div className="mt-3 grid gap-2 sm:grid-cols-2">
      {whatsappHref && <a href={whatsappHref} target="_blank" rel="noopener noreferrer"
        className="flex min-h-11 items-center gap-3 rounded-xl border border-white/10 bg-black/15 px-3 py-2 transition-colors hover:border-primary-400/40 hover:bg-primary-500/10">
        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-primary-500/15 text-primary-300" aria-hidden><MessageCircle size={16} /></span>
        <span className="min-w-0"><span className="block text-[11px] text-gray-400">WhatsApp</span><span className="block truncate text-sm font-semibold text-white">{details.whatsapp}</span></span>
      </a>}
      <a href={mailHref}
        className="flex min-h-11 items-center gap-3 rounded-xl border border-white/10 bg-black/15 px-3 py-2 transition-colors hover:border-secondary-400/40 hover:bg-secondary-500/10">
        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-secondary-500/15 text-secondary-300" aria-hidden><Mail size={16} /></span>
        <span className="min-w-0"><span className="block text-[11px] text-gray-400">Email</span><span className="block truncate text-sm font-semibold text-white">{details.email}</span></span>
      </a>
    </div>
  </section>;
}
