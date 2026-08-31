import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PTModal, ptButtonClass } from "@/components/admin/pt/PTUI";
import { usePTTrainers } from "@/hooks/pt/usePTPortal";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated?: (userId: string) => void;
}

export function PTNewClientDialog({ open, onOpenChange, onCreated }: Props) {
  const qc = useQueryClient();
  const { data: trainers = [] } = usePTTrainers();

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [trainerId, setTrainerId] = useState<string>("none");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  const reset = () => {
    setFirstName(""); setLastName(""); setEmail(""); setPhone("");
    setTrainerId("none"); setNotes("");
  };

  const submit = async () => {
    if (!firstName.trim() || !email.trim()) {
      toast.error("First name and email are required");
      return;
    }
    setSaving(true);
    try {
      const { data, error } = await supabase.functions.invoke("admin-create-pt-client", {
        body: {
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          email: email.trim(),
          phone: phone.trim() || null,
          primaryTrainerId: trainerId === "none" ? null : trainerId,
          internalNotes: notes.trim() || null,
        },
      });
      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);

      toast.success(
        data?.existingIdentity
          ? "Existing Storm account added as a training client"
          : "Client created",
      );
      qc.invalidateQueries({ queryKey: ["pt-client-directory"] });
      reset();
      onOpenChange(false);
      if (data?.userId) onCreated?.(data.userId);
    } catch (e) {
      toast.error((e as Error).message || "Could not create client");
    } finally {
      setSaving(false);
    }
  };

  return (
    <PTModal
      open={open}
      onOpenChange={(o) => { if (!saving) onOpenChange(o); }}
      title="Add a training client"
      description="Creates the client record. If the email already belongs to a Storm account, that person is attached instead of duplicated."
      footer={
        <>
          <button className={ptButtonClass("outline")} onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </button>
          <button className={ptButtonClass("primary")} onClick={submit} disabled={saving}>
            {saving ? "Saving…" : "Create client"}
          </button>
        </>
      }
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="pt-new-first">First name *</Label>
          <Input id="pt-new-first" value={firstName} onChange={(e) => setFirstName(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="pt-new-last">Last name</Label>
          <Input id="pt-new-last" value={lastName} onChange={(e) => setLastName(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="pt-new-email">Email *</Label>
          <Input id="pt-new-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="pt-new-phone">Phone</Label>
          <Input id="pt-new-phone" value={phone} onChange={(e) => setPhone(e.target.value)} />
        </div>
        <div className="space-y-1.5 sm:col-span-2">
          <Label>Primary trainer</Label>
          <Select value={trainerId} onValueChange={setTrainerId}>
            <SelectTrigger><SelectValue placeholder="Unassigned" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Unassigned</SelectItem>
              {trainers.map((t: any) => (
                <SelectItem key={t.id} value={t.id}>
                  {t.name ?? [t.first_name, t.last_name].filter(Boolean).join(" ") ?? "Trainer"}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="pt-new-notes">Internal notes</Label>
          <Textarea id="pt-new-notes" rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} />
        </div>
      </div>
    </PTModal>
  );
}
