import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Plus, Minus, Save, ChevronDown, ChevronRight, UserPlus, Calendar, Archive } from "lucide-react";
import { toast } from "sonner";
import { format as fmtDate, parseISO, differenceInDays } from "date-fns";
import { SellPTDialog } from "@/components/admin/SellPTDialog";
import { BookPTSessionDialog } from "@/components/admin/BookPTSessionDialog";
import { GrantLegacyPtPackDialog } from "@/components/admin/GrantLegacyPtPackDialog";
import { PT_FORMAT_LABEL, PtFormat, PtPass, formatCents } from "@/lib/ptFormat";
import { Link } from "react-router-dom";

interface UserLite {
  id: string;
  email: string;
  name: string;
  isMember: boolean;
}

interface CustomerGroup {
  user: UserLite | null;
  userId: string;
  passes: PtPass[];
  activeSessions: number;
  totalSessions: number;
  activePacks: number;
  soonestExpiry: Date | null;
  formats: Set<PtFormat>;
}

export default function PersonalTrainingPasses() {
  const qc = useQueryClient();
  const [sellOpen, setSellOpen] = useState(false);
  const [sellPreset, setSellPreset] = useState<{ id: string; label: string } | undefined>();
  const [bookOpen, setBookOpen] = useState(false);
  const [bookPreset, setBookPreset] = useState<{ id: string; label: string } | undefined>();
  const [legacyOpen, setLegacyOpen] = useState(false);
  const [legacyPreset, setLegacyPreset] = useState<{ id: string; label: string } | undefined>();
  const [filter, setFilter] = useState<"all" | PtFormat>("all");
  const [statusFilter, setStatusFilter] = useState<string>("active");
  const [search, setSearch] = useState("");
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftActivation, setDraftActivation] = useState("");
  const [draftExpires, setDraftExpires] = useState("");
  const [draftRemaining, setDraftRemaining] = useState<number>(0);
  const [draftTotal, setDraftTotal] = useState<number>(0);
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

  // Group passes by user
  const groups = useMemo<CustomerGroup[]>(() => {
    const byUser = new Map<string, CustomerGroup>();
    for (const p of passes) {
      let g = byUser.get(p.user_id);
      if (!g) {
        g = {
          userId: p.user_id,
          user: userMap[p.user_id] ?? null,
          passes: [],
          activeSessions: 0,
          totalSessions: 0,
          activePacks: 0,
          soonestExpiry: null,
          formats: new Set(),
        };
        byUser.set(p.user_id, g);
      }
      g.passes.push(p);
      g.formats.add(p.format);
      if (p.status === "active") {
        g.activeSessions += p.sessions_remaining;
        g.totalSessions += p.sessions_total;
        g.activePacks += 1;
        const exp = parseISO(p.expires_at);
        if (!g.soonestExpiry || exp < g.soonestExpiry) g.soonestExpiry = exp;
      }
    }
    // sort each group's passes newest first
    byUser.forEach((g) => g.passes.sort((a, b) => (a.created_at < b.created_at ? 1 : -1)));
    return Array.from(byUser.values());
  }, [passes, userMap]);

  const filteredGroups = useMemo(() => {
    let list = groups;
    if (search) {
      const q = search.toLowerCase();
      list = list.filter((g) => {
        if (g.user?.name?.toLowerCase().includes(q)) return true;
        if (g.user?.email?.toLowerCase().includes(q)) return true;
        if (g.passes.some((p) => p.pack_name.toLowerCase().includes(q))) return true;
        return false;
      });
    }
    // Sort: most active sessions first, then by soonest expiry
    return [...list].sort((a, b) => {
      if (b.activeSessions !== a.activeSessions) return b.activeSessions - a.activeSessions;
      const ax = a.soonestExpiry?.getTime() ?? Infinity;
      const bx = b.soonestExpiry?.getTime() ?? Infinity;
      return ax - bx;
    });
  }, [groups, search]);

  const selectedGroup = useMemo(
    () => filteredGroups.find((g) => g.userId === selectedUserId) ?? null,
    [filteredGroups, selectedUserId]
  );

  function startEdit(p: PtPass) {
    setEditingId(p.id);
    setDraftActivation(p.activated_at);
    setDraftExpires(p.expires_at);
    setDraftRemaining(p.sessions_remaining);
    setDraftTotal(p.sessions_total);
  }

  async function saveEdits(p: PtPass) {
    setSaving(true);
    try {
      const { error } = await (supabase as any)
        .from("pt_passes")
        .update({
          activated_at: draftActivation,
          expires_at: draftExpires,
          sessions_remaining: Math.max(0, Math.min(draftRemaining, draftTotal)),
        })
        .eq("id", p.id);
      if (error) throw error;
      toast.success("Pass updated");
      qc.invalidateQueries({ queryKey: ["pt-passes"] });
      setEditingId(null);
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
  }

  function openSellForCustomer(g: CustomerGroup) {
    setSellPreset({
      id: g.userId,
      label: g.user ? `${g.user.name} (${g.user.email})` : g.userId,
    });
    setSellOpen(true);
  }

  return (
    <AdminLayout>
      <div className="p-6 max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-semibold">PT Passes</h1>
            <p className="text-sm text-muted-foreground">
              Personal Training packs grouped by customer. Click a customer to view, edit, or sell more.
            </p>
          </div>
          <div className="flex gap-2 flex-wrap">
            <Button variant="outline" asChild>
              <Link to="/admin/personal-training/trainers">Trainers</Link>
            </Button>
            <Button variant="outline" asChild>
              <Link to="/admin/personal-training/schedule"><Calendar className="h-4 w-4 mr-2" /> Schedule</Link>
            </Button>
            <Button variant="outline" onClick={() => { setBookPreset(undefined); setBookOpen(true); }}>
              <Calendar className="h-4 w-4 mr-2" /> Book Session
            </Button>
            <Button variant="outline" onClick={() => { setLegacyPreset(undefined); setLegacyOpen(true); }}>
              <Archive className="h-4 w-4 mr-2" /> Grant legacy pack
            </Button>
            <Button onClick={() => { setSellPreset(undefined); setSellOpen(true); }}>
              <Plus className="h-4 w-4 mr-2" /> Sell PT
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
          <Input
            placeholder="Search customer or pack…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <Select value={filter} onValueChange={(v) => setFilter(v as any)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All formats</SelectItem>
              {(Object.keys(PT_FORMAT_LABEL) as PtFormat[]).map((f) => (
                <SelectItem key={f} value={f}>
                  {PT_FORMAT_LABEL[f]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
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
          <div className="flex justify-center py-20">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        ) : filteredGroups.length === 0 ? (
          <div className="text-center py-20 text-muted-foreground border border-dashed rounded-lg">
            No customers found.
          </div>
        ) : (
          <div className="grid md:grid-cols-[1fr_440px] gap-4">
            {/* Customer list */}
            <div className="border rounded-lg bg-card divide-y">
              {filteredGroups.map((g) => {
                const expSoon =
                  g.soonestExpiry && differenceInDays(g.soonestExpiry, new Date()) <= 14;
                const isSel = selectedUserId === g.userId;
                return (
                  <button
                    key={g.userId}
                    onClick={() => setSelectedUserId(isSel ? null : g.userId)}
                    className={`w-full text-left px-4 py-3 hover:bg-muted/40 ${isSel ? "bg-muted/60" : ""}`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          {isSel ? (
                            <ChevronDown className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                          ) : (
                            <ChevronRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                          )}
                          <span className="font-medium truncate">
                            {g.user?.name ?? g.userId.slice(0, 8)}
                          </span>
                          {g.user?.isMember && (
                            <Badge variant="outline" className="text-[10px]">
                              Member
                            </Badge>
                          )}
                        </div>
                        <div className="text-xs text-muted-foreground truncate ml-5">
                          {g.user?.email ?? "—"}
                        </div>
                        <div className="flex flex-wrap gap-1 mt-1 ml-5">
                          {Array.from(g.formats).map((f) => (
                            <Badge key={f} variant="secondary" className="text-[10px]">
                              {PT_FORMAT_LABEL[f]}
                            </Badge>
                          ))}
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <div className="text-sm font-semibold">
                          {g.activeSessions} session{g.activeSessions !== 1 ? "s" : ""} left
                        </div>
                        <div className="text-[11px] text-muted-foreground">
                          {g.activePacks} active pack{g.activePacks !== 1 ? "s" : ""} ·{" "}
                          {g.passes.length} total
                        </div>
                        {g.soonestExpiry && (
                          <div
                            className={`text-[11px] ${
                              expSoon ? "text-destructive" : "text-muted-foreground"
                            }`}
                          >
                            next exp {fmtDate(g.soonestExpiry, "MMM d, yyyy")}
                          </div>
                        )}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Detail pane */}
            <div className="border rounded-lg p-4 bg-card h-fit sticky top-4">
              {!selectedGroup ? (
                <p className="text-sm text-muted-foreground text-center py-8">
                  Select a customer to view their passes.
                </p>
              ) : (
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="font-semibold truncate">
                        {selectedGroup.user?.name ?? "Customer"}
                      </div>
                      <div className="text-xs text-muted-foreground truncate">
                        {selectedGroup.user?.email}
                      </div>
                    </div>
                    <div className="flex gap-1 shrink-0">
                      <Button size="sm" variant="default" onClick={() => {
                        setBookPreset({ id: selectedGroup.userId, label: selectedGroup.user ? `${selectedGroup.user.name} (${selectedGroup.user.email})` : selectedGroup.userId });
                        setBookOpen(true);
                      }}>
                        <Calendar className="h-3.5 w-3.5 mr-1" /> Book
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => openSellForCustomer(selectedGroup)}>
                        <UserPlus className="h-3.5 w-3.5 mr-1" /> Sell
                      </Button>
                    </div>
                  </div>

                  <div className="space-y-2 max-h-[70vh] overflow-y-auto pr-1">
                    {selectedGroup.passes.map((p) => {
                      const exp = parseISO(p.expires_at);
                      const daysToExpire = differenceInDays(exp, new Date());
                      const expSoon = p.status === "active" && daysToExpire <= 14;
                      const isEditing = editingId === p.id;
                      return (
                        <div
                          key={p.id}
                          className="border rounded-md p-3 space-y-2 bg-background"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <div className="text-sm font-medium truncate">{p.pack_name}</div>
                              <div className="text-[11px] text-muted-foreground">
                                {PT_FORMAT_LABEL[p.format]} · {formatCents(p.price_cents_charged)}
                              </div>
                            </div>
                            <div className="text-right shrink-0">
                              <div className="text-sm font-semibold">
                                {p.sessions_remaining}/{p.sessions_total}
                              </div>
                              <Badge
                                variant={p.status === "active" ? "default" : "secondary"}
                                className="text-[10px] mt-1"
                              >
                                {p.status}
                              </Badge>
                            </div>
                          </div>
                          <div className="text-[11px] text-muted-foreground flex justify-between">
                            <span>activated {fmtDate(parseISO(p.activated_at), "MMM d, yyyy")}</span>
                            <span className={expSoon ? "text-destructive" : ""}>
                              exp {fmtDate(exp, "MMM d, yyyy")}
                            </span>
                          </div>

                          {!isEditing ? (
                            <div className="flex flex-wrap gap-2">
                              <Button size="sm" variant="outline" onClick={() => startEdit(p)}>
                                Edit
                              </Button>
                              <Button
                                size="sm"
                                variant="secondary"
                                onClick={() => useSession(p)}
                                disabled={p.status !== "active" || p.sessions_remaining === 0}
                              >
                                Deduct
                              </Button>
                              <Select
                                value={p.status}
                                onValueChange={(v) => changeStatus(p, v as any)}
                              >
                                <SelectTrigger className="h-8 text-xs w-auto min-w-[110px]">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="active">Active</SelectItem>
                                  <SelectItem value="exhausted">Exhausted</SelectItem>
                                  <SelectItem value="expired">Expired</SelectItem>
                                  <SelectItem value="refunded">Refunded</SelectItem>
                                  <SelectItem value="cancelled">Cancelled</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                          ) : (
                            <div className="space-y-2 border-t pt-2">
                              <div className="grid grid-cols-2 gap-2">
                                <div className="space-y-1">
                                  <Label className="text-[11px]">Activation</Label>
                                  <Input
                                    type="date"
                                    value={draftActivation}
                                    onChange={(e) => setDraftActivation(e.target.value)}
                                    className="h-8 text-xs"
                                  />
                                </div>
                                <div className="space-y-1">
                                  <Label className="text-[11px]">Expiration</Label>
                                  <Input
                                    type="date"
                                    value={draftExpires}
                                    onChange={(e) => setDraftExpires(e.target.value)}
                                    className="h-8 text-xs"
                                  />
                                </div>
                              </div>
                              <div className="space-y-1">
                                <Label className="text-[11px]">
                                  Sessions remaining (of {draftTotal})
                                </Label>
                                <div className="flex items-center gap-1">
                                  <Button
                                    variant="outline"
                                    size="icon"
                                    className="h-8 w-8"
                                    onClick={() => setDraftRemaining((n) => Math.max(0, n - 1))}
                                  >
                                    <Minus className="h-3 w-3" />
                                  </Button>
                                  <Input
                                    type="number"
                                    min={0}
                                    max={draftTotal}
                                    value={draftRemaining}
                                    onChange={(e) =>
                                      setDraftRemaining(parseInt(e.target.value || "0", 10))
                                    }
                                    className="text-center h-8 text-xs"
                                  />
                                  <Button
                                    variant="outline"
                                    size="icon"
                                    className="h-8 w-8"
                                    onClick={() =>
                                      setDraftRemaining((n) => Math.min(draftTotal, n + 1))
                                    }
                                  >
                                    <Plus className="h-3 w-3" />
                                  </Button>
                                </div>
                              </div>
                              <div className="flex gap-2">
                                <Button
                                  size="sm"
                                  onClick={() => saveEdits(p)}
                                  disabled={saving}
                                  className="flex-1"
                                >
                                  {saving ? (
                                    <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                                  ) : (
                                    <Save className="h-3 w-3 mr-1" />
                                  )}
                                  Save
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => setEditingId(null)}
                                >
                                  Cancel
                                </Button>
                              </div>
                            </div>
                          )}

                          {p.notes && !isEditing && (
                            <div className="text-[11px] text-muted-foreground border-t pt-2">
                              {p.notes}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      <SellPTDialog
        open={sellOpen}
        onOpenChange={(v) => {
          setSellOpen(v);
          if (!v) setSellPreset(undefined);
        }}
        presetUserId={sellPreset?.id}
        presetUserName={sellPreset?.label}
      />
      <BookPTSessionDialog
        open={bookOpen}
        onOpenChange={(v) => { setBookOpen(v); if (!v) setBookPreset(undefined); }}
        presetUserId={bookPreset?.id}
        presetUserName={bookPreset?.label}
        onSellPack={(id, label) => { setBookOpen(false); setSellPreset({ id, label }); setSellOpen(true); }}
      />
    </AdminLayout>
  );
}
