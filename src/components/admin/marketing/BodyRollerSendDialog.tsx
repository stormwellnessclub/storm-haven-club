import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Loader2, Mail, Download, Clock } from "lucide-react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";

/** "2026-10-20T09:00" typed as Detroit time -> UTC ISO string. */
export function detroitLocalToUtc(local: string): string {
  const asUtc = new Date(`${local}:00Z`).getTime();
  const offsetAt = (t: number) => {
    const p = Object.fromEntries(new Intl.DateTimeFormat("en-US", { timeZone: "America/Detroit", hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" })
      .formatToParts(new Date(t)).map((x) => [x.type, x.value]));
    return Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute) - t;
  };
  let t = asUtc - offsetAt(asUtc);
  t = asUtc - offsetAt(t);
  return new Date(t).toISOString();
}

const FN = "send-body-roller-presale-email";
type Row = { email: string; name: string | null; source: string | null; already_sent: boolean };
const SOURCE: Record<string, string> = {
  imported: "Imported", portal_accounts: "Non-member account", other_accounts: "Website account",
  member: "Member", buyer: "Buyer", added: "Added by you", clicked: "Clicked", abandoned: "Unfinished checkout",
};
const parseEmails = (t: string) => t.split(/[\s,;]+/).map((e) => e.trim().toLowerCase()).filter((e) => e.includes("@"));

/** Send confirmation that shows exactly who will get the email and lets staff add people. */
export function BodyRollerSendDialog({ kind, title, disabled, busy, onSend }: {
  kind: string; title: string; disabled: boolean; busy: boolean; onSend: (extraEmails: string[]) => void;
}) {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [extra, setExtra] = useState("");
  const [showList, setShowList] = useState(false);
  const [when, setWhen] = useState("");
  const [scheduling, setScheduling] = useState(false);
  const qc = useQueryClient();
  const schedule = async () => {
    setScheduling(true);
    const { data, error } = await supabase.functions.invoke(FN, { body: { kind, scheduleAt: detroitLocalToUtc(when), extraEmails: extras } });
    setScheduling(false);
    if (error || !data?.ok) { toast.error(data?.error || error?.message || "Couldn't schedule"); return; }
    toast.success(`Scheduled for ${new Date(data.scheduled.send_at).toLocaleString("en-US", { timeZone: "America/Detroit", dateStyle: "medium", timeStyle: "short" })}`);
    qc.invalidateQueries({ queryKey: ["body-roller-scheduled"] });
    setOpen(false);
  };
  const [open, setOpen] = useState(false);

  const load = async (extraEmails: string[]) => {
    setLoading(true); setError(null);
    const { data, error } = await supabase.functions.invoke(FN, { body: { kind, listOnly: true, extraEmails } });
    if (error || !data?.ok) setError(error?.message || data?.error || "Could not load list");
    else setRows(data.recipients);
    setLoading(false);
  };

  const extras = parseEmails(extra);
  const toSend = (rows ?? []).filter((r) => !r.already_sent);
  const shown = (rows ?? []).filter((r) => !q || r.email.includes(q.toLowerCase()) || (r.name ?? "").toLowerCase().includes(q.toLowerCase()));

  const exportCsv = () => {
    const lines = (rows ?? []).map((r) => [r.name ?? "", r.email, SOURCE[r.source ?? ""] ?? "", r.already_sent ? "Already sent" : "Will send"]
      .map((v) => `"${String(v).replace(/"/g, '""').replace(/^[=+\-@]/, "'$&")}"`).join(","));
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([["Name,Email,Source,Status", ...lines].join("\n")], { type: "text/csv" }));
    a.download = `${kind}-recipients.csv`; a.click();
  };

  return (
    <AlertDialog open={open} onOpenChange={(o) => { setOpen(o); if (o) { setWhen(""); setRows(null); setExtra(""); setQ(""); setShowList(false); load([]); } }}>
      <AlertDialogTrigger asChild>
        <Button size="sm" disabled={disabled}>{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4 mr-1" />}Send</Button>
      </AlertDialogTrigger>
      <AlertDialogContent className="max-w-2xl">
        <AlertDialogHeader>
          <AlertDialogTitle>Send "{title}"?</AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div>
              {loading && !rows ? <span className="inline-flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" />Building the list…</span>
                : error ? <span className="text-destructive">{error}</span>
                : rows && <span><strong className="text-foreground">{toSend.length.toLocaleString()} people</strong> will get this email
                    {rows.length - toSend.length > 0 && ` (${(rows.length - toSend.length).toLocaleString()} already received it and will be skipped)`}.</span>}
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>

        {rows && (
          <div className="space-y-3">
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={() => setShowList((v) => !v)}>{showList ? "Hide list" : "View list"}</Button>
              <Button size="sm" variant="outline" onClick={exportCsv}><Download className="h-4 w-4 mr-1" />Download</Button>
            </div>
            {showList && (
              <div className="space-y-2">
                <Input placeholder="Search name or email" value={q} onChange={(e) => setQ(e.target.value)} />
                <div className="max-h-64 overflow-y-auto border rounded-md divide-y text-sm">
                  {shown.slice(0, 500).map((r) => (
                    <div key={r.email} className="flex items-center justify-between px-3 py-1.5 gap-2">
                      <div className="min-w-0"><p className="truncate">{r.name || r.email}</p>{r.name && <p className="text-xs text-muted-foreground truncate">{r.email}</p>}</div>
                      <div className="flex gap-1 shrink-0">
                        {r.source && <Badge variant="outline" className="text-xs">{SOURCE[r.source] ?? r.source}</Badge>}
                        {r.already_sent && <Badge variant="secondary" className="text-xs">Already sent</Badge>}
                      </div>
                    </div>
                  ))}
                  {shown.length > 500 && <p className="px-3 py-2 text-xs text-muted-foreground">Showing 500 of {shown.length.toLocaleString()} — search or download for the rest.</p>}
                </div>
              </div>
            )}
            <div className="space-y-1">
              <Label>Add more people (emails, separated by commas or new lines)</Label>
              <Textarea rows={3} value={extra} onChange={(e) => setExtra(e.target.value)} placeholder="name@example.com, other@example.com" />
              <div className="flex items-center justify-between">
                <p className="text-xs text-muted-foreground">Blocked or unsubscribed addresses are always left out.</p>
                <Button size="sm" variant="outline" disabled={!extras.length || loading} onClick={() => load(extras)}>
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : `Add ${extras.length || ""} to list`}
                </Button>
              </div>
            </div>
          </div>
        )}

        {rows && (
          <div className="flex flex-wrap items-end gap-2 border-t pt-3">
            <div className="space-y-1">
              <Label>Or send later (Detroit time)</Label>
              <Input type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} className="w-56" />
            </div>
            <Button size="sm" variant="outline" disabled={!when || scheduling} onClick={schedule}>
              {scheduling ? <Loader2 className="h-4 w-4 animate-spin" /> : <Clock className="h-4 w-4 mr-1" />}Schedule
            </Button>
            <p className="text-xs text-muted-foreground w-full">The list is rebuilt at send time, so new sign-ups are included and anyone who already got it is skipped.</p>
          </div>
        )}

        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction disabled={!rows || !toSend.length} onClick={() => onSend(extras)}>
            Send to {toSend.length.toLocaleString()}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
