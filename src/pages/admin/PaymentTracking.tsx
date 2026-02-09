import { AdminLayout } from "@/components/admin/AdminLayout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FailedPaymentsTab } from "@/components/admin/FailedPaymentsTab";
import { UpcomingPaymentsTab } from "@/components/admin/UpcomingPaymentsTab";
import { SuccessfulPaymentsTab } from "@/components/admin/SuccessfulPaymentsTab";
import { PaymentEmailsTab } from "@/components/admin/PaymentEmailsTab";
import { XCircle, Clock, CheckCircle, Mail } from "lucide-react";

export default function PaymentTracking() {
  return (
    <AdminLayout title="Payment Tracking">
      <Tabs defaultValue="failed" className="space-y-4">
        <TabsList className="grid w-full grid-cols-4 lg:w-auto lg:inline-grid">
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
        </TabsList>

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
      </Tabs>
    </AdminLayout>
  );
}
