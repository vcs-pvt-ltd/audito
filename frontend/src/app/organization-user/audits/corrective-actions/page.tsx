import { Suspense } from "react";
import Loading from "@/components/shared/Loading";
import CorrectiveActionsViewer from "@/components/corrective-actions/CorrectiveActionsViewer";

export default function OrganizationUserAuditCorrectiveActionsPage() {
  return (
    <Suspense fallback={<Loading />}>
      <CorrectiveActionsViewer sourceType="audit" requiredRole="organization_user" backPath="/organization-user/audits/preview" backIdParam="audit_id" />
    </Suspense>
  );
}
