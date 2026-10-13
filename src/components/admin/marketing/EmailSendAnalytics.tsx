import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ChevronDown, ChevronRight } from "lucide-react";

type Log = { email_type: string; recipient_email: string | null; status: string; created_at: string; error_message: string | null; subject: string | null; trigger_source: string | null };
const RANGES = [["7d", 7], ["30d", 30], ["90d", 90], ["all", 0]] as const;
const RANGE_LABEL: Record<string, string> = { "7d": "Last 7 days", "30d": "Last 30 days", "90d": "Last 90 days", all: "All time" };
// Group sends only (not one-off personal emails).
const BULK_SOURCES = ["admin_blast"];
const MONTHS: Record<string, string> = { jan: "Jan", feb: "Feb", mar: "Mar", apr: "Apr", may: "May", jun: "Jun", jul: "Jul", aug: "Aug", sep: "Sep", oct: "Oct", nov: "Nov", dec: "Dec" };

function humanize(key: string) {
  const parts = key.split("_");
  const words: string[] = [];
  let date = "";
  for (let i = 0; i < parts.length; i++) {
    const p = parts[i];
    if (MONTHS[p] && /^\d{1,2}$/.test(parts[i + 1] ?? "")) { date = `${MONTHS[p]} ${parts[i + 1]}${/^\d{4}$/.test(parts[i + 2] ?? "") ? `, ${parts[i + 2]}` : ""}`; i += /^\d{4}$/.test(parts[i + 2] ?? "") ? 2 : 1; continue; }
    if (/^\d{4}$/.test(p) && /^\d{2}$/.test(parts[i + 1] ?? "")) { date = parts.slice(i, i + 3).filter((x) => /^\d+$/.test(x)).join("-"); i += 2; continue; }
    if (/^\d{4}$/.test(p)) { date = date || p; continue; }
    words.push(p);
  }
  const name = words.join(" ").replace(/\b\w/g, (c) => c.toUpperCase());
  return date ? `${name} — ${date}` : name;
}

async function pageAll<T>(build: (from: number, to: number) => any): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await build(from, from + 999);
    if (error) throw error;
    out.push(...(data ?? []));
    if (!data || data.length < 1000) break;
  }
  return out;
}

/** Real group-email sends from the email log, with Body Roller click/checkout/purchase tracking. */
export function EmailSendAnalytics() {
  const [range, setRange] = useState<string>("30d");
  const [open, setOpen] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["email-send-analytics", range],
    queryFn: async () => {
      const days = RANGES.find((r) => r[0] === range)?.[1] ?? 0;
      const since = days ? new Date(Date.now() - days * 86400_000).toISOString() : null;
      const logs = await pageAll<Log>((f, t) => {
        let q = supabase.from("email_audit_log").select("email_type, recipient_email, status, created_at, error_message, subject, trigger_source")
          .in("trigger_source", BULK_SOURCES).order("created_at", { ascending: false }).range(f, t);
        if (since) q = q.gte("created_at", since);
        return q;
      });
      const [clicks, purchases] = await Promise.all([
        pageAll<{ email: string; kind: string }>((f, t) => supabase.from("body_roller_presale_clicks").select("email, kind").range(f, t)),
        pageAll<{ customer_email: string; status: string }>((f, t) => supabase.from("body_roller_presale_purchases").select("customer_email, status").range(f, t)),
      ]);
      return { logs: logs.filter((l) => !l.email_type.endsWith("_test")), clicks, purchases };
    },
  });

  const rows = useMemo(() => {
    if (!data) return [];
    const by = new Map<string, Log[]>();
    for (const l of data.logs) { const a = by.get(l.email_type) ?? []; a.push(l); by.set(l.email_type, a); }
    const norm = (e: string | null) => String(e ?? "").trim().toLowerCase();
    return [...by.entries()].map(([type, list]) => {
      const sentTo = new Set(list.filter((l) => l.status === "sent").map((l) => norm(l.recipient_email)));
      const failed = list.filter((l) => l.status !== "sent");
      const last = list.reduce((m, l) => (l.created_at > m ? l.created_at : m), list[0].created_at);
      let roller: { clicked: number; started: number; bought: number } | null = null;
      if (type.startsWith("body_roller_presale_")) {
        const kind = type.replace("body_roller_presale_", "");
        const clicked = new Set(data.clicks.filter((c) => c.kind === kind).map((c) => norm(c.email)));
        const started = new Set(data.purchases.filter((p) => sentTo.has(norm(p.customer_email))).map((p) => norm(p.customer_email)));
        const bought = new Set(data.purchases.filter((p) => (p.status === "paid" || p.status === "processing") && sentTo.has(norm(p.customer_email))).map((p) => norm(p.customer_email)));
        roller = { clicked: clicked.size, started: started.size, bought: bought.size };
      }
      return { type, name: list.find((l) => l.subject)?.subject && type.startsWith("body_roller") ? `Body Roller — ${list.find((l) => l.subject)!.subject}` : humanize(type), sent: sentTo.size, failed, last, roller };
    }).sort((a, b) => (a.last < b.last ? 1 : -1));
  }, [data]);

  const totals = rows.reduce((t, r) => ({ campaigns: t.campaigns + 1, sent: t.sent + r.sent, failed: t.failed + r.failed.length }), { campaigns: 0, sent: 0, failed: 0 });

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <CardTitle className="text-base">Group emails sent</CardTitle>
            <CardDescription>Every email sent to a group from this admin. Test sends are left out.</CardDescription>
          </div>
          <div className="flex gap-1">
            {RANGES.map(([k]) => <Button key={k} size="sm" variant={range === k ? "default" : "outline"} onClick={() => setRange(k)}>{RANGE_LABEL[k]}</Button>)}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {isLoading ? <Skeleton className="h-40 w-full" /> : (
          <>
            <div className="grid grid-cols-3 gap-2 text-center">
              {[["Emails", totals.campaigns], ["Delivered to", totals.sent], ["Failed", totals.failed]].map(([l, v]) => (
                <div key={l as string} className="border rounded-md p-3"><p className="text-2xl font-semibold">{(v as number).toLocaleString()}</p><p className="text-xs text-muted-foreground">{l}</p></div>
              ))}
            </div>
            {rows.length === 0 ? <p className="text-sm text-muted-foreground text-center py-6">No group emails in this period.</p> : (
              <Table>
                <TableHeader><TableRow>
                  <TableHead>Email</TableHead><TableHead>Last sent</TableHead><TableHead className="text-right">Sent to</TableHead>
                  <TableHead className="text-right">Failed</TableHead><TableHead className="text-right">Clicked · Checkout · Bought</TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {rows.map((r) => (
                    <>
                      <TableRow key={r.type} className={r.failed.length ? "cursor-pointer" : ""} onClick={() => r.failed.length && setOpen(open === r.type ? null : r.type)}>
                        <TableCell className="font-medium">
                          <span className="inline-flex items-center gap-1">{r.failed.length > 0 && (open === r.type ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />)}{r.name}</span>
                        </TableCell>
                        <TableCell className="whitespace-nowrap">{new Date(r.last).toLocaleDateString("en-US", { timeZone: "America/Detroit", month: "short", day: "numeric", year: "numeric" })}</TableCell>
                        <TableCell className="text-right">{r.sent.toLocaleString()}</TableCell>
                        <TableCell className="text-right">{r.failed.length ? <Badge variant="destructive">{r.failed.length}</Badge> : 0}</TableCell>
                        <TableCell className="text-right text-muted-foreground">{r.roller ? `${r.roller.clicked} · ${r.roller.started} · ${r.roller.bought}` : "—"}</TableCell>
                      </TableRow>
                      {open === r.type && (
                        <TableRow key={`${r.type}-f`}><TableCell colSpan={5} className="bg-muted/40">
                          <div className="space-y-1 text-xs max-h-60 overflow-y-auto">
                            {r.failed.map((f, i) => <p key={i}><span className="font-medium">{f.recipient_email}</span> — {f.error_message || f.status}</p>)}
                          </div>
                        </TableCell></TableRow>
                      )}
                    </>
                  ))}
                </TableBody>
              </Table>
            )}
            <p className="text-xs text-muted-foreground">Clicks are tracked for Body Roller emails sent after tracking was added. Opens and clicks for other emails aren't recorded yet.</p>
          </>
        )}
      </CardContent>
    </Card>
  );
}
