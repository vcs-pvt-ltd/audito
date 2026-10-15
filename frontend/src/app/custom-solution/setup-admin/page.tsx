"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

/** Custom plans are retired; older emailed setup links open the Audito team contact form. */
export default function SetupCustomSolutionAdminPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/register?contact=1");
  }, [router]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-3 px-4 text-center">
      <Loader2 size={28} className="animate-spin text-secondary-400" />
      <p className="text-sm text-gray-400">Opening custom workspace setup…</p>
    </div>
  );
}
