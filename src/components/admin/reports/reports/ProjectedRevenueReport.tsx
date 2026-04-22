import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { AlertTriangle } from "lucide-react";
import { BarChart, Bar, CartesianGrid, ResponsiveContainer, XAxis, YAxis } from "recharts";
import { format, parseISO } from "date-fns";
import {
  buildProjectedCharges,
  formatCurrency,
  formatTierLabel,
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

export function ProjectedRevenueReport({ dateRange, filters }: Props) {
  const { data, isLoading, error } = useFinancialReporting(dateRange);

  if (isLoading) return <Skeleton className="h-[420px] w-full" />;
  if (error) return <div className="text-sm text-destructive">Failed to load projected revenue.</div>;

  const rows = buildProjectedCharges(data?.members ?? [], dateRange)
    .filter((row) => matchesChargeType(row.chargeType, filters.chargeType))
    .filter((row) => matchesTier({ membership_type: row.tier }, filters.tier))
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate));

  const groupedByMonth = rows.reduce<Record<string, { month: string; dues: number; annual: number; total: number }>>((acc, row) => {
    const key = format(parseISO(row.dueDate), "MMM yyyy");
    if (!acc[key]) {
      acc[key] = { month: key, dues: 0, annual: 0, total: 0 };
    }
    if (row.chargeType === "annual_fee") acc[key].annual += row.amount;
    else acc[key].dues += row.amount;
    acc[key].total += row.amount;
    return acc;
  }, {});

  const chartData = Object.values(groupedByMonth);
  const missingFoundingDates = (data?.members ?? []).filter(
    (member) => member.is_founding_member && !member.next_billing_date,
  ).length;

  return (
    <div className="space-y-6">
      {(missingFoundingDates > 0 || rows.some((row) => row.isEstimate)) && (
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            {missingFoundingDates > 0 ? `${missingFoundingDates} founding member${missingFoundingDates === 1 ? "" : "s"} missing next dues dates.` : "Projections beyond the next scheduled charge are estimates."}
          </AlertDescription>
        </Alert>
      )}

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Projected total</p>
            <p className="text-2xl font-semibold">{formatCurrency(rows.reduce((sum, row) => sum + row.amount, 0))}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Membership dues</p>
            <p className="text-2xl font-semibold">{formatCurrency(rows.filter((row) => row.chargeType === "membership_dues").reduce((sum, row) => sum + row.amount, 0))}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Annual fee renewals</p>
            <p className="text-2xl font-semibold">{formatCurrency(rows.filter((row) => row.chargeType === "annual_fee").reduce((sum, row) => sum + row.amount, 0))}</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Projected monthly billing</CardTitle>
        </CardHeader>
        <CardContent>
          <ChartContainer
            config={{ dues: { label: "Dues", color: "hsl(var(--primary))" }, annual: { label: "Annual fee", color: "hsl(var(--accent))" } }}
            className="h-[280px]"
          >
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border/50" />
                <XAxis dataKey="month" />
                <YAxis tickFormatter={(value) => `$${Math.round(value / 1000)}k`} />
                <ChartTooltip content={<ChartTooltipContent formatter={(value) => formatCurrency(Number(value))} />} />
                <Bar dataKey="dues" stackId="projection" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                <Bar dataKey="annual" stackId="projection" fill="hsl(var(--accent))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </ChartContainer>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Projected line items</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Due date</TableHead>
                <TableHead>Member</TableHead>
                <TableHead>Tier</TableHead>
                <TableHead>Charge</TableHead>
                <TableHead>Estimate</TableHead>
                <TableHead className="text-right">Amount</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="py-10 text-center text-muted-foreground">No projected charges in this range.</TableCell>
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
                    <TableCell><Badge variant="outline">{formatTierLabel(row.tier)}</Badge></TableCell>
                    <TableCell>{row.chargeType === "annual_fee" ? "Annual fee" : row.isFoundingMember ? "Founding dues" : "Monthly dues"}</TableCell>
                    <TableCell>{row.isEstimate ? <Badge variant="secondary">Estimate</Badge> : <Badge variant="outline">Scheduled</Badge>}</TableCell>
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