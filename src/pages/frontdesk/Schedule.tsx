import { FrontDeskShell } from "./FrontDeskShell";
import { BareAdminLayoutProvider } from "@/components/admin/BareAdminLayoutContext";
import AdminClasses from "@/pages/admin/Classes";

/**
 * /frontdesk/schedule — today's class sessions + rosters.
 * Front desk gets the "today's sessions" view only (no class type editing,
 * no recurring schedule editing).
 */
export default function FrontDeskSchedule() {
  return (
    <FrontDeskShell>
      <BareAdminLayoutProvider>
        <AdminClasses />
      </BareAdminLayoutProvider>
    </FrontDeskShell>
  );
}
