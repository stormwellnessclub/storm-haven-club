import { useState } from "react";
import { format, addDays } from "date-fns";
import { User, CreditCard, AlertTriangle, Clock, Loader2 } from "lucide-react";
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
import { useUpcomingPayments } from "@/hooks/usePaymentTracking";
import { useNavigate } from "react-router-dom";

export function UpcomingPaymentsTab() {
  const navigate = useNavigate();
  const [daysAhead, setDaysAhead] = useState(30);
  const [filters, setFilters] = useState<{
    tier?: string;
    cardStatus?: "expiring" | "expired" | "valid";
    foundingMemberOnly?: boolean;
  }>({});

  const { data: payments, isLoading } = useUpcomingPayments(daysAhead, filters);

  const tiers = [
    { value: "Soul", label: "Soul" },
    { value: "Spirit", label: "Spirit" },
    { value: "Aura", label: "Aura" },
  ];

  // Calculate summary stats
  const expectedRevenue7 = payments
    ?.filter(p => {
      const daysUntil = Math.ceil((p.next_billing_date.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
      return daysUntil <= 7;
    })
    .reduce((sum, p) => sum + p.expected_amount, 0) || 0;

  const expectedRevenue30 = payments?.reduce((sum, p) => sum + p.expected_amount, 0) || 0;
  const expiringCards = payments?.filter(p => p.risk_level === "medium").length || 0;
  const highRisk = payments?.filter(p => p.risk_level === "high").length || 0;
  const atRiskAmount = payments
    ?.filter(p => p.risk_level === "high" || p.risk_level === "medium")
    .reduce((sum, p) => sum + p.expected_amount, 0) || 0;
  const totalPayments = payments?.length || 0;
  const validCardPayments = payments?.filter(p => p.risk_level === "low").length || 0;
  const collectionConfidence = totalPayments > 0 ? Math.round((validCardPayments / totalPayments) * 100) : 0;
  const foundingCount = payments?.filter(p => p.is_founding_member).length || 0;

  const getRiskBadge = (risk: "high" | "medium" | "low") => {
    switch (risk) {
      case "high":
        return <Badge variant="destructive">High Risk</Badge>;
      case "medium":
        return <Badge className="bg-amber-500/20 text-amber-700 dark:text-amber-400">At Risk</Badge>;
      default:
        return <Badge variant="secondary">Low Risk</Badge>;
    }
  };

  return (
    <div className="space-y-4">
      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-6">
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Expected (7 days)</p>
            <p className="text-2xl font-bold text-green-600">${expectedRevenue7.toLocaleString()}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Expected (30 days)</p>
            <p className="text-2xl font-bold text-green-600">${expectedRevenue30.toLocaleString()}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">At-Risk Amount</p>
            <p className="text-2xl font-bold text-amber-600">${atRiskAmount.toLocaleString()}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Collection Confidence</p>
            <p className="text-2xl font-bold" style={{ color: collectionConfidence >= 80 ? 'hsl(var(--primary))' : collectionConfidence >= 50 ? '#d97706' : 'hsl(var(--destructive))' }}>
              {collectionConfidence}%
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Expiring / High Risk</p>
            <p className="text-2xl font-bold text-destructive">{expiringCards + highRisk}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Founding ($0 auto-pay)</p>
            <p className="text-2xl font-bold text-muted-foreground">{foundingCount}</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-wrap gap-4 items-center">
            <Select
              value={daysAhead.toString()}
              onValueChange={(value) => setDaysAhead(parseInt(value))}
            >
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Time Range" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="7">Next 7 days</SelectItem>
                <SelectItem value="14">Next 14 days</SelectItem>
                <SelectItem value="30">Next 30 days</SelectItem>
                <SelectItem value="60">Next 60 days</SelectItem>
                <SelectItem value="90">Next 90 days</SelectItem>
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
              value={filters.cardStatus || "all"}
              onValueChange={(value) =>
                setFilters((f) => ({
                  ...f,
                  cardStatus: value === "all" ? undefined : (value as any),
                }))
              }
            >
              <SelectTrigger className="w-[160px]">
                <SelectValue placeholder="Card Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Cards</SelectItem>
                <SelectItem value="expired">Expired</SelectItem>
                <SelectItem value="expiring">Expiring Soon</SelectItem>
                <SelectItem value="valid">Valid</SelectItem>
              </SelectContent>
            </Select>
            <div className="flex items-center gap-2">
              <Switch
                id="founding-filter"
                checked={filters.foundingMemberOnly || false}
                onCheckedChange={(checked) =>
                  setFilters((f) => ({ ...f, foundingMemberOnly: checked }))
                }
              />
              <Label htmlFor="founding-filter" className="text-sm">Founding Only</Label>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5 text-primary" />
            Upcoming Payments
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
              No upcoming payments in this period
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Member</TableHead>
                  <TableHead>Tier</TableHead>
                  <TableHead>Expected Amount</TableHead>
                  <TableHead>Next Billing</TableHead>
                  <TableHead>Card on File</TableHead>
                  <TableHead>Card Expiry</TableHead>
                  <TableHead>Risk Level</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {payments.map((payment) => (
                  <TableRow key={payment.member_id}>
                    <TableCell>
                      <div>
                        <p className="font-medium">{payment.member_name}</p>
                        <p className="text-xs text-muted-foreground">{payment.member_email}</p>
                        {payment.is_founding_member && (
                          <Badge variant="outline" className="text-xs mt-1">Founding</Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{payment.membership_type}</Badge>
                    </TableCell>
                    <TableCell className="font-medium">
                      ${payment.expected_amount.toLocaleString()}
                    </TableCell>
                    <TableCell>
                      {format(payment.next_billing_date, "MMM d, yyyy")}
                    </TableCell>
                    <TableCell>
                      {payment.card_last4 ? (
                        <span className="flex items-center gap-1">
                          <CreditCard className="h-4 w-4 text-muted-foreground" />
                          {payment.card_brand} •••• {payment.card_last4}
                        </span>
                      ) : (
                        <span className="text-destructive flex items-center gap-1">
                          <AlertTriangle className="h-4 w-4" />
                          No Card
                        </span>
                      )}
                    </TableCell>
                    <TableCell>
                      {payment.card_exp_month && payment.card_exp_year ? (
                        <span>{payment.card_exp_month}/{payment.card_exp_year}</span>
                      ) : (
                        "—"
                      )}
                    </TableCell>
                    <TableCell>{getRiskBadge(payment.risk_level)}</TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => navigate(`/admin/members/${payment.member_id}`)}
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
    </div>
  );
}
