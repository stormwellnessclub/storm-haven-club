import { FrontDeskShell } from "./FrontDeskShell";
import { BareAdminLayoutProvider } from "@/components/admin/BareAdminLayoutContext";
import AdminCafePOS from "@/pages/admin/CafePOS";

/**
 * /frontdesk/cafe — cafe order queue (kitchen may miss orders otherwise).
 */
export default function FrontDeskCafePage() {
  return (
    <FrontDeskShell>
      <BareAdminLayoutProvider>
        <AdminCafePOS />
      </BareAdminLayoutProvider>
    </FrontDeskShell>
  );
}
