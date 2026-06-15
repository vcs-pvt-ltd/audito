"use client";

import { ExecutionProvider } from "@/context/ExecutionContext";
import ExecutionListPage from "@/components/shared/ExecutionListPage";

export default function MyAuditsPage() {
  return (
    <ExecutionProvider workflowType="audit">
      <ExecutionListPage basePath="/my-audits" />
    </ExecutionProvider>
  );
}
