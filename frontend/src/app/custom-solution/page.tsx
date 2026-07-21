"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

/** Custom workspaces now begin by selecting the organization account type. */
export default function CustomSolutionPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/register?plan=Custom");
  }, [router]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-3 px-4 text-center">
      <Loader2 size={28} className="animate-spin text-secondary-400" />
      <p className="text-sm text-gray-400">Opening custom workspace setup…</p>
    </div>
  );
}
