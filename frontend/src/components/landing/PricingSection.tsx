"use client";

import PackageSelector from "@/components/pricing/PackageSelector";

export default function PricingSection({ dialog = false }: { dialog?: boolean }) {
  return <PackageSelector dialog={dialog} />;
}
