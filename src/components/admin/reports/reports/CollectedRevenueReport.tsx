import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { format, parseISO } from "date-fns";
import {
  formatCurrency,
  formatPersonName,
  getAttemptChargeType,
  getAudienceSegment,
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

const LABELS = {
  membership_dues: "Dues",
  annual_fee: "Annual Fee",
  class_pass: "Class Pass",
  guest_pass: "Guest Pass",
  pos_other: "POS",
} as const;

export function CollectedRevenueReport({ dateRange, filters }: Props) {
  const { data, isLoading, error } = useFinancialReporting(dateRange);

  if (isLoading) return <Skeleton className="h-[420px] w-full" />;
  if (error) return <div className="text-sm text-destructive">Failed to load collected revenue.</div>;

  const succeeded = (data?.paymentAttempts ?? [])
    .filter((attempt) => attempt.status === "succeeded")
    .filter((attempt) => !!attempt.succeeded_at || !!attempt.created_at)
    .filter((attempt) => matchesChargeType(getAttemptChargeType(attempt), filters.chargeType))
    .filter((attempt) => matchesTier(attempt.member, filters.tier));

  const grouped = succeeded.reduce<Record<string, { member: number; non_member: number; total: number }>>((acc, attempt) => {
    const chargeType = getAttemptChargeType(attempt);
    const audience = getAudienceSegment(attempt);
    if (!acc[chargeType]) {
      acc[chargeType] = { member: 0, non_member: 0, total: 0 };
    }
    acc[chargeType][audience] += attempt.amount;
    acc[chargeType].total += attempt.amount;
    return acc;
  }, {});

  const rows = Object.entries(grouped)
    .map(([chargeType, values]) => ({ chargeType, ...values }))
    .sort((a, b) => b.total - a.total);

  const memberTransactions = succeeded.filter((attempt) => getAudienceSegment(attempt) === "member");
  const nonMemberTransactions = succeeded.filter((attempt) => getAudienceSegment(attempt) === "non_member");

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Collected total</p>
            <p className="text-2xl font-semibold">{formatCurrency(succeeded.reduce((sum, attempt) => sum + attempt.amount, 0))}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Member revenue</p>
            <p className="text-2xl font-semibold">{formatCurrency(memberTransactions.reduce((sum, attempt) => sum + attempt.amount, 0))}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Non-member revenue</p>
            <p className="text-2xl font-semibold">{formatCurrency(nonMemberTransactions.reduce((sum, attempt) => sum + attempt.amount, 0))}</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Collected revenue by charge type</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Charge type</TableHead>
                <TableHead className="text-right">Member</TableHead>
                <TableHead className="text-right">Non-member</TableHead>
                <TableHead className="text-right">Total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={row.chargeType}>
                  <TableCell><Badge variant="outline">{LABELS[row.chargeType as keyof typeof LABELS] || row.chargeType}</Badge></TableCell>
                  <TableCell className="text-right">{formatCurrency(row.member)}</TableCell>
                  <TableCell className="text-right">{formatCurrency(row.non_member)}</TableCell>
                  <TableCell className="text-right font-medium">{formatCurrency(row.total)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Member transactions</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Member</TableHead>
                  <TableHead>Charge</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {memberTransactions.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="py-8 text-center text-muted-foreground">No member transactions in range.</TableCell>
                  </TableRow>
                ) : (
                  memberTransactions.slice(0, 12).map((attempt) => (
                    <TableRow key={attempt.id}>
                      <TableCell>{format(parseISO(attempt.succeeded_at || attempt.created_at || new Date().toISOString()), "MMM d, yyyy")}</TableCell>
                      <TableCell>{formatPersonName(attempt.member || {})}</TableCell>
                      <TableCell>{LABELS[getAttemptChargeType(attempt)]}</TableCell>
                      <TableCell className="text-right font-medium">{formatCurrency(attempt.amount)}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Non-member transactions</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Profile</TableHead>
                  <TableHead>Charge</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {nonMemberTransactions.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="py-8 text-center text-muted-foreground">No non-member transactions in range.</TableCell>
                  </TableRow>
                ) : (
                  nonMemberTransactions.slice(0, 12).map((attempt) => (
                    <TableRow key={attempt.id}>
                      <TableCell>{format(parseISO(attempt.succeeded_at || attempt.created_at || new Date().toISOString()), "MMM d, yyyy")}</TableCell>
                      <TableCell>{formatPersonName(attempt.nonMember || {})}</TableCell>
                      <TableCell>{LABELS[getAttemptChargeType(attempt)]}</TableCell>
                      <TableCell className="text-right font-medium">{formatCurrency(attempt.amount)}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}