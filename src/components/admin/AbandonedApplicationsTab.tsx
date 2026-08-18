import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Loader2,
  Send,
  Mail,
  Clock,
  AlertCircle,
  AlertTriangle,
  CreditCard,
  Download,
  RefreshCw,
  Eye,
  HelpCircle,
} from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { Alert, AlertDescription } from "@/components/ui/alert";

type FilterReason = "none" | "already_applied" | "already_member" | "test_email";

interface AbandonedAttempt {
  id: string;
  stripe_customer_id: string;
  status: string;
  source: string;
  created_at: string;
  reminder_sent_at: string | null;
  reminder_count: number | null;
  card_brand?: string | null;
  card_last4?: string | null;
  metadata: {
    applicant_email?: string;
    applicant_name?: string;
  } | null;
  possibleDuplicateOf?: string | null;
  filterReason: FilterReason;
  attemptCount: number;
  attemptDates: string[];
}

interface SubmitFailure {
  id: string;
  created_at: string;
  status: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  phone: string | null;
  error_message: string | null;
  payload: Record<string, unknown> | null;
}

const TEST_EMAIL_PATTERN = /(test@|@example\.com|@test\.com)/i;

const normalizeName = (v?: string | null) =>
  (v || "").toLowerCase().replace(/[^a-z]/g, "");

const REASON_LABEL: Record<FilterReason, string> = {
  none: "",
  already_applied: "Already applied",
  already_member: "Already a member",
  test_email: "Test record",
};

function downloadCsv(filename: string, rows: string[][]) {
  const csv = rows
    .map((r) => r.map((c) => `"${(c ?? "").replace(/"/g, '""')}"`).join(","))
    .join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
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
  const [showFiltered, setShowFiltered] = useState(false);
  const [showIncomplete, setShowIncomplete] = useState(false);
  const [expandedAttempts, setExpandedAttempts] = useState<Set<string>>(new Set());

  // ---- Failed / unresolved submit attempts (the provable group) -------------
  const { data: submitFailures = [], isLoading: loadingFailures } = useQuery({
    queryKey: ["application-submit-failures"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("application_submit_attempts")
        .select(
          "id, created_at, status, first_name, last_name, email, phone, error_message, payload",
        )
        .in("status", ["pending", "failed"])
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;

      // A `pending` row younger than 5 minutes may still be in flight.
      const cutoff = Date.now() - 5 * 60 * 1000;
      return ((data || []) as SubmitFailure[]).filter(
        (r) => r.status === "failed" || new Date(r.created_at).getTime() < cutoff,
      );
    },
  });

  // ---- Card setup attempts, split by real Stripe outcome -------------------
  const { data: grouped, isLoading } = useQuery({
    queryKey: ["abandoned-applications"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("card_setup_attempts")
        .select(
          "id, stripe_customer_id, status, source, created_at, reminder_sent_at, reminder_count, card_brand, card_last4, metadata",
        )
        .is("application_id", null)
        .in("status", ["initiated", "abandoned", "failed", "succeeded"])
        .order("created_at", { ascending: false })
        .limit(2000);

      if (error) throw error;

      const rows = (data || []) as any[];

      // Rows with no identity captured at all — previously dropped silently.
      const incomplete: AbandonedAttempt[] = [];
      // Group by email, newest first (query is already ordered desc).
      const byEmail = new Map<string, any[]>();

      for (const attempt of rows) {
        const meta = attempt.metadata as AbandonedAttempt["metadata"];
        const email = meta?.applicant_email?.toLowerCase().trim();
        if (!email) {
          incomplete.push({
            ...attempt,
            metadata: meta,
            reminder_count: attempt.reminder_count ?? 0,
            filterReason: "none",
            attemptCount: 1,
            attemptDates: [attempt.created_at],
          });
          continue;
        }
        const list = byEmail.get(email);
        if (list) list.push(attempt);
        else byEmail.set(email, [attempt]);
      }

      const [appsRes, membersRes] = await Promise.all([
        supabase.from("membership_applications").select("email, full_name"),
        supabase.from("members").select("email, first_name, last_name"),
      ]);

      const appEmails = new Set<string>();
      const memberEmails = new Set<string>();
      const knownNames = new Map<string, string>();
      for (const row of (appsRes.data || []) as any[]) {
        if (row.email) appEmails.add(String(row.email).toLowerCase().trim());
        const n = normalizeName(row.full_name);
        if (n) knownNames.set(n, row.email || row.full_name);
      }
      for (const row of (membersRes.data || []) as any[]) {
        if (row.email) memberEmails.add(String(row.email).toLowerCase().trim());
        const n = normalizeName(`${row.first_name || ""}${row.last_name || ""}`);
        if (n) knownNames.set(n, row.email || `${row.first_name} ${row.last_name}`);
      }

      const all: AbandonedAttempt[] = [];
      let mergedAttempts = 0;

      for (const [email, list] of byEmail) {
        const newest = list[0];
        mergedAttempts += list.length - 1;
        const meta = newest.metadata as AbandonedAttempt["metadata"];

        let filterReason: FilterReason = "none";
        if (TEST_EMAIL_PATTERN.test(email)) filterReason = "test_email";
        else if (memberEmails.has(email)) filterReason = "already_member";
        else if (appEmails.has(email)) filterReason = "already_applied";

        const nameKey = normalizeName(meta?.applicant_name);
        all.push({
          ...newest,
          metadata: meta,
          reminder_count: newest.reminder_count ?? 0,
          filterReason,
          attemptCount: list.length,
          attemptDates: list.map((a: any) => a.created_at),
          possibleDuplicateOf:
            filterReason === "none" && nameKey ? knownNames.get(nameKey) ?? null : null,
        });
      }

      const visible = all.filter((a) => a.filterReason === "none");

      return {
        cardSaved: visible.filter((a) => a.status === "succeeded"),
        noCard: visible.filter((a) => a.status !== "succeeded"),
        filtered: all.filter((a) => a.filterReason !== "none"),
        incomplete,
        totals: {
          rows: rows.length,
          people: all.length + incomplete.length,
          mergedAttempts,
          alreadyApplied: all.filter((a) => a.filterReason === "already_applied").length,
          alreadyMember: all.filter((a) => a.filterReason === "already_member").length,
          testRows: all.filter((a) => a.filterReason === "test_email").length,
        },
      };
    },
  });

  const cardSaved = grouped?.cardSaved ?? [];
  const noCard = grouped?.noCard ?? [];
  const filtered = grouped?.filtered ?? [];
  const incomplete = useMemo(() => grouped?.incomplete ?? [], [grouped]);
  const totals = grouped?.totals;

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
    const toSend = [...cardSaved, ...noCard, ...filtered].filter((a) => selectedIds.has(a.id));
    if (toSend.length === 0) {
      toast.error("No applications selected");
      return;
    }

    setIsBulkSending(true);
    let successCount = 0;
    let failCount = 0;

    for (const attempt of toSend) {
      const email = attempt.metadata?.applicant_email;
      const name = attempt.metadata?.applicant_name;
      if (!email || !name) {
        failCount++;
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

  const exportGroup = (rows: AbandonedAttempt[], label: string) => {
    if (rows.length === 0) {
      toast.error("Nothing to export");
      return;
    }
    downloadCsv(`${label}-${format(new Date(), "yyyy-MM-dd")}.csv`, [
      [
        "Name",
        "Email",
        "Date started",
        "Card",
        "Status",
        "Attempts",
        "Reminders",
        "Filtered because",
        "Stripe customer",
      ],
      ...rows.map((a) => [
        a.metadata?.applicant_name || "",
        a.metadata?.applicant_email || "",
        format(new Date(a.created_at), "MMM d, yyyy"),
        a.card_brand ? `${a.card_brand} ****${a.card_last4}` : "",
        a.status,
        String(a.attemptCount),
        String(a.reminder_count || 0),
        REASON_LABEL[a.filterReason],
        a.stripe_customer_id || "",
      ]),
    ]);
  };

  const exportEverythingShown = () => {
    const rows = [
      ...cardSaved,
      ...noCard,
      ...(showFiltered ? filtered : []),
      ...(showIncomplete ? incomplete : []),
    ];
    exportGroup(rows, "abandoned-applications-visible");
  };

  const exportFailures = () => {
    if (submitFailures.length === 0) {
      toast.error("Nothing to export");
      return;
    }
    downloadCsv(`failed-submits-${format(new Date(), "yyyy-MM-dd")}.csv`, [
      ["Name", "Email", "Phone", "Attempted", "Status", "Error"],
      ...submitFailures.map((f) => [
        `${f.first_name || ""} ${f.last_name || ""}`.trim(),
        f.email || "",
        f.phone || "",
        format(new Date(f.created_at), "MMM d, yyyy h:mm a"),
        f.status,
        f.error_message || "",
      ]),
    ]);
  };

  const renderAttemptTable = (rows: AbandonedAttempt[], showCard: boolean) => (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="w-10" />
          <TableHead>Name</TableHead>
          <TableHead>Email</TableHead>
          <TableHead>Date Started</TableHead>
          {showCard && <TableHead>Card</TableHead>}
          <TableHead>Source</TableHead>
          <TableHead>Reminder Status</TableHead>
          <TableHead className="text-right">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((attempt) => {
          const name = attempt.metadata?.applicant_name || "Unknown";
          const email = attempt.metadata?.applicant_email || "Unknown";
          const reminderCount = attempt.reminder_count || 0;
          const expanded = expandedAttempts.has(attempt.id);

          return (
            <TableRow key={attempt.id}>
              <TableCell>
                <Checkbox
                  checked={selectedIds.has(attempt.id)}
                  onCheckedChange={(checked) => handleSelectOne(attempt.id, !!checked)}
                />
              </TableCell>
              <TableCell className="font-medium">
                {name}
                {attempt.filterReason !== "none" && (
                  <Badge variant="secondary" className="ml-2 text-[10px]">
                    {REASON_LABEL[attempt.filterReason]}
                  </Badge>
                )}
                {attempt.possibleDuplicateOf && (
                  <Badge variant="outline" className="ml-2 text-[10px] text-muted-foreground">
                    Possible duplicate of {attempt.possibleDuplicateOf}
                  </Badge>
                )}
                {attempt.attemptCount > 1 && (
                  <button
                    type="button"
                    onClick={() => toggleAttempts(attempt.id)}
                    className="ml-2 text-[10px] underline text-muted-foreground"
                  >
                    {attempt.attemptCount} attempts
                  </button>
                )}
                {expanded && (
                  <div className="mt-1 text-[10px] text-muted-foreground space-y-0.5">
                    {attempt.attemptDates.map((d) => (
                      <div key={d}>{format(new Date(d), "MMM d, yyyy h:mm a")}</div>
                    ))}
                  </div>
                )}
              </TableCell>
              <TableCell className="text-muted-foreground">{email}</TableCell>
              <TableCell className="text-muted-foreground">
                {format(new Date(attempt.created_at), "MMM d, yyyy")}
              </TableCell>
              {showCard && (
                <TableCell className="text-muted-foreground text-sm">
                  {attempt.card_brand
                    ? `${attempt.card_brand} ****${attempt.card_last4}`
                    : "On file"}
                </TableCell>
              )}
              <TableCell>
                <Badge variant="outline" className="text-xs">
                  {attempt.source === "self_service" ? "Self-Service" : attempt.source}
                </Badge>
              </TableCell>
              <TableCell>
                {reminderCount > 0 ? (
                  <Badge className="bg-accent/20 text-accent-foreground">
                    <Mail className="h-3 w-3 mr-1" />
                    Sent ({reminderCount})
                  </Badge>
                ) : (
                  <Badge variant="outline" className="text-muted-foreground">
                    <Clock className="h-3 w-3 mr-1" />
                    Not sent
                  </Badge>
                )}
              </TableCell>
              <TableCell className="text-right">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleSendReminder(attempt)}
                  disabled={sendingId === attempt.id}
                >
                  {sendingId === attempt.id ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <>
                      <Send className="h-4 w-4 mr-1" />
                      Send Reminder
                    </>
                  )}
                </Button>
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );

  if (isLoading || loadingFailures) {
    return (
      <div className="flex items-center justify-center h-32">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const nothing =
    submitFailures.length === 0 &&
    cardSaved.length === 0 &&
    noCard.length === 0 &&
    filtered.length === 0 &&
    incomplete.length === 0;

  return (
    <div className="space-y-8">
      <div className="flex items-start justify-between gap-2 flex-wrap">
        <div className="space-y-1">
          <p className="text-sm text-muted-foreground">
            {submitFailures.length} failed submit{submitFailures.length !== 1 ? "s" : ""} ·{" "}
            {cardSaved.length} card saved · {noCard.length} never entered a card
          </p>
          {totals && (
            <p className="text-xs text-muted-foreground">
              {totals.rows} card-setup attempts total ·{" "}
              {totals.mergedAttempts > 0
                ? `${totals.mergedAttempts} merged as repeat attempts`
                : "no repeat attempts"}{" "}
              ·{" "}
              <button
                type="button"
                className="underline"
                onClick={() => setShowFiltered((v) => !v)}
              >
                {totals.alreadyApplied + totals.alreadyMember + totals.testRows} hidden (
                {totals.alreadyApplied} already applied, {totals.alreadyMember} already members,{" "}
                {totals.testRows} test)
              </button>{" "}
              ·{" "}
              <button
                type="button"
                className="underline"
                onClick={() => setShowIncomplete((v) => !v)}
              >
                {incomplete.length} with no email captured
              </button>
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={exportEverythingShown}>
            <Download className="h-4 w-4 mr-2" />
            Export what's shown
          </Button>
          <Button size="sm" variant="outline" onClick={handleReconcile} disabled={isReconciling}>
            {isReconciling ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4 mr-2" />
            )}
            Re-check with Stripe
          </Button>
          {selectedIds.size > 0 && (
            <Button size="sm" onClick={handleBulkSend} disabled={isBulkSending}>
              {isBulkSending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Send className="h-4 w-4 mr-2" />
              )}
              Send Reminders ({selectedIds.size})
            </Button>
          )}
        </div>
      </div>

      {nothing && (
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>No abandoned applications found.</AlertDescription>
        </Alert>
      )}

      {/* 1. Failed submits */}
      {submitFailures.length > 0 && (
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-semibold flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-destructive" />
                Failed submits ({submitFailures.length})
              </h3>
              <p className="text-sm text-muted-foreground">
                These people pressed Submit and it did not go through. Their answers are saved
                below — you can re-create the application by hand.
              </p>
            </div>
            <Button size="sm" variant="outline" onClick={exportFailures}>
              <Download className="h-4 w-4 mr-2" />
              Export CSV
            </Button>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead>Attempted</TableHead>
                <TableHead>Reason</TableHead>
                <TableHead className="text-right">Answers</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {submitFailures.map((f) => (
                <TableRow key={f.id}>
                  <TableCell className="font-medium">
                    {`${f.first_name || ""} ${f.last_name || ""}`.trim() || "Unknown"}
                  </TableCell>
                  <TableCell className="text-muted-foreground">{f.email || "—"}</TableCell>
                  <TableCell className="text-muted-foreground">{f.phone || "—"}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {format(new Date(f.created_at), "MMM d, yyyy h:mm a")}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground max-w-[280px] truncate">
                    {f.error_message ||
                      (f.status === "pending" ? "Never completed — connection lost" : "Unknown")}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button size="sm" variant="outline" onClick={() => setPayloadView(f)}>
                      <Eye className="h-4 w-4 mr-1" />
                      View
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </section>
      )}

      {/* 2. Card saved, never submitted */}
      {cardSaved.length > 0 && (
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-semibold flex items-center gap-2">
                <CreditCard className="h-4 w-4 text-primary" />
                Card saved, never submitted ({cardSaved.length})
              </h3>
              <p className="text-sm text-muted-foreground">
                Verified against Stripe. High intent — they added a card and stopped at the
                acknowledgments.
              </p>
            </div>
            <Button size="sm" variant="outline" onClick={() => exportGroup(cardSaved, "card-saved")}>
              <Download className="h-4 w-4 mr-2" />
              Export CSV
            </Button>
          </div>
          {renderAttemptTable(cardSaved, true)}
        </section>
      )}

      {/* 3. Never entered a card */}
      {noCard.length > 0 && (
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-semibold">Never entered a card ({noCard.length})</h3>
              <p className="text-sm text-muted-foreground">
                Opened the card step and left without completing it.
              </p>
            </div>
            <Button size="sm" variant="outline" onClick={() => exportGroup(noCard, "no-card")}>
              <Download className="h-4 w-4 mr-2" />
              Export CSV
            </Button>
          </div>
          {renderAttemptTable(noCard, false)}
        </section>
      )}

      {/* 4. Hidden: already applied / already a member / test rows */}
      {showFiltered && filtered.length > 0 && (
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-semibold">
                Already on file ({filtered.length})
              </h3>
              <p className="text-sm text-muted-foreground">
                These attempts match an existing application or member record, so they are not
                leads — shown here so nothing is invisible.
              </p>
            </div>
            <Button size="sm" variant="outline" onClick={() => exportGroup(filtered, "already-on-file")}>
              <Download className="h-4 w-4 mr-2" />
              Export CSV
            </Button>
          </div>
          {renderAttemptTable(filtered, true)}
        </section>
      )}

      {/* 5. Incomplete records — no email captured on the attempt */}
      {showIncomplete && incomplete.length > 0 && (
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-semibold flex items-center gap-2">
                <HelpCircle className="h-4 w-4 text-muted-foreground" />
                Incomplete record ({incomplete.length})
              </h3>
              <p className="text-sm text-muted-foreground">
                No name or email was captured on these attempts. Use "Re-check with Stripe" to pull
                the identity from the Stripe customer, or look the customer up directly.
              </p>
            </div>
            <Button size="sm" variant="outline" onClick={() => exportGroup(incomplete, "incomplete-records")}>
              <Download className="h-4 w-4 mr-2" />
              Export CSV
            </Button>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Stripe customer</TableHead>
                <TableHead>Card</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Source</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {incomplete.map((a) => (
                <TableRow key={a.id}>
                  <TableCell className="text-muted-foreground">
                    {format(new Date(a.created_at), "MMM d, yyyy")}
                  </TableCell>
                  <TableCell className="font-mono text-xs">
                    {a.stripe_customer_id || "—"}
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {a.card_brand ? `${a.card_brand} ****${a.card_last4}` : "—"}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="text-xs">
                      {a.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground text-xs">{a.source}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </section>
      )}

      <Dialog open={!!payloadView} onOpenChange={(o) => !o && setPayloadView(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {`${payloadView?.first_name || ""} ${payloadView?.last_name || ""}`.trim() ||
                "Submitted answers"}
            </DialogTitle>
            <DialogDescription>
              Captured at submit time. Use this to re-create the application manually.
            </DialogDescription>
          </DialogHeader>
          <pre className="max-h-[60vh] overflow-auto rounded-md bg-muted p-4 text-xs">
            {JSON.stringify(payloadView?.payload ?? {}, null, 2)}
          </pre>
        </DialogContent>
      </Dialog>
    </div>
  );
}
