import { FrontDeskShell } from "./FrontDeskShell";
import { BareAdminLayoutProvider } from "@/components/admin/BareAdminLayoutContext";
import AdminNonMemberAccounts from "@/pages/admin/NonMemberAccounts";

/**
 * /frontdesk/non-members — non-member account lookup.
 */
export default function FrontDeskNonMembersPage() {
  return (
    <FrontDeskShell>
      <BareAdminLayoutProvider>
        <AdminNonMemberAccounts />
      </BareAdminLayoutProvider>
    </FrontDeskShell>
  );
}
