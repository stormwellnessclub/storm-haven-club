import { useState } from "react";
import { format, subDays } from "date-fns";
import { User, CheckCircle, ExternalLink, Mail, Loader2 } from "lucide-react";
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
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useSuccessfulPayments, usePaymentStats } from "@/hooks/usePaymentTracking";
import { DateRangePicker, type DateRange } from "@/components/admin/DateRangePicker";
import { useNavigate } from "react-router-dom";

export function SuccessfulPaymentsTab() {
  const navigate = useNavigate();
  const [dateRange, setDateRange] = useState<DateRange>({
    from: subDays(new Date(), 30),
    to: new Date(),
  });
  const [filters, setFilters] = useState<{
    paymentType?: string;
    tier?: string;
    foundingMemberOnly?: boolean;
  }>({});

  const { data: payments, isLoading } = useSuccessfulPayments(dateRange, filters);
  const { data: stats } = usePaymentStats(dateRange);

  const paymentTypes = [
    { value: "Manual Charge", label: "Manual Charge" },
    { value: "Subscription", label: "Subscription" },
  ];

  const tiers = [
    { value: "Soul", label: "Soul" },
    { value: "Spirit", label: "Spirit" },
    { value: "Aura", label: "Aura" },
  ];

  return (
    <div className="space-y-4">
      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Total Collected</p>
            <p className="text-2xl font-bold text-green-600">
              ${(stats?.success.totalCollected || 0).toLocaleString()}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Transactions</p>
            <p className="text-2xl font-bold">{stats?.success.transactionCount || 0}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Avg Transaction</p>
            <p className="text-2xl font-bold">
              ${(stats?.success.averageTransaction || 0).toFixed(0)}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-wrap gap-4 items-center">
            <DateRangePicker
              value={dateRange}
              onChange={setDateRange}
              className="w-[280px]"
            />
            <Select
              value={filters.paymentType || "all"}
              onValueChange={(value) =>
                setFilters((f) => ({ ...f, paymentType: value === "all" ? undefined : value }))
              }
            >
              <SelectTrigger className="w-[160px]">
                <SelectValue placeholder="Payment Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                {paymentTypes.map((type) => (
                  <SelectItem key={type.value} value={type.value}>
                    {type.label}
                  </SelectItem>
                ))}
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
            <div className="flex items-center gap-2">
              <Switch
                id="founding-filter-success"
                checked={filters.foundingMemberOnly || false}
                onCheckedChange={(checked) =>
                  setFilters((f) => ({ ...f, foundingMemberOnly: checked }))
                }
              />
              <Label htmlFor="founding-filter-success" className="text-sm">Founding Only</Label>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CheckCircle className="h-5 w-5 text-green-600" />
            Successful Payments
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
              No successful payments in this period
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Member</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Payment Method</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Receipt</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {payments.map((payment) => (
                  <TableRow key={payment.id}>
                    <TableCell>
                      <div>
                        <p className="font-medium">{payment.member_name}</p>
                        <p className="text-xs text-muted-foreground">{payment.member_email}</p>
                      </div>
                    </TableCell>
                    <TableCell>{payment.description}</TableCell>
                    <TableCell className="font-medium text-green-600">
                      ${payment.amount.toLocaleString()}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {payment.payment_method}
                    </TableCell>
                    <TableCell>
                      {format(new Date(payment.date), "MMM d, yyyy h:mm a")}
                    </TableCell>
                    <TableCell>
                      {payment.receipt_sent ? (
                        <Badge variant="secondary" className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                          <Mail className="h-3 w-3 mr-1" />
                          Sent
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-muted-foreground">
                          Not Sent
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => navigate(`/admin/members/${payment.member_id}`)}
                        >
                          <User className="h-4 w-4" />
                        </Button>
                        {payment.stripe_id && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() =>
                              window.open(
                                `https://dashboard.stripe.com/payments/${payment.stripe_id}`,
                                "_blank"
                              )
                            }
                          >
                            <ExternalLink className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
