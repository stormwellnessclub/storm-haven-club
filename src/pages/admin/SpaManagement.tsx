import { useState } from "react";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { SpaServicesTab } from "@/components/admin/spa/SpaServicesTab";
import { SpaTherapistsTab } from "@/components/admin/spa/SpaTherapistsTab";
import { SpaRoomsTab } from "@/components/admin/spa/SpaRoomsTab";
import { SpaAvailabilityTab } from "@/components/admin/spa/SpaAvailabilityTab";
import { SpaAddonsTab } from "@/components/admin/spa/SpaAddonsTab";

export default function SpaManagement() {
  return (
    <AdminLayout title="Spa Management">
      <Tabs defaultValue="services" className="space-y-4">
        <TabsList className="flex-wrap h-auto gap-1">
          <TabsTrigger value="services">Services</TabsTrigger>
          <TabsTrigger value="therapists">Therapists</TabsTrigger>
          <TabsTrigger value="rooms">Rooms</TabsTrigger>
          <TabsTrigger value="availability">Availability</TabsTrigger>
          <TabsTrigger value="addons">Add-Ons</TabsTrigger>
        </TabsList>

        <TabsContent value="services"><SpaServicesTab /></TabsContent>
        <TabsContent value="therapists"><SpaTherapistsTab /></TabsContent>
        <TabsContent value="rooms"><SpaRoomsTab /></TabsContent>
        <TabsContent value="availability"><SpaAvailabilityTab /></TabsContent>
        <TabsContent value="addons"><SpaAddonsTab /></TabsContent>
      </Tabs>
    </AdminLayout>
  );
}
