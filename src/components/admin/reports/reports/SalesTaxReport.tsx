import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { DollarSign, Store, Coffee, ShoppingBag, AlertCircle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface SalesTaxReportProps {
  dateRange: { start: Date; end: Date };
  filters: Record<string, string | boolean>;
}

interface StripeTaxItem {
  date: string;
  description: string;
  source: string;
  subtotal: number;
  tax_amount: number;
  total: number;
  stripe_charge_id: string;
}

export function SalesTaxReport({ dateRange }: SalesTaxReportProps) {
  const startStr = format(dateRange.start, "yyyy-MM-dd'T'00:00:00");
  const endStr = format(dateRange.end, "yyyy-MM-dd'T'23:59:59");

  const { data, isLoading, error } = useQuery({
    queryKey: ["sales-tax-stripe", startStr, endStr],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("stripe-sales-tax", {
        body: { start_date: startStr, end_date: endStr },
      });
      if (error) throw new Error(error.message || "Failed to fetch tax data");
      if (data && data.ok === false) throw new Error(data.error || "Request failed");
      if (data?.error) throw new Error(data.error);
      return {
        items: (data?.items || []) as StripeTaxItem[],
        truncated: Boolean(data?.truncated),
      };
    },
  });

  const items = data?.items || [];
  const truncated = data?.truncated;

  // Only show items that have tax collected
  const taxedItems = items.filter((i) => i.tax_amount > 0);
  
  // Category totals
  const cafeTax = taxedItems
    .filter((i) => i.source === "Café / POS")
    .reduce((s, i) => s + i.tax_amount, 0);
  const shopTax = taxedItems
    .filter((i) => i.source === "Storm Shop")
    .reduce((s, i) => s + i.tax_amount, 0);
  const otherTax = taxedItems
    .filter((i) => i.source !== "Café / POS" && i.source !== "Storm Shop")
    .reduce((s, i) => s + i.tax_amount, 0);
  const totalTax = taxedItems.reduce((s, i) => s + i.tax_amount, 0);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>{(error as Error).message}</AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-6">
      {truncated && (
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Results truncated for performance — showing first {items.length} charges. Narrow the date range for complete data.
          </AlertDescription>
        </Alert>
      )}
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
                <p className="text-xs text-muted-foreground">{taxedItems.length} taxed transactions</p>
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
                <p className="text-2xl font-bold">${cafeTax.toFixed(2)}</p>
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
                <p className="text-2xl font-bold">${shopTax.toFixed(2)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {otherTax > 0 && (
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-muted">
                <ShoppingBag className="h-5 w-5 text-muted-foreground" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Other Tax (Guest Passes, Class Passes, etc.)</p>
                <p className="text-2xl font-bold">${otherTax.toFixed(2)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* All transactions with tax */}
      {taxedItems.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <p>No taxed transactions found in this date range.</p>
          {items.length > 0 && (
            <p className="text-sm mt-2">
              {items.length} total Stripe charges found, but none had tax recorded.
            </p>
          )}
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Description</TableHead>
              <TableHead>Source</TableHead>
              <TableHead className="text-right">Subtotal</TableHead>
              <TableHead className="text-right">Tax (6%)</TableHead>
              <TableHead className="text-right">Total</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {taxedItems.map((item) => (
              <TableRow key={item.stripe_charge_id}>
                <TableCell>{format(new Date(item.date), "MMM d, yyyy h:mm a")}</TableCell>
                <TableCell className="max-w-[200px] truncate">{item.description}</TableCell>
                <TableCell>{item.source}</TableCell>
                <TableCell className="text-right">${item.subtotal.toFixed(2)}</TableCell>
                <TableCell className="text-right font-medium">${item.tax_amount.toFixed(2)}</TableCell>
                <TableCell className="text-right">${item.total.toFixed(2)}</TableCell>
              </TableRow>
            ))}
            <TableRow className="font-bold border-t-2">
              <TableCell colSpan={3}>Totals</TableCell>
              <TableCell className="text-right">
                ${taxedItems.reduce((s, i) => s + i.subtotal, 0).toFixed(2)}
              </TableCell>
              <TableCell className="text-right">${totalTax.toFixed(2)}</TableCell>
              <TableCell className="text-right">
                ${taxedItems.reduce((s, i) => s + i.total, 0).toFixed(2)}
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      )}
    </div>
  );
}
