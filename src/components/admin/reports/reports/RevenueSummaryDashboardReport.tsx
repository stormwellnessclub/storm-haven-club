import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { ResponsiveContainer, BarChart, CartesianGrid, XAxis, YAxis, Bar } from "recharts";
import {
  buildProjectedCharges,
  formatCurrency,
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

export function RevenueSummaryDashboardReport({ dateRange, filters }: Props) {
  const { data, isLoading, error } = useFinancialReporting(dateRange);

  if (isLoading) return <Skeleton className="h-[420px] w-full" />;
  if (error) return <div className="text-sm text-destructive">Failed to load revenue summary.</div>;

  const collected = (data?.paymentAttempts ?? [])
    .filter((attempt) => attempt.status === "succeeded")
    .filter((attempt) => matchesChargeType(getAttemptChargeType(attempt), filters.chargeType))
    .filter((attempt) => matchesTier(attempt.member, filters.tier));

  const projected = buildProjectedCharges(data?.members ?? [], dateRange)
    .filter((row) => matchesChargeType(row.chargeType, filters.chargeType))
    .filter((row) => matchesTier({ membership_type: row.tier }, filters.tier));

  const collectedTotal = collected.reduce((sum, row) => sum + row.amount, 0);
  const projectedTotal = projected.reduce((sum, row) => sum + row.amount, 0);
  const mrr = projected.filter((row) => row.chargeType === "membership_dues" && !row.isFoundingMember).reduce((sum, row) => sum + row.amount, 0);
  const annualInitiationProjection = projected.filter((row) => row.chargeType === "annual_fee").reduce((sum, row) => sum + row.amount, 0);
  const comparisonData = [
    {
      label: "Collected",
      amount: collectedTotal,
    },
    {
      label: "Projected",
      amount: projectedTotal,
    },
  ];

  const breakdownRows = [
    {
      label: "Membership dues",
      collected: collected.filter((row) => getAttemptChargeType(row) === "membership_dues").reduce((sum, row) => sum + row.amount, 0),
      projected: projected.filter((row) => row.chargeType === "membership_dues").reduce((sum, row) => sum + row.amount, 0),
    },
    {
      label: "Annual fee",
      collected: collected.filter((row) => getAttemptChargeType(row) === "annual_fee").reduce((sum, row) => sum + row.amount, 0),
      projected: projected.filter((row) => row.chargeType === "annual_fee").reduce((sum, row) => sum + row.amount, 0),
    },
    {
      label: "Class pass",
      collected: collected.filter((row) => getAttemptChargeType(row) === "class_pass").reduce((sum, row) => sum + row.amount, 0),
      projected: 0,
    },
    {
      label: "Guest pass",
      collected: collected.filter((row) => getAttemptChargeType(row) === "guest_pass").reduce((sum, row) => sum + row.amount, 0),
      projected: 0,
    },
    {
      label: "POS",
      collected: collected.filter((row) => getAttemptChargeType(row) === "pos_other").reduce((sum, row) => sum + row.amount, 0),
      projected: 0,
    },
  ];

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Collected revenue</p>
            <p className="text-2xl font-semibold">{formatCurrency(collectedTotal)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">MRR</p>
            <p className="text-2xl font-semibold">{formatCurrency(mrr)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Annual initiation fee revenue (next 12mo)</p>
            <p className="text-2xl font-semibold">{formatCurrency(annualInitiationProjection)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">12-month total projection</p>
            <p className="text-2xl font-semibold">{formatCurrency(projectedTotal)}</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Collected vs projected</CardTitle>
        </CardHeader>
        <CardContent>
          <ChartContainer config={{ amount: { label: "Revenue", color: "hsl(var(--primary))" } }} className="h-[260px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={comparisonData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border/50" />
                <XAxis dataKey="label" />
                <YAxis tickFormatter={(value) => `$${Math.round(value / 1000)}k`} />
                <ChartTooltip content={<ChartTooltipContent formatter={(value) => formatCurrency(Number(value))} />} />
                <Bar dataKey="amount" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </ChartContainer>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Breakdown</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Category</TableHead>
                <TableHead className="text-right">Collected</TableHead>
                <TableHead className="text-right">Projected</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {breakdownRows.map((row) => (
                <TableRow key={row.label}>
                  <TableCell>{row.label}</TableCell>
                  <TableCell className="text-right">{formatCurrency(row.collected)}</TableCell>
                  <TableCell className="text-right">{formatCurrency(row.projected)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}