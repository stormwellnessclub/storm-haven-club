import { FrontDeskShell } from "./FrontDeskShell";
import { BareAdminLayoutProvider } from "@/components/admin/BareAdminLayoutContext";
import AdminGuestPasses from "@/pages/admin/GuestPasses";

/**
 * /frontdesk/guest-passes — today's guest passes, mark used, sell new.
 */
export default function FrontDeskGuestPassesPage() {
  return (
    <FrontDeskShell>
      <BareAdminLayoutProvider>
        <AdminGuestPasses />
      </BareAdminLayoutProvider>
    </FrontDeskShell>
  );
}
