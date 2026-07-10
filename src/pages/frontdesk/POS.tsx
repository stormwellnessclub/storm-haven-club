import { FrontDeskShell } from "./FrontDeskShell";
import { BareAdminLayoutProvider } from "@/components/admin/BareAdminLayoutContext";
import FrontDeskPOSInner from "@/pages/admin/FrontDeskPOS";

/**
 * /frontdesk/pos — member lookup + POS.
 * Reuses the existing FrontDeskPOS admin page inside the front-desk shell.
 * Backend RLS/RPC role checks continue to enforce what a front_desk role
 * can actually charge/sell.
 */
export default function FrontDeskPOSPage() {
  return (
    <FrontDeskShell>
      <BareAdminLayoutProvider>
        <FrontDeskPOSInner />
      </BareAdminLayoutProvider>
    </FrontDeskShell>
  );
}
