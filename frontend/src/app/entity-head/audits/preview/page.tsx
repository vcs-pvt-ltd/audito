"use client";

import { Suspense } from "react";
import ClientPage from "./ClientPage";
import Loading from "@/components/shared/Loading";

export default function EntityHeadAuditPreviewPage() {
  return (
    <Suspense fallback={<Loading />}>
      <ClientPage />
    </Suspense>
  );
}
