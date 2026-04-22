import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AlertTriangle, CheckCircle2, RotateCcw, User } from "lucide-react";
import { format, parseISO } from "date-fns";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  formatCurrency,
  formatPersonName,
  getAttemptChargeType,
  matchesChargeType,
  matchesTier,
  useFinancialReporting,
  type FinancialDateRange,
  type FinancialFilters,
} from "@/hooks/useFinancialReporting";

interface Props {
  dateRange: FinancialDateRange;
  filters: FinancialFilters;
}

export function FailedPaymentsReport({ dateRange, filters }: Props) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data, isLoading, error } = useFinancialReporting(dateRange);

  const failedRows = useMemo(() => {
    return (data?.paymentAttempts ?? [])
      .filter((attempt) => attempt.status === "failed")
      .filter((attempt) => !attempt.resolved_at)
      .filter((attempt) => !attempt.superseded_at)
      .filter((attempt) => matchesChargeType(getAttemptChargeType(attempt), filters.chargeType))
      .filter((attempt) => matchesTier(attempt.member, filters.tier))
      .sort((a, b) => (b.failed_at || b.created_at || "").localeCompare(a.failed_at || a.created_at || ""));
  }, [data?.paymentAttempts, filters.chargeType, filters.tier]);

  const handleRetry = async (attemptId: string) => {
    const { data: response, error: fnError } = await supabase.functions.invoke("reconcile-arrear", {
      body: { attemptId },
    });

    if (fnError || response?.error) {
      toast.error(fnError?.message || response?.error || "Retry failed");
      return;
    }

    toast.success("Retry initiated");
    queryClient.invalidateQueries({ queryKey: ["financial-reporting"] });
  };

  const handleResolve = async (attemptId: string) => {
    const { error: updateError } = await supabase
      .from("payment_attempts")
      .update({ resolved_at: new Date().toISOString() })
      .eq("id", attemptId);

    if (updateError) {
      toast.error(updateError.message);
      return;
    }

    toast.success("Marked resolved");
    queryClient.invalidateQueries({ queryKey: ["financial-reporting"] });
  };

  if (isLoading) return <Skeleton className="h-[420px] w-full" />;
  if (error) return <div className="text-sm text-destructive">Failed to load failed payments.</div>;

  const totalAmount = failedRows.reduce((sum, row) => sum + row.amount, 0);

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Open failures</p>
            <p className="text-2xl font-semibold">{failedRows.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Amount at risk</p>
            <p className="text-2xl font-semibold">{formatCurrency(totalAmount)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Members affected</p>
            <p className="text-2xl font-semibold">{new Set(failedRows.map((row) => row.member_id).filter(Boolean)).size}</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Unresolved failed payments</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Failed at</TableHead>
                <TableHead>Profile</TableHead>
                <TableHead>Charge</TableHead>
                <TableHead>Reason</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {failedRows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="py-10 text-center text-muted-foreground">
                    No unresolved failed payments in this range.
                  </TableCell>
                </TableRow>
              ) : (
                failedRows.map((row) => {
                  const chargeType = getAttemptChargeType(row);
                  const name = row.member ? formatPersonName(row.member) : row.nonMember ? formatPersonName(row.nonMember) : "Unknown";
                  const email = row.member?.email || row.nonMember?.email || "No email";
                  const canViewMember = !!row.member_id;

                  return (
                    <TableRow key={row.id}>
                      <TableCell>{format(parseISO(row.failed_at || row.created_at || new Date().toISOString()), "MMM d, yyyy h:mm a")}</TableCell>
                      <TableCell>
                        <div>
                          <p className="font-medium">{name}</p>
                          <p className="text-xs text-muted-foreground">{email}</p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{chargeType.replace(/_/g, " ")}</Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2 text-sm">
                          <AlertTriangle className="h-4 w-4 text-destructive" />
                          <span>{row.decline_code || row.decline_reason || row.failure_message || "Unknown decline"}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-right font-medium">{formatCurrency(row.amount)}</TableCell>
                      <TableCell>
                        <div className="flex items-center justify-end gap-2">
                          <Button variant="outline" size="sm" onClick={() => handleRetry(row.id)}>
                            <RotateCcw className="mr-2 h-3.5 w-3.5" />Retry
                          </Button>
                          <Button variant="outline" size="sm" onClick={() => handleResolve(row.id)}>
                            <CheckCircle2 className="mr-2 h-3.5 w-3.5" />Resolve
                          </Button>
                          {canViewMember && (
                            <Button variant="ghost" size="icon" onClick={() => navigate(`/admin/members/${row.member_id}`)}>
                              <User className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}