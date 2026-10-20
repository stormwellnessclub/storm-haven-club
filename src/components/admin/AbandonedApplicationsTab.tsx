import { useMemo, useState } from "react";
import { neutralizeCsvFormula } from "@/lib/csvSafe";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2, Send, Download, RefreshCw, Eye, Search } from "lucide-react";
import { toast } from "sonner";
import { formatInTimeZone } from "date-fns-tz";
import { useAbandonedApplications, type AbandonedAttempt } from "@/hooks/useAbandonedApplications";
import { applicationRoster, filterApplicationRoster, type RosterFilter, type SubmitFailure } from "@/lib/abandonedApplicationRoster";

const CLUB_TZ = "America/Detroit";
const dateLabel = (iso: string) => formatInTimeZone(new Date(iso), CLUB_TZ, "MMM d, yyyy h:mm a");
const FILTERS: { key: RosterFilter; label: string }[] = [
  { key: "unfinished", label: "All abandoned leads" },
  { key: "week", label: "Started this week" },
  { key: "month", label: "Started this month" },
  { key: "card", label: "Card saved" },
  { key: "no_card", label: "No card" },
  { key: "failed", label: "Failed submits" },
  { key: "history", label: "All history" },
];

function downloadCsv(filename: string, rows: string[][]) {
  const csv = rows.map(r => r.map(c => `"${neutralizeCsvFormula(c ?? "").replace(/"/g, '""')}"`).join(",")).join("\n");
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8;" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function AbandonedApplicationsTab() {
  const queryClient = useQueryClient();
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [sendingId, setSendingId] = useState<string | null>(null);
  const [isBulkSending, setIsBulkSending] = useState(false);
  const [isReconciling, setIsReconciling] = useState(false);
  const [payloadView, setPayloadView] = useState<SubmitFailure | null>(null);
  const [expandedAttempts, setExpandedAttempts] = useState<Set<string>>(new Set());
  const [filter, setFilter] = useState<RosterFilter>("unfinished");
  const [search, setSearch] = useState("");
  const { data: submitFailures = [], isLoading: loadingFailures, error: failuresError } = useQuery({
    queryKey: ["application-submit-failures"],
    queryFn: async () => {
      const all: SubmitFailure[] = [];
      for (let offset = 0; ; offset += 500) {
        const { data, error } = await supabase.from("application_submit_attempts")
          .select("id, created_at, status, first_name, last_name, email, phone, error_message, payload")
          .in("status", ["pending", "failed"]).order("created_at", { ascending: false }).order("id").range(offset, offset + 499);
        if (error) throw error;
        const page = (data || []) as unknown as SubmitFailure[];
        all.push(...page);
        if (page.length < 500) break;
      }
      const cutoff = Date.now() - 5 * 60 * 1000;
      return all.filter(r => r.status === "failed" || new Date(r.created_at).getTime() < cutoff);
    },
  });
  const { data: grouped, isLoading, error: attemptsError } = useAbandonedApplications();
  const cardSaved = grouped?.cardSaved ?? [];
  const noCard = grouped?.noCard ?? [];
  const roster = useMemo(() => applicationRoster(grouped, submitFailures), [grouped, submitFailures]);
  const visible = filterApplicationRoster(roster, filter, search);
  const selectable = visible.filter(r => r.unfinished && r.attempt?.filterReason === "none" && r.email && r.attempt.metadata?.applicant_name);
  const exportVisible = () => downloadCsv(`abandoned-applications-${filter}.csv`, [
    ["Name", "Email", "Phone", "Started (Michigan time)", "Stage", "Card", "Attempts", "Reminders", "Last reminder (Michigan time)", "Error", "Stripe customer"],
    ...visible.map(r => [r.name, r.email, r.phone, dateLabel(r.createdAt), r.stage, r.attempt?.card_last4 ? `${r.attempt.card_brand || "Card"} ****${r.attempt.card_last4}` : "", String(r.dates.length), String(r.attempt?.reminder_count || 0), r.attempt?.reminder_sent_at ? dateLabel(r.attempt.reminder_sent_at) : "", r.failure?.error_message || "", r.attempt?.stripe_customer_id || ""]),
  ]);
  const sendReminderMutation = useMutation({
    mutationFn: async ({ id, email, name }: { id: string; email: string; name: string }) => {
      const { data, error } = await supabase.functions.invoke("send-application-reminder", {
        body: { email, name, cardSetupAttemptId: id },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["abandoned-applications"] });
    },
  });

  const handleSendReminder = async (attempt: AbandonedAttempt) => {
    const email = attempt.metadata?.applicant_email;
    const name = attempt.metadata?.applicant_name;
    if (!email || !name) {
      toast.error("Missing email or name for this attempt");
      return;
    }

    setSendingId(attempt.id);
    try {
      await sendReminderMutation.mutateAsync({ id: attempt.id, email, name });
      toast.success(`Reminder sent to ${email}`);
    } catch (err: any) {
      toast.error(err.message || "Failed to send reminder");
    } finally {
      setSendingId(null);
    }
  };

  const handleBulkSend = async () => {
    // Only genuinely unfinished people are ever selectable or sendable.
    const toSend = [...cardSaved, ...noCard].filter((a) => selectedIds.has(a.id));

    if (toSend.length === 0) {
      toast.error("No applications selected");
      return;
    }

    setIsBulkSending(true);
    let successCount = 0;
    let failCount = 0;
    let skippedCount = 0;

    // Re-check right before sending: nobody who has since become a member or
    // completed an application can be emailed a "finish your application" note.
    const emails = toSend
      .map((a) => a.metadata?.applicant_email?.toLowerCase().trim())
      .filter((e): e is string => !!e);
    const excluded = new Set<string>();
    if (emails.length > 0) {
      const [memberRows, appRows] = await Promise.all([
        supabase.from("members").select("email").in("email", emails),
        supabase.from("membership_applications").select("email").in("email", emails),
      ]);
      for (const r of [...(memberRows.data || []), ...(appRows.data || [])] as any[]) {
        if (r.email) excluded.add(String(r.email).toLowerCase().trim());
      }
    }

    for (const attempt of toSend) {
      const email = attempt.metadata?.applicant_email;
      const name = attempt.metadata?.applicant_name;
      if (!email || !name) {
        failCount++;
        continue;
      }
      if (excluded.has(email.toLowerCase().trim())) {
        skippedCount++;
        continue;
      }

      try {
        await sendReminderMutation.mutateAsync({ id: attempt.id, email, name });
        successCount++;
      } catch {
        failCount++;
      }
    }

    if (successCount > 0) toast.success(`Sent ${successCount} reminder(s)`);
    if (skippedCount > 0)
      toast.info(`Skipped ${skippedCount} — already a member or already applied`);
    if (failCount > 0) toast.error(`Failed to send ${failCount} reminder(s)`);

    setSelectedIds(new Set());
    setIsBulkSending(false);
  };

  const handleSelectOne = (id: string, checked: boolean) => {
    const newSet = new Set(selectedIds);
    if (checked) newSet.add(id);
    else newSet.delete(id);
    setSelectedIds(newSet);
  };

  const toggleAttempts = (id: string) => {
    const next = new Set(expandedAttempts);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setExpandedAttempts(next);
  };

  const handleReconcile = async () => {
    setIsReconciling(true);
    try {
      const { data, error } = await supabase.functions.invoke(
        "reconcile-card-setup-attempts",
        { body: {} },
      );
      if (error) throw error;
      toast.success(
        `Checked ${data?.scanned ?? 0} card setups with Stripe — ${data?.updated ?? 0} corrected, ${
          data?.identitiesFilled ?? 0
        } names recovered`,
      );
      queryClient.invalidateQueries({ queryKey: ["abandoned-applications"] });
    } catch (err: any) {
      toast.error(err.message || "Failed to re-check with Stripe");
    } finally {
      setIsReconciling(false);
    }
  };


  if (isLoading || loadingFailures) return <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  if (attemptsError || failuresError) return <div role="alert" className="text-destructive">Could not load applications. <Button variant="outline" onClick={() => { queryClient.invalidateQueries({ queryKey: ["abandoned-applications"] }); queryClient.invalidateQueries({ queryKey: ["application-submit-failures"] }); }}>Try again</Button></div>;

  return <div className="space-y-4">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <h2 className="text-lg font-semibold">Abandoned applications</h2>
        <p className="text-xs text-muted-foreground">{roster.length} total records · Latest activity: {roster[0] ? dateLabel(roster[0].createdAt) : "—"}</p>
        <p className="text-xs text-muted-foreground">{grouped?.totals.memberCardUpdates ?? 0} member card updates excluded</p>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant="outline" onClick={exportVisible} disabled={!visible.length}><Download className="mr-2 h-4 w-4" />Export list</Button>
        <Button size="sm" variant="outline" onClick={handleReconcile} disabled={isReconciling}><RefreshCw className={`mr-2 h-4 w-4 ${isReconciling ? "animate-spin" : ""}`} />Re-check with Stripe</Button>
        {selectedIds.size > 0 && <Button size="sm" onClick={handleBulkSend} disabled={isBulkSending}><Send className="mr-2 h-4 w-4" />Send reminders ({selectedIds.size})</Button>}
      </div>
    </div>
    <div className="flex flex-wrap gap-2" role="group" aria-label="Application filters">
      {FILTERS.map(f => <Button key={f.key} size="sm" variant={filter === f.key ? "default" : "outline"} aria-pressed={filter === f.key} onClick={() => { setFilter(f.key); setSelectedIds(new Set()); }}>{f.label} <span className="ml-2 tabular-nums">{filterApplicationRoster(roster, f.key).length}</span></Button>)}
    </div>
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="relative w-full sm:max-w-sm"><Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" /><Input aria-label="Search abandoned applications" placeholder="Search name, email or phone" className="pl-9" value={search} onChange={e => { setSearch(e.target.value); setSelectedIds(new Set()); }} /></div>
      <span className="text-sm text-muted-foreground">{visible.length} {visible.length === 1 ? "person" : "people"} shown</span>
    </div>
    <Table>
      <TableHeader><TableRow>
        <TableHead className="w-10"><Checkbox aria-label="Select visible reminder recipients" disabled={!selectable.length} checked={selectable.length > 0 && selectable.every(r => selectedIds.has(r.id))} onCheckedChange={checked => setSelectedIds(checked ? new Set(selectable.map(r => r.id)) : new Set())} /></TableHead>
        <TableHead>Applicant</TableHead><TableHead>Started · Michigan time</TableHead><TableHead>Stage / Card</TableHead><TableHead>Reminders</TableHead><TableHead className="text-right">Actions</TableHead>
      </TableRow></TableHeader>
      <TableBody>
        {!visible.length && <TableRow><TableCell colSpan={6} className="py-10 text-center text-muted-foreground">{search ? "No matching applications." : filter === "unfinished" ? "No unfinished applications recorded." : "No applications in this view."}</TableCell></TableRow>}
        {visible.map(r => <TableRow key={r.id}>
          <TableCell>{selectable.some(s => s.id === r.id) && <Checkbox aria-label={`Select ${r.name}`} checked={selectedIds.has(r.id)} onCheckedChange={checked => handleSelectOne(r.id, !!checked)} />}</TableCell>
          <TableCell className="min-w-[200px] max-w-[320px]">
            <div className="font-medium break-words">{r.name}</div><div className="text-xs text-muted-foreground break-all">{r.email || "No email captured"}</div>{r.phone && <div className="text-xs text-muted-foreground">{r.phone}</div>}
            {r.attempt?.possibleDuplicateOf && <div className="text-xs text-muted-foreground break-all">Possible duplicate: {r.attempt.possibleDuplicateOf}</div>}
          </TableCell>
          <TableCell className="min-w-[175px]"><div className="text-xs">{dateLabel(r.createdAt)}</div>{r.dates.length > 1 && <Button size="sm" variant="link" className="h-auto px-0 text-xs" onClick={() => toggleAttempts(r.id)}>{r.dates.length} attempts</Button>}{expandedAttempts.has(r.id) && <div className="space-y-1 text-xs text-muted-foreground">{r.dates.map(d => <div key={d}>{dateLabel(d)}</div>)}</div>}</TableCell>
          <TableCell className="min-w-[165px]"><Badge variant={r.unfinished ? "outline" : "secondary"}>{r.stage}</Badge>{r.attempt?.card_last4 && <div className="mt-1 text-xs text-muted-foreground">{r.attempt.card_brand} ****{r.attempt.card_last4}</div>}{r.attempt?.resolvedAt && <div className="mt-1 text-xs text-muted-foreground">On file: {dateLabel(r.attempt.resolvedAt)}</div>}{!r.email && <div className="mt-1 text-xs text-muted-foreground">{r.attempt?.stripe_customer_id}</div>}{r.failure?.error_message && <div className="mt-1 max-w-[240px] break-words text-xs text-destructive">{r.failure.error_message}</div>}</TableCell>
          <TableCell className="min-w-[140px]"><span className="text-xs">{r.attempt?.reminder_count ? `${r.attempt.reminder_count} sent` : "Not sent"}</span>{r.attempt?.reminder_sent_at && <div className="text-xs text-muted-foreground">{dateLabel(r.attempt.reminder_sent_at)}</div>}</TableCell>
          <TableCell><div className="flex justify-end gap-2">{r.failure && <Button size="sm" variant="outline" onClick={() => setPayloadView(r.failure ?? null)}><Eye className="mr-1 h-4 w-4" />Answers</Button>}{selectable.some(s => s.id === r.id) && r.attempt && <Button size="sm" variant="outline" disabled={sendingId === r.id || isBulkSending} onClick={() => { if (r.attempt) handleSendReminder(r.attempt); }}>{sendingId === r.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Send className="mr-1 h-4 w-4" />Remind</>}</Button>}</div></TableCell>
        </TableRow>)}
      </TableBody>
    </Table>
    {payloadView && <section className="border-t pt-4 space-y-3"><div className="flex items-center justify-between gap-3"><h3 className="font-semibold">Submitted answers · {payloadView.email}</h3><Button variant="outline" size="sm" onClick={() => setPayloadView(null)}>Close</Button></div><pre className="max-h-[60vh] overflow-auto rounded-md bg-muted p-4 text-xs">{JSON.stringify(payloadView.payload ?? {}, null, 2)}</pre></section>}
  </div>;
}
