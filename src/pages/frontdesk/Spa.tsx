import { FrontDeskShell } from "./FrontDeskShell";
import { BareAdminLayoutProvider } from "@/components/admin/BareAdminLayoutContext";
import AdminAppointments from "@/pages/admin/Appointments";

/**
 * /frontdesk/spa — spa appointments view + book new appointment.
 * Reuses admin Appointments page (calendar + AdminSpaBookingModal).
 */
export default function FrontDeskSpaPage() {
  return (
    <FrontDeskShell>
      <BareAdminLayoutProvider>
        <AdminAppointments />
      </BareAdminLayoutProvider>
    </FrontDeskShell>
  );
}
