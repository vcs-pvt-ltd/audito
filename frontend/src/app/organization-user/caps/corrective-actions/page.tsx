import { Suspense } from "react";
import Loading from "@/components/shared/Loading";
import CorrectiveActionsViewer from "@/components/corrective-actions/CorrectiveActionsViewer";

export default function OrganizationUserCapCorrectiveActionsPage() {
  return (
    <Suspense fallback={<Loading />}>
      <CorrectiveActionsViewer sourceType="cap" requiredRole="organization_user" backPath="/organization-user/caps/preview" backIdParam="cap_id" />
    </Suspense>
  );
}
