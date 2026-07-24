"use client";

import Image from "next/image";
import { ArrowLeft, FileText, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import logo from "@/assets/logo/audito_logo.png";
import { landingApi, type PrivacyPolicy } from "@/lib/api";

export default function PrivacyPolicyPage() {
  const [policy, setPolicy] = useState<PrivacyPolicy | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    landingApi.getPrivacyPolicy().then((result) => {
      if (result.success && result.data) setPolicy(result.data);
      else setError(result.message || "The Privacy Policy is currently unavailable.");
    });
  }, []);

  const effectiveDate = policy?.effective_date || policy?.published_at;
  const closePolicyTab = () => window.close();
  return (
    <div className="min-h-screen bg-transparent">
      <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6 sm:py-20">
        <div className="mb-10">
          <button type="button" onClick={closePolicyTab} className="mb-6 inline-flex items-center gap-2 text-sm text-secondary-400 transition-colors hover:text-secondary-300"><ArrowLeft size={16} /> Back to Registration</button>
          <Image src={logo} alt="Audito" className="mb-6 h-auto w-28 object-contain" />
          <div className="flex items-start gap-3"><div className="mt-1 rounded-xl border border-secondary-400/20 bg-secondary-500/10 p-2 text-secondary-300"><FileText size={19} /></div><div><h1 className="text-3xl font-bold text-white sm:text-4xl">{policy?.title || "Privacy Policy"}</h1>{policy && <p className="mt-2 text-sm text-gray-400">Version {policy.version}{effectiveDate ? ` · Effective ${new Date(effectiveDate).toLocaleDateString()}` : ""}</p>}</div></div>
          {policy && <p className="mt-5 max-w-3xl text-sm leading-relaxed text-gray-400">{policy.intro}</p>}
        </div>

        {!policy && !error && <div className="flex min-h-48 items-center justify-center text-gray-400"><Loader2 size={22} className="mr-2 animate-spin" /> Loading Privacy Policy…</div>}
        {error && <div className="rounded-2xl border border-red-400/25 bg-red-500/10 p-5 text-sm text-red-200">{error}</div>}
        {policy && <div className="space-y-6">{policy.sections.map((section, index) => <article key={`${section.title}-${index}`} className="glass rounded-xl border border-white/10 p-6 sm:p-8"><h2 className="mb-3 text-lg font-bold text-white">{section.title}</h2><div className="whitespace-pre-line text-sm leading-relaxed text-gray-400">{section.content}</div></article>)}</div>}

        <div className="mt-12 border-t border-white/10 pt-8 text-center"><p className="text-xs text-gray-500">This Privacy Policy applies to all Audito users from its effective date.</p></div>
      </div>
    </div>
  );
}
