import { PortalLayout } from "@/components/portal/PortalLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Receipt, Loader2 } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { format } from "date-fns";

interface PaymentRecord {
  id: string;
  date: string;
  description: string;
  amount: number; // in cents for charges, dollars for passes
  status: string;
  type: "charge" | "pass_purchase";
}

export default function PortalPaymentHistory() {
  const { user } = useAuth();

  const { data: payments, isLoading } = useQuery({
    queryKey: ["portal-payment-history", user?.id],
    queryFn: async (): Promise<PaymentRecord[]> => {
      if (!user) return [];

      // Fetch manual charges
      const { data: charges } = await supabase
        .from("manual_charges")
        .select("id, amount, description, status, created_at")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      // Fetch paid class passes (price_paid > 0)
      const { data: passes } = await supabase
        .from("class_passes")
        .select("id, price_paid, category, pass_type, status, purchased_at")
        .eq("user_id", user.id)
        .gt("price_paid", 0)
        .order("purchased_at", { ascending: false });

      const records: PaymentRecord[] = [];

      (charges || []).forEach((c) => {
        records.push({
          id: c.id,
          date: c.created_at,
          description: c.description || "Charge",
          amount: c.amount, // cents
          status: c.status || "pending",
          type: "charge",
        });
      });

      (passes || []).forEach((p) => {
        records.push({
          id: p.id,
          date: p.purchased_at,
          description: `${p.pass_type} — ${p.category}`,
          amount: p.price_paid * 100, // convert dollars to cents for uniform display
          status: p.status === "active" || p.status === "exhausted" ? "succeeded" : p.status,
          type: "pass_purchase",
        });
      });

      records.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      return records;
    },
    enabled: !!user,
  });

  const formatAmount = (cents: number) => {
    return `$${(cents / 100).toFixed(2)}`;
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "succeeded":
        return <Badge variant="default">Paid</Badge>;
      case "pending":
        return <Badge variant="secondary">Pending</Badge>;
      case "failed":
        return <Badge variant="destructive">Failed</Badge>;
      case "refunded":
        return <Badge variant="outline">Refunded</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  return (
    <PortalLayout title="Payment History">
      <div className="max-w-3xl space-y-4">
        {isLoading ? (
          <Card>
            <CardContent className="py-8 flex justify-center">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </CardContent>
          </Card>
        ) : !payments?.length ? (
          <Card>
            <CardContent className="py-8 text-center">
              <Receipt className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
              <p className="text-muted-foreground">No payment history yet.</p>
              <p className="text-sm text-muted-foreground mt-1">
                Your charges and receipts will appear here.
              </p>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Receipt className="h-4 w-4" />
                Transactions
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {payments.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell className="whitespace-nowrap">
                        {format(new Date(p.date), "MMM d, yyyy")}
                      </TableCell>
                      <TableCell>{p.description}</TableCell>
                      <TableCell className="text-right font-medium">
                        {formatAmount(p.amount)}
                      </TableCell>
                      <TableCell>{getStatusBadge(p.status)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}
      </div>
    </PortalLayout>
  );
}
