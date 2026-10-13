import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { SMS_TEMPLATES } from "@/lib/smsTemplates";
import { toast } from "sonner";

const KEYS = ["class-booking-confirmation", "class-reminder-24h", "class-reminder-2h", "waitlist-joined", "waitlist-promoted", "class-booking-cancellation", "class-cancelled"];
const fill = (s: string, v: Record<string, string>) => s.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, k) => v[k] ?? "");

/** Custom class texts per class type. Falls back to the standard wording when none is set. */
export function ClassSmsWording() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [typeId, setTypeId] = useState("");
  const [key, setKey] = useState(KEYS[0]);
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);

  const { data: types = [] } = useQuery({
    queryKey: ["class-types-min"],
    queryFn: async () => (await supabase.from("class_types").select("id, name").order("name")).data ?? [],
  });
  const { data: overrides = [] } = useQuery({
    queryKey: ["class-sms-overrides"],
    queryFn: async () => (await (supabase.from as any)("sms_class_template_overrides").select("*")).data ?? [],
  });
  const tpl = SMS_TEMPLATES.find((t) => t.key === key);
  const current = overrides.find((o: any) => o.class_type_id === typeId && o.template_key === key);
  const typeName = types.find((t: any) => t.id === typeId)?.name ?? "Reformer Pilates";
  const sample = { ...(tpl?.sampleVariables ?? {}), className: typeName };

  useEffect(() => { setBody(current?.body ?? tpl?.body ?? ""); }, [current?.id, key, typeId, tpl?.body]);

  const save = async () => {
    if (!typeId) return toast.error("Pick a class type.");
    if (!body.trim().startsWith("Storm Wellness Club")) return toast.error('Start the text with "Storm Wellness Club".');
    setBusy(true);
    const { error } = await (supabase.from as any)("sms_class_template_overrides").upsert(
      { template_key: key, class_type_id: typeId, body: body.trim(), is_active: true, updated_by: user?.id, updated_at: new Date().toISOString() },
      { onConflict: "template_key,class_type_id" });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Saved. New texts for this class will use it.");
    qc.invalidateQueries({ queryKey: ["class-sms-overrides"] });
  };
  const reset = async () => {
    if (!current) return;
    await (supabase.from as any)("sms_class_template_overrides").delete().eq("id", current.id);
    toast.success("Back to the standard wording.");
    qc.invalidateQueries({ queryKey: ["class-sms-overrides"] });
  };
  const test = async () => {
    if (!user) return;
    await save();
    const { data, error } = await supabase.functions.invoke("send-sms", {
      body: { to: { userId: user.id }, templateKey: key, variables: sample, idempotencyKey: `class-wording-test-${key}-${Date.now()}`, metadata: { source: "class_wording_test" } },
    });
    if (error || (data as any)?.success === false) toast.error((data as any)?.error || error?.message || "Test failed (is your own number opted in?)");
    else toast.success("Test sent to your phone.");
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Class texts by class type</CardTitle>
        <CardDescription>Give a class its own confirmation, reminder or waitlist text. Classes without one use the standard wording below.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid sm:grid-cols-2 gap-2">
          <div><Label className="text-xs">Class type</Label>
            <Select value={typeId} onValueChange={setTypeId}><SelectTrigger><SelectValue placeholder="Pick a class" /></SelectTrigger>
              <SelectContent>{types.map((t: any) => <SelectItem key={t.id} value={t.id}>{t.name}{overrides.some((o: any) => o.class_type_id === t.id) ? " •" : ""}</SelectItem>)}</SelectContent></Select></div>
          <div><Label className="text-xs">Text</Label>
            <Select value={key} onValueChange={setKey}><SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{KEYS.map((k) => <SelectItem key={k} value={k}>{SMS_TEMPLATES.find((t) => t.key === k)?.label ?? k}</SelectItem>)}</SelectContent></Select></div>
        </div>
        {current ? <Badge>Custom wording in use</Badge> : <Badge variant="outline">Standard wording</Badge>}
        <Textarea rows={4} maxLength={480} value={body} onChange={(e) => setBody(e.target.value)} />
        <p className="text-xs text-muted-foreground">Fill-ins: {Object.keys(tpl?.sampleVariables ?? {}).map((k) => `{{${k}}}`).join(" ")}</p>
        <div className="rounded-2xl bg-muted p-3 max-w-xs"><div className="text-[10px] text-muted-foreground mb-1">Preview</div>
          <div className="rounded-2xl bg-background px-3 py-2 text-sm">{fill(body, sample)}</div></div>
        <div className="flex gap-2">
          <Button onClick={save} disabled={busy || !typeId}>Save</Button>
          <Button variant="outline" onClick={test} disabled={busy || !typeId}>Send test to my phone</Button>
          {current && <Button variant="ghost" onClick={reset}>Use standard wording</Button>}
        </div>
      </CardContent>
    </Card>
  );
}
