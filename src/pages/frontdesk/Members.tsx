import { FrontDeskShell } from "./FrontDeskShell";
import { BareAdminLayoutProvider } from "@/components/admin/BareAdminLayoutContext";
import AdminMembers from "@/pages/admin/Members";

/**
 * /frontdesk/members — member lookup with credit/note/charge actions.
 * Reuses the admin Members page inside the front-desk shell.
 * Backend RLS and the MemberDetailSheet's own role checks enforce what
 * a front_desk role can actually see or edit.
 */
export default function FrontDeskMembersPage() {
  return (
    <FrontDeskShell>
      <BareAdminLayoutProvider>
        <AdminMembers />
      </BareAdminLayoutProvider>
    </FrontDeskShell>
  );
}
