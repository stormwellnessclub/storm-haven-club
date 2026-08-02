import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Loader2, Tag, RefreshCcw, Plus, MoreVertical, EyeOff, Eye, Trash2 } from "lucide-react";
import type { ClassPricingRow } from "@/hooks/useClassPassPricing";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SalesPromosTab } from "@/components/admin/promotions/SalesPromosTab";

const CATEGORY_LABEL: Record<string, string> = {
  pilates_cycling: "Pilates & Cycling",
  other: "Other Classes (Sculpt, HIIT, etc.)",
  reformer: "Reformer",
  cycling: "Cycling",
  aerobics: "Aerobics",
};

const CATEGORY_OPTIONS = Object.keys(CATEGORY_LABEL);

const PASS_TYPE_LABEL: Record<string, string> = {
  single: "Single Class",
  "10_pack": "10 Class Pack",
};

const passTypeLabel = (pt: string) =>
  PASS_TYPE_LABEL[pt] ?? pt.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

const AUDIENCE_LABEL: Record<string, string> = {
  member: "Member",
  non_member: "Non-Member",
};

const SELECT_COLS =
  "id, category, pass_type, audience, label, price_cents, classes_included, display_order, stripe_price_id, is_active";

function PriceRow({ row, onSaved }: { row: ClassPricingRow; onSaved: () => void }) {
  const [dollars, setDollars] = useState<string>((row.price_cents / 100).toFixed(2));
  const [saving, setSaving] = useState(false);
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    setDollars((row.price_cents / 100).toFixed(2));
  }, [row.price_cents]);

  const dirty = Math.round(parseFloat(dollars || "0") * 100) !== row.price_cents;

  const save = async () => {
    const cents = Math.round(parseFloat(dollars || "0") * 100);
    if (!Number.isFinite(cents) || cents < 0) {
      toast.error("Enter a valid dollar amount");
      return;
    }
    setSaving(true);
    try {
      const { data, error } = await supabase.functions.invoke("update-class-pass-price", {
        body: { id: row.id, price_cents: cents },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      toast.success(`Updated ${AUDIENCE_LABEL[row.audience]} ${row.label}`);
      onSaved();
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to update price");
    } finally {
      setSaving(false);
    }
  };

  const runMode = async (mode: "deactivate" | "reactivate" | "delete") => {
    setBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke("delete-class-pass-tier", {
        body: { id: row.id, mode },
      });
      if (error) {
        const msg = (await (error as any)?.context?.json?.().catch(() => null))?.error;
        throw new Error(msg || error.message);
      }
      if ((data as any)?.error) throw new Error((data as any).error);
      toast.success(
        mode === "delete" ? "Tier deleted" : mode === "deactivate" ? "Tier deactivated" : "Tier reactivated",
      );
      onSaved();
    } catch (e: any) {
      toast.error(e?.message ?? "Action failed");
    } finally {
      setBusy(false);
      setConfirmDelete(false);
    }
  };

  return (
    <div className="flex items-center gap-3 py-3 border-b last:border-b-0">
      <div className="w-40 flex items-center gap-2">
        <Badge variant={row.audience === "member" ? "default" : "secondary"}>
          {AUDIENCE_LABEL[row.audience]}
        </Badge>
        {!row.is_active && <Badge variant="outline">Inactive</Badge>}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium">{row.label}</div>
        <div className="text-xs text-muted-foreground">
          {row.classes_included} class{row.classes_included === 1 ? "" : "es"}
        </div>
        <div className="text-xs text-muted-foreground font-mono truncate">
          {row.stripe_price_id}
        </div>
      </div>
      <div className="flex items-center gap-2">
        <span className="text-muted-foreground">$</span>
        <Input
          type="number"
          step="0.01"
          min="0"
          value={dollars}
          onChange={(e) => setDollars(e.target.value)}
          className="w-28"
          disabled={saving || busy}
        />
        <Button size="sm" onClick={save} disabled={!dirty || saving || busy}>
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save"}
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button size="icon" variant="ghost" disabled={busy} aria-label="Tier actions">
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <MoreVertical className="h-4 w-4" />}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {row.is_active ? (
              <DropdownMenuItem onClick={() => runMode("deactivate")}>
                <EyeOff className="h-4 w-4 mr-2" /> Deactivate (recommended)
              </DropdownMenuItem>
            ) : (
              <DropdownMenuItem onClick={() => runMode("reactivate")}>
                <Eye className="h-4 w-4 mr-2" /> Reactivate
              </DropdownMenuItem>
            )}
            <DropdownMenuItem className="text-destructive" onClick={() => setConfirmDelete(true)}>
              <Trash2 className="h-4 w-4 mr-2" /> Delete permanently
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete “{row.label}”?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently removes the pricing tier and archives its Stripe price. Passes already
              sold are not affected. If the tier has recorded sales, deletion is blocked — deactivate
              it instead.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => runMode("delete")}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function AddTierDialog({ open, onOpenChange, onCreated }: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onCreated: () => void;
}) {
  const [category, setCategory] = useState("pilates_cycling");
  const [audience, setAudience] = useState("member");
  const [passTypeChoice, setPassTypeChoice] = useState("single");
  const [customPassType, setCustomPassType] = useState("");
  const [classes, setClasses] = useState("1");
  const [label, setLabel] = useState("");
  const [dollars, setDollars] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (passTypeChoice === "single") setClasses("1");
    if (passTypeChoice === "10_pack") setClasses("10");
  }, [passTypeChoice]);

  const passType = passTypeChoice === "custom" ? customPassType : passTypeChoice;

  const submit = async () => {
    const cents = Math.round(parseFloat(dollars || "0") * 100);
    const classesIncluded = parseInt(classes || "0", 10);
    if (!passType.trim()) return toast.error("Enter a pass type");
    if (!label.trim()) return toast.error("Enter a label");
    if (!Number.isFinite(cents) || cents < 0) return toast.error("Enter a valid price");
    if (!classesIncluded || classesIncluded < 1) return toast.error("Classes included must be at least 1");

    setSaving(true);
    try {
      const { data, error } = await supabase.functions.invoke("create-class-pass-tier", {
        body: {
          category,
          audience,
          pass_type: passType,
          label: label.trim(),
          price_cents: cents,
          classes_included: classesIncluded,
        },
      });
      if (error) {
        const msg = (await (error as any)?.context?.json?.().catch(() => null))?.error;
        throw new Error(msg || error.message);
      }
      if ((data as any)?.error) throw new Error((data as any).error);
      toast.success("Pricing tier created");
      onCreated();
      onOpenChange(false);
      setLabel("");
      setDollars("");
      setCustomPassType("");
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to create tier");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Add pricing tier</DialogTitle>
          <DialogDescription>
            A Stripe product and price are created automatically so this tier is sellable right away.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-1">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Category</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CATEGORY_OPTIONS.map((c) => (
                    <SelectItem key={c} value={c}>{CATEGORY_LABEL[c]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Audience</Label>
              <Select value={audience} onValueChange={setAudience}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="member">Member</SelectItem>
                  <SelectItem value="non_member">Non-Member</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Pass type</Label>
              <Select value={passTypeChoice} onValueChange={setPassTypeChoice}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="single">Single Class</SelectItem>
                  <SelectItem value="10_pack">10 Class Pack</SelectItem>
                  <SelectItem value="custom">Custom pack…</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Classes included</Label>
              <Input
                type="number"
                min={1}
                value={classes}
                onChange={(e) => setClasses(e.target.value)}
              />
            </div>
          </div>

          {passTypeChoice === "custom" && (
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Custom pass type key (e.g. 5_pack)</Label>
              <Input
                value={customPassType}
                onChange={(e) => setCustomPassType(e.target.value)}
                placeholder="5_pack"
              />
            </div>
          )}

          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Display label</Label>
            <Input
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="5 Class Pack (Member)"
            />
          </div>

          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Price (USD)</Label>
            <Input
              type="number"
              step="0.01"
              min="0"
              value={dollars}
              onChange={(e) => setDollars(e.target.value)}
              placeholder="95.00"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={saving}>Cancel</Button>
          <Button onClick={submit} disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
            Create tier
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function ClassPassPricing() {
  const queryClient = useQueryClient();
  const [showInactive, setShowInactive] = useState(false);
  const [addOpen, setAddOpen] = useState(false);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["admin-class-pricing"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("class_pricing")
        .select(SELECT_COLS)
        .order("category")
        .order("pass_type")
        .order("audience");
      if (error) throw error;
      return (data ?? []) as unknown as ClassPricingRow[];
    },
  });

  const visible = useMemo(
    () => (data ?? []).filter((r) => showInactive || r.is_active),
    [data, showInactive],
  );

  const grouped = useMemo(() => {
    const map = new Map<string, ClassPricingRow[]>();
    visible.forEach((r) => {
      const key = `${r.category}::${r.pass_type}`;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(r);
    });
    return Array.from(map.entries());
  }, [visible]);

  const onSaved = () => {
    queryClient.invalidateQueries({ queryKey: ["admin-class-pricing"] });
    queryClient.invalidateQueries({ queryKey: ["class-pass-pricing"] });
  };

  return (
    <AdminLayout>
      <div className="max-w-4xl mx-auto space-y-6 p-4 sm:p-6">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold flex items-center gap-2">
              <Tag className="h-6 w-6" /> Class Passes
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Manage everyday pricing, plus sales and promo codes.
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            <RefreshCcw className="h-4 w-4 mr-1" /> Refresh
          </Button>
        </div>

        <Tabs defaultValue="pricing">
          <TabsList>
            <TabsTrigger value="pricing">Pricing</TabsTrigger>
            <TabsTrigger value="sales">Sales &amp; Promos</TabsTrigger>
          </TabsList>

          <TabsContent value="pricing" className="mt-4 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm text-muted-foreground">
                Saving creates a new Stripe price automatically — existing purchases are not affected.
              </p>
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <Switch id="show-inactive" checked={showInactive} onCheckedChange={setShowInactive} />
                  <Label htmlFor="show-inactive" className="text-sm">Show inactive</Label>
                </div>
                <Button size="sm" onClick={() => setAddOpen(true)}>
                  <Plus className="h-4 w-4 mr-1" /> Add tier
                </Button>
              </div>
            </div>

            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <div className="space-y-4">
                {grouped.map(([key, rows]) => {
                  const [category, passType] = key.split("::");
                  return (
                    <Card key={key}>
                      <CardHeader>
                        <CardTitle className="text-base">
                          {CATEGORY_LABEL[category] ?? category} — {passTypeLabel(passType)}
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        {rows.map((r) => (
                          <PriceRow key={r.id} row={r} onSaved={onSaved} />
                        ))}
                      </CardContent>
                    </Card>
                  );
                })}
                {grouped.length === 0 && (
                  <p className="text-sm text-muted-foreground py-8 text-center">
                    No pricing tiers yet. Use “Add tier” to create one.
                  </p>
                )}
              </div>
            )}
          </TabsContent>

          <TabsContent value="sales" className="mt-4">
            <SalesPromosTab tiers={(data ?? []).filter((r) => r.is_active)} />
          </TabsContent>
        </Tabs>

        <AddTierDialog open={addOpen} onOpenChange={setAddOpen} onCreated={onSaved} />
      </div>
    </AdminLayout>
  );
}
