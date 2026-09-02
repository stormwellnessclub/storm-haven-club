import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Coffee, ShoppingBag, Dumbbell, Ticket, CreditCard, DollarSign } from "lucide-react";
import { format } from "date-fns";
import { GUEST_PASS_COLUMNS } from "@/lib/guestPassStatus";

interface Props {
  dateRange: { start: Date; end: Date };
  filters: Record<string, string | boolean>;
}

const fmt = (v: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(v);

// ─── Cafe Tab ────────────────────────────────────────────────
function CafeTab({ dateRange }: { dateRange: Props["dateRange"] }) {
  const { data, isLoading } = useQuery({
    queryKey: ["daily-sales-cafe", dateRange.start, dateRange.end],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cafe_orders")
        .select("*")
        .gte("created_at", dateRange.start.toISOString())
        .lte("created_at", dateRange.end.toISOString())
        .in("status", ["completed", "ready", "preparing"]);
      if (error) throw error;
      return data ?? [];
    },
  });

  if (isLoading) return <LoadingSkeleton />;
  if (!data?.length) return <EmptyState label="No café orders in this period" />;

  const totalRevenue = data.reduce((s, o) => s + (o.total_amount || 0), 0);
  const orderCount = data.length;
  const avgOrder = totalRevenue / orderCount;

  // Aggregate items from order_items JSON
  const itemMap = new Map<string, { qty: number; revenue: number }>();
  for (const order of data) {
    const items = order.order_items as any[];
    if (!Array.isArray(items)) continue;
    for (const item of items) {
      const name = item.name || item.item_name || "Unknown Item";
      const qty = item.quantity || 1;
      const price = (item.price || 0) * qty;
      const existing = itemMap.get(name) || { qty: 0, revenue: 0 };
      itemMap.set(name, { qty: existing.qty + qty, revenue: existing.revenue + price });
    }
  }
  const topItems = [...itemMap.entries()]
    .sort((a, b) => b[1].revenue - a[1].revenue);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <SummaryCard label="Total Revenue" value={fmt(totalRevenue)} />
        <SummaryCard label="Orders" value={orderCount.toString()} />
        <SummaryCard label="Avg Order" value={fmt(avgOrder)} />
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold">Top Items Sold</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Item</TableHead>
                <TableHead className="text-right">Qty Sold</TableHead>
                <TableHead className="text-right">Revenue</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {topItems.map(([name, { qty, revenue }]) => (
                <TableRow key={name}>
                  <TableCell className="font-medium">{name}</TableCell>
                  <TableCell className="text-right">{qty}</TableCell>
                  <TableCell className="text-right">{fmt(revenue)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold">Individual Orders</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Items</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead>Payment</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((order) => {
                const items = Array.isArray(order.order_items) ? (order.order_items as any[]) : [];
                const itemNames = items
                  .map((i: any) => {
                    const n = i.name || i.item_name || "Item";
                    const q = i.quantity || 1;
                    return q > 1 ? `${n} ×${q}` : n;
                  })
                  .join(", ");
                return (
                  <TableRow key={order.id}>
                    <TableCell className="whitespace-nowrap">
                      {format(new Date(order.created_at), "MMM d, h:mm a")}
                    </TableCell>
                    <TableCell className="max-w-[280px] truncate" title={itemNames}>
                      {itemNames || "—"}
                    </TableCell>
                    <TableCell className="text-right font-medium">{fmt(order.total_amount)}</TableCell>
                    <TableCell className="capitalize">{order.payment_method || "—"}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Merch Tab ───────────────────────────────────────────────
function MerchTab({ dateRange }: { dateRange: Props["dateRange"] }) {
  const { data, isLoading } = useQuery({
    queryKey: ["daily-sales-merch", dateRange.start, dateRange.end],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("merch_orders")
        .select("*")
        .gte("created_at", dateRange.start.toISOString())
        .lte("created_at", dateRange.end.toISOString())
        .in("status", ["paid", "completed", "pending"]);
      if (error) throw error;
      return data ?? [];
    },
  });

  if (isLoading) return <LoadingSkeleton />;
  if (!data?.length) return <EmptyState label="No merch orders in this period" />;

  const totalRevenue = data.reduce((s, o) => s + (o.total_amount || 0), 0);
  const orderCount = data.length;
  const avgOrder = totalRevenue / orderCount;

  const itemMap = new Map<string, { qty: number; revenue: number }>();
  for (const order of data) {
    const items = order.order_items as any[];
    if (!Array.isArray(items)) continue;
    for (const item of items) {
      const name = item.name || item.product_name || "Unknown Item";
      const variant = [item.size, item.color].filter(Boolean).join(" / ");
      const label = variant ? `${name} (${variant})` : name;
      const qty = item.quantity || 1;
      const price = (item.price || 0) * qty;
      const existing = itemMap.get(label) || { qty: 0, revenue: 0 };
      itemMap.set(label, { qty: existing.qty + qty, revenue: existing.revenue + price });
    }
  }
  const topItems = [...itemMap.entries()].sort((a, b) => b[1].revenue - a[1].revenue);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <SummaryCard label="Total Revenue" value={fmt(totalRevenue)} />
        <SummaryCard label="Orders" value={orderCount.toString()} />
        <SummaryCard label="Avg Order" value={fmt(avgOrder)} />
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold">Top Products Sold</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Product</TableHead>
                <TableHead className="text-right">Qty</TableHead>
                <TableHead className="text-right">Revenue</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {topItems.map(([name, { qty, revenue }]) => (
                <TableRow key={name}>
                  <TableCell className="font-medium">{name}</TableCell>
                  <TableCell className="text-right">{qty}</TableCell>
                  <TableCell className="text-right">{fmt(revenue)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold">Individual Orders</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Items</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((order) => {
                const items = Array.isArray(order.order_items) ? (order.order_items as any[]) : [];
                const itemNames = items
                  .map((i: any) => {
                    const n = i.name || i.product_name || "Item";
                    const q = i.quantity || 1;
                    return q > 1 ? `${n} ×${q}` : n;
                  })
                  .join(", ");
                return (
                  <TableRow key={order.id}>
                    <TableCell className="whitespace-nowrap">
                      {format(new Date(order.created_at!), "MMM d, h:mm a")}
                    </TableCell>
                    <TableCell>{order.customer_name || "—"}</TableCell>
                    <TableCell className="max-w-[240px] truncate" title={itemNames}>
                      {itemNames || "—"}
                    </TableCell>
                    <TableCell className="text-right font-medium">{fmt(order.total_amount)}</TableCell>
                    <TableCell className="capitalize">{order.status || "—"}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Classes Tab ─────────────────────────────────────────────
function ClassesTab({ dateRange }: { dateRange: Props["dateRange"] }) {
  const { data, isLoading } = useQuery({
    queryKey: ["daily-sales-classes", dateRange.start, dateRange.end],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("class_passes")
        .select("*")
        .gte("purchased_at", dateRange.start.toISOString())
        .lte("purchased_at", dateRange.end.toISOString());
      if (error) throw error;
      return data ?? [];
    },
  });

  if (isLoading) return <LoadingSkeleton />;
  if (!data?.length) return <EmptyState label="No class pass sales in this period" />;

  const totalRevenue = data.reduce((s, p) => s + (p.price_paid || 0), 0);
  const passCount = data.length;

  // Group by category + pass_type
  const groupMap = new Map<string, { count: number; revenue: number }>();
  for (const pass of data) {
    const key = `${pass.category} — ${pass.pass_type}`;
    const existing = groupMap.get(key) || { count: 0, revenue: 0 };
    groupMap.set(key, { count: existing.count + 1, revenue: existing.revenue + (pass.price_paid || 0) });
  }
  const groups = [...groupMap.entries()].sort((a, b) => b[1].revenue - a[1].revenue);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <SummaryCard label="Total Revenue" value={fmt(totalRevenue)} />
        <SummaryCard label="Passes Sold" value={passCount.toString()} />
        <SummaryCard label="Avg Pass Price" value={fmt(totalRevenue / passCount)} />
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold">Revenue by Class Type</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Category / Pass Type</TableHead>
                <TableHead className="text-right">Passes</TableHead>
                <TableHead className="text-right">Revenue</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {groups.map(([key, { count, revenue }]) => (
                <TableRow key={key}>
                  <TableCell className="font-medium capitalize">{key.replace(/_/g, " ")}</TableCell>
                  <TableCell className="text-right">{count}</TableCell>
                  <TableCell className="text-right">{fmt(revenue)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold">Individual Pass Sales</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Pass Type</TableHead>
                <TableHead className="text-right">Classes</TableHead>
                <TableHead className="text-right">Price</TableHead>
                <TableHead>Member</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((pass) => (
                <TableRow key={pass.id}>
                  <TableCell className="whitespace-nowrap">
                    {format(new Date(pass.purchased_at), "MMM d, h:mm a")}
                  </TableCell>
                  <TableCell className="capitalize">{pass.category.replace(/_/g, " ")}</TableCell>
                  <TableCell className="capitalize">{pass.pass_type.replace(/_/g, " ")}</TableCell>
                  <TableCell className="text-right">{pass.classes_total}</TableCell>
                  <TableCell className="text-right font-medium">{fmt(pass.price_paid)}</TableCell>
                  <TableCell>{pass.is_member_price ? "Member" : "Non-Member"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Guest Passes Tab ────────────────────────────────────────
function GuestPassesTab({ dateRange }: { dateRange: Props["dateRange"] }) {
  const { data, isLoading } = useQuery({
    queryKey: ["daily-sales-guests", dateRange.start, dateRange.end],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("guest_passes")
        .select(GUEST_PASS_COLUMNS)
        .gte("purchased_at", dateRange.start.toISOString())
        .lte("purchased_at", dateRange.end.toISOString());
      if (error) throw error;
      return data ?? [];
    },
  });

  if (isLoading) return <LoadingSkeleton />;
  if (!data?.length) return <EmptyState label="No guest pass sales in this period" />;

  const totalRevenue = data.reduce((s, p) => s + (p.price_paid || 0), 0);
  const passCount = data.length;
  const usedCount = data.filter((p) => p.status === "used" || p.status === "exhausted").length;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <SummaryCard label="Total Revenue" value={fmt(totalRevenue)} />
        <SummaryCard label="Passes Sold" value={passCount.toString()} />
        <SummaryCard label="Used" value={`${usedCount} / ${passCount}`} />
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold">Individual Guest Passes</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Guest Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead className="text-right">Price</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Referral</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((pass) => (
                <TableRow key={pass.id}>
                  <TableCell className="whitespace-nowrap">
                    {pass.purchased_at ? format(new Date(pass.purchased_at), "MMM d, h:mm a") : "—"}
                  </TableCell>
                  <TableCell className="font-medium">{pass.guest_name}</TableCell>
                  <TableCell className="max-w-[180px] truncate">{pass.guest_email || "—"}</TableCell>
                  <TableCell className="text-right font-medium">{fmt(pass.price_paid)}</TableCell>
                  <TableCell className="capitalize">{pass.status}</TableCell>
                  <TableCell className="max-w-[140px] truncate">{pass.member_referral || "—"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Memberships Tab ─────────────────────────────────────────
function MembershipsTab({ dateRange }: { dateRange: Props["dateRange"] }) {
  const { data, isLoading } = useQuery({
    queryKey: ["daily-sales-memberships", dateRange.start, dateRange.end],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("manual_charges")
        .select("*, members(first_name, last_name, member_id)")
        .gte("created_at", dateRange.start.toISOString())
        .lte("created_at", dateRange.end.toISOString())
        .eq("status", "succeeded");
      if (error) throw error;
      return data ?? [];
    },
  });

  if (isLoading) return <LoadingSkeleton />;
  if (!data?.length) return <EmptyState label="No membership charges in this period" />;

  // amount is in cents
  const totalRevenue = data.reduce((s, c) => s + (c.amount || 0), 0) / 100;
  const chargeCount = data.length;

  // Group by description
  const groupMap = new Map<string, { count: number; revenue: number }>();
  for (const charge of data) {
    const desc = charge.description || "Other";
    const existing = groupMap.get(desc) || { count: 0, revenue: 0 };
    groupMap.set(desc, { count: existing.count + 1, revenue: existing.revenue + (charge.amount || 0) / 100 });
  }
  const groups = [...groupMap.entries()].sort((a, b) => b[1].revenue - a[1].revenue);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <SummaryCard label="Total Revenue" value={fmt(totalRevenue)} />
        <SummaryCard label="Charges" value={chargeCount.toString()} />
        <SummaryCard label="Avg Charge" value={fmt(totalRevenue / chargeCount)} />
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold">Revenue by Charge Type</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Description</TableHead>
                <TableHead className="text-right">Count</TableHead>
                <TableHead className="text-right">Revenue</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {groups.map(([desc, { count, revenue }]) => (
                <TableRow key={desc}>
                  <TableCell className="font-medium">{desc}</TableCell>
                  <TableCell className="text-right">{count}</TableCell>
                  <TableCell className="text-right">{fmt(revenue)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold">Individual Charges</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Member</TableHead>
                <TableHead>Description</TableHead>
                <TableHead className="text-right">Amount</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((charge) => {
                const member = charge.members as any;
                const memberName = member
                  ? `${member.first_name || ""} ${member.last_name || ""}`.trim()
                  : "—";
                return (
                  <TableRow key={charge.id}>
                    <TableCell className="whitespace-nowrap">
                      {format(new Date(charge.created_at), "MMM d, h:mm a")}
                    </TableCell>
                    <TableCell className="font-medium">{memberName}</TableCell>
                    <TableCell className="max-w-[200px] truncate">{charge.description}</TableCell>
                    <TableCell className="text-right font-medium">{fmt(charge.amount / 100)}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Shared Components ───────────────────────────────────────
function SummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <Card>
      <CardContent className="p-4">
        <p className="text-xs text-muted-foreground mb-1">{label}</p>
        <p className="text-xl font-bold">{value}</p>
      </CardContent>
    </Card>
  );
}

function LoadingSkeleton() {
  return (
    <div className="space-y-4 pt-4">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Skeleton className="h-20" />
        <Skeleton className="h-20" />
        <Skeleton className="h-20" />
      </div>
      <Skeleton className="h-64" />
    </div>
  );
}

function EmptyState({ label }: { label: string }) {
  return (
    <div className="text-center py-12 text-muted-foreground">
      <p>{label}</p>
    </div>
  );
}

// ─── Grand Total Summary ────────────────────────────────────
function GrandSummary({ dateRange }: { dateRange: Props["dateRange"] }) {
  const cafe = useQuery({
    queryKey: ["daily-sales-cafe-sum", dateRange.start, dateRange.end],
    queryFn: async () => {
      const { data } = await supabase
        .from("cafe_orders")
        .select("total_amount")
        .gte("created_at", dateRange.start.toISOString())
        .lte("created_at", dateRange.end.toISOString())
        .in("status", ["completed", "ready", "preparing"]);
      return (data ?? []).reduce((s, o) => s + (o.total_amount || 0), 0);
    },
  });

  const merch = useQuery({
    queryKey: ["daily-sales-merch-sum", dateRange.start, dateRange.end],
    queryFn: async () => {
      const { data } = await supabase
        .from("merch_orders")
        .select("total_amount")
        .gte("created_at", dateRange.start.toISOString())
        .lte("created_at", dateRange.end.toISOString())
        .in("status", ["paid", "completed", "pending"]);
      return (data ?? []).reduce((s, o) => s + (o.total_amount || 0), 0);
    },
  });

  const classes = useQuery({
    queryKey: ["daily-sales-classes-sum", dateRange.start, dateRange.end],
    queryFn: async () => {
      const { data } = await supabase
        .from("class_passes")
        .select("price_paid")
        .gte("purchased_at", dateRange.start.toISOString())
        .lte("purchased_at", dateRange.end.toISOString());
      return (data ?? []).reduce((s, p) => s + (p.price_paid || 0), 0);
    },
  });

  const guests = useQuery({
    queryKey: ["daily-sales-guests-sum", dateRange.start, dateRange.end],
    queryFn: async () => {
      const { data } = await supabase
        .from("guest_passes")
        .select("price_paid")
        .gte("purchased_at", dateRange.start.toISOString())
        .lte("purchased_at", dateRange.end.toISOString());
      return (data ?? []).reduce((s, p) => s + (p.price_paid || 0), 0);
    },
  });

  const memberships = useQuery({
    queryKey: ["daily-sales-memberships-sum", dateRange.start, dateRange.end],
    queryFn: async () => {
      const { data } = await supabase
        .from("manual_charges")
        .select("amount")
        .gte("created_at", dateRange.start.toISOString())
        .lte("created_at", dateRange.end.toISOString())
        .eq("status", "succeeded");
      return (data ?? []).reduce((s, c) => s + (c.amount || 0), 0) / 100;
    },
  });

  const isLoading = cafe.isLoading || merch.isLoading || classes.isLoading || guests.isLoading || memberships.isLoading;
  const cafeVal = cafe.data ?? 0;
  const merchVal = merch.data ?? 0;
  const classesVal = classes.data ?? 0;
  const guestsVal = guests.data ?? 0;
  const membershipsVal = memberships.data ?? 0;
  const grandTotal = cafeVal + merchVal + classesVal + guestsVal + membershipsVal;

  const cards = [
    { label: "Café", value: cafeVal, icon: Coffee },
    { label: "Merch", value: merchVal, icon: ShoppingBag },
    { label: "Classes", value: classesVal, icon: Dumbbell },
    { label: "Guest Passes", value: guestsVal, icon: Ticket },
    { label: "Memberships", value: membershipsVal, icon: CreditCard },
    { label: "Grand Total", value: grandTotal, icon: DollarSign },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
      {cards.map((c) => {
        const Icon = c.icon;
        return (
          <Card key={c.label} className={c.label === "Grand Total" ? "border-primary/30 bg-primary/5" : ""}>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-1">
                <Icon className="h-3.5 w-3.5 text-muted-foreground" />
                <p className="text-xs text-muted-foreground">{c.label}</p>
              </div>
              {isLoading ? (
                <Skeleton className="h-6 w-20" />
              ) : (
                <p className="text-lg font-bold">{fmt(c.value)}</p>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

// ─── Main Report Component ───────────────────────────────────
export function DailySalesBreakdownReport({ dateRange, filters }: Props) {
  const [activeTab, setActiveTab] = useState("cafe");

  return (
    <div className="space-y-6">
      <GrandSummary dateRange={dateRange} />

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="w-full flex flex-wrap h-auto gap-1">
          <TabsTrigger value="cafe" className="flex items-center gap-1.5">
            <Coffee className="h-3.5 w-3.5" /> Café
          </TabsTrigger>
          <TabsTrigger value="merch" className="flex items-center gap-1.5">
            <ShoppingBag className="h-3.5 w-3.5" /> Merch
          </TabsTrigger>
          <TabsTrigger value="classes" className="flex items-center gap-1.5">
            <Dumbbell className="h-3.5 w-3.5" /> Classes
          </TabsTrigger>
          <TabsTrigger value="guests" className="flex items-center gap-1.5">
            <Ticket className="h-3.5 w-3.5" /> Guest Passes
          </TabsTrigger>
          <TabsTrigger value="memberships" className="flex items-center gap-1.5">
            <CreditCard className="h-3.5 w-3.5" /> Memberships
          </TabsTrigger>
        </TabsList>

        <TabsContent value="cafe">
          <CafeTab dateRange={dateRange} />
        </TabsContent>
        <TabsContent value="merch">
          <MerchTab dateRange={dateRange} />
        </TabsContent>
        <TabsContent value="classes">
          <ClassesTab dateRange={dateRange} />
        </TabsContent>
        <TabsContent value="guests">
          <GuestPassesTab dateRange={dateRange} />
        </TabsContent>
        <TabsContent value="memberships">
          <MembershipsTab dateRange={dateRange} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
