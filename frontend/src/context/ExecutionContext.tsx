"use client";

import React, { createContext, useContext } from "react";

export type WorkflowType = "audit" | "cap";

interface ExecutionContextType {
  workflowType: WorkflowType;
  labels: {
    title: string;
    description: string;
    statusField: "status";
    codeField: "audit_code" | "cap_id";
    idField: "id";
  };
  apiConfig: {
    listEndpoint: "myAudits" | "list";
    executeEndpoint: "getDetail" | "getItems";
    submitEndpoint: "respond";
  };
}

const ExecutionContext = createContext<ExecutionContextType | null>(null);

interface ExecutionProviderProps {
  children: React.ReactNode;
  workflowType: WorkflowType;
}

export function ExecutionProvider({ children, workflowType }: ExecutionProviderProps) {
  const config: ExecutionContextType = {
    workflowType,
    labels: {
      title: workflowType === "audit" ? "My Audits" : "My CAP Plans",
      description:
        workflowType === "audit"
          ? "Your assigned audit tasks and progress overview"
          : "Your corrective action plans and progress overview",
      statusField: "status",
      codeField: workflowType === "audit" ? "audit_code" : "cap_id",
      idField: "id",
    },
    apiConfig: {
      listEndpoint: workflowType === "audit" ? "myAudits" : "list",
      executeEndpoint: workflowType === "audit" ? "getDetail" : "getItems",
      submitEndpoint: workflowType === "audit" ? "respond" : "respond",
    },
  };

  return <ExecutionContext.Provider value={config}>{children}</ExecutionContext.Provider>;
}

export function useExecution() {
  const context = useContext(ExecutionContext);
  if (!context) {
    throw new Error("useExecution must be used within ExecutionProvider");
  }
  return context;
}
