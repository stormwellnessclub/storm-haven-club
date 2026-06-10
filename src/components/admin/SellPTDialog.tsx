import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { addDays, format as fmtDate } from "date-fns";
import { PT_FORMAT_LABEL, PtFormat, PtPack, formatCents, perSessionPrice } from "@/lib/ptFormat";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  presetUserId?: string;
  presetUserName?: string;
}

interface UserOption {
  id: string;
  email: string;
  name: string;
  isMember: boolean;
}

export function SellPTDialog({ open, onOpenChange, presetUserId, presetUserName }: Props) {
  const qc = useQueryClient();
  const [selectedUserId, setSelectedUserId] = useState<string | undefined>(presetUserId);
  const [selectedUserLabel, setSelectedUserLabel] = useState<string | undefined>(presetUserName);
  const [searchQuery, setSearchQuery] = useState("");

  const [format, setFormat] = useState<PtFormat>("one_on_one");
  const [packId, setPackId] = useState<string>("");
  const [quantity, setQuantity] = useState(1);
  const [activatedAt, setActivatedAt] = useState<string>(fmtDate(new Date(), "yyyy-MM-dd"));
  const [expiresAt, setExpiresAt] = useState<string>("");
  const [paymentMethod, setPaymentMethod] = useState<"offline" | "external">("offline");
  const [adminNotes, setAdminNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (presetUserId) {
      setSelectedUserId(presetUserId);
      setSelectedUserLabel(presetUserName);
    }
  }, [presetUserId, presetUserName, open]);

  const { data: packs = [] } = useQuery({
    queryKey: ["pt-packs-all"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("pt_packs")
        .select("*")
        .eq("is_active", true)
        .order("format")
        .order("display_order");
      if (error) throw error;
      return (data ?? []) as PtPack[];
    },
  });

  const formatPacks = useMemo(
    () => packs.filter((p) => p.format === format && p.price_cents > 0),
    [packs, format]
  );
  const selectedPack = formatPacks.find((p) => p.id === packId);

  // Auto-pick first pack when format changes
  useEffect(() => {
    if (formatPacks.length > 0 && !formatPacks.find((p) => p.id === packId)) {
      setPackId(formatPacks[0].id);
    }
  }, [formatPacks, packId]);

  // Recompute expiration when pack or activation changes
  useEffect(() => {
    if (!selectedPack) return;
    try {
      const base = new Date(activatedAt + "T12:00:00");
      const exp = addDays(base, selectedPack.expiration_days);
      setExpiresAt(fmtDate(exp, "yyyy-MM-dd"));
    } catch {
      /* noop */
    }
  }, [selectedPack?.id, activatedAt]);

  const { data: users = [] } = useQuery({
    queryKey: ["pt-user-search", searchQuery],
    queryFn: async (): Promise<UserOption[]> => {
      if (!searchQuery || searchQuery.length < 2) return [];
      const [{ data: profiles }, { data: members }] = await Promise.all([
        supabase
          .from("profiles")
          .select("user_id, email, full_name")
          .or(`email.ilike.%${searchQuery}%,full_name.ilike.%${searchQuery}%`)
          .limit(10),
        supabase
          .from("members")
          .select("user_id, email, first_name, last_name")
          .or(`email.ilike.%${searchQuery}%,first_name.ilike.%${searchQuery}%,last_name.ilike.%${searchQuery}%`)
          .limit(10),
      ]);
      const list: UserOption[] = [
        ...(profiles ?? []).map((p: any) => ({
          id: p.user_id,
          email: p.email,
          name: p.full_name ?? p.email,
          isMember: false,
        })),
        ...(members ?? []).map((m: any) => ({
          id: m.user_id,
          email: m.email,
          name: `${m.first_name ?? ""} ${m.last_name ?? ""}`.trim() || m.email,
          isMember: true,
        })),
      ].filter((u) => u.id);
      return Array.from(new Map(list.map((u) => [u.id, u])).values());
    },
    enabled: !selectedUserId && searchQuery.length >= 2,
  });

  const totalCents = selectedPack ? selectedPack.price_cents * quantity : 0;

  function reset() {
    setSelectedUserId(presetUserId);
    setSelectedUserLabel(presetUserName);
    setSearchQuery("");
    setFormat("one_on_one");
    setPackId("");
    setQuantity(1);
    setActivatedAt(fmtDate(new Date(), "yyyy-MM-dd"));
    setExpiresAt("");
    setPaymentMethod("offline");
    setAdminNotes("");
  }

  async function submit() {
    if (!selectedUserId) return toast.error("Select a customer");
    if (!selectedPack) return toast.error("Select a pack");
    if (!expiresAt) return toast.error("Expiration date required");

    setSubmitting(true);
    try {
      const { data: { user: adminUser } } = await supabase.auth.getUser();
      const rows = Array.from({ length: quantity }).map(() => ({
        user_id: selectedUserId,
        pack_id: selectedPack.id,
        format: selectedPack.format,
        pack_name: selectedPack.name,
        sessions_total: selectedPack.sessions,
        sessions_remaining: selectedPack.sessions,
        price_cents_charged: selectedPack.price_cents,
        activated_at: activatedAt,
        expires_at: expiresAt,
        status: "active",
        payment_method: paymentMethod,
        sold_by_admin_id: adminUser?.id ?? null,
        notes: adminNotes || null,
      }));
      const { error } = await (supabase as any).from("pt_passes").insert(rows);
      if (error) throw error;
      toast.success(`Sold ${quantity} × ${selectedPack.name}`);
      qc.invalidateQueries({ queryKey: ["pt-passes"] });
      reset();
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to record sale");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) reset(); onOpenChange(v); }}>
      <DialogContent className="sm:max-w-[560px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Sell Personal Training</DialogTitle>
          <DialogDescription>
            Record a PT pack sale. Charging is recorded as offline/external —
            wire in Stripe charging in a follow-up if needed.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Customer */}
          {!selectedUserId ? (
            <div className="space-y-2">
              <Label>Customer</Label>
              <Input
                placeholder="Search by name or email…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              {users.length > 0 && (
                <div className="border rounded-md max-h-44 overflow-y-auto">
                  {users.map((u) => (
                    <button
                      key={u.id}
                      onClick={() => {
                        setSelectedUserId(u.id);
                        setSelectedUserLabel(`${u.name} (${u.email})`);
                      }}
                      className="w-full text-left px-3 py-2 hover:bg-muted text-sm border-b last:border-0"
                    >
                      <div className="font-medium">{u.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {u.email} {u.isMember && "· Member"}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-2">
              <Label>Customer</Label>
              <div className="flex items-center justify-between border rounded-md px-3 py-2 text-sm">
                <span>{selectedUserLabel ?? "Selected customer"}</span>
                <Button variant="ghost" size="sm" onClick={() => { setSelectedUserId(undefined); setSelectedUserLabel(undefined); }}>
                  Change
                </Button>
              </div>
            </div>
          )}

          {/* Format + Pack */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Format</Label>
              <Select value={format} onValueChange={(v) => setFormat(v as PtFormat)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(Object.keys(PT_FORMAT_LABEL) as PtFormat[]).map((f) => (
                    <SelectItem key={f} value={f}>{PT_FORMAT_LABEL[f]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Pack</Label>
              <Select value={packId} onValueChange={setPackId}>
                <SelectTrigger><SelectValue placeholder="Select a pack" /></SelectTrigger>
                <SelectContent>
                  {formatPacks.length === 0 ? (
                    <div className="px-2 py-1.5 text-xs text-muted-foreground">No active packs</div>
                  ) : formatPacks.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name} — {formatCents(p.price_cents)}
                      {!p.is_public && " (admin-only)"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Quantity */}
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-2">
              <Label>Quantity</Label>
              <Input
                type="number"
                min={1}
                max={20}
                value={quantity}
                onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value || "1", 10)))}
              />
            </div>
            <div className="space-y-2">
              <Label>Activation</Label>
              <Input
                type="date"
                value={activatedAt}
                onChange={(e) => setActivatedAt(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Expiration</Label>
              <Input
                type="date"
                value={expiresAt}
                onChange={(e) => setExpiresAt(e.target.value)}
              />
            </div>
          </div>

          {selectedPack && (
            <div className="text-xs text-muted-foreground">
              {selectedPack.sessions} session{selectedPack.sessions !== 1 ? "s" : ""} per pack
              {perSessionPrice(selectedPack) && ` · ${perSessionPrice(selectedPack)}`}
              {" · "}default expiration {selectedPack.expiration_days} days
            </div>
          )}

          <div className="space-y-2">
            <Label>Payment method</Label>
            <Select value={paymentMethod} onValueChange={(v) => setPaymentMethod(v as any)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="offline">Paid offline / in person</SelectItem>
                <SelectItem value="external">Charged externally (Stripe link, etc.)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Internal notes (optional)</Label>
            <Textarea rows={2} value={adminNotes} onChange={(e) => setAdminNotes(e.target.value)} />
          </div>

          {/* Total */}
          {selectedPack && (
            <div className="rounded-md border bg-muted/40 px-4 py-3 flex justify-between items-center">
              <div className="text-sm">
                {quantity} × {selectedPack.name}
              </div>
              <div className="text-lg font-semibold">{formatCents(totalCents)}</div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={submit} disabled={submitting || !selectedUserId || !selectedPack}>
            {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Record sale
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
