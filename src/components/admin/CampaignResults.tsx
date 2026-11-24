import { useQuery } from "@tanstack/react-query";
import { formatInTimeZone } from "date-fns-tz";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

const TZ = "America/Detroit";
// Opens and clicks are recorded only for emails sent after tracking was switched on.
export const TRACKING_SINCE = "2026-11-24T05:30:00Z";

export type CampaignResultsData = {
  started_at: string | null; sent: number; delivered: number; bounced: number; complained: number;
  opened: number; clicked: number; buyers: number; revenue_cents: number;
  buyer_list: { email: string; name: string | null; first_at: string; gross_cents: number; items: string | null; clicked: boolean }[];
  clicker_list: { email: string; name: string | null; at: string; hits: number; url: string | null }[];
};

export function useCampaignResults(id: string, enabled = true) {
  return useQuery({
    queryKey: ["campaign-results", id], enabled, staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("campaign_email_results" as any, { p_campaign_id: id });
      if (error) throw error;
      return data as unknown as CampaignResultsData;
    },
  });
}

const pct = (n: number, d: number) => (d > 0 ? `${Math.round((n / d) * 1000) / 10}%` : "—");
const usd = (c: number) => `$${(c / 100).toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;

export function resultsTracked(r?: CampaignResultsData | null) {
  return !!r?.started_at && r.started_at >= TRACKING_SINCE;
}

function Stat({ label, value, sub, tone }: { label: string; value: string | number; sub?: string; tone?: "bad" }) {
  return (
    <div className="rounded-md border bg-background p-2.5">
      <div className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className={`text-lg font-semibold ${tone === "bad" ? "text-destructive" : ""}`}>{value}</div>
      {sub && <div className="text-xs text-muted-foreground">{sub}</div>}
    </div>
  );
}

/** Opens, clicks and purchases for one campaign email. */
export function CampaignResults({ campaignId }: { campaignId: string }) {
  const { data: r, isLoading, error } = useCampaignResults(campaignId);
  if (isLoading) return <div className="rounded-lg border bg-card p-3"><Loader2 className="h-4 w-4 animate-spin" /></div>;
  if (error || !r) return <div className="rounded-lg border bg-card p-3 text-sm text-muted-foreground">Results aren't available.</div>;
  if (!r.sent) return null;
  const tracked = resultsTracked(r);
  const bounceRate = r.sent ? r.bounced / r.sent : 0;
  return (
    <section className="space-y-3 rounded-lg border bg-card p-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="text-sm font-medium">Email results</h3>
        {r.started_at && <span className="text-xs text-muted-foreground">Sent {formatInTimeZone(r.started_at, TZ, "MMM d, h:mm a")} · purchases counted for 7 days after</span>}
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7">
        <Stat label="Sent" value={r.sent.toLocaleString()} />
        <Stat label="Delivered" value={r.delivered.toLocaleString()} sub={pct(r.delivered, r.sent)} />
        <Stat label="Bounced" value={r.bounced.toLocaleString()} sub={pct(r.bounced, r.sent)} tone={bounceRate > 0.02 ? "bad" : undefined} />
        <Stat label="Marked spam" value={r.complained} sub={pct(r.complained, r.sent)} tone={r.complained / Math.max(1, r.sent) > 0.001 ? "bad" : undefined} />
        <Stat label="Opened" value={tracked ? r.opened.toLocaleString() : "—"} sub={tracked ? pct(r.opened, r.delivered || r.sent) : "sent before tracking"} />
        <Stat label="Clicked" value={tracked ? r.clicked.toLocaleString() : "—"} sub={tracked ? pct(r.clicked, r.delivered || r.sent) : "sent before tracking"} />
        <Stat label="Bought" value={r.buyers} sub={r.buyers ? usd(r.revenue_cents) : "no purchases"} />
      </div>
      <p className="text-xs text-muted-foreground">
        "Opened" is an estimate: some phones open every email automatically and others block the tracking image. Clicks and purchases are reliable.
        "Bought" means the person paid for training, spa, classes, gifts, guest passes or Kids Care within 7 days of this email, even if they didn't click it (sales staff rang up are included).
        Bounced addresses and spam reports are taken off future marketing emails automatically.
      </p>
      {r.buyer_list.length > 0 && (
        <div>
          <div className="mb-1 text-xs font-medium uppercase tracking-wider text-muted-foreground">Who bought</div>
          <Table>
            <TableHeader><TableRow><TableHead>Person</TableHead><TableHead>What</TableHead><TableHead>When</TableHead><TableHead className="text-right">Paid</TableHead></TableRow></TableHeader>
            <TableBody>
              {r.buyer_list.map((b) => (
                <TableRow key={b.email}>
                  <TableCell><div className="font-medium">{b.name || b.email}</div><div className="text-xs text-muted-foreground">{b.email}{b.clicked ? " · clicked the email" : ""}</div></TableCell>
                  <TableCell className="max-w-[260px] text-xs">{b.items}</TableCell>
                  <TableCell className="text-xs">{formatInTimeZone(b.first_at, TZ, "MMM d, h:mm a")}</TableCell>
                  <TableCell className="text-right">{usd(b.gross_cents)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
      {tracked && r.clicker_list.length > 0 && (
        <details>
          <summary className="cursor-pointer text-xs font-medium uppercase tracking-wider text-muted-foreground">Who clicked ({r.clicker_list.length})</summary>
          <ul className="mt-2 max-h-64 space-y-1 overflow-y-auto text-sm">
            {r.clicker_list.map((c) => (
              <li key={c.email} className="flex justify-between gap-3">
                <span>{c.name || c.email} <span className="text-xs text-muted-foreground">{c.hits > 1 ? `· ${c.hits} clicks` : ""}</span></span>
                <span className="text-xs text-muted-foreground">{formatInTimeZone(c.at, TZ, "MMM d, h:mm a")}</span>
              </li>
            ))}
          </ul>
        </details>
      )}
    </section>
  );
}

/** One row per sent campaign email, newest first. */
export function CampaignResultsOverview({ campaigns, onOpen }: { campaigns: { id: string; name: string; sent_at: string | null }[]; onOpen: (id: string) => void }) {
  return (
    <div className="rounded-lg border bg-card">
      <div className="border-b p-3">
        <h2 className="text-sm font-medium">Results for every campaign email</h2>
        <p className="text-xs text-muted-foreground">Opens and clicks are recorded for emails sent from Nov 24, 2026 on. Delivery, bounces, spam reports and purchases are shown for every campaign.</p>
      </div>
      <Table>
        <TableHeader><TableRow>
          <TableHead>Campaign</TableHead><TableHead className="text-right">Sent</TableHead><TableHead className="text-right">Delivered</TableHead>
          <TableHead className="text-right">Bounced</TableHead><TableHead className="text-right">Spam</TableHead><TableHead className="text-right">Opened</TableHead>
          <TableHead className="text-right">Clicked</TableHead><TableHead className="text-right">Bought</TableHead>
        </TableRow></TableHeader>
        <TableBody>{campaigns.map((c) => <OverviewRow key={c.id} c={c} onOpen={onOpen} />)}</TableBody>
      </Table>
    </div>
  );
}

function OverviewRow({ c, onOpen }: { c: { id: string; name: string; sent_at: string | null }; onOpen: (id: string) => void }) {
  const { data: r, isLoading } = useCampaignResults(c.id);
  const tracked = resultsTracked(r);
  const cell = (v: React.ReactNode) => <TableCell className="text-right tabular-nums">{isLoading ? "…" : v}</TableCell>;
  return (
    <TableRow className="cursor-pointer" onClick={() => onOpen(c.id)}>
      <TableCell><div className="font-medium">{c.name}</div>{c.sent_at && <div className="text-xs text-muted-foreground">{formatInTimeZone(c.sent_at, TZ, "MMM d, h:mm a")}</div>}</TableCell>
      {cell(r?.sent ?? 0)}
      {cell(r ? `${r.delivered} (${pct(r.delivered, r.sent)})` : "")}
      {cell(r ? <span className={r.sent && r.bounced / r.sent > 0.02 ? "text-destructive" : ""}>{r.bounced} ({pct(r.bounced, r.sent)})</span> : "")}
      {cell(r?.complained ?? 0)}
      {cell(tracked ? `${r!.opened} (${pct(r!.opened, r!.delivered || r!.sent)})` : "—")}
      {cell(tracked ? `${r!.clicked} (${pct(r!.clicked, r!.delivered || r!.sent)})` : "—")}
      {cell(r ? (r.buyers ? `${r.buyers} · ${usd(r.revenue_cents)}` : "0") : "")}
    </TableRow>
  );
}
