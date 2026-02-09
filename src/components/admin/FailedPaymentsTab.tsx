import { useState } from "react";
import { format } from "date-fns";
import { ExternalLink, Mail, User, AlertTriangle, XCircle, Loader2, RefreshCcw, Ban, RotateCcw } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useFailedPayments, usePaymentStats, useMembersWithBillingFailures, useRetryInvoice, useSyncMemberStatus, useDeactivateMember, type FailedPayment, type MemberBillingFailure } from "@/hooks/usePaymentTracking";
import { DateRangePicker, type DateRange } from "@/components/admin/DateRangePicker";
import { FailedPaymentDetailSheet } from "@/components/admin/FailedPaymentDetailSheet";
import { useNavigate } from "react-router-dom";
import { subDays } from "date-fns";
import { toast } from "sonner";

export function FailedPaymentsTab() {
  const navigate = useNavigate();
  const [dateRange, setDateRange] = useState<DateRange>({
    from: subDays(new Date(), 30),
    to: new Date(),
  });
  const [filters, setFilters] = useState<{
    declineCode?: string;
    status?: string;
    tier?: string;
    emailSent?: boolean | null;
  }>({});
  const [selectedPayment, setSelectedPayment] = useState<FailedPayment | null>(null);
  const [detailSheetOpen, setDetailSheetOpen] = useState(false);
  const [deactivateTarget, setDeactivateTarget] = useState<MemberBillingFailure | null>(null);

  const { data: payments, isLoading } = useFailedPayments(dateRange, filters);
  const { data: stats } = usePaymentStats(dateRange);
  const { data: billingFailures, isLoading: isLoadingBilling } = useMembersWithBillingFailures();
  const retryInvoice = useRetryInvoice();
  const syncStatus = useSyncMemberStatus();
  const deactivateMember = useDeactivateMember();

  const [syncingAll, setSyncingAll] = useState(false);

  const handleSyncAll = async () => {
    if (!billingFailures?.length) return;
    setSyncingAll(true);
    let synced = 0;
    for (const m of billingFailures) {
      try {
        const result = await syncStatus.mutateAsync(m.id);
        if (result.synced) synced++;
      } catch { /* continue */ }
    }
    setSyncingAll(false);
    toast.success(`Synced ${synced} of ${billingFailures.length} members`);
  };

  const handleRetry = async (memberId: string, name: string) => {
    try {
      const result = await retryInvoice.mutateAsync(memberId);
      if (result.status === 'paid') {
        toast.success(`Payment succeeded for ${name}!`);
      } else {
        toast.error(`Payment attempt returned status: ${result.status}`);
      }
    } catch (err: any) {
      toast.error(err.message || "Retry failed");
    }
  };

  const handleDeactivate = async () => {
    if (!deactivateTarget) return;
    try {
      await deactivateMember.mutateAsync(deactivateTarget.id);
      toast.success(`${deactivateTarget.first_name} ${deactivateTarget.last_name} has been deactivated`);
      setDeactivateTarget(null);
    } catch (err: any) {
      toast.error(err.message || "Deactivation failed");
    }
  };

  const declineCodes = [
    { value: "insufficient_funds", label: "Insufficient Funds" },
    { value: "card_declined", label: "Card Declined" },
    { value: "expired_card", label: "Expired Card" },
    { value: "incorrect_cvc", label: "Incorrect CVC" },
    { value: "processing_error", label: "Processing Error" },
    { value: "do_not_honor", label: "Do Not Honor" },
  ];

  const tiers = [
    { value: "Soul", label: "Soul" },
    { value: "Spirit", label: "Spirit" },
    { value: "Aura", label: "Aura" },
  ];

  const handleRowClick = (payment: FailedPayment) => {
    setSelectedPayment(payment);
    setDetailSheetOpen(true);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'incomplete': return <Badge variant="destructive">Incomplete</Badge>;
      case 'incomplete_expired': return <Badge variant="destructive">Expired</Badge>;
      case 'past_due': return <Badge className="bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200">Past Due</Badge>;
      case 'unpaid': return <Badge variant="destructive">Unpaid</Badge>;
      default: return <Badge variant="secondary">{status}</Badge>;
    }
  };

  return (
    <div className="space-y-4">
      {/* Members with Billing Issues - Primary Section */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              Members with Billing Issues
              {billingFailures && (
                <Badge variant="destructive" className="ml-2">
                  {billingFailures.length}
                </Badge>
              )}
            </CardTitle>
            <Button
              variant="outline"
              size="sm"
              onClick={handleSyncAll}
              disabled={syncingAll || !billingFailures?.length}
            >
              <RefreshCcw className={`h-4 w-4 mr-2 ${syncingAll ? 'animate-spin' : ''}`} />
              Sync All from Stripe
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {isLoadingBilling ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : !billingFailures || billingFailures.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No members with billing issues found
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Member</TableHead>
                  <TableHead>Tier</TableHead>
                  <TableHead>Member Status</TableHead>
                  <TableHead>Subscription Status</TableHead>
                  <TableHead>Card on File</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {billingFailures.map((member) => (
                  <TableRow key={member.id}>
                    <TableCell>
                      <div>
                        <p className="font-medium">{member.first_name} {member.last_name}</p>
                        <p className="text-xs text-muted-foreground">{member.email}</p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{member.membership_type}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary" className="capitalize">
                        {member.status?.replace(/_/g, ' ')}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {getStatusBadge(member.subscription_status)}
                    </TableCell>
                    <TableCell>
                      {member.card_brand && member.card_last4 ? (
                        <span className="text-sm">
                          {member.card_brand.toUpperCase()} •••• {member.card_last4}
                        </span>
                      ) : (
                        <span className="text-sm text-muted-foreground">No card</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleRetry(member.id, `${member.first_name} ${member.last_name}`)}
                          disabled={retryInvoice.isPending || !member.stripe_subscription_id}
                          title="Retry payment"
                        >
                          {retryInvoice.isPending ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : (
                            <RotateCcw className="h-3 w-3" />
                          )}
                          <span className="ml-1 hidden sm:inline">Retry</span>
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => syncStatus.mutateAsync(member.id).then(r => {
                            toast.success(r.synced ? `Status updated: ${r.currentStatus}` : "Already in sync");
                          }).catch(() => toast.error("Sync failed"))}
                          disabled={syncStatus.isPending}
                          title="Sync from Stripe"
                        >
                          <RefreshCcw className={`h-3 w-3 ${syncStatus.isPending ? 'animate-spin' : ''}`} />
                        </Button>
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => setDeactivateTarget(member)}
                          title="Deactivate member"
                        >
                          <Ban className="h-3 w-3" />
                          <span className="ml-1 hidden sm:inline">Suspend</span>
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => navigate(`/admin/members/${member.id}`)}
                          title="View profile"
                        >
                          <User className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-5">
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Failed Attempts</p>
            <p className="text-2xl font-bold">{stats?.failed.totalAttempts || 0}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Total Amount</p>
            <p className="text-2xl font-bold text-destructive">
              ${(stats?.failed.totalAmount || 0).toLocaleString()}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Members Affected</p>
            <p className="text-2xl font-bold">{stats?.failed.uniqueMembers || 0}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Avg Attempts</p>
            <p className="text-2xl font-bold">{(stats?.failed.avgAttempts || 0).toFixed(1)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Top Decline</p>
            <p className="text-lg font-bold truncate">{stats?.failed.mostCommonDecline || "N/A"}</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-wrap gap-4">
            <DateRangePicker
              value={dateRange}
              onChange={setDateRange}
              className="w-[280px]"
            />
            <Select
              value={filters.declineCode || "all"}
              onValueChange={(value) =>
                setFilters((f) => ({ ...f, declineCode: value === "all" ? undefined : value }))
              }
            >
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Decline Code" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Decline Codes</SelectItem>
                {declineCodes.map((code) => (
                  <SelectItem key={code.value} value={code.value}>
                    {code.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={filters.status || "all"}
              onValueChange={(value) =>
                setFilters((f) => ({ ...f, status: value === "all" ? undefined : value }))
              }
            >
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="failed">Failed</SelectItem>
                <SelectItem value="requires_action">Action Required</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
              </SelectContent>
            </Select>
            <Select
              value={filters.tier || "all"}
              onValueChange={(value) =>
                setFilters((f) => ({ ...f, tier: value === "all" ? undefined : value }))
              }
            >
              <SelectTrigger className="w-[120px]">
                <SelectValue placeholder="Tier" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Tiers</SelectItem>
                {tiers.map((tier) => (
                  <SelectItem key={tier.value} value={tier.value}>
                    {tier.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={filters.emailSent === null ? "all" : filters.emailSent ? "yes" : "no"}
              onValueChange={(value) =>
                setFilters((f) => ({
                  ...f,
                  emailSent: value === "all" ? null : value === "yes",
                }))
              }
            >
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="Email Sent" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="yes">Email Sent</SelectItem>
                <SelectItem value="no">Not Contacted</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Payment Attempts Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <XCircle className="h-5 w-5 text-destructive" />
            Failed Payment Attempts
            {payments && (
              <Badge variant="secondary" className="ml-2">
                {payments.length}
              </Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : !payments || payments.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              No failed payment attempts recorded in this period
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Member</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Decline Code</TableHead>
                  <TableHead>Attempt #</TableHead>
                  <TableHead>Next Retry</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Contacted</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {payments.map((payment) => (
                  <TableRow
                    key={payment.id}
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => handleRowClick(payment)}
                  >
                    <TableCell>
                      <div>
                        <p className="font-medium">{payment.member_name}</p>
                        <p className="text-xs text-muted-foreground">{payment.member_email}</p>
                      </div>
                    </TableCell>
                    <TableCell className="font-medium">
                      ${payment.amount.toLocaleString()}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={payment.status === "failed" ? "destructive" : "secondary"}
                      >
                        {payment.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm">{payment.decline_code || "—"}</span>
                    </TableCell>
                    <TableCell>{payment.attempt_number || 1}</TableCell>
                    <TableCell>
                      {payment.next_retry_at
                        ? format(new Date(payment.next_retry_at), "MMM d, h:mm a")
                        : "—"}
                    </TableCell>
                    <TableCell>
                      {format(new Date(payment.created_at), "MMM d, yyyy")}
                    </TableCell>
                    <TableCell>
                      {payment.email_sent ? (
                        <Badge variant="secondary" className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                          <Mail className="h-3 w-3 mr-1" />
                          Yes
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-muted-foreground">
                          No
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={(e) => {
                          e.stopPropagation();
                          navigate(`/admin/members/${payment.member_id}`);
                        }}
                      >
                        <User className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <FailedPaymentDetailSheet
        payment={selectedPayment}
        open={detailSheetOpen}
        onOpenChange={setDetailSheetOpen}
      />

      {/* Deactivate Confirmation Dialog */}
      <AlertDialog open={!!deactivateTarget} onOpenChange={(open) => !open && setDeactivateTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Deactivate Member</AlertDialogTitle>
            <AlertDialogDescription>
              This will suspend {deactivateTarget?.first_name} {deactivateTarget?.last_name}'s membership and cancel their Stripe subscription. This action can be reversed by reactivating the member.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeactivate}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deactivateMember.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : null}
              Deactivate
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
