import { PortalLayout } from "@/components/portal/PortalLayout";
import { CafeOrderContent } from "@/components/cafe/CafeOrderContent";

export default function PortalCafe() {
  return (
    <PortalLayout title="Cafe Order">
      <CafeOrderContent variant="nonmember" />
    </PortalLayout>
  );
}
