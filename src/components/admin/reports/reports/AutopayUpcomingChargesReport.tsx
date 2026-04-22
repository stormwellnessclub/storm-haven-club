import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CalendarClock, CreditCard, TriangleAlert, Users } from "lucide-react";
import { format, parseISO } from "date-fns";
import {
  buildUpcomingCharges,
  formatCurrency,
  formatTierLabel,
  matchesChargeType,
  matchesTier,
  type FinancialFilters,
  type FinancialDateRange,
  useFinancialReporting,
} from "@/hooks/useFinancialReporting";

interface Props {
  dateRange: FinancialDateRange;
  filters: FinancialFilters;
}

export function AutopayUpcomingChargesReport({ dateRange, filters }: Props) {
  const { data, isLoading, error } = useFinancialReporting(dateRange);

  if (isLoading) return <Skeleton className="h-[420px] w-full" />;
  if (error) return <div className="text-sm text-destructive">Failed to load upcoming charges.</div>;

  const rows = buildUpcomingCharges(data?.members ?? [], dateRange)
    .filter((row) => matchesChargeType(row.chargeType, filters.chargeType))
    .filter((row) => matchesTier({ membership_type: row.tier }, filters.tier))
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate));

  const totalAmount = rows.reduce((sum, row) => sum + row.amount, 0);
  const missingScheduleCount = (data?.members ?? []).filter(
    (member) => !member.next_billing_date || !member.next_annual_fee_date,
  ).length;

  return (
    <div className="space-y-6">
      {missingScheduleCount > 0 && (
        <Alert>
          <TriangleAlert className="h-4 w-4" />
          <AlertDescription>
            {missingScheduleCount} active member{missingScheduleCount === 1 ? "" : "s"} missing one or more upcoming billing dates.
          </AlertDescription>
        </Alert>
      )}

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Upcoming charges</p>
                <p className="text-2xl font-semibold">{rows.length}</p>
              </div>
              <CalendarClock className="h-5 w-5 text-primary" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Projected in range</p>
                <p className="text-2xl font-semibold">{formatCurrency(totalAmount)}</p>
              </div>
              <CreditCard className="h-5 w-5 text-primary" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Members represented</p>
                <p className="text-2xl font-semibold">{new Set(rows.map((row) => row.memberId)).size}</p>
              </div>
              <Users className="h-5 w-5 text-primary" />
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Scheduled member billing</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Due date</TableHead>
                <TableHead>Member</TableHead>
                <TableHead>Tier</TableHead>
                <TableHead>Charge</TableHead>
                <TableHead>Card</TableHead>
                <TableHead className="text-right">Amount</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="py-10 text-center text-muted-foreground">
                    No upcoming charges in this range.
                  </TableCell>
                </TableRow>
              ) : (
                rows.map((row) => (
                  <TableRow key={row.key}>
                    <TableCell>{format(parseISO(row.dueDate), "MMM d, yyyy")}</TableCell>
                    <TableCell>
                      <div>
                        <p className="font-medium">{row.memberName}</p>
                        <p className="text-xs text-muted-foreground">{row.email || "No email"}</p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{formatTierLabel(row.tier)}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={row.chargeType === "annual_fee" ? "secondary" : "default"}>
                        {row.chargeType === "annual_fee" ? "Annual fee" : row.isFoundingMember ? "Founding dues" : "Monthly dues"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {row.cardBrand && row.cardLast4 ? `${row.cardBrand.toUpperCase()} •••• ${row.cardLast4}` : "No card on file"}
                    </TableCell>
                    <TableCell className="text-right font-medium">{formatCurrency(row.amount)}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}