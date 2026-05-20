import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Coffee, Plus, CreditCard, Gift, Loader2, History, Settings2 } from "lucide-react";
import { format } from "date-fns";
import {
  useMemberCafeCredit, useCafeCreditLedger,
  useGrantCashCredit, useGrantPrepaidItems, useAdjustCafeCredit, useChargeCardForCredit,
  formatCents, LEDGER_KIND_LABEL,
} from "@/hooks/useMemberCafeCredit";
import { useUserRoles } from "@/hooks/useUserRoles";

interface Member {
  id: string;
  first_name: string;
  last_name: string;
  stripe_customer_id?: string | null;
}

interface Props {
  member: Member;
}

export function CafeCreditPanel({ member }: Props) {
  const { data: balance, isLoading } = useMemberCafeCredit(member.id);
  const [openDialog, setOpenDialog] = useState<null | "cash" | "card" | "items" | "adjust" | "history">(null);
  const { hasAnyRole } = useUserRoles();
  const isSuperAdmin = hasAnyRole(["super_admin"]);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center justify-between text-base">
          <span className="flex items-center gap-2">
            <Coffee className="h-4 w-4 text-amber-600" />
            Cafe Credit
          </span>
          <Button size="sm" variant="ghost" onClick={() => setOpenDialog("history")}>
            <History className="h-4 w-4 mr-1" /> Ledger
          </Button>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {isLoading ? (
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        ) : (
          <>
            <div className="flex items-baseline justify-between">
              <span className="text-sm text-muted-foreground">Cash balance</span>
              <span className="text-2xl font-semibold tabular-nums">
                {formatCents(balance?.balance_cents || 0)}
              </span>
            </div>

            {balance && balance.prepaid_items.length > 0 && (
              <div className="space-y-1 border-t pt-2">
                <div className="text-xs text-muted-foreground">Prepaid items</div>
                <div className="flex flex-wrap gap-1">
                  {balance.prepaid_items.map((p) => (
                    <Badge key={p.menu_item_id} variant="secondary" className="font-normal">
                      {p.quantity_remaining}× {p.item_name}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-2 pt-2">
              <Button size="sm" variant="outline" onClick={() => setOpenDialog("cash")}>
                <Plus className="h-3 w-3 mr-1" /> Add Cash
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setOpenDialog("card")}
                disabled={!member.stripe_customer_id}
                title={!member.stripe_customer_id ? "No card on file" : ""}
              >
                <CreditCard className="h-3 w-3 mr-1" /> Charge Card
              </Button>
              <Button size="sm" variant="outline" onClick={() => setOpenDialog("items")}>
                <Gift className="h-3 w-3 mr-1" /> Grant Items
              </Button>
              {isSuperAdmin && (
                <Button size="sm" variant="outline" onClick={() => setOpenDialog("adjust")}>
                  <Settings2 className="h-3 w-3 mr-1" /> Adjust
                </Button>
              )}
            </div>
          </>
        )}
      </CardContent>

      <AddCashDialog memberId={member.id} open={openDialog === "cash"} onClose={() => setOpenDialog(null)} />
      <ChargeCardDialog
        memberId={member.id}
        stripeCustomerId={member.stripe_customer_id || null}
        open={openDialog === "card"}
        onClose={() => setOpenDialog(null)}
      />
      <GrantItemsDialog memberId={member.id} open={openDialog === "items"} onClose={() => setOpenDialog(null)} />
      <AdjustDialog memberId={member.id} open={openDialog === "adjust"} onClose={() => setOpenDialog(null)} />
      <HistoryDialog memberId={member.id} open={openDialog === "history"} onClose={() => setOpenDialog(null)} />
    </Card>
  );
}

// ============================================================
// Add Cash Credit
// ============================================================
function AddCashDialog({ memberId, open, onClose }: { memberId: string; open: boolean; onClose: () => void }) {
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const grant = useGrantCashCredit(memberId);

  const submit = async () => {
    const dollars = parseFloat(amount);
    if (!dollars || dollars <= 0) return;
    await grant.mutateAsync({ amountDollars: dollars, reason });
    setAmount(""); setReason(""); onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add Cash Credit</DialogTitle>
          <DialogDescription>Adds a free cash balance the member can spend at the cafe.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1">
            <Label>Amount ($)</Label>
            <Input type="number" step="0.01" min="0" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="25.00" autoFocus />
          </div>
          <div className="space-y-1">
            <Label>Reason / Note</Label>
            <Textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Birthday gift, comp for service issue" rows={2} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={submit} disabled={grant.isPending || !amount}>
            {grant.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Add Credit
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ============================================================
// Charge Card → Credit
// ============================================================
function ChargeCardDialog({
  memberId, stripeCustomerId, open, onClose,
}: { memberId: string; stripeCustomerId: string | null; open: boolean; onClose: () => void }) {
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const charge = useChargeCardForCredit(memberId);

  const submit = async () => {
    const dollars = parseFloat(amount);
    if (!dollars || dollars <= 0 || !stripeCustomerId) return;
    await charge.mutateAsync({ stripeCustomerId, amountDollars: dollars, reason });
    setAmount(""); setReason(""); onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Charge Card → Cafe Credit</DialogTitle>
          <DialogDescription>
            Charges the member's saved card and deposits the same amount to their cafe wallet.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1">
            <Label>Amount to charge ($)</Label>
            <Input type="number" step="0.01" min="0" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="50.00" autoFocus />
          </div>
          <div className="space-y-1">
            <Label>Note (optional)</Label>
            <Textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={2} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={submit} disabled={charge.isPending || !amount}>
            {charge.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Charge & Credit
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ============================================================
// Grant Prepaid Items
// ============================================================
function GrantItemsDialog({ memberId, open, onClose }: { memberId: string; open: boolean; onClose: () => void }) {
  const [menuItemId, setMenuItemId] = useState("");
  const [quantity, setQuantity] = useState("10");
  const [reason, setReason] = useState("");
  const grant = useGrantPrepaidItems(memberId);

  const { data: menuItems = [] } = useQuery({
    queryKey: ["cafe-menu-items-for-grant"],
    queryFn: async () => {
      const { data, error } = await (supabase.from as any)("cafe_menu_items")
        .select("id, brand_name, item_name, flavor, price")
        .eq("is_active", true)
        .order("item_name");
      if (error) throw error;
      return data || [];
    },
    enabled: open,
  });

  const submit = async () => {
    const qty = parseInt(quantity, 10);
    if (!menuItemId || !qty || qty <= 0) return;
    await grant.mutateAsync({ menuItemId, quantity: qty, reason });
    setMenuItemId(""); setQuantity("10"); setReason(""); onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Grant Prepaid Items</DialogTitle>
          <DialogDescription>e.g. give the member 10 prepaid lattes redeemable at the cafe.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1">
            <Label>Menu Item</Label>
            <select
              className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
              value={menuItemId}
              onChange={(e) => setMenuItemId(e.target.value)}
            >
              <option value="">Select an item…</option>
              {menuItems.map((m: any) => {
                const label = [m.brand_name, m.item_name, m.flavor].filter(Boolean).join(" ");
                return (
                  <option key={m.id} value={m.id}>
                    {label || "Item"} — ${Number(m.price).toFixed(2)}
                  </option>
                );
              })}
            </select>
          </div>
          <div className="space-y-1">
            <Label>Quantity</Label>
            <Input type="number" min="1" value={quantity} onChange={(e) => setQuantity(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>Reason / Note</Label>
            <Textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={2} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={submit} disabled={grant.isPending || !menuItemId}>
            {grant.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Grant
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ============================================================
// Adjust (super admin)
// ============================================================
function AdjustDialog({ memberId, open, onClose }: { memberId: string; open: boolean; onClose: () => void }) {
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const adjust = useAdjustCafeCredit(memberId);

  const submit = async () => {
    const dollars = parseFloat(amount);
    if (!dollars || !reason.trim()) return;
    await adjust.mutateAsync({ amountDollars: dollars, reason });
    setAmount(""); setReason(""); onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Adjust Cafe Credit</DialogTitle>
          <DialogDescription>
            Use a negative amount to deduct (e.g. -10.00 to remove $10). Super-admin only. Reason required.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1">
            <Label>Amount ($) — negative to deduct</Label>
            <Input type="number" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="-10.00" autoFocus />
          </div>
          <div className="space-y-1">
            <Label>Reason (required)</Label>
            <Textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={2} required />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={submit} disabled={adjust.isPending || !amount || !reason.trim()}>
            {adjust.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Post Adjustment
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ============================================================
// History / Ledger
// ============================================================
function HistoryDialog({ memberId, open, onClose }: { memberId: string; open: boolean; onClose: () => void }) {
  const { data: ledger = [], isLoading } = useCafeCreditLedger(open ? memberId : null);

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Cafe Credit Ledger</DialogTitle>
          <DialogDescription>Complete history of credits, top-ups, and redemptions.</DialogDescription>
        </DialogHeader>
        <div className="max-h-[60vh] overflow-y-auto space-y-1">
          {isLoading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : ledger.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">No activity yet.</p>
          ) : (
            ledger.map((e) => (
              <div key={e.id} className="flex items-start justify-between gap-3 border-b py-2 text-sm">
                <div className="min-w-0 flex-1">
                  <div className="font-medium">{LEDGER_KIND_LABEL[e.kind] || e.kind}</div>
                  <div className="text-xs text-muted-foreground">
                    {format(new Date(e.created_at), "MMM d, yyyy h:mm a")}
                    {e.menu_item_name && ` • ${e.menu_item_name}`}
                  </div>
                  {e.reason && <div className="text-xs text-muted-foreground italic">{e.reason}</div>}
                </div>
                <div className="text-right shrink-0 tabular-nums">
                  {e.amount_cents !== 0 && (
                    <div className={e.amount_cents > 0 ? "text-emerald-600 font-medium" : "text-destructive font-medium"}>
                      {e.amount_cents > 0 ? "+" : ""}{formatCents(e.amount_cents)}
                    </div>
                  )}
                  {e.item_quantity !== 0 && (
                    <div className="text-xs text-muted-foreground">
                      {e.item_quantity > 0 ? "+" : ""}{e.item_quantity} item{Math.abs(e.item_quantity) !== 1 ? "s" : ""}
                    </div>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
