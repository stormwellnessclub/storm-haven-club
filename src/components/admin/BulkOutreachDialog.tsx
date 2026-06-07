import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import type { ArrearsRow } from "@/hooks/useBillingArrears";

const CHANNELS = [
  { value: "call", label: "Call" },
  { value: "sms", label: "SMS" },
  { value: "email", label: "Email" },
  { value: "in_person", label: "In person" },
  { value: "other", label: "Other" },
];

const OUTCOMES = [
  { value: "left_message", label: "Left message" },
  { value: "reached_member", label: "Reached member" },
  { value: "payment_promised", label: "Payment promised" },
  { value: "card_update_requested", label: "Card update requested" },
  { value: "no_response", label: "No response" },
  { value: "other", label: "Other" },
];

interface Props {
  open: boolean;
  onOpenChange: (b: boolean) => void;
  targets: ArrearsRow[];
}

export function BulkOutreachDialog({ open, onOpenChange, targets }: Props) {
  const qc = useQueryClient();
  const [channel, setChannel] = useState("call");
  const [outcome, setOutcome] = useState("left_message");
  const [note, setNote] = useState("");
  const [followUp, setFollowUp] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setChannel("call");
      setOutcome("left_message");
      setNote("");
      setFollowUp("");
      setSaving(false);
    }
  }, [open]);

  const submit = async () => {
    if (targets.length === 0) return;
    setSaving(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      const payload = targets.map((t) => ({
        member_id: t.member_id,
        channel,
        outcome,
        note: note || null,
        follow_up_at: followUp ? new Date(followUp).toISOString() : null,
        outstanding_at_contact_cents: t.outstanding_cents,
        months_behind_at_contact: t.months_behind,
        created_by: userData?.user?.id ?? null,
        created_by_email: userData?.user?.email ?? null,
      }));
      const { error } = await supabase.from("billing_outreach_logs" as any).insert(payload as any);
      if (error) throw error;
      toast.success(`Logged outreach for ${targets.length} member${targets.length === 1 ? "" : "s"}`);
      qc.invalidateQueries({ queryKey: ["billing-arrears-summary"] });
      qc.invalidateQueries({ queryKey: ["member-outreach"] });
      qc.invalidateQueries({ queryKey: ["dunning-timeline"] });
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e?.message || "Failed to log outreach");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Log outreach for {targets.length} member{targets.length === 1 ? "" : "s"}</DialogTitle>
          <DialogDescription>
            One outreach record will be created per selected member with the same channel, outcome, and note.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Channel</Label>
              <Select value={channel} onValueChange={setChannel}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CHANNELS.map((c) => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Outcome</Label>
              <Select value={outcome} onValueChange={setOutcome}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {OUTCOMES.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <Label>Note</Label>
            <Textarea value={note} onChange={(e) => setNote(e.target.value)} rows={3} placeholder="Optional shared note for all selected members" />
          </div>
          <div>
            <Label>Follow-up date (optional)</Label>
            <Input type="date" value={followUp} onChange={(e) => setFollowUp(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancel</Button>
          <Button onClick={submit} disabled={saving || targets.length === 0}>
            {saving ? "Saving…" : `Log for ${targets.length}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
