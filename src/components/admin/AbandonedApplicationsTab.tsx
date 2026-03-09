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
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2, Send, Mail, Clock, AlertCircle } from "lucide-react";
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
  metadata: {
    applicant_email?: string;
    applicant_name?: string;
  } | null;
}

export function AbandonedApplicationsTab() {
  const queryClient = useQueryClient();
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [sendingId, setSendingId] = useState<string | null>(null);
  const [isBulkSending, setIsBulkSending] = useState(false);

  const { data: abandonedAttempts = [], isLoading } = useQuery({
    queryKey: ["abandoned-applications"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("card_setup_attempts")
        .select("id, stripe_customer_id, status, source, created_at, reminder_sent_at, reminder_count, metadata")
        .is("application_id", null)
        .in("status", ["initiated", "abandoned"])
        .order("created_at", { ascending: false });

      if (error) throw error;

      // Deduplicate by email - keep only the most recent attempt per email
      const seenEmails = new Set<string>();
      const deduplicated: AbandonedAttempt[] = [];
      
      for (const attempt of (data || [])) {
        const meta = attempt.metadata as AbandonedAttempt["metadata"];
        const email = meta?.applicant_email?.toLowerCase();
        if (email && !seenEmails.has(email)) {
          seenEmails.add(email);
          deduplicated.push({
            ...attempt,
            metadata: meta,
            reminder_count: attempt.reminder_count ?? 0,
          } as AbandonedAttempt);
        }
      }

      return deduplicated;
    },
  });

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
    const toSend = abandonedAttempts.filter(a => selectedIds.has(a.id));
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

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedIds(new Set(abandonedAttempts.map(a => a.id)));
    } else {
      setSelectedIds(new Set());
    }
  };

  const handleSelectOne = (id: string, checked: boolean) => {
    const newSet = new Set(selectedIds);
    if (checked) newSet.add(id);
    else newSet.delete(id);
    setSelectedIds(newSet);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-32">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (abandonedAttempts.length === 0) {
    return (
      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>No abandoned applications found.</AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {abandonedAttempts.length} abandoned application{abandonedAttempts.length !== 1 ? "s" : ""} found
        </p>
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

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-10">
              <Checkbox
                checked={selectedIds.size === abandonedAttempts.length && abandonedAttempts.length > 0}
                onCheckedChange={handleSelectAll}
              />
            </TableHead>
            <TableHead>Name</TableHead>
            <TableHead>Email</TableHead>
            <TableHead>Date Started</TableHead>
            <TableHead>Source</TableHead>
            <TableHead>Reminder Status</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {abandonedAttempts.map((attempt) => {
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
                <TableCell className="font-medium">{name}</TableCell>
                <TableCell className="text-muted-foreground">{email}</TableCell>
                <TableCell className="text-muted-foreground">
                  {format(new Date(attempt.created_at), "MMM d, yyyy")}
                </TableCell>
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
    </div>
  );
}
