import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

interface MemberLite {
  id: string;
  user_id: string | null;
  email: string;
  first_name: string | null;
  last_name: string | null;
}

interface MenuItem {
  id: string;
  item_name: string | null;
  brand_name: string | null;
  price: number;
}

function genCode() {
  const a = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let s = "";
  for (let i = 0; i < 8; i++) s += a[Math.floor(Math.random() * a.length)];
  return s;
}

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  members: MemberLite[];
  onGranted?: () => void;
}

export function GrantCafeVoucherDialog({ open, onOpenChange, members, onGranted }: Props) {
  const [memberId, setMemberId] = useState("");
  const [itemId, setItemId] = useState<string>("__any");
  const [maxValue, setMaxValue] = useState("8");
  const [description, setDescription] = useState("Free drink — on us");
  const [expiresInDays, setExpiresInDays] = useState("30");
  const [code, setCode] = useState(genCode());
  const [items, setItems] = useState<MenuItem[]>([]);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (!open) return;
    setCode(genCode());
    setMemberId("");
    setSearch("");
    supabase
      .from("cafe_menu_items" as any)
      .select("id, item_name, brand_name, price")
      .order("item_name")
      .then(({ data }) => setItems(((data || []) as any[]) as MenuItem[]));
  }, [open]);

  const filteredMembers = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return members.slice(0, 50);
    return members
      .filter(
        (m) =>
          m.email.toLowerCase().includes(q) ||
          (m.first_name || "").toLowerCase().includes(q) ||
          (m.last_name || "").toLowerCase().includes(q),
      )
      .slice(0, 50);
  }, [members, search]);

  const handleSave = async () => {
    if (!memberId) {
      toast.error("Pick a member");
      return;
    }
    setSaving(true);
    try {
      const expiresAt = new Date(Date.now() + parseInt(expiresInDays) * 24 * 60 * 60 * 1000).toISOString();
      const maxCents = itemId === "__any" ? Math.round(parseFloat(maxValue || "0") * 100) : null;
      const { error } = await (supabase.from("cafe_vouchers" as any).insert({
        member_id: memberId,
        code,
        description,
        item_id: itemId === "__any" ? null : itemId,
        max_value_cents: maxCents,
        expires_at: expiresAt,
      }) as any);
      if (error) throw error;
      toast.success(`Voucher ${code} granted`);
      onGranted?.();
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e?.message || "Failed to grant voucher");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Grant Cafe Voucher</DialogTitle>
          <DialogDescription>
            Issue a one-time code to a member. Auto-applies at the POS or in their portal.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-2">
            <Label>Member</Label>
            <Input placeholder="Search members…" value={search} onChange={(e) => setSearch(e.target.value)} />
            <Select value={memberId} onValueChange={setMemberId}>
              <SelectTrigger>
                <SelectValue placeholder="Select a member" />
              </SelectTrigger>
              <SelectContent className="max-h-72">
                {filteredMembers.map((m) => (
                  <SelectItem key={m.id} value={m.id}>
                    {(m.first_name || "") + " " + (m.last_name || "") || m.email} · {m.email}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Item</Label>
            <Select value={itemId} onValueChange={setItemId}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="max-h-72">
                <SelectItem value="__any">Any item (up to max value)</SelectItem>
                {items.map((it) => (
                  <SelectItem key={it.id} value={it.id}>
                    {it.item_name || it.brand_name} (${it.price?.toFixed(2)})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {itemId === "__any" && (
            <div className="space-y-2">
              <Label>Max Value ($)</Label>
              <Input type="number" inputMode="decimal" value={maxValue} onChange={(e) => setMaxValue(e.target.value)} />
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Code</Label>
              <Input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} />
            </div>
            <div className="space-y-2">
              <Label>Expires (days)</Label>
              <Input type="number" value={expiresInDays} onChange={(e) => setExpiresInDays(e.target.value)} />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Description</Label>
            <Input value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />} Grant
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
