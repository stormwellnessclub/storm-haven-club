import { useQuery } from "@tanstack/react-query";
import { format, eachDayOfInterval, parseISO } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { DollarSign, ShoppingCart, TrendingUp, Receipt, Coffee } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import { fetchCafeSales, CAFE_TAX_RATE } from "@/lib/cafeSales";

interface CafeSalesReportProps {
  dateRange: { start: Date; end: Date };
  filters: Record<string, string | boolean>;
}

const TAX_RATE = CAFE_TAX_RATE;
const PIE_COLORS = [
  "hsl(var(--primary))",
  "hsl(var(--chart-2))",
  "hsl(var(--chart-3))",
  "hsl(var(--chart-4))",
  "hsl(var(--chart-5))",
  "#8884d8",
  "#ffc658",
  "#ff7300",
];

export function CafeSalesReport({ dateRange }: CafeSalesReportProps) {
  const { data: orders, isLoading } = useQuery({
    queryKey: ["cafe-sales-unified", dateRange.start.toISOString(), dateRange.end.toISOString()],
    queryFn: () => fetchCafeSales(dateRange.start, dateRange.end),
  });

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-28" />)}
        </div>
        <Skeleton className="h-72" />
        <Skeleton className="h-64" />
      </div>
    );
  }

  const sales = orders || [];

  if (sales.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <Coffee className="h-12 w-12 mx-auto mb-4 opacity-50" />
        <p>No café sales found for this date range</p>
      </div>
    );
  }

  // Summary stats
  const totalRevenue = sales.reduce((sum, o) => sum + o.total_amount, 0);
  const totalOrders = sales.length;
  const avgOrderValue = totalRevenue / totalOrders;
  // Totals are tax-inclusive — back out the 6% MI tax
  const totalTax = totalRevenue - totalRevenue / (1 + TAX_RATE);

  // Daily aggregation
  const dailyMap = new Map<string, { revenue: number; orders: number }>();
  const days = eachDayOfInterval({ start: dateRange.start, end: dateRange.end });
  days.forEach((d) => dailyMap.set(format(d, "yyyy-MM-dd"), { revenue: 0, orders: 0 }));
  sales.forEach((o) => {
    const day = format(parseISO(o.created_at), "yyyy-MM-dd");
    const entry = dailyMap.get(day) || { revenue: 0, orders: 0 };
    entry.revenue += o.total_amount;
    entry.orders += 1;
    dailyMap.set(day, entry);
  });
  const dailyData = Array.from(dailyMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, val]) => ({ date: format(parseISO(date), "MMM d"), revenue: val.revenue, orders: val.orders }));

  // Item aggregation (revenue split across units in the order)
  const itemMap = new Map<string, { qty: number; revenue: number; category: string }>();
  sales.forEach((o) => {
    const unitCount = o.items.reduce((s, it) => s + (it.quantity || 1), 0) || 1;
    const perUnitRevenue = o.total_amount / unitCount;
    o.items.forEach((item) => {
      const qty = item.quantity || 1;
      const entry = itemMap.get(item.name) || { qty: 0, revenue: 0, category: item.category };
      entry.qty += qty;
      entry.revenue += perUnitRevenue * qty;
      itemMap.set(item.name, entry);
    });
  });

  const topItems = Array.from(itemMap.entries())
    .map(([name, val]) => ({ name, ...val, pct: totalRevenue > 0 ? (val.revenue / totalRevenue) * 100 : 0 }))
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 20);

  // Category aggregation
  const catMap = new Map<string, { qty: number; revenue: number }>();
  itemMap.forEach((val) => {
    const entry = catMap.get(val.category) || { qty: 0, revenue: 0 };
    entry.qty += val.qty;
    entry.revenue += val.revenue;
    catMap.set(val.category, entry);
  });
  const categoryData = Array.from(catMap.entries())
    .map(([name, val]) => ({ name, ...val }))
    .sort((a, b) => b.revenue - a.revenue);

  // Payment method
  const payMap = new Map<string, { count: number; revenue: number }>();
  orders.forEach((o) => {
    const method = o.payment_method || "Unknown";
    const entry = payMap.get(method) || { count: 0, revenue: 0 };
    entry.count += 1;
    entry.revenue += o.total_amount;
    payMap.set(method, entry);
  });
  const paymentData = Array.from(payMap.entries())
    .map(([method, val]) => ({ method, ...val }))
    .sort((a, b) => b.revenue - a.revenue);

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <SummaryCard icon={DollarSign} label="Total Revenue" value={`$${totalRevenue.toFixed(2)}`} />
        <SummaryCard icon={ShoppingCart} label="Total Orders" value={totalOrders.toString()} />
        <SummaryCard icon={TrendingUp} label="Avg Order Value" value={`$${avgOrderValue.toFixed(2)}`} />
        <SummaryCard icon={Receipt} label="Tax Collected (6%)" value={`$${totalTax.toFixed(2)}`} />
      </div>

      {/* Daily Sales Trend */}
      {dailyData.length > 1 && (
        <Card>
          <CardHeader><CardTitle className="text-base">Daily Sales Trend</CardTitle></CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={dailyData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="date" className="text-xs fill-muted-foreground" tick={{ fontSize: 11 }} />
                  <YAxis className="text-xs fill-muted-foreground" tick={{ fontSize: 11 }} tickFormatter={(v) => `$${v}`} />
                  <Tooltip formatter={(v: number) => [`$${v.toFixed(2)}`, "Revenue"]} />
                  <Bar dataKey="revenue" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Selling Items */}
        <Card>
          <CardHeader><CardTitle className="text-base">Top Selling Items</CardTitle></CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>#</TableHead>
                  <TableHead>Item</TableHead>
                  <TableHead className="text-right">Qty</TableHead>
                  <TableHead className="text-right">Revenue</TableHead>
                  <TableHead className="text-right">%</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {topItems.map((item, i) => (
                  <TableRow key={item.name}>
                    <TableCell className="font-medium text-muted-foreground">{i + 1}</TableCell>
                    <TableCell className="font-medium">{item.name}</TableCell>
                    <TableCell className="text-right">{item.qty}</TableCell>
                    <TableCell className="text-right">${item.revenue.toFixed(2)}</TableCell>
                    <TableCell className="text-right">{item.pct.toFixed(1)}%</TableCell>
                  </TableRow>
                ))}
                {topItems.length === 0 && (
                  <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground">No item data</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Sales by Category */}
        <Card>
          <CardHeader><CardTitle className="text-base">Sales by Category</CardTitle></CardHeader>
          <CardContent>
            {categoryData.length > 0 ? (
              <div className="flex flex-col items-center gap-4">
                <div className="h-48 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={categoryData} dataKey="revenue" nameKey="name" cx="50%" cy="50%" outerRadius={80} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                        {categoryData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                      </Pie>
                      <Tooltip formatter={(v: number) => `$${v.toFixed(2)}`} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Category</TableHead>
                      <TableHead className="text-right">Items Sold</TableHead>
                      <TableHead className="text-right">Revenue</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {categoryData.map((cat) => (
                      <TableRow key={cat.name}>
                        <TableCell className="font-medium">{cat.name}</TableCell>
                        <TableCell className="text-right">{cat.qty}</TableCell>
                        <TableCell className="text-right">${cat.revenue.toFixed(2)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <p className="text-center text-muted-foreground py-8">No category data</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Payment Method Breakdown */}
      <Card>
        <CardHeader><CardTitle className="text-base">Payment Method Breakdown</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Method</TableHead>
                <TableHead className="text-right">Orders</TableHead>
                <TableHead className="text-right">Revenue</TableHead>
                <TableHead className="text-right">% of Revenue</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paymentData.map((pm) => (
                <TableRow key={pm.method}>
                  <TableCell className="font-medium capitalize">{pm.method}</TableCell>
                  <TableCell className="text-right">{pm.count}</TableCell>
                  <TableCell className="text-right">${pm.revenue.toFixed(2)}</TableCell>
                  <TableCell className="text-right">{totalRevenue > 0 ? ((pm.revenue / totalRevenue) * 100).toFixed(1) : 0}%</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Order Log */}
      <Card>
        <CardHeader><CardTitle className="text-base">Order Log ({orders.length} orders)</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date/Time</TableHead>
                <TableHead>Items</TableHead>
                <TableHead>Payment</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {orders.slice(0, 100).map((order) => {
                const itemSummary = order.items.map((it) => it.name).join(", ");
                return (
                  <TableRow key={order.id}>
                    <TableCell className="whitespace-nowrap">{format(parseISO(order.created_at), "MMM d, h:mm a")}</TableCell>
                    <TableCell className="max-w-[300px] truncate" title={itemSummary}>{itemSummary || "—"}</TableCell>
                    <TableCell className="capitalize">{order.payment_method}</TableCell>
                    <TableCell className="capitalize">{order.status}</TableCell>
                    <TableCell className="text-right font-medium">${order.total_amount.toFixed(2)}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
          {orders.length > 100 && <p className="text-xs text-muted-foreground mt-2 text-center">Showing first 100 of {orders.length} orders</p>}
        </CardContent>
      </Card>
    </div>
  );
}

function SummaryCard({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: string }) {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10">
            <Icon className="h-5 w-5 text-primary" />
          </div>
          <div>
            <p className="text-sm text-muted-foreground">{label}</p>
            <p className="text-2xl font-bold">{value}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
