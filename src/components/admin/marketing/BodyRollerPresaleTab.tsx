import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { Download, Eye, Loader2, Mail, Send, ExternalLink } from "lucide-react";
import { usd } from "@/lib/bodyRollerPresale";

const FN = "send-body-roller-presale-email";
const KINDS = [
  { kind: "launch", title: "Launch announcement", who: "active members" },
  { kind: "halfway", title: "Halfway reminder", who: "active members" },
  { kind: "last_chance", title: "Last-chance reminder", who: "active members" },
  { kind: "arrived", title: "Machine arrived", who: "presale buyers only" },
  { kind: "nm_launch", title: "Non-member launch announcement", who: "registered non-members" },
  { kind: "nm_halfway", title: "Non-member halfway reminder", who: "registered non-members" },
  { kind: "nm_last_chance", title: "Non-member last-chance reminder", who: "registered non-members" },
] as const;
const KEYS: Record<string, string> = {
  launch: "body_roller_presale_launch", halfway: "body_roller_presale_halfway",
  last_chance: "body_roller_presale_last_chance", arrived: "body_roller_presale_arrived",
  nm_launch: "body_roller_presale_nm_launch", nm_halfway: "body_roller_presale_nm_halfway", nm_last_chance: "body_roller_presale_nm_last_chance",
};

export function BodyRollerPresaleTab() {
  const qc = useQueryClient();
  const [html, setHtml] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [testEmail, setTestEmail] = useState("admin@stormwellnessclub.com");
  const { data: nmCount } = useQuery({
    queryKey: ["body-roller-nm-recipient-count"],
    queryFn: async () => {
      const { data: r, error } = await supabase.functions.invoke(FN, { body: { kind: "nm_launch", countOnly: true } });
      if (error) throw error;
      return r as { total: number; counts: { imported: number; portal_accounts: number; other_accounts: number } };
    },
  });

  const { data } = useQuery({
    queryKey: ["admin-body-roller-presale"],
    queryFn: async () => {
      const [{ data: rows }, { data: settings }, { data: logs }] = await Promise.all([
        supabase.from("body_roller_presale_purchases").select("*").eq("status", "paid").order("paid_at", { ascending: false }),
        supabase.from("body_roller_presale_settings").select("*").eq("id", 1).maybeSingle(),
        supabase.from("email_audit_log").select("email_type").in("email_type", Object.values(KEYS)).eq("status", "sent"),
      ]);
      const sent: Record<string, number> = {};
      for (const l of logs ?? []) sent[l.email_type] = (sent[l.email_type] ?? 0) + 1;
      return { rows: rows ?? [], settings, sent };
    },
  });

  const rows = data?.rows ?? [];
  const totalCents = rows.reduce((s, r) => s + r.subtotal_cents, 0);
  const endsDate = data?.settings ? new Date(data.settings.ends_at).toLocaleDateString("en-CA", { timeZone: "America/Detroit" }) : "";

  const saveSettings = async (patch: Record<string, unknown>) => {
    const { error } = await supabase.from("body_roller_presale_settings").update({ ...patch, updated_at: new Date().toISOString() }).eq("id", 1);
    if (error) toast.error(error.message); else { toast.success("Saved"); qc.invalidateQueries({ queryKey: ["admin-body-roller-presale"] }); }
  };

  const preview = async (kind: string) => {
    setBusy(`p-${kind}`);
    try {
      const { data: s } = await supabase.auth.getSession();
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/${FN}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${s.session?.access_token}`, "Content-Type": "application/json", apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? "" },
        body: JSON.stringify({ kind, preview: true }),
      });
      if (!res.ok) throw new Error(await res.text());
      setHtml(await res.text());
    } catch (e: any) { toast.error(e.message || "Preview failed"); } finally { setBusy(null); }
  };

  const send = async (kind: string, test: boolean) => {
    setBusy(`${test ? "t" : "b"}-${kind}`);
    try {
      const { data: r, error } = await supabase.functions.invoke(FN, { body: test ? { kind, testEmail } : { kind } });
      if (error) throw error;
      if (test) { if (!r?.ok) throw new Error(r?.error); toast.success(`Test sent to ${r.sentTo}`); }
      else { toast.success(`Sent ${r.queued} (${r.skipped} skipped)`); qc.invalidateQueries({ queryKey: ["admin-body-roller-presale"] }); }
    } catch (e: any) { toast.error(e.message || "Send failed"); } finally { setBusy(null); }
  };

  const exportCsv = () => {
    const head = ["Paid", "Name", "Email", "Option", "Sessions", "Subtotal", "Tax", "Fee", "Total", "Expires"];
    const lines = rows.map((r) => [r.paid_at?.slice(0, 10), r.customer_name, r.customer_email, r.label, r.sessions_total, r.subtotal_cents / 100, r.tax_cents / 100, r.fee_cents / 100, r.total_cents / 100, r.expires_at?.slice(0, 10)]
      .map((v) => `"${String(v ?? "").replace(/"/g, '""').replace(/^[=+\-@]/, "'$&")}"`).join(","));
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([[head.join(","), ...lines].join("\n")], { type: "text/csv" }));
    a.download = "body-roller-presale.csv"; a.click();
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Lymphatic Body Roller — Member Presale</CardTitle>
          <CardDescription>
            {rows.length} purchases · {usd(totalCents)} in sales before fees ·{" "}
            <a href="/body-roller-presale" target="_blank" className="underline inline-flex items-center gap-1">Open presale page <ExternalLink className="h-3 w-3" /></a>
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap items-end gap-6">
          <div className="space-y-1">
            <Label>Presale ends (last day)</Label>
            <Input type="date" defaultValue={endsDate} key={endsDate}
              onBlur={(e) => e.target.value && e.target.value !== endsDate && saveSettings({ ends_at: `${e.target.value}T23:59:59-05:00` })} />
          </div>
          <div className="flex items-center gap-2">
            <Switch checked={!!data?.settings?.booking_open} onCheckedChange={(v) => saveSettings({ booking_open: v })} />
            <Label>Machine arrived — booking open</Label>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Campaign emails</CardTitle>
          <CardDescription>Nothing sends automatically. Each send skips anyone who already received that email.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center gap-2 max-w-sm">
            <Label className="shrink-0">Test to</Label>
            <Input value={testEmail} onChange={(e) => setTestEmail(e.target.value)} />
          </div>
          {KINDS.map((k) => (
            <div key={k.kind} className="flex flex-wrap items-center justify-between gap-2 border-t pt-3">
              <div>
                <p className="font-medium text-sm">{k.title}</p>
                <p className="text-xs text-muted-foreground">To {k.who} · sent to {data?.sent[KEYS[k.kind]] ?? 0}</p>
                {k.kind.startsWith("nm_") && nmCount && (
                  <p className="text-xs text-muted-foreground">
                    List: {nmCount.total} people ({nmCount.counts.imported} imported · {nmCount.counts.portal_accounts} non-member accounts · {nmCount.counts.other_accounts} other accounts)
                  </p>
                )}
              </div>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={() => preview(k.kind)} disabled={!!busy}>
                  {busy === `p-${k.kind}` ? <Loader2 className="h-4 w-4 animate-spin" /> : <Eye className="h-4 w-4 mr-1" />}Preview
                </Button>
                <Button size="sm" variant="outline" onClick={() => send(k.kind, true)} disabled={!!busy || !testEmail}>
                  {busy === `t-${k.kind}` ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4 mr-1" />}Test
                </Button>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button size="sm" disabled={!!busy}>{busy === `b-${k.kind}` ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4 mr-1" />}Send</Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Send "{k.title}"?</AlertDialogTitle>
                      <AlertDialogDescription>This emails all {k.who}. It may take a minute or two.</AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction onClick={() => send(k.kind, false)}>Send emails</AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle className="text-base">Buyers</CardTitle>
          <Button size="sm" variant="outline" onClick={exportCsv} disabled={!rows.length}><Download className="h-4 w-4 mr-1" />CSV</Button>
        </CardHeader>
        <CardContent>
          {!rows.length ? <p className="text-sm text-muted-foreground">No purchases yet.</p> : (
            <div className="divide-y text-sm">
              {rows.map((r) => (
                <div key={r.id} className="grid grid-cols-4 gap-2 py-2">
                  <span>{r.customer_name ?? r.customer_email}</span>
                  <span>{r.label}</span>
                  <span>{usd(r.total_cents)}</span>
                  <span className="text-muted-foreground">{r.paid_at && new Date(r.paid_at).toLocaleDateString("en-US", { timeZone: "America/Detroit" })}</span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!html} onOpenChange={(o) => !o && setHtml(null)}>
        <DialogContent className="max-w-3xl h-[85vh] flex flex-col p-0">
          <DialogHeader className="p-4 border-b"><DialogTitle>Email preview</DialogTitle></DialogHeader>
          {html && <iframe title="Email preview" srcDoc={html} sandbox="" className="flex-1 w-full bg-background" />}
        </DialogContent>
      </Dialog>
    </div>
  );
}
