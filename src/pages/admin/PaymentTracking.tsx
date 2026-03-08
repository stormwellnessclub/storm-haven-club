import { AdminLayout } from "@/components/admin/AdminLayout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FailedPaymentsTab } from "@/components/admin/FailedPaymentsTab";
import { UpcomingPaymentsTab } from "@/components/admin/UpcomingPaymentsTab";
import { SuccessfulPaymentsTab } from "@/components/admin/SuccessfulPaymentsTab";
import { PaymentEmailsTab } from "@/components/admin/PaymentEmailsTab";
import { StripeLivePaymentsTab } from "@/components/admin/StripeLivePaymentsTab";
import { AutoPayProjectionsTab } from "@/components/admin/AutoPayProjectionsTab";
import { AutopayScheduleTab } from "@/components/admin/AutopayScheduleTab";
import { XCircle, Clock, CheckCircle, Mail, Zap, TrendingUp, CalendarClock } from "lucide-react";

export default function PaymentTracking() {
  return (
    <AdminLayout title="Payment Tracking">
      <Tabs defaultValue="stripe-live" className="space-y-4">
        <TabsList className="grid w-full grid-cols-7 lg:w-auto lg:inline-grid">
          <TabsTrigger value="stripe-live" className="gap-2">
            <Zap className="h-4 w-4 text-amber-500" />
            <span className="hidden sm:inline">Stripe Live</span>
          </TabsTrigger>
          <TabsTrigger value="projections" className="gap-2">
            <TrendingUp className="h-4 w-4 text-green-600" />
            <span className="hidden sm:inline">Projections</span>
          </TabsTrigger>
          <TabsTrigger value="failed" className="gap-2">
            <XCircle className="h-4 w-4 text-destructive" />
            <span className="hidden sm:inline">Failed</span>
          </TabsTrigger>
          <TabsTrigger value="upcoming" className="gap-2">
            <Clock className="h-4 w-4 text-primary" />
            <span className="hidden sm:inline">Upcoming</span>
          </TabsTrigger>
          <TabsTrigger value="successful" className="gap-2">
            <CheckCircle className="h-4 w-4 text-green-600" />
            <span className="hidden sm:inline">Successful</span>
          </TabsTrigger>
          <TabsTrigger value="emails" className="gap-2">
            <Mail className="h-4 w-4" />
            <span className="hidden sm:inline">Emails</span>
          </TabsTrigger>
          <TabsTrigger value="autopay" className="gap-2">
            <CalendarClock className="h-4 w-4 text-primary" />
            <span className="hidden sm:inline">Autopay</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="stripe-live">
          <StripeLivePaymentsTab />
        </TabsContent>

        <TabsContent value="projections">
          <AutoPayProjectionsTab />
        </TabsContent>

        <TabsContent value="failed">
          <FailedPaymentsTab />
        </TabsContent>

        <TabsContent value="upcoming">
          <UpcomingPaymentsTab />
        </TabsContent>

        <TabsContent value="successful">
          <SuccessfulPaymentsTab />
        </TabsContent>

        <TabsContent value="emails">
          <PaymentEmailsTab />
        </TabsContent>

        <TabsContent value="autopay">
          <AutopayScheduleTab />
        </TabsContent>
      </Tabs>
    </AdminLayout>
  );
}
