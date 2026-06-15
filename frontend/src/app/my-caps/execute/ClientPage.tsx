"use client";

import { ExecutionProvider } from "@/context/ExecutionContext";
import CapExecuteContent from "./content";

export default function MyCapExecutePage() {
  return (
    <ExecutionProvider workflowType="cap">
      <CapExecuteContent />
    </ExecutionProvider>
  );
}



