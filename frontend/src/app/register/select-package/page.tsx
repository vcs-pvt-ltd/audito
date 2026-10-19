"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

/** Package selection moved to /register/start; old links keep their query. */
export default function SelectPackagePage() {
  const router = useRouter();

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (!params.has("account_type")) params.set("account_type", "company");
    router.replace(`/register/start?${params}`);
  }, [router]);

  return <div className="flex min-h-screen items-center justify-center">
    <Loader2 size={32} className="animate-spin text-secondary-400" />
    <span className="sr-only">Opening package selection</span>
  </div>;
}
