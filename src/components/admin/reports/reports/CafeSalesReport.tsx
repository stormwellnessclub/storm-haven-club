import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format, eachDayOfInterval, parseISO } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { DollarSign, ShoppingCart, TrendingUp, Receipt, Coffee } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";

interface CafeSalesReportProps {
  dateRange: { start: Date; end: Date };
  filters: Record<string, string | boolean>;
}

const TAX_RATE = 0.06;
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

interface NormalizedOrder {
  id: string;
  created_at: string;
  total_amount: number; // dollars
  items: { name: string; category: string }[];
  payment_method: string;
  status: string;
  source: "manual_charges" | "cafe_orders";
}

/** Parse item names from manual_charges description like:
 *  "Cafe - Matcha - Vanilla | Cafe - Banana Mango - (20oz) (incl. MI 6% tax)" */
function parseDescription(desc: string): { name: string; category: string }[] {
  // Remove trailing tax note
  const cleaned = desc.replace(/\s*\(incl\.\s*MI\s*\d+%?\s*tax\)\s*$/i, "");
  const segments = cleaned.split(" | ");
  return segments.map((seg) => {
    const parts = seg.split(" - ").map((p) => p.trim());
    // parts[0] = "Cafe", parts[1] = item name, rest = variant/size
    const itemName = parts.length > 1 ? parts.slice(1).filter(p => !p.startsWith("(")).join(" - ") : seg;
    return { name: itemName || seg, category: "Café" };
  });
}

interface OrderItem {
  name?: string; itemName?: string; item_name?: string;
  quantity?: number; qty?: number;
  price?: number; total?: number;
  category?: string; categoryName?: string; category_name?: string;
}

function extractItems(orderItems: unknown): OrderItem[] {
  if (!Array.isArray(orderItems)) return [];
  return orderItems as OrderItem[];
}

function getItemName(item: OrderItem): string {
  return item.name || item.itemName || item.item_name || "Unknown Item";
}

function getItemQty(item: OrderItem): number {
  return item.quantity || item.qty || 1;
}

function getItemCategory(item: OrderItem): string {
  return item.category || item.categoryName || item.category_name || "Café";
}

export function CafeSalesReport({ dateRange }: CafeSalesReportProps) {
  // Query manual_charges (primary source — actual Stripe payments)
  const { data: manualCharges, isLoading: loadingCharges } = useQuery({
    queryKey: ["cafe-manual-charges", dateRange.start.toISOString(), dateRange.end.toISOString()],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("manual_charges")
        .select("id, created_at, amount, description, status, stripe_payment_intent_id, member_id")
        .ilike("description", "Cafe%")
        .eq("status", "succeeded")
        .gte("created_at", dateRange.start.toISOString())
        .lte("created_at", dateRange.end.toISOString())
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  // Query cafe_orders (fallback — cash/member account sales)
  const { data: cafeOrders, isLoading: loadingOrders } = useQuery({
    queryKey: ["cafe-orders-report", dateRange.start.toISOString(), dateRange.end.toISOString()],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cafe_orders")
        .select("id, created_at, total_amount, order_items, payment_method, status, payment_intent_id")
        .gte("created_at", dateRange.start.toISOString())
        .lte("created_at", dateRange.end.toISOString())
        .in("status", ["completed", "ready", "preparing", "pending"])
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  const isLoading = loadingCharges || loadingOrders;

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

  // Build set of payment_intent_ids from manual_charges to deduplicate
  const mcPiIds = new Set(
    (manualCharges || []).map((mc) => mc.stripe_payment_intent_id).filter(Boolean)
  );

  // Normalize manual_charges → NormalizedOrder
  const mcOrders: NormalizedOrder[] = (manualCharges || []).map((mc) => ({
    id: mc.id,
    created_at: mc.created_at,
    total_amount: (mc.amount || 0) / 100, // cents → dollars
    items: parseDescription(mc.description || ""),
    payment_method: "card",
    status: "succeeded",
    source: "manual_charges",
  }));

  // Normalize cafe_orders (only those NOT already in manual_charges)
  const coOrders: NormalizedOrder[] = (cafeOrders || [])
    .filter((co) => !co.payment_intent_id || !mcPiIds.has(co.payment_intent_id))
    .map((co) => {
      const items = extractItems(co.order_items);
      return {
        id: co.id,
        created_at: co.created_at,
        total_amount: co.total_amount || 0,
        items: items.map((it) => ({
          name: getItemName(it),
          category: getItemCategory(it),
        })),
        payment_method: co.payment_method || "unknown",
        status: co.status,
        source: "cafe_orders" as const,
      };
    });

  const orders = [...mcOrders, ...coOrders].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );

  if (orders.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <Coffee className="h-12 w-12 mx-auto mb-4 opacity-50" />
        <p>No café sales found for this date range</p>
      </div>
    );
  }

  // Summary stats
  const totalRevenue = orders.reduce((sum, o) => sum + o.total_amount, 0);
  const totalOrders = orders.length;
  const avgOrderValue = totalRevenue / totalOrders;
  const totalTax = totalRevenue * TAX_RATE;

  // Daily aggregation
  const dailyMap = new Map<string, { revenue: number; orders: number }>();
  const days = eachDayOfInterval({ start: dateRange.start, end: dateRange.end });
  days.forEach((d) => dailyMap.set(format(d, "yyyy-MM-dd"), { revenue: 0, orders: 0 }));
  orders.forEach((o) => {
    const day = format(parseISO(o.created_at), "yyyy-MM-dd");
    const entry = dailyMap.get(day) || { revenue: 0, orders: 0 };
    entry.revenue += o.total_amount;
    entry.orders += 1;
    dailyMap.set(day, entry);
  });
  const dailyData = Array.from(dailyMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, val]) => ({ date: format(parseISO(date), "MMM d"), revenue: val.revenue, orders: val.orders }));

  // Item aggregation
  const itemMap = new Map<string, { qty: number; revenue: number; category: string }>();
  orders.forEach((o) => {
    const itemCount = o.items.length || 1;
    const perItemRevenue = o.total_amount / itemCount;
    o.items.forEach((item) => {
      const entry = itemMap.get(item.name) || { qty: 0, revenue: 0, category: item.category };
      entry.qty += 1;
      entry.revenue += perItemRevenue;
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
