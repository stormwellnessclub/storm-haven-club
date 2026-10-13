import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Download, Loader2 } from "lucide-react";
import { toast } from "sonner";

const FN = "send-body-roller-presale-email";
const fmt = (d: string) => new Date(d).toLocaleString("en-US", { timeZone: "America/Detroit", dateStyle: "medium", timeStyle: "short" });
const STATUS: Record<string, "default" | "secondary" | "destructive" | "outline"> = { scheduled: "default", sending: "secondary", sent: "secondary", failed: "destructive", cancelled: "outline" };

export function BodyRollerScheduledSends({ titles }: { titles: Record<string, string> }) {
  const qc = useQueryClient();
  const [busy, setBusy] = useState<string | null>(null);
  const { data = [] } = useQuery({
    queryKey: ["body-roller-scheduled"],
    refetchInterval: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke(FN, { body: { kind: "launch", listScheduled: true } });
      if (error) throw error;
      return (data?.scheduled ?? []) as any[];
    },
  });
  const cancel = async (id: string) => {
    setBusy(id);
    const { data: r, error } = await supabase.functions.invoke(FN, { body: { kind: "launch", cancelScheduled: id } });
    setBusy(null);
    if (error || !r?.ok) toast.error(r?.error || error?.message || "Couldn't cancel"); else toast.success("Scheduled send cancelled");
    qc.invalidateQueries({ queryKey: ["body-roller-scheduled"] });
  };
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Scheduled sends</CardTitle>
        <CardDescription>Pick "Send later" on any email's send screen. Times are Detroit time.</CardDescription>
      </CardHeader>
      <CardContent>
        {!data.length ? <p className="text-sm text-muted-foreground">Nothing scheduled.</p> : (
          <div className="divide-y text-sm">
            {data.map((s) => (
              <div key={s.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                <div>
                  <p className="font-medium">{titles[s.kind] ?? s.kind}</p>
                  <p className="text-xs text-muted-foreground">
                    {fmt(s.send_at)}{s.extra_emails?.length ? ` · +${s.extra_emails.length} added` : ""}
                    {s.status === "sent" && s.result ? ` · sent to ${s.result.queued ?? 0}` : ""}
                    {s.error ? ` · ${s.error}` : ""}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={STATUS[s.status] ?? "outline"} className="capitalize">{s.status}</Badge>
                  {s.status === "scheduled" && (
                    <Button size="sm" variant="outline" disabled={busy === s.id} onClick={() => cancel(s.id)}>
                      {busy === s.id ? <Loader2 className="h-4 w-4 animate-spin" /> : "Cancel"}
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

type OpenRow = { email: string; name: string | null; sent_at: string; opened: boolean; first_opened_at: string | null; open_count: number };

export function BodyRollerOpens({ kinds }: { kinds: { kind: string; title: string }[] }) {
  const [kind, setKind] = useState(kinds[0]?.kind ?? "launch");
  const [filter, setFilter] = useState<"all" | "opened" | "not">("all");
  const [q, setQ] = useState("");
  const { data, isLoading } = useQuery({
    queryKey: ["body-roller-opens", kind],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke(FN, { body: { kind, opens: true } });
      if (error) throw error;
      return data as { total: number; opened: number; rows: OpenRow[] };
    },
  });
  const rows = (data?.rows ?? []).filter((r) => (filter === "all" || (filter === "opened") === r.opened) && (!q || r.email.includes(q.toLowerCase()) || (r.name ?? "").toLowerCase().includes(q.toLowerCase())));
  const exportCsv = () => {
    const lines = rows.map((r) => [r.name ?? "", r.email, r.opened ? "Opened" : "Not opened", r.first_opened_at ? fmt(r.first_opened_at) : "", r.open_count]
      .map((v) => `"${String(v).replace(/"/g, '""').replace(/^[=+\-@]/, "'$&")}"`).join(","));
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([["Name,Email,Status,First opened,Opens", ...lines].join("\n")], { type: "text/csv" }));
    a.download = `${kind}-${filter}-opens.csv`; a.click();
  };
  const pct = data?.total ? Math.round((data.opened / data.total) * 100) : 0;
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Who opened</CardTitle>
        <CardDescription>Counted for emails sent from now on. Apple Mail opens some emails on its own, so treat opens as a guide. Clicks are the surer sign.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap gap-2">
          <Select value={kind} onValueChange={setKind}>
            <SelectTrigger className="w-72"><SelectValue /></SelectTrigger>
            <SelectContent>{kinds.map((k) => <SelectItem key={k.kind} value={k.kind}>{k.title}</SelectItem>)}</SelectContent>
          </Select>
          {(["all", "opened", "not"] as const).map((f) => (
            <Button key={f} size="sm" variant={filter === f ? "default" : "outline"} onClick={() => setFilter(f)}>
              {f === "all" ? "Everyone" : f === "opened" ? "Opened" : "Didn't open"}
            </Button>
          ))}
          <Button size="sm" variant="outline" onClick={exportCsv} disabled={!rows.length}><Download className="h-4 w-4 mr-1" />Download</Button>
        </div>
        {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : data && (
          <>
            <p className="text-sm"><strong>{data.opened.toLocaleString()}</strong> of {data.total.toLocaleString()} opened ({pct}%) · <strong>{(data.total - data.opened).toLocaleString()}</strong> didn't open</p>
            <Input placeholder="Search name or email" value={q} onChange={(e) => setQ(e.target.value)} className="max-w-sm" />
            <div className="max-h-72 overflow-y-auto border rounded-md divide-y text-sm">
              {rows.slice(0, 500).map((r) => (
                <div key={r.email} className="flex items-center justify-between px-3 py-1.5 gap-2">
                  <div className="min-w-0"><p className="truncate">{r.name || r.email}</p>{r.name && <p className="text-xs text-muted-foreground truncate">{r.email}</p>}</div>
                  {r.opened ? <Badge variant="secondary" className="text-xs shrink-0">Opened {r.first_opened_at && fmt(r.first_opened_at)}</Badge> : <Badge variant="outline" className="text-xs shrink-0">Not opened</Badge>}
                </div>
              ))}
              {!rows.length && <p className="px-3 py-4 text-xs text-muted-foreground text-center">No one here yet.</p>}
              {rows.length > 500 && <p className="px-3 py-2 text-xs text-muted-foreground">Showing 500 of {rows.length.toLocaleString()} — download for the rest.</p>}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
