import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { format, parseISO } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { LedgerStatusBar } from "../LedgerStatusBar";
import { RevenueTotalsCards } from "../RevenueTotalsCards";
import {
  AREA_ORDER, areaLabel, isEarnedArea, money, sumRows, tenderLabel, toBusinessDate, useRevenueSummary,
} from "@/lib/revenueLedger";

interface Props {
  dateRange: { start: Date; end: Date };
  filters: Record<string, string | boolean>;
}

export function CollectedRevenueReport({ dateRange }: Props) {
  const { data: rows, isLoading, error } = useRevenueSummary(dateRange);
  const recent = useQuery({
    queryKey: ["revenue-ledger-entries", "recent", toBusinessDate(dateRange.start), toBusinessDate(dateRange.end)],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("revenue_ledger")
        .select("id, business_date, kind, area, label, description, tender, net_cents, gross_cents")
        .gte("business_date", toBusinessDate(dateRange.start))
        .lte("business_date", toBusinessDate(dateRange.end))
        .order("occurred_at", { ascending: false })
        .limit(25);
      if (error) throw error;
      return data ?? [];
    },
  });

  const view = useMemo(() => {
    const earned = (rows ?? []).filter((r) => isEarnedArea(r.area));
    const areas = AREA_ORDER.filter((a) => earned.some((r) => r.area === a)).map((a) => {
      const inArea = earned.filter((r) => r.area === a);
      return {
        area: a,
        member: sumRows(inArea.filter((r) => r.is_member)).net,
        nonMember: sumRows(inArea.filter((r) => !r.is_member)).net,
        total: sumRows(inArea).net,
      };
    });
    return {
      areas,
      totals: sumRows(earned),
      member: sumRows(earned.filter((r) => r.is_member)).net,
      nonMember: sumRows(earned.filter((r) => !r.is_member)).net,
    };
  }, [rows]);

  if (isLoading) return <Skeleton className="h-[420px] w-full" />;
  if (error) return <div className="text-sm text-destructive">Failed to load collected revenue: {(error as Error).message}</div>;

  return (
    <div className="space-y-6">
      <LedgerStatusBar estimatedEntries={view.totals.estimated} />
      <RevenueTotalsCards totals={view.totals} />

      <Card>
        <CardHeader>
          <CardTitle>Revenue by area</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Area</TableHead>
                <TableHead className="text-right">Members</TableHead>
                <TableHead className="text-right">Non-members &amp; walk-ins</TableHead>
                <TableHead className="text-right">Total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {view.areas.map((row) => (
                <TableRow key={row.area}>
                  <TableCell><Badge variant="outline">{areaLabel(row.area)}</Badge></TableCell>
                  <TableCell className="text-right">{money(row.member)}</TableCell>
                  <TableCell className="text-right">{money(row.nonMember)}</TableCell>
                  <TableCell className="text-right font-medium">{money(row.total)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
            <TableFooter>
              <TableRow>
                <TableCell className="font-bold">Total</TableCell>
                <TableCell className="text-right">{money(view.member)}</TableCell>
                <TableCell className="text-right">{money(view.nonMember)}</TableCell>
                <TableCell className="text-right font-bold">{money(view.totals.net)}</TableCell>
              </TableRow>
            </TableFooter>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Latest transactions</CardTitle>
        </CardHeader>
        <CardContent>
          {recent.isLoading ? (
            <Skeleton className="h-40 w-full" />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Area</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Paid by</TableHead>
                  <TableHead className="text-right">Revenue</TableHead>
                  <TableHead className="text-right">Collected</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(recent.data ?? []).length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">No transactions in range.</TableCell>
                  </TableRow>
                ) : (
                  (recent.data ?? []).map((e) => (
                    <TableRow key={e.id}>
                      <TableCell className="whitespace-nowrap">{format(parseISO(e.business_date), "MMM d, yyyy")}</TableCell>
                      <TableCell>{areaLabel(e.area)}</TableCell>
                      <TableCell className="max-w-[320px] truncate">
                        {e.kind !== "sale" && <Badge variant="destructive" className="mr-2 capitalize">{e.kind.replace("_", " ")}</Badge>}
                        {e.label || e.description || "—"}
                      </TableCell>
                      <TableCell>{tenderLabel(e.tender)}</TableCell>
                      <TableCell className="text-right">{money(e.net_cents / 100)}</TableCell>
                      <TableCell className="text-right font-medium">{money(e.gross_cents / 100)}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
