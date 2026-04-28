import { KioskShell } from "@/components/kiosk/KioskShell";
import { BareAdminLayoutProvider } from "@/components/admin/BareAdminLayoutContext";
import FrontDeskKioskInner from "./FrontDesk";

/**
 * Reception kiosk mode — mirrors the existing /front-desk check-in interface
 * but lives inside the unified kiosk shell so staff can switch between modes.
 */
export default function KioskReception() {
  return (
    <KioskShell label="Reception • Check-In" mode="reception">
      <BareAdminLayoutProvider>
        {/* FrontDesk already gates on its own PIN; the shell shares the
            kioskUnlocked sessionStorage flag so this is a no-op once unlocked. */}
        <FrontDeskKioskInner />
      </BareAdminLayoutProvider>
    </KioskShell>
  );
}
