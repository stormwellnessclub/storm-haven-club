import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Archive } from "lucide-react";
import { toast } from "sonner";
import { addMonths, format as fmtDate } from "date-fns";
import { PT_FORMAT_LABEL, PT_FORMATS, PtFormat } from "@/lib/ptFormat";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  presetUserId?: string;
  presetUserLabel?: string;
}

interface UserOption { id: string; email: string; name: string; isMember: boolean; }

export function GrantLegacyPtPackDialog({ open, onOpenChange, presetUserId, presetUserLabel }: Props) {
  const qc = useQueryClient();
  const [userId, setUserId] = useState<string | undefined>(presetUserId);
  const [userLabel, setUserLabel] = useState<string | undefined>(presetUserLabel);
  const [search, setSearch] = useState("");
  const [format, setFormat] = useState<PtFormat>("one_on_one");
  const [packName, setPackName] = useState("Legacy — Old Location");
  const [sessions, setSessions] = useState(10);
  const [activatedAt, setActivatedAt] = useState(fmtDate(new Date(), "yyyy-MM-dd"));
  const [expiresAt, setExpiresAt] = useState(fmtDate(addMonths(new Date(), 6), "yyyy-MM-dd"));
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setUserId(presetUserId);
      setUserLabel(presetUserLabel);
    }
  }, [open, presetUserId, presetUserLabel]);

  const { data: users = [] } = useQuery({
    queryKey: ["legacy-pt-user-search", search],
    enabled: !userId && search.length >= 2,
    queryFn: async (): Promise<UserOption[]> => {
      const [{ data: profiles }, { data: members }] = await Promise.all([
        supabase.from("profiles").select("user_id, email, first_name, last_name")
          .or(`email.ilike.%${search}%,first_name.ilike.%${search}%,last_name.ilike.%${search}%`).limit(10),
        supabase.from("members").select("user_id, email, first_name, last_name")
          .or(`email.ilike.%${search}%,first_name.ilike.%${search}%,last_name.ilike.%${search}%`).limit(10),
      ]);
      const list: UserOption[] = [
        ...(profiles ?? []).map((p: any) => ({ id: p.user_id, email: p.email, name: [p.first_name, p.last_name].filter(Boolean).join(" ") ?? p.email, isMember: false })),
        ...(members ?? []).map((m: any) => ({ id: m.user_id, email: m.email, name: `${m.first_name ?? ""} ${m.last_name ?? ""}`.trim() || m.email, isMember: true })),
      ].filter((u) => u.id);
      return Array.from(new Map(list.map((u) => [u.id, u])).values());
    },
  });

  function reset() {
    setUserId(presetUserId); setUserLabel(presetUserLabel); setSearch("");
    setFormat("one_on_one"); setPackName("Legacy — Old Location");
    setSessions(10); setNotes("");
    setActivatedAt(fmtDate(new Date(), "yyyy-MM-dd"));
    setExpiresAt(fmtDate(addMonths(new Date(), 6), "yyyy-MM-dd"));
  }

  async function submit() {
    if (!userId) return toast.error("Select a customer");
    if (!packName.trim()) return toast.error("Pack name required");
    if (sessions < 1) return toast.error("Sessions must be ≥ 1");
    if (!expiresAt) return toast.error("Expiration required");
    setSaving(true);
    try {
      const { data: { user: adminUser } } = await supabase.auth.getUser();
      const { error } = await (supabase as any).from("pt_passes").insert({
        user_id: userId,
        pack_id: null,
        format,
        pack_name: packName.trim(),
        sessions_total: sessions,
        sessions_remaining: sessions,
        price_cents_charged: 0,
        activated_at: activatedAt,
        expires_at: expiresAt,
        status: "active",
        payment_method: "legacy",
        stripe_payment_intent_id: null,
        sold_by_admin_id: adminUser?.id ?? null,
        notes: notes.trim() ? `[Legacy — Old Location] ${notes.trim()}` : "[Legacy — Old Location]",
      });
      if (error) throw error;
      toast.success(`Granted ${sessions} legacy session${sessions !== 1 ? "s" : ""}`);
      qc.invalidateQueries({ queryKey: ["pt-passes"] });
      qc.invalidateQueries({ queryKey: ["my-pt-passes"] });
      reset();
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to grant pack");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) reset(); onOpenChange(v); }}>
      <DialogContent className="sm:max-w-[540px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Archive className="h-5 w-5" /> Grant legacy pack
          </DialogTitle>
          <DialogDescription>
            Add sessions a member purchased at your old location. No charge is created.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {!userId ? (
            <div className="space-y-2">
              <Label>Customer</Label>
              <Input placeholder="Search by name or email…" value={search} onChange={(e) => setSearch(e.target.value)} />
              {users.length > 0 && (
                <div className="border rounded-md max-h-44 overflow-y-auto">
                  {users.map((u) => (
                    <button key={u.id} onClick={() => { setUserId(u.id); setUserLabel(`${u.name} (${u.email})`); }}
                      className="w-full text-left px-3 py-2 hover:bg-muted text-sm border-b last:border-0">
                      <div className="font-medium">{u.name}</div>
                      <div className="text-xs text-muted-foreground">{u.email}{u.isMember && " · Member"}</div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-2">
              <Label>Customer</Label>
              <div className="flex items-center justify-between border rounded-md px-3 py-2 text-sm">
                <span>{userLabel ?? "Selected customer"}</span>
                <Button variant="ghost" size="sm" onClick={() => { setUserId(undefined); setUserLabel(undefined); }}>Change</Button>
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Format</Label>
              <Select value={format} onValueChange={(v) => setFormat(v as PtFormat)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PT_FORMATS.map((f) => <SelectItem key={f} value={f}>{PT_FORMAT_LABEL[f]}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Pack name</Label>
              <Input value={packName} onChange={(e) => setPackName(e.target.value)} />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1">
              <Label>Sessions</Label>
              <Input type="number" min={1} value={sessions} onChange={(e) => setSessions(Math.max(1, parseInt(e.target.value || "1", 10)))} />
            </div>
            <div className="space-y-1">
              <Label>Activation</Label>
              <Input type="date" value={activatedAt} onChange={(e) => setActivatedAt(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Expiration</Label>
              <Input type="date" value={expiresAt} onChange={(e) => setExpiresAt(e.target.value)} />
            </div>
          </div>

          <div className="space-y-1">
            <Label>Notes (optional)</Label>
            <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Migrated from old location on 7/22. Original purchase 3/2025." />
          </div>

          <div className="rounded-md bg-muted/50 border px-3 py-2 text-xs text-muted-foreground">
            Records as <span className="font-mono">payment_method = legacy</span> with $0 charged.
            Appears in the member's pass list identically to a purchased pack.
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={submit} disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />} Grant pack
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
