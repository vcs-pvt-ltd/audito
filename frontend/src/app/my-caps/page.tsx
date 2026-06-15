"use client";

import { ExecutionProvider } from "@/context/ExecutionContext";
import ExecutionListPage from "@/components/shared/ExecutionListPage";

export default function MyCapsPage() {
  return (
    <ExecutionProvider workflowType="cap">
      <ExecutionListPage basePath="/my-caps" />
    </ExecutionProvider>
  );
}
