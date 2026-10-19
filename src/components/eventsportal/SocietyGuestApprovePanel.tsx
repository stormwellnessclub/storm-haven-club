import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

/** Inline approval: confirms the guest's contact details, adds them to the roster and emails host + guest. */
export function SocietyGuestApprovePanel({ hostId, onDone }: { hostId: string; onDone: () => void }) {
  const qc = useQueryClient();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [waiver, setWaiver] = useState(false);

  useEffect(() => {
    supabase.functions.invoke("approve-society-guest", { body: { mode: "lookup", hostId } }).then(({ data }) => {
      if (data?.success) {
        setName(data.name || ""); setEmail(data.email || ""); setPhone(data.phone || ""); setWaiver(!!data.waiverSigned);
      }
      setLoading(false);
    });
  }, [hostId]);

  const approve = async () => {
    setSaving(true);
    const { data, error } = await supabase.functions.invoke("approve-society-guest", {
      body: { mode: "approve", hostId, name, email, phone },
    });
    setSaving(false);
    if (error || !data?.success) return toast.error(data?.error || "Could not approve guest");
    toast.success(`${name} approved and added to the roster${data.guestEmailed ? " · emails sent" : ""}`);
    if (!data.hostEmailed || !data.guestEmailed) toast.warning("One of the emails could not be sent — please follow up directly.");
    qc.invalidateQueries({ queryKey: ["hss-roster"] });
    onDone();
  };

  if (loading) return <p className="text-xs text-muted-foreground">Looking up guest details…</p>;
  return (
    <div className="space-y-2 rounded-md border p-2 bg-muted/30 min-w-[240px]">
      <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Guest name" className="h-8" />
      <Input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Guest email" type="email" className="h-8" />
      <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Guest phone (optional)" className="h-8" />
      <Badge variant={waiver ? "secondary" : "outline"}>{waiver ? "Waiver on file" : "No waiver on file — link will be sent"}</Badge>
      <div className="flex gap-1">
        <Button size="sm" disabled={saving || !name || !email} onClick={approve}>{saving ? "Approving…" : "Confirm & notify"}</Button>
        <Button size="sm" variant="ghost" onClick={onDone}>Cancel</Button>
      </div>
    </div>
  );
}
