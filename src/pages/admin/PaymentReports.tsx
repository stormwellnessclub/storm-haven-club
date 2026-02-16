import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Alert, AlertDescription, AlertTitle,
} from "@/components/ui/alert";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  TrendingUp, TrendingDown, AlertTriangle, CheckCircle2,
  DollarSign, RefreshCw, Loader2, Activity, Users,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { subDays } from "date-fns";

interface PaymentMetrics {
  attempts: { total: number; successful: number; failed: number; pending: number; requires_action: number };
  amounts: { total: number; successful: number; failed: number };
  rates: { success_rate: number; failure_rate: number; retry_success_rate: number };
  members_affected: { unique_failed_members: number };
}

interface SubscriptionHealth {
  subscriptions: { active: number; past_due: number; recently_cancelled: number; total: number };
  payment_health: { recent_failures_7d: number; at_risk_members: number; expiring_payment_methods: number };
  health_score: number;
}

interface DunningEfficiency {
  first_attempt: { success_rate: number };
  retries: { total_attempts: number; successful: number; success_rate: number };
  final_outcomes: { final_failure_rate: number };
  top_decline_reasons: Array<{ reason: string; count: number }>;
}

// Transform flat RPC responses to nested UI structures
function transformPaymentMetrics(raw: any): PaymentMetrics {
  return {
    attempts: {
      total: raw?.total_attempts ?? 0,
      successful: raw?.successful_payments ?? 0,
      failed: raw?.failed_payments ?? 0,
      pending: raw?.pending_payments ?? 0,
      requires_action: 0,
    },
    amounts: {
      total: (raw?.total_collected ?? 0) + (raw?.total_failed_amount ?? 0),
      successful: raw?.total_collected ?? 0,
      failed: raw?.total_failed_amount ?? 0,
    },
    rates: {
      success_rate: raw?.success_rate ?? 0,
      failure_rate: raw?.total_attempts > 0 ? 100 - (raw?.success_rate ?? 0) : 0,
      retry_success_rate: raw?.retry_success_rate ?? 0,
    },
    members_affected: { unique_failed_members: 0 },
  };
}

function transformSubscriptionHealth(raw: any): SubscriptionHealth {
  const total = raw?.total_members ?? 0;
  const active = raw?.active_subscriptions ?? 0;
  const pastDue = raw?.past_due_subscriptions ?? 0;
  const cancelled = raw?.cancelled_subscriptions ?? 0;
  return {
    subscriptions: { active, past_due: pastDue, recently_cancelled: cancelled, total },
    payment_health: {
      recent_failures_7d: raw?.at_risk_members ?? 0,
      at_risk_members: raw?.at_risk_members ?? 0,
      expiring_payment_methods: raw?.members_with_expiring_cards ?? 0,
    },
    health_score: total > 0 ? (active / total) * 100 : 0,
  };
}

function transformDunningEfficiency(raw: any): DunningEfficiency {
  const totalFailed = raw?.total_failed_first_attempts ?? 0;
  const recovered = raw?.recovered_on_retry ?? 0;
  return {
    first_attempt: {
      success_rate: totalFailed > 0 ? 100 - ((totalFailed / ((raw?.total_failed_first_attempts ?? 0) + recovered)) * 100) : 100,
    },
    retries: {
      total_attempts: totalFailed,
      successful: recovered,
      success_rate: raw?.recovery_rate ?? 0,
    },
    final_outcomes: {
      final_failure_rate: totalFailed > 0 ? ((totalFailed - recovered) / totalFailed) * 100 : 0,
    },
    top_decline_reasons: (raw?.top_decline_reasons || []).map((r: any) => ({
      reason: r?.reason ?? 'unknown',
      count: r?.count ?? 0,
    })),
  };
}

const safe = (v: number | null | undefined) => v ?? 0;
const pct = (v: number | null | undefined) => safe(v).toFixed(1);
const dollars = (v: number | null | undefined) => safe(v).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function PaymentReports() {
  const [periodDays, setPeriodDays] = useState<number>(30);
  const [syncLoading, setSyncLoading] = useState(false);

  const endDate = new Date();
  const startDate = subDays(endDate, periodDays);

  const { data: paymentMetrics, isLoading: metricsLoading, refetch: refetchMetrics } = useQuery({
    queryKey: ["payment-metrics", periodDays],
    queryFn: async () => {
      const { data, error } = await (supabase.rpc as any)("get_payment_metrics", {
        p_start_date: startDate.toISOString(),
        p_end_date: endDate.toISOString(),
      });
      if (error) throw error;
      return transformPaymentMetrics(data);
    },
  });

  const { data: subscriptionHealth, isLoading: healthLoading, refetch: refetchHealth } = useQuery({
    queryKey: ["subscription-health"],
    queryFn: async () => {
      const { data, error } = await (supabase.rpc as any)("get_subscription_health");
      if (error) throw error;
      return transformSubscriptionHealth(data);
    },
  });

  const { data: dunningEfficiency, isLoading: dunningLoading, refetch: refetchDunning } = useQuery({
    queryKey: ["dunning-efficiency", periodDays],
    queryFn: async () => {
      const { data, error } = await (supabase.rpc as any)("get_dunning_efficiency", {
        p_start_date: startDate.toISOString(),
        p_end_date: endDate.toISOString(),
      });
      if (error) throw error;
      return transformDunningEfficiency(data);
    },
  });

  const syncMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("sync-subscription-status", { body: {} });
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      toast.success(`Sync completed: ${data?.summary?.synced ?? 0} synced, ${data?.summary?.discrepancies ?? 0} discrepancies found`);
      refetchMetrics();
      refetchHealth();
      refetchDunning();
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to sync subscription status");
    },
  });

  const handleSync = async () => {
    setSyncLoading(true);
    try { await syncMutation.mutateAsync(); } finally { setSyncLoading(false); }
  };

  const isLoading = metricsLoading || healthLoading || dunningLoading;

  return (
    <AdminLayout title="Payment Reports">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold">Payment Analytics & Reports</h2>
            <p className="text-muted-foreground">Monitor payment performance, subscription health, and dunning efficiency</p>
          </div>
          <div className="flex gap-2">
            <Select value={periodDays.toString()} onValueChange={(value) => setPeriodDays(parseInt(value))}>
              <SelectTrigger className="w-[180px]"><SelectValue placeholder="Select period" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="7">Last 7 days</SelectItem>
                <SelectItem value="30">Last 30 days</SelectItem>
                <SelectItem value="90">Last 90 days</SelectItem>
                <SelectItem value="365">Last year</SelectItem>
              </SelectContent>
            </Select>
            <Button onClick={handleSync} disabled={syncLoading} variant="outline">
              {syncLoading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-2" />}
              Sync Status
            </Button>
          </div>
        </div>

        {/* Subscription Health Overview */}
        {healthLoading ? (
          <Skeleton className="h-32 w-full" />
        ) : subscriptionHealth && (
          <div className="grid gap-4 md:grid-cols-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Active Subscriptions</CardTitle>
                <CheckCircle2 className="h-4 w-4 text-green-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{safe(subscriptionHealth.subscriptions.active)}</div>
                <p className="text-xs text-muted-foreground">of {safe(subscriptionHealth.subscriptions.total)} total</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Past Due</CardTitle>
                <AlertTriangle className="h-4 w-4 text-amber-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{safe(subscriptionHealth.subscriptions.past_due)}</div>
                <p className="text-xs text-muted-foreground">Requires attention</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Health Score</CardTitle>
                <Activity className="h-4 w-4 text-blue-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{pct(subscriptionHealth.health_score)}%</div>
                <p className="text-xs text-muted-foreground">Subscription health</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">At Risk Members</CardTitle>
                <Users className="h-4 w-4 text-red-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{safe(subscriptionHealth.payment_health.at_risk_members)}</div>
                <p className="text-xs text-muted-foreground">Multiple recent failures</p>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Tabs */}
        <Tabs defaultValue="metrics" className="space-y-4">
          <TabsList>
            <TabsTrigger value="metrics">Payment Metrics</TabsTrigger>
            <TabsTrigger value="dunning">Dunning Efficiency</TabsTrigger>
            <TabsTrigger value="health">Subscription Health</TabsTrigger>
          </TabsList>

          {/* Payment Metrics Tab */}
          <TabsContent value="metrics" className="space-y-4">
            {isLoading ? (
              <div className="space-y-4"><Skeleton className="h-64 w-full" /><Skeleton className="h-64 w-full" /></div>
            ) : paymentMetrics && (
              <>
                <div className="grid gap-4 md:grid-cols-4">
                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <CardTitle className="text-sm font-medium">Success Rate</CardTitle>
                      <TrendingUp className="h-4 w-4 text-green-600" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">{pct(paymentMetrics.rates.success_rate)}%</div>
                      <p className="text-xs text-muted-foreground">{safe(paymentMetrics.attempts.successful)} of {safe(paymentMetrics.attempts.total)} attempts</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <CardTitle className="text-sm font-medium">Failure Rate</CardTitle>
                      <TrendingDown className="h-4 w-4 text-red-600" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">{pct(paymentMetrics.rates.failure_rate)}%</div>
                      <p className="text-xs text-muted-foreground">{safe(paymentMetrics.attempts.failed)} failed attempts</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <CardTitle className="text-sm font-medium">Revenue Collected</CardTitle>
                      <DollarSign className="h-4 w-4 text-green-600" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">${dollars(paymentMetrics.amounts.successful)}</div>
                      <p className="text-xs text-muted-foreground">Successful payments</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <CardTitle className="text-sm font-medium">Retry Success Rate</CardTitle>
                      <RefreshCw className="h-4 w-4 text-blue-600" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">{pct(paymentMetrics.rates.retry_success_rate)}%</div>
                      <p className="text-xs text-muted-foreground">Success after retry</p>
                    </CardContent>
                  </Card>
                </div>

                <Card>
                  <CardHeader>
                    <CardTitle>Payment Attempts Breakdown</CardTitle>
                    <CardDescription>Detailed breakdown of payment attempts for the selected period</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Status</TableHead>
                          <TableHead>Attempts</TableHead>
                          <TableHead>Amount</TableHead>
                          <TableHead>Percentage</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        <TableRow>
                          <TableCell><Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300">Successful</Badge></TableCell>
                          <TableCell>{safe(paymentMetrics.attempts.successful)}</TableCell>
                          <TableCell>${dollars(paymentMetrics.amounts.successful)}</TableCell>
                          <TableCell>{pct(paymentMetrics.rates.success_rate)}%</TableCell>
                        </TableRow>
                        <TableRow>
                          <TableCell><Badge className="bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300">Failed</Badge></TableCell>
                          <TableCell>{safe(paymentMetrics.attempts.failed)}</TableCell>
                          <TableCell>${dollars(paymentMetrics.amounts.failed)}</TableCell>
                          <TableCell>{pct(paymentMetrics.rates.failure_rate)}%</TableCell>
                        </TableRow>
                        <TableRow>
                          <TableCell><Badge className="bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-300">Pending</Badge></TableCell>
                          <TableCell>{safe(paymentMetrics.attempts.pending)}</TableCell>
                          <TableCell>-</TableCell>
                          <TableCell>-</TableCell>
                        </TableRow>
                        <TableRow className="font-semibold">
                          <TableCell>Total</TableCell>
                          <TableCell>{safe(paymentMetrics.attempts.total)}</TableCell>
                          <TableCell>${dollars(paymentMetrics.amounts.total)}</TableCell>
                          <TableCell>100%</TableCell>
                        </TableRow>
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>

                {safe(paymentMetrics.members_affected.unique_failed_members) > 0 && (
                  <Alert>
                    <AlertTriangle className="h-4 w-4" />
                    <AlertTitle>Members Affected by Payment Failures</AlertTitle>
                    <AlertDescription>
                      {paymentMetrics.members_affected.unique_failed_members} unique member(s) had payment failures during this period.
                    </AlertDescription>
                  </Alert>
                )}
              </>
            )}
          </TabsContent>

          {/* Dunning Efficiency Tab */}
          <TabsContent value="dunning" className="space-y-4">
            {isLoading ? (
              <Skeleton className="h-64 w-full" />
            ) : dunningEfficiency && (
              <>
                <div className="grid gap-4 md:grid-cols-3">
                  <Card>
                    <CardHeader><CardTitle className="text-sm font-medium">First Attempt Success</CardTitle></CardHeader>
                    <CardContent>
                      <div className="text-3xl font-bold">{pct(dunningEfficiency.first_attempt.success_rate)}%</div>
                      <p className="text-sm text-muted-foreground mt-2">Payments that succeed on the first try</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader><CardTitle className="text-sm font-medium">Retry Success Rate</CardTitle></CardHeader>
                    <CardContent>
                      <div className="text-3xl font-bold">{pct(dunningEfficiency.retries.success_rate)}%</div>
                      <p className="text-sm text-muted-foreground mt-2">
                        {safe(dunningEfficiency.retries.successful)} successful retries of {safe(dunningEfficiency.retries.total_attempts)} attempts
                      </p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader><CardTitle className="text-sm font-medium">Final Failure Rate</CardTitle></CardHeader>
                    <CardContent>
                      <div className="text-3xl font-bold">{pct(dunningEfficiency.final_outcomes.final_failure_rate)}%</div>
                      <p className="text-sm text-muted-foreground mt-2">Invoices that ultimately failed after all retries</p>
                    </CardContent>
                  </Card>
                </div>

                <Card>
                  <CardHeader>
                    <CardTitle>Top Decline Reasons</CardTitle>
                    <CardDescription>Most common reasons for payment failures</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {dunningEfficiency.top_decline_reasons && dunningEfficiency.top_decline_reasons.length > 0 ? (
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Reason</TableHead>
                            <TableHead>Count</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {dunningEfficiency.top_decline_reasons.map((r, i) => (
                            <TableRow key={i}>
                              <TableCell>{r.reason}</TableCell>
                              <TableCell><Badge variant="outline">{r.count}</Badge></TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    ) : (
                      <p className="text-muted-foreground text-center py-8">No decline reasons found for this period</p>
                    )}
                  </CardContent>
                </Card>
              </>
            )}
          </TabsContent>

          {/* Subscription Health Tab */}
          <TabsContent value="health" className="space-y-4">
            {isLoading ? (
              <Skeleton className="h-64 w-full" />
            ) : subscriptionHealth && (
              <div className="grid gap-4 md:grid-cols-2">
                <Card>
                  <CardHeader><CardTitle>Subscription Status Breakdown</CardTitle></CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">Active</span>
                        <div className="flex items-center gap-2">
                          <span className="text-lg font-semibold">{safe(subscriptionHealth.subscriptions.active)}</span>
                          <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300">
                            {subscriptionHealth.subscriptions.total > 0
                              ? ((subscriptionHealth.subscriptions.active / subscriptionHealth.subscriptions.total) * 100).toFixed(1)
                              : 0}%
                          </Badge>
                        </div>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">Past Due</span>
                        <div className="flex items-center gap-2">
                          <span className="text-lg font-semibold">{safe(subscriptionHealth.subscriptions.past_due)}</span>
                          <Badge className="bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-300">
                            {subscriptionHealth.subscriptions.total > 0
                              ? ((subscriptionHealth.subscriptions.past_due / subscriptionHealth.subscriptions.total) * 100).toFixed(1)
                              : 0}%
                          </Badge>
                        </div>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">Recently Cancelled</span>
                        <div className="flex items-center gap-2">
                          <span className="text-lg font-semibold">{safe(subscriptionHealth.subscriptions.recently_cancelled)}</span>
                          <Badge variant="outline">Last 30 days</Badge>
                        </div>
                      </div>
                      <div className="pt-4 border-t">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-semibold">Total</span>
                          <span className="text-lg font-bold">{safe(subscriptionHealth.subscriptions.total)}</span>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader><CardTitle>Payment Health Indicators</CardTitle></CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">Recent Failures (7d)</span>
                        <Badge className={safe(subscriptionHealth.payment_health.recent_failures_7d) > 0 ? "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300" : "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300"}>
                          {safe(subscriptionHealth.payment_health.recent_failures_7d)}
                        </Badge>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">At Risk Members</span>
                        <Badge className={safe(subscriptionHealth.payment_health.at_risk_members) > 0 ? "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-300" : "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300"}>
                          {safe(subscriptionHealth.payment_health.at_risk_members)}
                        </Badge>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">Expiring Payment Methods</span>
                        <Badge className={safe(subscriptionHealth.payment_health.expiring_payment_methods) > 0 ? "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300" : "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300"}>
                          {safe(subscriptionHealth.payment_health.expiring_payment_methods)}
                        </Badge>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </AdminLayout>
  );
}
