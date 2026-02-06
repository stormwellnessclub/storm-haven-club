import { useState } from "react";
import { format, differenceInDays } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { useAdminMemberBillingHealth, BillingHealthData } from "@/hooks/useAdminMemberBillingHealth";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  CreditCard,
  Calendar,
  DollarSign,
  RefreshCw,
  ExternalLink,
  Loader2,
  XCircle,
  Clock,
  TrendingUp,
  Info,
} from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface BillingHealthCardProps {
  memberId: string;
  memberEmail?: string;
  memberName?: string;
}

const getStatusBadgeColor = (status: string | null) => {
  switch (status?.toLowerCase()) {
    case "active":
      return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300";
    case "past_due":
      return "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300";
    case "canceled":
    case "cancelled":
      return "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300";
    case "trialing":
      return "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300";
    case "incomplete":
    case "incomplete_expired":
      return "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-300";
    default:
      return "bg-secondary text-secondary-foreground";
  }
};

const getIssueIcon = (type: "error" | "warning" | "info") => {
  switch (type) {
    case "error":
      return <XCircle className="h-4 w-4 text-destructive" />;
    case "warning":
      return <AlertTriangle className="h-4 w-4 text-amber-500" />;
    case "info":
      return <Info className="h-4 w-4 text-blue-500" />;
  }
};

const getIssueColor = (type: "error" | "warning" | "info") => {
  switch (type) {
    case "error":
      return "border-destructive/50 bg-destructive/5";
    case "warning":
      return "border-amber-500/50 bg-amber-500/5";
    case "info":
      return "border-blue-500/50 bg-blue-500/5";
  }
};

export function BillingHealthCard({ memberId, memberEmail, memberName }: BillingHealthCardProps) {
  const { data, isLoading, error, refetch } = useAdminMemberBillingHealth(memberId);
  const [isSyncing, setIsSyncing] = useState(false);
  const queryClient = useQueryClient();

  const handleSync = async () => {
    setIsSyncing(true);
    try {
      const { data: syncResult, error: syncError } = await supabase.functions.invoke("stripe-payment", {
        body: {
          action: "sync_member_billing_data",
          memberId,
        },
      });

      if (syncError) throw syncError;
      if (syncResult?.error) throw new Error(syncResult.error);

      toast.success("Billing data synced successfully");
      await refetch();
      // Also invalidate other queries that might be affected
      queryClient.invalidateQueries({ queryKey: ["admin-member-detail", memberId] });
      queryClient.invalidateQueries({ queryKey: ["admin-member-payment-methods", memberId] });
    } catch (err) {
      console.error("Sync error:", err);
      toast.error(err instanceof Error ? err.message : "Failed to sync billing data");
    } finally {
      setIsSyncing(false);
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-primary" />
            Billing Health
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-32 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-primary" />
            Billing Health
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2 p-4 border border-destructive/50 bg-destructive/5 rounded-lg">
            <AlertCircle className="h-5 w-5 text-destructive" />
            <div>
              <p className="font-medium text-destructive">Failed to load billing data</p>
              <p className="text-sm text-muted-foreground">{error instanceof Error ? error.message : "Unknown error"}</p>
            </div>
          </div>
          <Button variant="outline" onClick={() => refetch()} className="mt-4">
            <RefreshCw className="h-4 w-4 mr-2" />
            Retry
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (!data) return null;

  const hasIssues = data.issues.length > 0;
  const criticalIssues = data.issues.filter((i) => i.type === "error");
  const warningIssues = data.issues.filter((i) => i.type === "warning");

  return (
    <Card className={hasIssues ? (criticalIssues.length > 0 ? "border-destructive/50" : "border-amber-500/50") : ""}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-primary" />
            <div>
              <CardTitle className="flex items-center gap-2">
                Billing Health
                {hasIssues && (
                  <Badge variant={criticalIssues.length > 0 ? "destructive" : "outline"} className="ml-2">
                    {data.issues.length} {data.issues.length === 1 ? "issue" : "issues"}
                  </Badge>
                )}
              </CardTitle>
              <CardDescription>
                {data.syncStatus.lastSynced
                  ? `Last synced: ${format(new Date(data.syncStatus.lastSynced), "MMM d, h:mm a")}`
                  : "Never synced"}
              </CardDescription>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={handleSync}
            disabled={isSyncing}
          >
            {isSyncing ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <RefreshCw className="h-4 w-4 mr-2" />
            )}
            Sync with Stripe
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Issues Section */}
        {hasIssues && (
          <div className="space-y-2">
            {data.issues.map((issue, idx) => (
              <div
                key={idx}
                className={`flex items-start gap-3 p-3 border rounded-lg ${getIssueColor(issue.type)}`}
              >
                {getIssueIcon(issue.type)}
                <div>
                  <p className="font-medium text-sm">{issue.message}</p>
                  <p className="text-xs text-muted-foreground">{issue.code}</p>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Stripe Customer */}
        <div className="space-y-2">
          <h4 className="text-sm font-medium text-muted-foreground flex items-center gap-2">
            <CreditCard className="h-4 w-4" />
            Stripe Customer
          </h4>
          <div className="p-3 bg-secondary/30 rounded-lg">
            {data.stripeCustomerId ? (
              <div className="flex items-center justify-between">
                <code className="text-sm font-mono">{data.stripeCustomerId}</code>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="sm"
                        asChild
                      >
                        <a
                          href={`https://dashboard.stripe.com/customers/${data.stripeCustomerId}`}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          <ExternalLink className="h-4 w-4" />
                        </a>
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>View in Stripe Dashboard</TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No Stripe customer linked</p>
            )}
          </div>
        </div>

        <Separator />

        {/* Dues Subscription */}
        <div className="space-y-2">
          <h4 className="text-sm font-medium text-muted-foreground flex items-center gap-2">
            <Calendar className="h-4 w-4" />
            Membership Dues Subscription
          </h4>
          {data.duesSubscription?.id ? (
            <div className="p-3 bg-secondary/30 rounded-lg space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Badge className={getStatusBadgeColor(data.duesSubscription.status)}>
                    {data.duesSubscription.status}
                  </Badge>
                  {data.duesSubscription.cancelAtPeriodEnd && (
                    <Badge variant="outline" className="text-amber-600 border-amber-500">
                      Cancels at period end
                    </Badge>
                  )}
                </div>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button variant="ghost" size="sm" asChild>
                        <a
                          href={`https://dashboard.stripe.com/subscriptions/${data.duesSubscription.id}`}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          <ExternalLink className="h-4 w-4" />
                        </a>
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>View in Stripe Dashboard</TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground">Next billing</p>
                  <p className="font-medium">
                    {data.duesSubscription.currentPeriodEnd
                      ? format(new Date(data.duesSubscription.currentPeriodEnd), "MMM d, yyyy")
                      : "—"}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground">Amount</p>
                  <p className="font-medium">
                    {data.duesSubscription.amountDue
                      ? `$${(data.duesSubscription.amountDue / 100).toFixed(2)}/${data.duesSubscription.interval === "year" ? "yr" : "mo"}`
                      : "—"}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground">Last payment</p>
                  <p className="font-medium flex items-center gap-1">
                    {data.duesSubscription.lastPaymentDate
                      ? format(new Date(data.duesSubscription.lastPaymentDate), "MMM d, yyyy")
                      : "—"}
                    {data.duesSubscription.lastPaymentStatus === "succeeded" && (
                      <CheckCircle2 className="h-3 w-3 text-green-600" />
                    )}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground">Subscription ID</p>
                  <code className="text-xs font-mono">{data.duesSubscription.id}</code>
                </div>
              </div>
            </div>
          ) : (
            <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-500" />
              <p className="text-sm">No active dues subscription</p>
            </div>
          )}
        </div>

        {/* Initiation Fee Subscription */}
        <div className="space-y-2">
          <h4 className="text-sm font-medium text-muted-foreground flex items-center gap-2">
            <DollarSign className="h-4 w-4" />
            Initiation Fee Subscription
          </h4>
          {data.initiationFeeSubscription?.id ? (
            <div className="p-3 bg-secondary/30 rounded-lg space-y-2">
              <div className="flex items-center justify-between">
                <Badge className={getStatusBadgeColor(data.initiationFeeSubscription.status)}>
                  {data.initiationFeeSubscription.status}
                </Badge>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button variant="ghost" size="sm" asChild>
                        <a
                          href={`https://dashboard.stripe.com/subscriptions/${data.initiationFeeSubscription.id}`}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          <ExternalLink className="h-4 w-4" />
                        </a>
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>View in Stripe Dashboard</TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground">Next renewal</p>
                  <p className="font-medium">
                    {data.initiationFeeSubscription.currentPeriodEnd
                      ? format(new Date(data.initiationFeeSubscription.currentPeriodEnd), "MMM d, yyyy")
                      : "—"}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground">Amount</p>
                  <p className="font-medium">
                    {data.initiationFeeSubscription.amountDue
                      ? `$${(data.initiationFeeSubscription.amountDue / 100).toFixed(2)}/yr`
                      : "—"}
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <div className="p-3 bg-secondary/30 rounded-lg">
              <p className="text-sm text-muted-foreground">No initiation fee subscription (one-time payment or not set up)</p>
            </div>
          )}
        </div>

        <Separator />

        {/* Payment Method Health */}
        <div className="space-y-2">
          <h4 className="text-sm font-medium text-muted-foreground flex items-center gap-2">
            <CreditCard className="h-4 w-4" />
            Payment Method
          </h4>
          {data.paymentMethodHealth.hasPaymentMethod ? (
            <div className="p-3 bg-secondary/30 rounded-lg">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CreditCard className="h-5 w-5" />
                  <span className="font-medium capitalize">
                    {data.paymentMethodHealth.cardBrand} •••• {data.paymentMethodHealth.cardLast4}
                  </span>
                </div>
                {data.paymentMethodHealth.isExpiringSoon ? (
                  <Badge variant="outline" className="text-amber-600 border-amber-500">
                    <AlertTriangle className="h-3 w-3 mr-1" />
                    {data.paymentMethodHealth.expirationWarning}
                  </Badge>
                ) : (
                  <span className="text-sm text-muted-foreground">
                    Exp {data.paymentMethodHealth.cardExpMonth}/{data.paymentMethodHealth.cardExpYear}
                  </span>
                )}
              </div>
            </div>
          ) : (
            <div className="p-3 bg-destructive/10 border border-destructive/30 rounded-lg flex items-center gap-2">
              <XCircle className="h-4 w-4 text-destructive" />
              <p className="text-sm">No payment method on file</p>
            </div>
          )}
        </div>

        {/* Recent Payment Attempts */}
        {data.recentPaymentAttempts.length > 0 && (
          <>
            <Separator />
            <div className="space-y-2">
              <h4 className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <Clock className="h-4 w-4" />
                Recent Payment Activity
              </h4>
              <div className="space-y-2">
                {data.recentPaymentAttempts.slice(0, 5).map((attempt) => (
                  <div
                    key={attempt.id}
                    className="flex items-center justify-between p-2 border rounded text-sm"
                  >
                    <div className="flex items-center gap-2">
                      {attempt.status === "succeeded" ? (
                        <CheckCircle2 className="h-4 w-4 text-green-600" />
                      ) : attempt.status === "failed" ? (
                        <XCircle className="h-4 w-4 text-destructive" />
                      ) : (
                        <Clock className="h-4 w-4 text-amber-500" />
                      )}
                      <div>
                        <p className="font-medium">${(attempt.amount / 100).toFixed(2)}</p>
                        {attempt.description && (
                          <p className="text-xs text-muted-foreground truncate max-w-[200px]">
                            {attempt.description}
                          </p>
                        )}
                        {attempt.failureReason && (
                          <p className="text-xs text-destructive">{attempt.failureReason}</p>
                        )}
                      </div>
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {format(new Date(attempt.date), "MMM d, h:mm a")}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}

        {/* Sync Discrepancies */}
        {data.syncStatus.discrepancies.length > 0 && (
          <>
            <Separator />
            <div className="space-y-2">
              <h4 className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <AlertCircle className="h-4 w-4" />
                Data Discrepancies
              </h4>
              <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg">
                <ul className="list-disc list-inside text-sm space-y-1">
                  {data.syncStatus.discrepancies.map((d, idx) => (
                    <li key={idx}>{d}</li>
                  ))}
                </ul>
                <Button size="sm" variant="outline" className="mt-3" onClick={handleSync} disabled={isSyncing}>
                  {isSyncing ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                  Fix Discrepancies
                </Button>
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
