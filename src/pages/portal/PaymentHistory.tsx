import { PortalLayout } from "@/components/portal/PortalLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Receipt } from "lucide-react";

export default function PortalPaymentHistory() {
  return (
    <PortalLayout title="Payment History">
      <div className="max-w-3xl space-y-4">
        <Card>
          <CardContent className="py-8 text-center">
            <Receipt className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
            <p className="text-muted-foreground">No payment history yet.</p>
            <p className="text-sm text-muted-foreground mt-1">
              Your charges and receipts will appear here.
            </p>
          </CardContent>
        </Card>
      </div>
    </PortalLayout>
  );
}
