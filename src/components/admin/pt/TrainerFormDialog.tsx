import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

export interface TrainerFormValues {
  id?: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  bio: string;
  photo_url: string;
  specialties: string;
  is_public_pt: boolean;
  is_master: boolean;
  pay_type: "per_class" | "hourly" | "mixed";
  default_per_class_rate: string;
  hourly_rate: string;
}

const EMPTY: TrainerFormValues = {
  first_name: "", last_name: "", email: "", phone: "", bio: "", photo_url: "",
  specialties: "", is_public_pt: false, is_master: false,
  pay_type: "hourly", default_per_class_rate: "0", hourly_rate: "0",
};

export function TrainerFormDialog({
  open, onOpenChange, initial,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  initial?: Partial<TrainerFormValues> | null;
}) {
  const qc = useQueryClient();
  const [v, setV] = useState<TrainerFormValues>(EMPTY);
  const [saving, setSaving] = useState(false);
  const editing = !!initial?.id;

  useEffect(() => {
    if (open) setV({ ...EMPTY, ...(initial ?? {}) } as TrainerFormValues);
  }, [open, initial]);

  function set<K extends keyof TrainerFormValues>(k: K, val: TrainerFormValues[K]) {
    setV((p) => ({ ...p, [k]: val }));
  }

  async function save() {
    if (!v.first_name.trim() || !v.last_name.trim()) return toast.error("First and last name are required");
    if (!v.email.trim()) return toast.error("Email is required");
    setSaving(true);
    try {
      const payload: any = {
        first_name: v.first_name.trim(),
        last_name: v.last_name.trim(),
        email: v.email.trim().toLowerCase(),
        phone: v.phone.trim() || null,
        bio: v.bio.trim() || null,
        photo_url: v.photo_url.trim() || null,
        specialties: v.specialties.trim()
          ? v.specialties.split(",").map((s) => s.trim()).filter(Boolean)
          : null,
        is_public_pt: v.is_public_pt,
        is_master: v.is_master,
        pay_type: v.pay_type,
        default_per_class_rate: Number(v.default_per_class_rate) || 0,
        hourly_rate: Number(v.hourly_rate) || 0,
      };

      if (editing) {
        const { error } = await (supabase as any).from("instructors").update(payload).eq("id", initial!.id);
        if (error) throw error;
        toast.success("Trainer updated");
      } else {
        const { error } = await (supabase as any).from("instructors").insert({ ...payload, is_active: true });
        if (error) throw error;
        toast.success("Trainer added");
      }
      qc.invalidateQueries({ queryKey: ["pt-trainers-list"] });
      qc.invalidateQueries({ queryKey: ["instructors"] });
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to save trainer");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editing ? "Edit trainer" : "Add trainer"}</DialogTitle>
          <DialogDescription>
            {editing ? "Update this trainer's profile and visibility." : "Create a new trainer profile for personal training."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-xs">First name</Label>
              <Input value={v.first_name} onChange={(e) => set("first_name", e.target.value)} />
            </div>
            <div>
              <Label className="text-xs">Last name</Label>
              <Input value={v.last_name} onChange={(e) => set("last_name", e.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-xs">Email</Label>
              <Input type="email" value={v.email} onChange={(e) => set("email", e.target.value)} />
            </div>
            <div>
              <Label className="text-xs">Phone</Label>
              <Input value={v.phone} onChange={(e) => set("phone", e.target.value)} />
            </div>
          </div>
          <div>
            <Label className="text-xs">Specialties (comma separated)</Label>
            <Input value={v.specialties} onChange={(e) => set("specialties", e.target.value)} placeholder="Strength, Mobility, Pre/postnatal" />
          </div>
          <div>
            <Label className="text-xs">Photo URL</Label>
            <Input value={v.photo_url} onChange={(e) => set("photo_url", e.target.value)} placeholder="https://…" />
          </div>
          <div>
            <Label className="text-xs">Bio</Label>
            <Textarea rows={3} value={v.bio} onChange={(e) => set("bio", e.target.value)} />
          </div>

          <div className="grid grid-cols-3 gap-2">
            <div>
              <Label className="text-xs">Pay type</Label>
              <Select value={v.pay_type} onValueChange={(x) => set("pay_type", x as any)}>
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="hourly">Hourly</SelectItem>
                  <SelectItem value="per_class">Per session</SelectItem>
                  <SelectItem value="mixed">Mixed</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Hourly rate</Label>
              <Input type="number" step="0.01" value={v.hourly_rate} onChange={(e) => set("hourly_rate", e.target.value)} />
            </div>
            <div>
              <Label className="text-xs">Per-session rate</Label>
              <Input type="number" step="0.01" value={v.default_per_class_rate} onChange={(e) => set("default_per_class_rate", e.target.value)} />
            </div>
          </div>

          <div className="flex items-center justify-between border rounded-md px-3 py-2">
            <div>
              <div className="text-sm font-medium">Show on public website</div>
              <div className="text-xs text-muted-foreground">Appears in PT booking and trainer directory.</div>
            </div>
            <Switch checked={v.is_public_pt} onCheckedChange={(x) => set("is_public_pt", x)} />
          </div>
          <div className="flex items-center justify-between border rounded-md px-3 py-2">
            <div>
              <div className="text-sm font-medium">Master trainer</div>
              <div className="text-xs text-muted-foreground">Eligible to teach Signature sessions.</div>
            </div>
            <Switch checked={v.is_master} onCheckedChange={(x) => set("is_master", x)} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={save} disabled={saving}>
            {saving && <Loader2 className="h-3 w-3 mr-1 animate-spin" />}
            {editing ? "Save changes" : "Add trainer"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
