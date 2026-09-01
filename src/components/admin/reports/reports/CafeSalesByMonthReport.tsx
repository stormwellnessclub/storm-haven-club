import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Info, DollarSign, Receipt, Coffee } from "lucide-react";
import { format } from "date-fns";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { fetchCafeSales, CAFE_TAX_RATE } from "@/lib/cafeSales";

interface Props {
  dateRange: { start: Date; end: Date };
  filters: Record<string, string | boolean>;
}

const TAX_RATE = CAFE_TAX_RATE;

export function CafeSalesByMonthReport({ dateRange }: Props) {
  const startISO = dateRange.start.toISOString();
  const endISO = dateRange.end.toISOString();

  const { data, isLoading, error } = useQuery({
    queryKey: ["cafe-sales-by-month", startISO, endISO],
    queryFn: async () => {
      const all = await fetchCafeSales(dateRange.start, dateRange.end);

      const byMonth = new Map<string, { key: string; label: string; orders: number; gross: number }>();
      for (const row of all) {
        const d = new Date(row.created_at);
        const key = format(d, "yyyy-MM");
        const label = format(d, "MMM yyyy");
        const entry = byMonth.get(key) ?? { key, label, orders: 0, gross: 0 };
        entry.orders += 1;
        entry.gross += Number(row.total_amount) || 0;
        byMonth.set(key, entry);
      }

      const rows = Array.from(byMonth.values())
        .sort((a, b) => a.key.localeCompare(b.key))
        .map((r) => {
          const tax = (r.gross / (1 + TAX_RATE)) * TAX_RATE;
          const net = r.gross - tax;
          return { ...r, tax, net };
        });

      const totalGross = rows.reduce((s, r) => s + r.gross, 0);
      const totalTax = rows.reduce((s, r) => s + r.tax, 0);
      const totalNet = rows.reduce((s, r) => s + r.net, 0);
      const totalOrders = rows.reduce((s, r) => s + r.orders, 0);

      return { rows, totalGross, totalTax, totalNet, totalOrders };
    },
  });


  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-64 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertDescription>{(error as Error).message}</AlertDescription>
      </Alert>
    );
  }

  const rows = data?.rows ?? [];

  return (
    <div className="space-y-6">
      <Alert>
        <Info className="h-4 w-4" />
        <AlertDescription>
          Café orders store tax-inclusive totals. Sales tax shown here is back-calculated at 6% (MI).
          For authoritative Stripe-sourced tax figures, see the <strong>Sales Tax Collected</strong> report.
        </AlertDescription>
      </Alert>

      {/* Summary tiles */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <DollarSign className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Gross Sales</p>
                <p className="text-2xl font-bold">${data?.totalGross.toFixed(2) ?? "0.00"}</p>
                <p className="text-xs text-muted-foreground">{data?.totalOrders ?? 0} orders</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-secondary">
                <Receipt className="h-5 w-5 text-secondary-foreground" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Sales Tax (6% MI, est.)</p>
                <p className="text-2xl font-bold">${data?.totalTax.toFixed(2) ?? "0.00"}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-accent">
                <Coffee className="h-5 w-5 text-accent-foreground" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Net Sales (pre-tax)</p>
                <p className="text-2xl font-bold">${data?.totalNet.toFixed(2) ?? "0.00"}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Monthly bar chart */}
      <Card>
        <CardHeader><CardTitle className="text-lg">Gross Sales by Month</CardTitle></CardHeader>
        <CardContent>
          {rows.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">No café sales in this date range.</div>
          ) : (
            <ResponsiveContainer width="100%" height={320}>
              <BarChart data={rows}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="label" />
                <YAxis tickFormatter={(v) => `$${v}`} />
                <Tooltip formatter={(v: number) => [`$${v.toFixed(2)}`, "Gross Sales"]} />
                <Bar dataKey="gross" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* Monthly breakdown table */}
      {rows.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-lg">Monthly Breakdown</CardTitle></CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Month</TableHead>
                  <TableHead className="text-right">Orders</TableHead>
                  <TableHead className="text-right">Gross Sales</TableHead>
                  <TableHead className="text-right">Sales Tax (6%)</TableHead>
                  <TableHead className="text-right">Net Sales</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => (
                  <TableRow key={r.key}>
                    <TableCell className="font-medium">{r.label}</TableCell>
                    <TableCell className="text-right">{r.orders}</TableCell>
                    <TableCell className="text-right">${r.gross.toFixed(2)}</TableCell>
                    <TableCell className="text-right">${r.tax.toFixed(2)}</TableCell>
                    <TableCell className="text-right">${r.net.toFixed(2)}</TableCell>
                  </TableRow>
                ))}
                <TableRow className="font-bold border-t-2">
                  <TableCell>Total</TableCell>
                  <TableCell className="text-right">{data?.totalOrders}</TableCell>
                  <TableCell className="text-right">${data?.totalGross.toFixed(2)}</TableCell>
                  <TableCell className="text-right">${data?.totalTax.toFixed(2)}</TableCell>
                  <TableCell className="text-right">${data?.totalNet.toFixed(2)}</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
