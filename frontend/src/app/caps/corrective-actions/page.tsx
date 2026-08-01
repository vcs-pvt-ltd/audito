import { Suspense } from "react";
import Loading from "@/components/shared/Loading";
import CorrectiveActionsViewer from "@/components/corrective-actions/CorrectiveActionsViewer";

export default function CapCorrectiveActionsPage() {
  return (
    <Suspense fallback={<Loading />}>
      <CorrectiveActionsViewer sourceType="cap" requiredRole="admin" backPath="/caps/details" backIdParam="id" />
    </Suspense>
  );
}
