import { KioskShell } from "@/components/kiosk/KioskShell";
import { BareAdminLayoutProvider } from "@/components/admin/BareAdminLayoutContext";
import SpaManagement from "@/pages/admin/SpaManagement";

export default function KioskSpa() {
  return (
    <KioskShell label="Spa • Therapist Schedule" mode="spa">
      <BareAdminLayoutProvider>
        <SpaManagement />
      </BareAdminLayoutProvider>
    </KioskShell>
  );
}
