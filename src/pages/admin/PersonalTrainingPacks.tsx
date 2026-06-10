import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Plus, Pencil } from "lucide-react";
import { toast } from "sonner";
import { PT_FORMAT_LABEL, PT_FORMATS, PtFormat, PtPack, formatCents, formatExpiration, perSessionPrice } from "@/lib/ptFormat";

interface DraftPack {
  id?: string;
  format: PtFormat;
  name: string;
  sessions: number;
  price_dollars: number;
  expiration_days: number;
  is_public: boolean;
  is_active: boolean;
  display_order: number;
  notes: string;
}

const EMPTY: DraftPack = {
  format: "one_on_one",
  name: "",
  sessions: 1,
  price_dollars: 0,
  expiration_days: 30,
  is_public: true,
  is_active: true,
  display_order: 10,
  notes: "",
};

export default function PersonalTrainingPacks() {
  const qc = useQueryClient();
  const [editing, setEditing] = useState<DraftPack | null>(null);
  const [saving, setSaving] = useState(false);

  const { data: packs = [], isLoading } = useQuery({
    queryKey: ["pt-packs-admin"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("pt_packs")
        .select("*")
        .order("format")
        .order("display_order");
      if (error) throw error;
      return (data ?? []) as PtPack[];
    },
  });

  function openNew() {
    setEditing({ ...EMPTY });
  }
  function openEdit(p: PtPack) {
    setEditing({
      id: p.id,
      format: p.format,
      name: p.name,
      sessions: p.sessions,
      price_dollars: p.price_cents / 100,
      expiration_days: p.expiration_days,
      is_public: p.is_public,
      is_active: p.is_active,
      display_order: p.display_order,
      notes: p.notes ?? "",
    });
  }

  async function save() {
    if (!editing) return;
    if (!editing.name.trim()) return toast.error("Name required");
    if (editing.sessions < 1) return toast.error("Sessions must be ≥ 1");
    if (editing.expiration_days < 1) return toast.error("Expiration must be ≥ 1 day");

    setSaving(true);
    try {
      const payload = {
        format: editing.format,
        name: editing.name.trim(),
        sessions: editing.sessions,
        price_cents: Math.round(editing.price_dollars * 100),
        expiration_days: editing.expiration_days,
        is_public: editing.is_public,
        is_active: editing.is_active,
        display_order: editing.display_order,
        notes: editing.notes.trim() || null,
      };
      if (editing.id) {
        const { error } = await (supabase as any).from("pt_packs").update(payload).eq("id", editing.id);
        if (error) throw error;
        toast.success("Pack updated");
      } else {
        const { error } = await (supabase as any).from("pt_packs").insert(payload);
        if (error) throw error;
        toast.success("Pack created");
      }
      qc.invalidateQueries({ queryKey: ["pt-packs-admin"] });
      qc.invalidateQueries({ queryKey: ["pt-packs-all"] });
      qc.invalidateQueries({ queryKey: ["pt-packs-public"] });
      setEditing(null);
    } catch (e: any) {
      toast.error(e?.message ?? "Save failed");
    } finally {
      setSaving(false);
    }
  }

  const grouped = PT_FORMATS.map((f) => ({
    format: f,
    items: packs.filter((p) => p.format === f),
  }));

  return (
    <AdminLayout>
      <div className="p-6 max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-semibold">PT Packs & Pricing</h1>
            <p className="text-sm text-muted-foreground">
              Edits here update both the public Personal Training pages and the Sell PT dialog.
            </p>
          </div>
          <Button onClick={openNew}>
            <Plus className="h-4 w-4 mr-2" /> New pack
          </Button>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-20"><Loader2 className="h-5 w-5 animate-spin" /></div>
        ) : (
          <div className="space-y-8">
            {grouped.map((g) => (
              <section key={g.format}>
                <h2 className="font-serif text-xl mb-3">{PT_FORMAT_LABEL[g.format]}</h2>
                <div className="border rounded-lg bg-card divide-y">
                  {g.items.length === 0 ? (
                    <div className="px-4 py-6 text-sm text-muted-foreground">No packs yet.</div>
                  ) : g.items.map((p) => (
                    <div key={p.id} className="px-4 py-3 flex items-center gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{p.name}</span>
                          {!p.is_active && <Badge variant="outline">Inactive</Badge>}
                          {!p.is_public && <Badge variant="secondary">Admin-only</Badge>}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {p.sessions} session{p.sessions !== 1 ? "s" : ""} · {formatCents(p.price_cents)}
                          {perSessionPrice(p) && ` · ${perSessionPrice(p)}`}
                          {" · "}expires after {formatExpiration(p.expiration_days)}
                          {p.notes && ` · ${p.notes}`}
                        </div>
                      </div>
                      <Button variant="ghost" size="sm" onClick={() => openEdit(p)}>
                        <Pencil className="h-4 w-4 mr-1" /> Edit
                      </Button>
                    </div>
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}
      </div>

      <Dialog open={!!editing} onOpenChange={(v) => !v && setEditing(null)}>
        <DialogContent className="sm:max-w-[520px]">
          <DialogHeader>
            <DialogTitle>{editing?.id ? "Edit pack" : "New pack"}</DialogTitle>
            <DialogDescription>
              Public visibility hides this from the website; Active hides it everywhere.
            </DialogDescription>
          </DialogHeader>

          {editing && (
            <div className="space-y-3 py-2">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label>Format</Label>
                  <Select value={editing.format} onValueChange={(v) => setEditing({ ...editing, format: v as PtFormat })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {PT_FORMATS.map((f) => (
                        <SelectItem key={f} value={f}>{PT_FORMAT_LABEL[f]}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label>Display order</Label>
                  <Input type="number" value={editing.display_order} onChange={(e) => setEditing({ ...editing, display_order: parseInt(e.target.value || "0", 10) })} />
                </div>
              </div>
              <div className="space-y-1">
                <Label>Name</Label>
                <Input value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} placeholder="e.g. 10-Pack" />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1">
                  <Label>Sessions</Label>
                  <Input type="number" min={1} value={editing.sessions} onChange={(e) => setEditing({ ...editing, sessions: parseInt(e.target.value || "1", 10) })} />
                </div>
                <div className="space-y-1">
                  <Label>Price ($)</Label>
                  <Input type="number" min={0} step="0.01" value={editing.price_dollars} onChange={(e) => setEditing({ ...editing, price_dollars: parseFloat(e.target.value || "0") })} />
                </div>
                <div className="space-y-1">
                  <Label>Expires (days)</Label>
                  <Input type="number" min={1} value={editing.expiration_days} onChange={(e) => setEditing({ ...editing, expiration_days: parseInt(e.target.value || "1", 10) })} />
                </div>
              </div>
              <div className="space-y-1">
                <Label>Notes (shown on admin list only)</Label>
                <Textarea rows={2} value={editing.notes} onChange={(e) => setEditing({ ...editing, notes: e.target.value })} />
              </div>
              <div className="flex items-center justify-between border rounded-md px-3 py-2">
                <div>
                  <div className="font-medium text-sm">Public</div>
                  <div className="text-xs text-muted-foreground">Show on the website pricing tiles.</div>
                </div>
                <Switch checked={editing.is_public} onCheckedChange={(v) => setEditing({ ...editing, is_public: v })} />
              </div>
              <div className="flex items-center justify-between border rounded-md px-3 py-2">
                <div>
                  <div className="font-medium text-sm">Active</div>
                  <div className="text-xs text-muted-foreground">Available in Sell PT and public site.</div>
                </div>
                <Switch checked={editing.is_active} onCheckedChange={(v) => setEditing({ ...editing, is_active: v })} />
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>Cancel</Button>
            <Button onClick={save} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />} Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}
