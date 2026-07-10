import { FrontDeskShell } from "./FrontDeskShell";
import { BareAdminLayoutProvider } from "@/components/admin/BareAdminLayoutContext";
import FrontDeskKioskInner from "@/pages/FrontDesk";

/**
 * /frontdesk — Reception check-in home.
 * Reuses the existing FrontDesk page (member search + attendance + rosters).
 * The existing page's own KioskPinGate is a no-op here because our shell
 * shares the `kioskUnlocked` sessionStorage flag.
 */
export default function FrontDeskReception() {
  return (
    <FrontDeskShell>
      <BareAdminLayoutProvider>
        <FrontDeskKioskInner />
      </BareAdminLayoutProvider>
    </FrontDeskShell>
  );
}
