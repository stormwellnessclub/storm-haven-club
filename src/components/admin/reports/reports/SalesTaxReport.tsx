import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { DollarSign, Store, Coffee } from "lucide-react";

interface SalesTaxReportProps {
  dateRange: { start: Date; end: Date };
  filters: Record<string, string | boolean>;
}

interface TaxLineItem {
  date: string;
  source: string;
  orderId: string;
  subtotal: number;
  taxAmount: number;
  total: number;
}

export function SalesTaxReport({ dateRange }: SalesTaxReportProps) {
  const startStr = format(dateRange.start, "yyyy-MM-dd");
  const endStr = format(dateRange.end, "yyyy-MM-dd'T'23:59:59");

  const { data: cafeOrders, isLoading: cafeLoading } = useQuery({
    queryKey: ["sales-tax-cafe", startStr, endStr],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cafe_orders")
        .select("id, created_at, order_items, total_amount, status")
        .eq("status", "completed")
        .gte("created_at", startStr)
        .lte("created_at", endStr)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  const { data: merchOrders, isLoading: merchLoading } = useQuery({
    queryKey: ["sales-tax-merch", startStr, endStr],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("merch_orders")
        .select("id, created_at, order_items, total_amount, status")
        .eq("status", "completed")
        .gte("created_at", startStr)
        .lte("created_at", endStr)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  const isLoading = cafeLoading || merchLoading;

  // Extract tax from cafe/POS orders
  const cafeTaxItems: TaxLineItem[] = (cafeOrders || []).flatMap((order) => {
    const items = Array.isArray(order.order_items) ? (order.order_items as any[]) : [];
    const taxItems = items.filter(
      (item: any) =>
        typeof item?.name === "string" &&
        item.name.toLowerCase().includes("tax")
    );
    if (taxItems.length === 0) return [];

    const taxAmount: number = taxItems.reduce(
      (sum: number, item: any) => sum + (Number(item.price) || 0) * (Number(item.quantity) || 1),
      0
    );
    const subtotal = order.total_amount - taxAmount;

    return [
      {
        date: order.created_at,
        source: "Café / POS",
        orderId: order.id,
        subtotal,
        taxAmount,
        total: order.total_amount,
      },
    ];
  });

  // Extract tax from merch orders
  const merchTaxItems: TaxLineItem[] = (merchOrders || []).flatMap((order) => {
    const items = Array.isArray(order.order_items) ? (order.order_items as any[]) : [];
    const taxItems = items.filter(
      (item: any) =>
        typeof item?.name === "string" &&
        item.name.toLowerCase().includes("tax")
    );
    if (taxItems.length === 0) return [];

    const taxAmount: number = taxItems.reduce(
      (sum: number, item: any) => sum + (Number(item.price) || 0) * (Number(item.quantity) || 1),
      0
    );
    const subtotal = order.total_amount - taxAmount;

    return [
      {
        date: order.created_at,
        source: "Storm Shop",
        orderId: order.id,
        subtotal,
        taxAmount,
        total: order.total_amount,
      },
    ];
  });

  const allItems = [...cafeTaxItems, ...merchTaxItems].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  );

  const totalCafeTax = cafeTaxItems.reduce((s, i) => s + i.taxAmount, 0);
  const totalMerchTax = merchTaxItems.reduce((s, i) => s + i.taxAmount, 0);
  const totalTax = totalCafeTax + totalMerchTax;

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <DollarSign className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Tax Collected</p>
                <p className="text-2xl font-bold">${totalTax.toFixed(2)}</p>
                <p className="text-xs text-muted-foreground">{allItems.length} transactions</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-secondary">
                <Coffee className="h-5 w-5 text-secondary-foreground" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Café / POS Tax</p>
                <p className="text-2xl font-bold">${totalCafeTax.toFixed(2)}</p>
                <p className="text-xs text-muted-foreground">{cafeTaxItems.length} orders</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-accent">
                <Store className="h-5 w-5 text-accent-foreground" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Storm Shop Tax</p>
                <p className="text-2xl font-bold">${totalMerchTax.toFixed(2)}</p>
                <p className="text-xs text-muted-foreground">{merchTaxItems.length} orders</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Transaction Table */}
      {allItems.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <p>No taxed transactions found in this date range.</p>
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Source</TableHead>
              <TableHead className="text-right">Subtotal</TableHead>
              <TableHead className="text-right">Tax (6%)</TableHead>
              <TableHead className="text-right">Total</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {allItems.map((item) => (
              <TableRow key={item.orderId}>
                <TableCell>{format(new Date(item.date), "MMM d, yyyy h:mm a")}</TableCell>
                <TableCell>{item.source}</TableCell>
                <TableCell className="text-right">${item.subtotal.toFixed(2)}</TableCell>
                <TableCell className="text-right font-medium">${item.taxAmount.toFixed(2)}</TableCell>
                <TableCell className="text-right">${item.total.toFixed(2)}</TableCell>
              </TableRow>
            ))}
            {/* Totals row */}
            <TableRow className="font-bold border-t-2">
              <TableCell colSpan={2}>Totals</TableCell>
              <TableCell className="text-right">
                ${allItems.reduce((s, i) => s + i.subtotal, 0).toFixed(2)}
              </TableCell>
              <TableCell className="text-right">${totalTax.toFixed(2)}</TableCell>
              <TableCell className="text-right">
                ${allItems.reduce((s, i) => s + i.total, 0).toFixed(2)}
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      )}
    </div>
  );
}
