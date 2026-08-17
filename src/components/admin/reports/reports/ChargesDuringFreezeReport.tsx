import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { format, parseISO } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AlertTriangle, Download, Snowflake } from "lucide-react";

interface Props {
  dateRange: { start: Date; end: Date };
  filters: Record<string, string | boolean>;
}

interface ChargeRow {
  member: string;
  email: string;
  freezeStatus: string;
  freezeStart: string;
  freezeEnd: string;
  chargeDate: string;
  amount: number;
  description: string;
  chargeId: string;
  category: "Membership dues" | "Freeze fee" | "Other purchase";
}

/**
 * Charges that landed inside a member's freeze window. Membership dues charges
 * are refund candidates; freeze fees and café/shop purchases are legitimate and
 * are labelled as such so staff don't refund them by mistake.
 */
function categorize(description: string, amount: number): ChargeRow["category"] {
  const d = description.toLowerCase();
  if (d.includes("freeze fee")) return "Freeze fee";
  if (d.includes("subscription")) return "Membership dues";
  if (d.includes("cafe") || d.includes("café") || d.includes("shop") || d.includes("merch")) {
    return "Other purchase";
  }
  // Unlabelled small amounts around the freeze fee price are almost always the fee itself.
  if (amount <= 65) return "Freeze fee";
  return "Membership dues";
}

export function ChargesDuringFreezeReport({ dateRange }: Props) {
  const { data, isLoading } = useQuery({
    queryKey: ["report-charges-during-freeze", dateRange],
    queryFn: async () => {
      const { data: freezes, error } = await supabase
        .from("member_freezes")
        .select(
          "id, member_id, status, requested_start_date, requested_end_date, actual_start_date, actual_end_date, members (first_name, last_name, email)",
        )
        .in("status", ["active", "approved", "completed"]);
      if (error) throw error;

      const memberIds = [...new Set((freezes ?? []).map((f) => f.member_id).filter(Boolean))];
      if (memberIds.length === 0) return [] as ChargeRow[];

      const { data: payments, error: payErr } = await supabase
        .from("payment_attempts")
        .select("member_id, amount, succeeded_at, stripe_charge_id, metadata")
        .in("member_id", memberIds)
        .eq("status", "succeeded")
        .not("succeeded_at", "is", null);
      if (payErr) throw payErr;

      const rows: ChargeRow[] = [];
      for (const f of freezes ?? []) {
        const start = f.actual_start_date ?? f.requested_start_date;
        const end = f.actual_end_date ?? f.requested_end_date;
        if (!start || !end) continue;

        for (const p of payments ?? []) {
          if (p.member_id !== f.member_id || !p.succeeded_at) continue;
          const day = String(p.succeeded_at).slice(0, 10);
          if (day < start || day > end) continue;
          if (day < format(dateRange.start, "yyyy-MM-dd") || day > format(dateRange.end, "yyyy-MM-dd")) continue;

          const meta = (p.metadata ?? {}) as Record<string, unknown>;
          const description = String(meta.description ?? meta.type ?? "");
          const amount = Number(p.amount ?? 0);
          rows.push({
            member: `${f.members?.first_name ?? ""} ${f.members?.last_name ?? ""}`.trim(),
            email: f.members?.email ?? "",
            freezeStatus: f.status,
            freezeStart: start,
            freezeEnd: end,
            chargeDate: day,
            amount,
            description: description || "(no description)",
            chargeId: p.stripe_charge_id ?? "",
            category: categorize(description, amount),
          });
        }
      }
      return rows.sort((a, b) => b.chargeDate.localeCompare(a.chargeDate));
    },
  });

  const rows = data ?? [];
  const duesRows = useMemo(() => rows.filter((r) => r.category === "Membership dues"), [rows]);
  const refundTotal = useMemo(() => duesRows.reduce((sum, r) => sum + r.amount, 0), [duesRows]);

  const exportPdf = () => {
    const doc = new jsPDF({ orientation: "landscape" });
    doc.setFontSize(16);
    doc.text("Charges Taken During Membership Freezes", 14, 16);
    doc.setFontSize(10);
    doc.text(
      `${format(dateRange.start, "MMM d, yyyy")} – ${format(dateRange.end, "MMM d, yyyy")}`,
      14,
      23,
    );
    doc.text(
      `Refund candidates (membership dues): ${duesRows.length} charge(s), $${refundTotal.toFixed(2)}`,
      14,
      29,
    );

    autoTable(doc, {
      startY: 34,
      head: [["Member", "Email", "Freeze window", "Charge date", "Amount", "Category", "Description", "Stripe charge"]],
      body: rows.map((r) => [
        r.member,
        r.email,
        `${format(parseISO(r.freezeStart), "MMM d")} – ${format(parseISO(r.freezeEnd), "MMM d, yyyy")}`,
        format(parseISO(r.chargeDate), "MMM d, yyyy"),
        `$${r.amount.toFixed(2)}`,
        r.category,
        r.description.slice(0, 60),
        r.chargeId,
      ]),
      styles: { fontSize: 7, cellPadding: 1.5 },
      headStyles: { fillColor: [30, 41, 59] },
    });

    doc.save(`charges-during-freeze-${format(new Date(), "yyyy-MM-dd")}.pdf`);
  };

  if (isLoading) return <Skeleton className="h-96 w-full" />;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6 flex items-center gap-3">
            <Snowflake className="h-8 w-8 text-blue-500" />
            <div>
              <p className="text-sm text-muted-foreground">Charges in freeze windows</p>
              <p className="text-2xl font-bold">{rows.length}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6 flex items-center gap-3">
            <AlertTriangle className="h-8 w-8 text-destructive" />
            <div>
              <p className="text-sm text-muted-foreground">Refund candidates (dues)</p>
              <p className="text-2xl font-bold">{duesRows.length}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6 flex items-center justify-between gap-3">
            <div>
              <p className="text-sm text-muted-foreground">Total to review</p>
              <p className="text-2xl font-bold">${refundTotal.toFixed(2)}</p>
            </div>
            <Button size="sm" onClick={exportPdf} disabled={rows.length === 0}>
              <Download className="h-4 w-4 mr-1" /> PDF
            </Button>
          </CardContent>
        </Card>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Member</TableHead>
            <TableHead>Freeze window</TableHead>
            <TableHead>Charge date</TableHead>
            <TableHead className="text-right">Amount</TableHead>
            <TableHead>Category</TableHead>
            <TableHead>Description</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((r, i) => (
            <TableRow key={`${r.chargeId}-${i}`}>
              <TableCell className="font-medium">
                {r.member}
                <div className="text-xs text-muted-foreground">{r.email}</div>
              </TableCell>
              <TableCell className="text-sm">
                {format(parseISO(r.freezeStart), "MMM d")} – {format(parseISO(r.freezeEnd), "MMM d, yyyy")}
              </TableCell>
              <TableCell>{format(parseISO(r.chargeDate), "MMM d, yyyy")}</TableCell>
              <TableCell className="text-right">${r.amount.toFixed(2)}</TableCell>
              <TableCell>
                <Badge variant={r.category === "Membership dues" ? "destructive" : "outline"}>{r.category}</Badge>
              </TableCell>
              <TableCell className="max-w-[320px] truncate text-sm text-muted-foreground">{r.description}</TableCell>
            </TableRow>
          ))}
          {rows.length === 0 && (
            <TableRow>
              <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                No charges landed inside a freeze window in this period
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}
