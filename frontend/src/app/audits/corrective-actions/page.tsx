import { Suspense } from "react";
import Loading from "@/components/shared/Loading";
import CorrectiveActionsViewer from "@/components/corrective-actions/CorrectiveActionsViewer";

export default function AuditCorrectiveActionsPage() {
  return (
    <Suspense fallback={<Loading />}>
      <CorrectiveActionsViewer sourceType="audit" requiredRole="admin" backPath="/audits/details" backIdParam="id" />
    </Suspense>
  );
}
