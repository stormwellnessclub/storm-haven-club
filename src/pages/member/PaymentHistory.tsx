import { useQuery } from "@tanstack/react-query";
import { MemberLayout } from "@/components/member/MemberLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Alert,
  AlertDescription,
} from "@/components/ui/alert";
import {
  CreditCard,
  CheckCircle2,
  XCircle,
  Clock,
  AlertTriangle,
  Loader2,
  Receipt,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useUserMembership } from "@/hooks/useUserMembership";
import { format, parseISO } from "date-fns";

interface PaymentHistoryItem {
  id: string;
  invoice_id: string;
  invoice_number: string | null;
  amount: number;
  currency: string;
  status: string;
  attempt_number: number;
  failure_code: string | null;
  failure_message: string | null;
  decline_code: string | null;
  decline_reason: string | null;
  created_at: string;
  succeeded_at: string | null;
  failed_at: string | null;
  next_retry_at: string | null;
}

const getStatusBadge = (status: string) => {
  switch (status) {
    case "succeeded":
      return (
        <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300">
          <CheckCircle2 className="h-3 w-3 mr-1" />
          Successful
        </Badge>
      );
    case "failed":
      return (
        <Badge className="bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300">
          <XCircle className="h-3 w-3 mr-1" />
          Failed
        </Badge>
      );
    case "pending":
      return (
        <Badge className="bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-300">
          <Clock className="h-3 w-3 mr-1" />
          Pending
        </Badge>
      );
    case "requires_action":
      return (
        <Badge className="bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300">
          <AlertTriangle className="h-3 w-3 mr-1" />
          Action Required
        </Badge>
      );
    default:
      return (
        <Badge variant="outline">{status}</Badge>
      );
  }
};

const formatCurrency = (amount: number, currency: string = "usd") => {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency.toUpperCase(),
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
};

export default function PaymentHistory() {
  const { data: membership, isLoading: membershipLoading } = useUserMembership();

  const { data: paymentHistory, isLoading: historyLoading } = useQuery({
    queryKey: ["member-payment-history", membership?.id],
    queryFn: async () => {
      if (!membership?.id) return [];

      const { data, error } = await (supabase.rpc as any)("get_member_payment_history", {
        p_member_id: membership.id,
        p_limit: 100,
      });

      if (error) throw error;
      return (data as PaymentHistoryItem[]) || [];
    },
    enabled: !!membership?.id,
  });

  const isLoading = membershipLoading || historyLoading;

  if (isLoading) {
    return (
      <MemberLayout title="Payment History">
        <div className="space-y-6">
          <Skeleton className="h-64 w-full" />
        </div>
      </MemberLayout>
    );
  }

  if (!membership) {
    return (
      <MemberLayout title="Payment History">
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            Membership information not found. Please contact support if you believe this is an error.
          </AlertDescription>
        </Alert>
      </MemberLayout>
    );
  }

  const successfulPayments = paymentHistory?.filter((p) => p.status === "succeeded") || [];
  const failedPayments = paymentHistory?.filter((p) => p.status === "failed") || [];
  const totalAmount = successfulPayments.reduce((sum, p) => sum + p.amount, 0);

  return (
    <MemberLayout title="Payment History">
      <div className="space-y-6">
        {/* Summary Cards */}
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Payments</CardTitle>
              <Receipt className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{paymentHistory?.length || 0}</div>
              <p className="text-xs text-muted-foreground">
                Payment attempts recorded
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Collected</CardTitle>
              <CreditCard className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {formatCurrency(totalAmount)}
              </div>
              <p className="text-xs text-muted-foreground">
                {successfulPayments.length} successful payments
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Failed Payments</CardTitle>
              <XCircle className="h-4 w-4 text-red-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{failedPayments.length}</div>
              <p className="text-xs text-muted-foreground">
                {failedPayments.length > 0 ? "Requires attention" : "All payments successful"}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Payment History Table */}
        <Card>
          <CardHeader>
            <CardTitle>Payment History</CardTitle>
            <CardDescription>
              Your recent payment attempts and transactions
            </CardDescription>
          </CardHeader>
          <CardContent>
            {paymentHistory && paymentHistory.length > 0 ? (
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Invoice</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Attempt</TableHead>
                      <TableHead>Details</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paymentHistory.map((payment) => (
                      <TableRow key={payment.id}>
                        <TableCell>
                          <div className="flex flex-col">
                            <span className="font-medium">
                              {format(parseISO(payment.created_at), "MMM d, yyyy")}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              {format(parseISO(payment.created_at), "h:mm a")}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>
                          {payment.invoice_number ? (
                            <span className="font-mono text-sm">{payment.invoice_number}</span>
                          ) : (
                            <span className="text-muted-foreground text-sm">N/A</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <span className="font-semibold">
                            {formatCurrency(payment.amount, payment.currency)}
                          </span>
                        </TableCell>
                        <TableCell>
                          {getStatusBadge(payment.status)}
                        </TableCell>
                        <TableCell>
                          {payment.attempt_number > 1 && (
                            <Badge variant="outline" className="text-xs">
                              Retry #{payment.attempt_number}
                            </Badge>
                          )}
                          {payment.attempt_number === 1 && (
                            <span className="text-xs text-muted-foreground">First attempt</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {payment.status === "failed" && payment.decline_reason && (
                            <div className="flex flex-col gap-1">
                              <span className="text-xs text-red-600 font-medium">
                                {payment.decline_reason}
                              </span>
                              {payment.decline_code && (
                                <span className="text-xs text-muted-foreground font-mono">
                                  {payment.decline_code}
                                </span>
                              )}
                              {payment.next_retry_at && (
                                <span className="text-xs text-muted-foreground">
                                  Retry: {format(parseISO(payment.next_retry_at), "MMM d, h:mm a")}
                                </span>
                              )}
                            </div>
                          )}
                          {payment.status === "succeeded" && payment.succeeded_at && (
                            <span className="text-xs text-muted-foreground">
                              {format(parseISO(payment.succeeded_at), "MMM d, h:mm a")}
                            </span>
                          )}
                          {payment.status === "requires_action" && (
                            <span className="text-xs text-blue-600">
                              Action required from customer
                            </span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <div className="text-center py-12">
                <Receipt className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-2">No Payment History</h3>
                <p className="text-muted-foreground">
                  Your payment history will appear here once you have payment attempts.
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Failed Payments Alert */}
        {failedPayments.length > 0 && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              You have {failedPayments.length} failed payment{failedPayments.length !== 1 ? "s" : ""}. 
              Please update your payment method to ensure uninterrupted service.
            </AlertDescription>
          </Alert>
        )}
      </div>
    </MemberLayout>
  );
}
