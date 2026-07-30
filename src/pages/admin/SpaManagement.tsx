import { AdminLayout } from "@/components/admin/AdminLayout";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { SpaRequestsTab } from "@/components/admin/spa/SpaRequestsTab";
import { SpaServicesTab } from "@/components/admin/spa/SpaServicesTab";
import { SpaTherapistsTab } from "@/components/admin/spa/SpaTherapistsTab";
import { SpaRoomsTab } from "@/components/admin/spa/SpaRoomsTab";
import { SpaAvailabilityTab } from "@/components/admin/spa/SpaAvailabilityTab";
import { SpaAddonsTab } from "@/components/admin/spa/SpaAddonsTab";
import { SpaPayrollTab } from "@/components/admin/spa/SpaPayrollTab";
import { MothersDayTab } from "@/components/admin/spa/MothersDayTab";
import { SpaReviewsAdminTab } from "@/components/admin/spa/SpaReviewsAdminTab";
import { useSearchParams } from "react-router-dom";

export default function SpaManagement() {
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get("tab") || "services";
  const initialView = searchParams.get("view") || undefined;
  const initialDate = searchParams.get("date") || undefined;

  const handleTabChange = (value: string) => {
    const newParams = new URLSearchParams(searchParams);
    newParams.set("tab", value);
    // Clear view/date when switching away from availability
    if (value !== "availability") {
      newParams.delete("view");
      newParams.delete("date");
    }
    setSearchParams(newParams, { replace: true });
  };

  return (
    <AdminLayout title="Spa Management">
      <Tabs value={activeTab} onValueChange={handleTabChange} className="space-y-4">
        <TabsList className="flex-wrap h-auto gap-1">
          <TabsTrigger value="services">Services</TabsTrigger>
          <TabsTrigger value="therapists">Therapists</TabsTrigger>
          <TabsTrigger value="rooms">Rooms</TabsTrigger>
          <TabsTrigger value="availability">Availability</TabsTrigger>
          <TabsTrigger value="addons">Add-Ons</TabsTrigger>
          <TabsTrigger value="payroll">Payroll</TabsTrigger>
          <TabsTrigger value="reviews">Reviews</TabsTrigger>
          <TabsTrigger value="requests">Requests</TabsTrigger>
          <TabsTrigger value="mothers-day">Mother's Day Tracking 💛</TabsTrigger>
        </TabsList>

        <TabsContent value="services"><SpaServicesTab /></TabsContent>
        <TabsContent value="therapists"><SpaTherapistsTab /></TabsContent>
        <TabsContent value="rooms"><SpaRoomsTab /></TabsContent>
        <TabsContent value="availability">
          <SpaAvailabilityTab initialView={initialView} initialDate={initialDate} />
        </TabsContent>
        <TabsContent value="addons"><SpaAddonsTab /></TabsContent>
        <TabsContent value="payroll"><SpaPayrollTab /></TabsContent>
        <TabsContent value="reviews"><SpaReviewsAdminTab /></TabsContent>
        <TabsContent value="requests"><SpaRequestsTab /></TabsContent>
        <TabsContent value="mothers-day"><MothersDayTab /></TabsContent>
      </Tabs>
    </AdminLayout>
  );
}
