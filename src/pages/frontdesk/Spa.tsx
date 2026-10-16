import { FrontDeskShell } from "./FrontDeskShell";
import { BareAdminLayoutProvider } from "@/components/admin/BareAdminLayoutContext";
import AdminAppointments from "@/pages/admin/Appointments";
import { useSearchParams } from "react-router-dom";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { SpaRequestsTab } from "@/components/admin/spa/SpaRequestsTab";
import { useNewSpaRequestCount } from "@/hooks/useSpaServiceRequests";

/**
 * /frontdesk/spa — spa appointments view + book new appointment.
 * Reuses admin Appointments page (calendar + AdminSpaBookingModal).
 */
export default function FrontDeskSpaPage() {
  const [params, setParams] = useSearchParams();
  const tab = params.get("tab") === "requests" ? "requests" : "appointments";
  const newRequests = useNewSpaRequestCount();

  return (
    <FrontDeskShell>
      <BareAdminLayoutProvider>
        <Tabs value={tab} onValueChange={(value) => {
          const next = new URLSearchParams(params);
          next.set("tab", value);
          setParams(next, { replace: true });
        }} className="p-4 space-y-4">
          <TabsList>
            <TabsTrigger value="appointments">Appointments</TabsTrigger>
            <TabsTrigger value="requests">
              Appointment Requests
              {newRequests > 0 && (
                <span className="ml-2 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-destructive px-1.5 text-xs text-destructive-foreground">{newRequests}</span>
              )}
            </TabsTrigger>
          </TabsList>
          <TabsContent value="appointments"><AdminAppointments /></TabsContent>
          <TabsContent value="requests"><SpaRequestsTab /></TabsContent>
        </Tabs>
      </BareAdminLayoutProvider>
    </FrontDeskShell>
  );
}
