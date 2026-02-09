import { useState } from "react";
import { format } from "date-fns";
import { ExternalLink, Mail, User, AlertTriangle, XCircle, Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
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
import { useFailedPayments, usePaymentStats, type FailedPayment } from "@/hooks/usePaymentTracking";
import { DateRangePicker, type DateRange } from "@/components/admin/DateRangePicker";
import { FailedPaymentDetailSheet } from "@/components/admin/FailedPaymentDetailSheet";
import { useNavigate } from "react-router-dom";
import { subDays } from "date-fns";

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

  const { data: payments, isLoading } = useFailedPayments(dateRange, filters);
  const { data: stats } = usePaymentStats(dateRange);

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

  return (
    <div className="space-y-4">
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

      {/* Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <XCircle className="h-5 w-5 text-destructive" />
            Failed Payments
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
              No failed payments in this period
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
    </div>
  );
}
