import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Plus, Minus, Save } from "lucide-react";
import { toast } from "sonner";
import { format as fmtDate, parseISO, differenceInDays } from "date-fns";
import { SellPTDialog } from "@/components/admin/SellPTDialog";
import { PT_FORMAT_LABEL, PtFormat, PtPass, formatCents } from "@/lib/ptFormat";

interface UserLite {
  id: string;
  email: string;
  name: string;
  isMember: boolean;
}

export default function PersonalTrainingPasses() {
  const qc = useQueryClient();
  const [sellOpen, setSellOpen] = useState(false);
  const [filter, setFilter] = useState<"all" | PtFormat>("all");
  const [statusFilter, setStatusFilter] = useState<string>("active");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<PtPass | null>(null);
  const [draftActivation, setDraftActivation] = useState("");
  const [draftExpires, setDraftExpires] = useState("");
  const [draftRemaining, setDraftRemaining] = useState<number>(0);
  const [saving, setSaving] = useState(false);

  const { data: passes = [], isLoading } = useQuery({
    queryKey: ["pt-passes", filter, statusFilter],
    queryFn: async () => {
      let q = (supabase as any).from("pt_passes").select("*").order("created_at", { ascending: false });
      if (filter !== "all") q = q.eq("format", filter);
      if (statusFilter !== "all") q = q.eq("status", statusFilter);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as PtPass[];
    },
  });

  // Hydrate user labels in one round trip
  const userIds = useMemo(() => Array.from(new Set(passes.map((p) => p.user_id))), [passes]);
  const { data: userMap = {} } = useQuery({
    queryKey: ["pt-user-map", userIds],
    enabled: userIds.length > 0,
    queryFn: async (): Promise<Record<string, UserLite>> => {
      const [{ data: profiles }, { data: members }] = await Promise.all([
        supabase.from("profiles").select("user_id, email, full_name").in("user_id", userIds),
        supabase.from("members").select("user_id, email, first_name, last_name").in("user_id", userIds),
      ]);
      const map: Record<string, UserLite> = {};
      (profiles ?? []).forEach((p: any) => {
        map[p.user_id] = { id: p.user_id, email: p.email, name: p.full_name ?? p.email, isMember: false };
      });
      (members ?? []).forEach((m: any) => {
        map[m.user_id] = {
          id: m.user_id,
          email: m.email,
          name: `${m.first_name ?? ""} ${m.last_name ?? ""}`.trim() || m.email,
          isMember: true,
        };
      });
      return map;
    },
  });

  const filtered = useMemo(() => {
    if (!search) return passes;
    const q = search.toLowerCase();
    return passes.filter((p) => {
      const u = userMap[p.user_id];
      return (
        u?.name?.toLowerCase().includes(q) ||
        u?.email?.toLowerCase().includes(q) ||
        p.pack_name.toLowerCase().includes(q)
      );
    });
  }, [passes, userMap, search]);

  function openDetail(p: PtPass) {
    setSelected(p);
    setDraftActivation(p.activated_at);
    setDraftExpires(p.expires_at);
    setDraftRemaining(p.sessions_remaining);
  }

  async function saveEdits() {
    if (!selected) return;
    setSaving(true);
    try {
      const { error } = await (supabase as any)
        .from("pt_passes")
        .update({
          activated_at: draftActivation,
          expires_at: draftExpires,
          sessions_remaining: Math.max(0, Math.min(draftRemaining, selected.sessions_total)),
        })
        .eq("id", selected.id);
      if (error) throw error;
      toast.success("Pass updated");
      qc.invalidateQueries({ queryKey: ["pt-passes"] });
      setSelected(null);
    } catch (e: any) {
      toast.error(e?.message ?? "Update failed");
    } finally {
      setSaving(false);
    }
  }

  async function useSession(p: PtPass) {
    const { error } = await (supabase as any).rpc("use_pt_session", { _pass_id: p.id });
    if (error) return toast.error(error.message);
    toast.success("Session deducted");
    qc.invalidateQueries({ queryKey: ["pt-passes"] });
  }

  async function changeStatus(p: PtPass, status: PtPass["status"]) {
    const { error } = await (supabase as any).from("pt_passes").update({ status }).eq("id", p.id);
    if (error) return toast.error(error.message);
    toast.success("Status updated");
    qc.invalidateQueries({ queryKey: ["pt-passes"] });
    if (selected?.id === p.id) setSelected({ ...p, status });
  }

  return (
    <AdminLayout>
      <div className="p-6 max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-semibold">PT Passes</h1>
            <p className="text-sm text-muted-foreground">
              Every Personal Training pack sold. Edit dates, deduct sessions, or refund.
            </p>
          </div>
          <Button onClick={() => setSellOpen(true)}>
            <Plus className="h-4 w-4 mr-2" /> Sell PT
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
          <Input placeholder="Search customer or pack…" value={search} onChange={(e) => setSearch(e.target.value)} />
          <Select value={filter} onValueChange={(v) => setFilter(v as any)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All formats</SelectItem>
              {(Object.keys(PT_FORMAT_LABEL) as PtFormat[]).map((f) => (
                <SelectItem key={f} value={f}>{PT_FORMAT_LABEL[f]}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="exhausted">Exhausted</SelectItem>
              <SelectItem value="expired">Expired</SelectItem>
              <SelectItem value="refunded">Refunded</SelectItem>
              <SelectItem value="cancelled">Cancelled</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-20"><Loader2 className="h-5 w-5 animate-spin" /></div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20 text-muted-foreground border border-dashed rounded-lg">
            No passes found.
          </div>
        ) : (
          <div className="grid md:grid-cols-[1fr_380px] gap-4">
            <div className="border rounded-lg bg-card divide-y">
              {filtered.map((p) => {
                const u = userMap[p.user_id];
                const exp = parseISO(p.expires_at);
                const daysToExpire = differenceInDays(exp, new Date());
                const expSoon = p.status === "active" && daysToExpire <= 14;
                return (
                  <button
                    key={p.id}
                    onClick={() => openDetail(p)}
                    className={`w-full text-left px-4 py-3 hover:bg-muted/40 ${selected?.id === p.id ? "bg-muted/60" : ""}`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium truncate">{u?.name ?? p.user_id.slice(0, 8)}</span>
                          {u?.isMember && <Badge variant="outline" className="text-[10px]">Member</Badge>}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {PT_FORMAT_LABEL[p.format]} · {p.pack_name} · {formatCents(p.price_cents_charged)}
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <div className="text-sm font-semibold">
                          {p.sessions_remaining}/{p.sessions_total}
                        </div>
                        <div className={`text-[11px] ${expSoon ? "text-destructive" : "text-muted-foreground"}`}>
                          exp {fmtDate(exp, "MMM d, yyyy")}
                        </div>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>

            <div className="border rounded-lg p-4 bg-card h-fit sticky top-4">
              {!selected ? (
                <p className="text-sm text-muted-foreground text-center py-8">
                  Select a pass to edit.
                </p>
              ) : (
                <div className="space-y-3">
                  <div>
                    <div className="font-semibold">{userMap[selected.user_id]?.name ?? "Customer"}</div>
                    <div className="text-xs text-muted-foreground">
                      {PT_FORMAT_LABEL[selected.format]} · {selected.pack_name}
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <Label className="text-xs">Activation</Label>
                      <Input type="date" value={draftActivation} onChange={(e) => setDraftActivation(e.target.value)} />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Expiration</Label>
                      <Input type="date" value={draftExpires} onChange={(e) => setDraftExpires(e.target.value)} />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Sessions remaining (of {selected.sessions_total})</Label>
                    <div className="flex items-center gap-2">
                      <Button variant="outline" size="icon" onClick={() => setDraftRemaining((n) => Math.max(0, n - 1))}>
                        <Minus className="h-4 w-4" />
                      </Button>
                      <Input
                        type="number"
                        min={0}
                        max={selected.sessions_total}
                        value={draftRemaining}
                        onChange={(e) => setDraftRemaining(parseInt(e.target.value || "0", 10))}
                        className="text-center"
                      />
                      <Button variant="outline" size="icon" onClick={() => setDraftRemaining((n) => Math.min(selected.sessions_total, n + 1))}>
                        <Plus className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                  <Button onClick={saveEdits} disabled={saving} className="w-full">
                    {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
                    Save changes
                  </Button>

                  <div className="border-t pt-3 space-y-2">
                    <Button variant="secondary" className="w-full" onClick={() => useSession(selected)} disabled={selected.status !== "active" || selected.sessions_remaining === 0}>
                      Deduct one session
                    </Button>
                    <div className="space-y-1">
                      <Label className="text-xs">Status</Label>
                      <Select value={selected.status} onValueChange={(v) => changeStatus(selected, v as any)}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="active">Active</SelectItem>
                          <SelectItem value="exhausted">Exhausted</SelectItem>
                          <SelectItem value="expired">Expired</SelectItem>
                          <SelectItem value="refunded">Refunded</SelectItem>
                          <SelectItem value="cancelled">Cancelled</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {selected.notes && (
                    <div className="text-xs text-muted-foreground border-t pt-3">
                      <div className="font-medium mb-1">Notes</div>
                      {selected.notes}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      <SellPTDialog open={sellOpen} onOpenChange={setSellOpen} />
    </AdminLayout>
  );
}
