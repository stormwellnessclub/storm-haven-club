import { FrontDeskShell } from "./FrontDeskShell";
import { BareAdminLayoutProvider } from "@/components/admin/BareAdminLayoutContext";
import AdminClassRoster from "@/pages/admin/ClassRoster";

/**
 * /frontdesk/class-roster/:sessionId — reuse admin ClassRoster inside the
 * FrontDesk shell so front desk staff can view/manage the roster for a
 * single session without being kicked over to /admin (which is auth-gated).
 */
export default function FrontDeskClassRosterPage() {
  return (
    <FrontDeskShell>
      <BareAdminLayoutProvider>
        <AdminClassRoster />
      </BareAdminLayoutProvider>
    </FrontDeskShell>
  );
}
