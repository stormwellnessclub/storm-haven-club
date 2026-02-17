import { AdminLayout } from "@/components/admin/AdminLayout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { GuestMarketingTab } from "@/components/admin/marketing/GuestMarketingTab";
import { MemberMarketingTab } from "@/components/admin/marketing/MemberMarketingTab";
import { TemplatesTab } from "@/components/admin/marketing/TemplatesTab";
import { CampaignAnalytics } from "@/components/admin/marketing/CampaignAnalytics";
import { Megaphone } from "lucide-react";

export default function Marketing() {
  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <Megaphone className="h-6 w-6 text-accent" />
          <div>
            <h1 className="text-2xl font-semibold">Marketing Portal</h1>
            <p className="text-sm text-muted-foreground">
              Guest & member outreach, templates, and campaign analytics
            </p>
          </div>
        </div>

        <Tabs defaultValue="guests" className="space-y-4">
          <TabsList>
            <TabsTrigger value="guests">Guests</TabsTrigger>
            <TabsTrigger value="members">Members</TabsTrigger>
            <TabsTrigger value="templates">Templates</TabsTrigger>
            <TabsTrigger value="analytics">Analytics</TabsTrigger>
          </TabsList>

          <TabsContent value="guests">
            <GuestMarketingTab />
          </TabsContent>
          <TabsContent value="members">
            <MemberMarketingTab />
          </TabsContent>
          <TabsContent value="templates">
            <TemplatesTab />
          </TabsContent>
          <TabsContent value="analytics">
            <CampaignAnalytics />
          </TabsContent>
        </Tabs>
      </div>
    </AdminLayout>
  );
}
