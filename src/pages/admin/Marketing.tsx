import { useSearchParams } from "react-router-dom";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { GuestMarketingTab } from "@/components/admin/marketing/GuestMarketingTab";
import { MemberMarketingTab } from "@/components/admin/marketing/MemberMarketingTab";
import { ReferralCampaignTab } from "@/components/admin/marketing/ReferralCampaignTab";
import { TemplatesTab } from "@/components/admin/marketing/TemplatesTab";
import { CampaignAnalytics } from "@/components/admin/marketing/CampaignAnalytics";
import { SmsBlastTab } from "@/components/admin/marketing/SmsBlastTab";
import { SmsTemplatesTab } from "@/components/admin/marketing/SmsTemplatesTab";
import { CafeSalesTab } from "@/components/admin/marketing/CafeSalesTab";
import { ContactsTab } from "@/components/admin/marketing/ContactsTab";
import { AnnouncementsTab } from "@/components/admin/marketing/AnnouncementsTab";
import { Megaphone, MessageSquare, Coffee, Mail, Bell, MessageCircle } from "lucide-react";

export default function Marketing() {
  const [params, setParams] = useSearchParams();
  const tab = params.get("tab") ?? "guests";

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <Megaphone className="h-6 w-6 text-accent" />
          <div>
            <h1 className="text-2xl font-semibold">Marketing Portal</h1>
            <p className="text-sm text-muted-foreground">
              Guest & member outreach, SMS, templates, and campaign analytics
            </p>
          </div>
        </div>

        <Tabs
          value={tab}
          onValueChange={(v) => {
            const next = new URLSearchParams(params);
            next.set("tab", v);
            setParams(next, { replace: true });
          }}
          className="space-y-4"
        >
          <div className="w-full overflow-x-auto pb-1 -mx-1 px-1">
            <TabsList className="w-max flex-nowrap">
              <TabsTrigger value="guests">Guests</TabsTrigger>
              <TabsTrigger value="members">Members</TabsTrigger>
              <TabsTrigger value="announcements" className="gap-1.5">
                <Bell className="h-3.5 w-3.5" /> Announcements
              </TabsTrigger>
              <TabsTrigger value="contacts" className="gap-1.5">
                <Mail className="h-3.5 w-3.5" /> Contacts
              </TabsTrigger>
              <TabsTrigger value="cafe" className="gap-1.5">
                <Coffee className="h-3.5 w-3.5" /> Cafe
              </TabsTrigger>
              <TabsTrigger value="sms" className="gap-1.5">
                <MessageSquare className="h-3.5 w-3.5" /> SMS Blast
              </TabsTrigger>
              <TabsTrigger value="sms-templates" className="gap-1.5">
                <MessageCircle className="h-3.5 w-3.5" /> SMS Templates
              </TabsTrigger>
              <TabsTrigger value="referrals">Referrals</TabsTrigger>
              <TabsTrigger value="templates">Email Templates</TabsTrigger>
              <TabsTrigger value="analytics">Analytics</TabsTrigger>
            </TabsList>
          </div>


          <TabsContent value="guests">
            <GuestMarketingTab />
          </TabsContent>
          <TabsContent value="members">
            <MemberMarketingTab />
          </TabsContent>
          <TabsContent value="announcements">
            <AnnouncementsTab />
          </TabsContent>
          <TabsContent value="contacts">
            <ContactsTab />
          </TabsContent>
          <TabsContent value="cafe">
            <CafeSalesTab />
          </TabsContent>
          <TabsContent value="sms">
            <SmsBlastTab />
          </TabsContent>
          <TabsContent value="sms-templates">
            <SmsTemplatesTab />
          </TabsContent>
          <TabsContent value="referrals">
            <ReferralCampaignTab />
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

