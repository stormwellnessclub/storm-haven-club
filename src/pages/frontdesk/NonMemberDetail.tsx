import { FrontDeskShell } from "./FrontDeskShell";
import { BareAdminLayoutProvider } from "@/components/admin/BareAdminLayoutContext";
import AdminNonMemberDetail from "@/pages/admin/NonMemberDetail";

/**
 * /frontdesk/non-members/:userId — non-member account detail inside the
 * Front Desk shell so staff are never bounced to the auth-gated /admin area.
 */
export default function FrontDeskNonMemberDetailPage() {
  return (
    <FrontDeskShell>
      <BareAdminLayoutProvider>
        <AdminNonMemberDetail />
      </BareAdminLayoutProvider>
    </FrontDeskShell>
  );
}
