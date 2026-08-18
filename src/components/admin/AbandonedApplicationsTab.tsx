import { useState } from "react";
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
} from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { Alert, AlertDescription } from "@/components/ui/alert";

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
        .order("created_at", { ascending: false });

      if (error) throw error;

      // Deduplicate by email — keep only the most recent attempt per person.
      const seenEmails = new Set<string>();
      const deduplicated: AbandonedAttempt[] = [];

      for (const attempt of (data || []) as any[]) {
        const meta = attempt.metadata as AbandonedAttempt["metadata"];
        const email = meta?.applicant_email?.toLowerCase();
        if (!email) continue;
        if (TEST_EMAIL_PATTERN.test(email)) continue;
        if (seenEmails.has(email)) continue;
        seenEmails.add(email);
        deduplicated.push({
          ...attempt,
          metadata: meta,
          reminder_count: attempt.reminder_count ?? 0,
        } as AbandonedAttempt);
      }

      const emails = Array.from(seenEmails);
      if (emails.length === 0) return { cardSaved: [], noCard: [] };

      const [appsRes, membersRes] = await Promise.all([
        supabase.from("membership_applications").select("email, full_name"),
        supabase.from("members").select("email, first_name, last_name"),
      ]);

      const knownEmails = new Set<string>();
      const knownNames = new Map<string, string>();
      for (const row of (appsRes.data || []) as any[]) {
        if (row.email) knownEmails.add(String(row.email).toLowerCase().trim());
        const n = normalizeName(row.full_name);
        if (n) knownNames.set(n, row.email || row.full_name);
      }
      for (const row of (membersRes.data || []) as any[]) {
        if (row.email) knownEmails.add(String(row.email).toLowerCase().trim());
        const n = normalizeName(`${row.first_name || ""}${row.last_name || ""}`);
        if (n) knownNames.set(n, row.email || `${row.first_name} ${row.last_name}`);
      }

      const remaining: AbandonedAttempt[] = [];
      for (const a of deduplicated) {
        const email = a.metadata?.applicant_email?.toLowerCase().trim();
        if (!email || knownEmails.has(email)) continue;
        // Near-miss typo detection: same normalized name already on file.
        const nameKey = normalizeName(a.metadata?.applicant_name);
        remaining.push({
          ...a,
          possibleDuplicateOf: nameKey ? knownNames.get(nameKey) ?? null : null,
        });
      }

      return {
        cardSaved: remaining.filter((a) => a.status === "succeeded"),
        noCard: remaining.filter((a) => a.status !== "succeeded"),
      };
    },
  });

  const cardSaved = grouped?.cardSaved ?? [];
  const noCard = grouped?.noCard ?? [];

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
    const toSend = [...cardSaved, ...noCard].filter((a) => selectedIds.has(a.id));
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

  const handleReconcile = async () => {
    setIsReconciling(true);
    try {
      const { data, error } = await supabase.functions.invoke(
        "reconcile-card-setup-attempts",
        { body: {} },
      );
      if (error) throw error;
      toast.success(
        `Checked ${data?.scanned ?? 0} card setups with Stripe — ${data?.updated ?? 0} corrected`,
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
      ["Name", "Email", "Date started", "Card", "Status", "Reminders"],
      ...rows.map((a) => [
        a.metadata?.applicant_name || "",
        a.metadata?.applicant_email || "",
        format(new Date(a.created_at), "MMM d, yyyy"),
        a.card_brand ? `${a.card_brand} ****${a.card_last4}` : "",
        a.status,
        String(a.reminder_count || 0),
      ]),
    ]);
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
                {attempt.possibleDuplicateOf && (
                  <Badge variant="outline" className="ml-2 text-[10px] text-muted-foreground">
                    Possible duplicate of {attempt.possibleDuplicateOf}
                  </Badge>
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
    submitFailures.length === 0 && cardSaved.length === 0 && noCard.length === 0;

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <p className="text-sm text-muted-foreground">
          {submitFailures.length} failed submit{submitFailures.length !== 1 ? "s" : ""} ·{" "}
          {cardSaved.length} card saved · {noCard.length} never entered a card
        </p>
        <div className="flex items-center gap-2">
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
