import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { EventsPortalShell } from "@/components/eventsportal/EventsPortalShell";
import { useAllEventInvoices } from "@/hooks/useEventFinancials";
import { LegacyImportDialog } from "@/components/eventsportal/finance/LegacyImportDialog";
import {
  INVOICE_STATUS_LABEL,
  INVOICE_STATUS_TONE,
  INVOICE_STATUSES,
  formatDay,
  money,
  type InvoiceStatus,
} from "@/lib/eventFinancials";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, Search, Download } from "lucide-react";

const SUMMARY_CARDS = [
  { key: "outstanding", label: "Total outstanding" },
  { key: "deposits", label: "Deposits awaiting payment" },
  { key: "dueSoon", label: "Balances due in 14 days" },
  { key: "overdue", label: "Overdue" },
  { key: "received", label: "Payments received" },
  { key: "refunded", label: "Refunded" },
  { key: "drafts", label: "Draft invoices" },
] as const;

export default function EventsPortalFinance() {
  const navigate = useNavigate();
  const { data: invoices = [], isLoading } = useAllEventInvoices();
  const [importOpen, setImportOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<string>("all");
  const [kind, setKind] = useState<string>("all");

  // legacy private events without a financial workspace yet
  const { data: unmapped = [], refetch: refetchUnmapped } = useQuery({
    queryKey: ["unmapped-private-events"],
    queryFn: async () => {
      const [pe, fin] = await Promise.all([
        supabase.from("private_events").select("id, title, event_date, client_first_name, client_last_name"),
        supabase.from("event_financials").select("private_event_id").not("private_event_id", "is", null),
      ]);
      const mapped = new Set((fin.data ?? []).map((f: any) => f.private_event_id));
      return (pe.data ?? []).filter((e: any) => !mapped.has(e.id));
    },
  });

  const totals = useMemo(() => {
    const t = { outstanding: 0, deposits: 0, dueSoon: 0, overdue: 0, received: 0, refunded: 0, drafts: 0 };
    const horizon = new Date();
    horizon.setDate(horizon.getDate() + 14);
    for (const i of invoices as any[]) {
      const balance = Math.max(0, i.amount_cents - i.amount_paid_cents);
      if (i.status === "void") continue;
      t.received += i.amount_paid_cents;
      t.refunded += i.amount_refunded_cents;
      if (i.status === "draft") t.drafts += i.amount_cents;
      if (!["paid", "refunded", "draft"].includes(i.status)) t.outstanding += balance;
      if (i.invoice_type === "deposit" && !["paid", "refunded"].includes(i.status)) t.deposits += balance;
      if (i.status === "overdue") t.overdue += balance;
      if (i.due_date && !["paid", "refunded", "draft"].includes(i.status)) {
        const due = new Date(`${i.due_date}T12:00:00`);
        if (due >= new Date() && due <= horizon) t.dueSoon += balance;
      }
    }
    return t;
  }, [invoices]);

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (invoices as any[]).filter((i) => {
      if (status !== "all" && i.status !== status) return false;
      if (kind !== "all" && i.financial?.event_kind !== kind) return false;
      if (!q) return true;
      return [i.invoice_number, i.label, i.financial?.title, i.financial?.client_name, i.financial?.client_email]
        .filter(Boolean)
        .some((v: string) => String(v).toLowerCase().includes(q));
    });
  }, [invoices, search, status, kind]);

  const exportCsv = () => {
    const header = [
      "Invoice",
      "Event",
      "Client",
      "Event type",
      "Invoice type",
      "Issued",
      "Due",
      "Total",
      "Paid",
      "Balance",
      "Status",
      "Method",
      "Last reminder",
    ];
    const body = rows.map((i: any) => [
      i.invoice_number,
      i.financial?.title ?? "",
      i.financial?.client_name ?? "",
      i.financial?.event_kind ?? "",
      i.invoice_type,
      i.issue_date ?? "",
      i.due_date ?? "",
      (i.amount_cents / 100).toFixed(2),
      (i.amount_paid_cents / 100).toFixed(2),
      ((i.amount_cents - i.amount_paid_cents) / 100).toFixed(2),
      i.status,
      i.payment_method ?? "",
      i.last_reminder_at ?? "",
    ]);
    const csv = [header, ...body]
      .map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = "event-invoices.csv";
    a.click();
    URL.revokeObjectURL(url);
  };


  return (
    <EventsPortalShell
      title="Finance"
      description="Every estimate, invoice, payment and refund across the events programme."
      actions={
        <div className="flex flex-wrap gap-2">
          {unmapped.length > 0 && (
            <Button variant="outline" onClick={() => setImportOpen(true)}>
              Review {unmapped.length} existing event{unmapped.length === 1 ? "" : "s"}
            </Button>
          )}
          <Button variant="outline" onClick={exportCsv}>
            <Download className="mr-2 h-4 w-4" /> Export
          </Button>
        </div>
      }
    >
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {SUMMARY_CARDS.map((c) => (
          <Card key={c.key}>
            <CardHeader className="pb-1">
              <CardTitle className="text-xs font-normal uppercase tracking-wider text-muted-foreground">
                {c.label}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="font-serif text-2xl text-primary">{money((totals as any)[c.key])}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader className="flex flex-col gap-3 pb-3 md:flex-row md:items-center md:justify-between">
          <CardTitle className="font-serif">Invoices</CardTitle>
          <div className="flex flex-wrap gap-2">
            <div className="relative">
              <Search className="pointer-events-none absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                className="w-56 pl-8"
                placeholder="Invoice, event or client"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger className="w-44">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                {INVOICE_STATUSES.map((s) => (
                  <SelectItem key={s} value={s}>
                    {INVOICE_STATUS_LABEL[s]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={kind} onValueChange={setKind}>
              <SelectTrigger className="w-44">
                <SelectValue placeholder="Event type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All event types</SelectItem>
                {["private", "corporate", "brand_partnership", "member", "workshop", "facility_rental", "production", "public", "custom"].map(
                  (k) => (
                    <SelectItem key={k} value={k}>
                      {k.replace(/_/g, " ")}
                    </SelectItem>
                  ),
                )}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          {isLoading ? (
            <div className="flex justify-center py-10">
              <Loader2 className="h-5 w-5 animate-spin" />
            </div>
          ) : rows.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted-foreground">No invoices match this view.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Invoice</TableHead>
                  <TableHead>Event</TableHead>
                  <TableHead>Client</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Issued</TableHead>
                  <TableHead>Due</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead className="text-right">Paid</TableHead>
                  <TableHead className="text-right">Balance</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Last reminder</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((i: any) => (
                  <TableRow
                    key={i.id}
                    className="cursor-pointer"
                    onClick={() => navigate(`/events-portal/finance/${i.financial_id}?invoice=${i.id}`)}
                  >
                    <TableCell className="font-medium">{i.invoice_number}</TableCell>
                    <TableCell>{i.financial?.title ?? "—"}</TableCell>
                    <TableCell className="text-muted-foreground">{i.financial?.client_name ?? "—"}</TableCell>
                    <TableCell className="capitalize">{i.invoice_type}</TableCell>
                    <TableCell>{formatDay(i.issue_date)}</TableCell>
                    <TableCell>{formatDay(i.due_date)}</TableCell>
                    <TableCell className="text-right">{money(i.amount_cents)}</TableCell>
                    <TableCell className="text-right">{money(i.amount_paid_cents)}</TableCell>
                    <TableCell className="text-right font-medium">
                      {money(Math.max(0, i.amount_cents - i.amount_paid_cents))}
                    </TableCell>
                    <TableCell>
                      <Badge className={INVOICE_STATUS_TONE[i.status as InvoiceStatus]} variant="secondary">
                        {INVOICE_STATUS_LABEL[i.status as InvoiceStatus]}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {i.last_reminder_at ? formatDay(String(i.last_reminder_at).slice(0, 10)) : "—"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
      <LegacyImportDialog open={importOpen} onOpenChange={setImportOpen} onImported={() => refetchUnmapped()} />
    </EventsPortalShell>
  );
}
