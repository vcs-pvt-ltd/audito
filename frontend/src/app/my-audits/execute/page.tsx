"use client";

import { Suspense } from "react";
import { ExecutionProvider } from "@/context/ExecutionContext";
import AuditExecuteContent from "./content";
import Loading from "@/components/shared/Loading";

export default function MyAuditExecutePage() {
  return (
    <Suspense fallback={<Loading />}>
      <ExecutionProvider workflowType="audit">
        <AuditExecuteContent />
      </ExecutionProvider>
    </Suspense>
  );
}
