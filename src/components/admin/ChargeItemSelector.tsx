import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DollarSign, Loader2, Banknote, Plus } from "lucide-react";
import { calculateProcessingFeeFromDollars } from "@/lib/processingFee";
import {
  MEMBERSHIP_PRICING,
  INITIATION_FEE,
  extractTier,
  normalizeGender,
  type MembershipTier,
  type GenderType,
} from "@/lib/membershipPricing";
import {
  useCafeMenuCategories,
  useCafeMenuItems,
  useCafeMenuAddons,
  useAddCafeCategory,
  useAddCafeMenuItem,
  useAddCafeAddon,
  MI_SALES_TAX_RATE,
  calculateTax,
} from "@/hooks/useCafeMenu";

interface ChargeItem {
  id: string;
  label: string;
  amount: number | null;
  description: string;
  chargeType: string;
  group: string;
}

function buildChargeItems(
  membershipType: string | null,
  gender: string | null,
  billingType: string | null
): ChargeItem[] {
  const tier = extractTier(membershipType);
  const g = normalizeGender(gender);
  const monthlyPrice = MEMBERSHIP_PRICING[tier]?.monthly?.[g] ?? 0;
  const annualPrice = MEMBERSHIP_PRICING[tier]?.annual?.[g] ?? 0;
  const initiationFee = INITIATION_FEE[g];
  const tierLabel = tier.charAt(0).toUpperCase() + tier.slice(1);

  return [
    { id: "dues_monthly", label: "Membership Dues (Monthly)", amount: monthlyPrice, description: `Monthly membership dues - ${tierLabel}`, chargeType: "membership_dues", group: "Membership" },
    { id: "dues_annual", label: "Membership Dues (Annual)", amount: annualPrice, description: `Annual membership dues - ${tierLabel}`, chargeType: "membership_dues", group: "Membership" },
    { id: "past_due", label: "Past Due Payment", amount: monthlyPrice, description: `Past due membership payment - ${tierLabel}`, chargeType: "membership_dues", group: "Membership" },
    { id: "failed_recovery", label: "Failed Payment Recovery", amount: monthlyPrice, description: `Failed payment recovery - ${tierLabel}`, chargeType: "membership_dues", group: "Membership" },
    { id: "initiation_fee", label: `Initiation Fee ($${initiationFee})`, amount: initiationFee, description: "Initiation fee", chargeType: "initiation_fee", group: "Fees" },
    { id: "guest_pass", label: "Guest Pass ($60)", amount: 60, description: "Guest pass - gym and amenities", chargeType: "guest_pass", group: "Guest Services" },
    { id: "rlt_10", label: "RLT 10 min ($18)", amount: 18, description: "Red Light Therapy 10 min", chargeType: "guest_pass", group: "Guest Services" },
    { id: "rlt_20", label: "RLT 20 min ($28)", amount: 28, description: "Red Light Therapy 20 min", chargeType: "guest_pass", group: "Guest Services" },
    { id: "cryo", label: "ZeroBody Cryo ($45)", amount: 45, description: "ZeroBody Cryo Session", chargeType: "guest_pass", group: "Guest Services" },
    { id: "single_member_pilates", label: "Single Pass - Pilates/Cycling (Member $25)", amount: 25, description: "Single class pass - Pilates/Cycling", chargeType: "class_pass", group: "Class Passes" },
    { id: "single_member_other", label: "Single Pass - Other (Member $15)", amount: 15, description: "Single class pass", chargeType: "class_pass", group: "Class Passes" },
    { id: "single_nonmember_pilates", label: "Single Pass - Pilates/Cycling (Non-Member $40)", amount: 40, description: "Single class pass (non-member) - Pilates/Cycling", chargeType: "class_pass", group: "Class Passes" },
    { id: "single_nonmember_other", label: "Single Pass - Other (Non-Member $30)", amount: 30, description: "Single class pass (non-member)", chargeType: "class_pass", group: "Class Passes" },
    { id: "10pack_member_pilates", label: "10-Pack - Pilates/Cycling (Member $170)", amount: 170, description: "10-pack class pass - Pilates/Cycling", chargeType: "class_pass", group: "Class Passes" },
    { id: "10pack_member_other", label: "10-Pack - Other (Member $150)", amount: 150, description: "10-pack class pass", chargeType: "class_pass", group: "Class Passes" },
    { id: "10pack_nonmember_pilates", label: "10-Pack - Pilates/Cycling (Non-Member $300)", amount: 300, description: "10-pack class pass (non-member) - Pilates/Cycling", chargeType: "class_pass", group: "Class Passes" },
    { id: "10pack_nonmember_other", label: "10-Pack - Other (Non-Member $200)", amount: 200, description: "10-pack class pass (non-member)", chargeType: "class_pass", group: "Class Passes" },
    { id: "late_cancel", label: "Late Cancel Fee ($25)", amount: 25, description: "Late cancellation fee", chargeType: "other", group: "Fees" },
    { id: "custom", label: "Custom Amount", amount: null, description: "", chargeType: "other", group: "Custom" },
  ];
}

interface NonMemberInfo {
  userId: string;
  stripeCustomerId?: string;
  firstName?: string;
  lastName?: string;
}

interface ChargeItemSelectorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  member: {
    id: string;
    first_name: string;
    last_name: string;
    membership_type: string;
    gender: string | null;
    billing_type: string | null;
    status?: string;
  };
  nonMember?: NonMemberInfo;
  onChargeSuccess?: () => void;
  onRequires3DS?: (amount: number, description: string) => void;
}

export function ChargeItemSelector({
  open,
  onOpenChange,
  member,
  nonMember,
  onChargeSuccess,
  onRequires3DS,
}: ChargeItemSelectorProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [selectedItemId, setSelectedItemId] = useState("");
  const [chargeAmount, setChargeAmount] = useState("");
  const [chargeDescription, setChargeDescription] = useState("");
  const [chargeType, setChargeType] = useState("other");
  const [isManualPayment, setIsManualPayment] = useState(false);
  const [manualPaymentMethod, setManualPaymentMethod] = useState("cash");
  const [alsoActivate, setAlsoActivate] = useState(false);
  const [isCharging, setIsCharging] = useState(false);

  // Cafe state
  const [isAddingCafeItem, setIsAddingCafeItem] = useState(false);
  const [newItemFields, setNewItemFields] = useState({ brand_name: "", flavor: "", size: "", price: "", category_id: "" });
  const [isAddingCategory, setIsAddingCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [isAddingAddon, setIsAddingAddon] = useState(false);
  const [newAddonFields, setNewAddonFields] = useState({ name: "", price: "", category_id: "" });

  // Protein shake customization
  const [proteinFlavor, setProteinFlavor] = useState("");
  const [customFlavor, setCustomFlavor] = useState("");
  const [selectedAddons, setSelectedAddons] = useState<string[]>([]);
  const [quantity, setQuantity] = useState(1);

  const isPendingActivation = member.status === "pending_activation";

  // Fetch cafe data
  const { data: categories = [] } = useCafeMenuCategories();
  const { data: cafeItems = [] } = useCafeMenuItems();
  const { data: addons = [] } = useCafeMenuAddons();
  const addCategory = useAddCafeCategory();
  const addItem = useAddCafeMenuItem();
  const addAddon = useAddCafeAddon();

  const chargeItems = buildChargeItems(member.membership_type, member.gender, member.billing_type);

  // Build cafe charge items grouped by category
  const cafeChargeItems: ChargeItem[] = cafeItems.map((item) => {
    const cat = categories.find((c) => c.id === item.category_id);
    const parts: string[] = [];
    if (item.brand_name) parts.push(item.brand_name);
    if (item.item_name) parts.push(item.item_name);
    if (item.flavor) parts.push(item.flavor);
    if (item.size) parts.push(`(${item.size})`);
    const label = parts.length > 0 ? parts.join(" - ") : "Item";
    const groupName = cat ? cat.name : "Cafe / Juice Bar";

    return {
      id: `cafe_${item.id}`,
      label: `${label} ($${Number(item.price).toFixed(2)})`,
      amount: Number(item.price),
      description: `Cafe - ${label}`,
      chargeType: "cafe",
      group: groupName,
    };
  });

  // Add management actions
  const addNewCafeItem: ChargeItem = { id: "cafe_add_new", label: "+ Add New Item", amount: null, description: "", chargeType: "cafe", group: "Cafe Management" };
  const addNewCategory: ChargeItem = { id: "cafe_add_category", label: "+ Add New Category", amount: null, description: "", chargeType: "cafe", group: "Cafe Management" };
  const addNewAddon: ChargeItem = { id: "cafe_add_addon", label: "+ Add New Add-on", amount: null, description: "", chargeType: "cafe", group: "Cafe Management" };

  const allChargeItems = [...chargeItems, ...cafeChargeItems, addNewCafeItem, addNewCategory, addNewAddon];

  const selectedCafeItem = selectedItemId.startsWith("cafe_")
    ? cafeItems.find((i) => `cafe_${i.id}` === selectedItemId)
    : null;
  const selectedCafeCategory = selectedCafeItem
    ? categories.find((c) => c.id === selectedCafeItem.category_id)
    : null;
  const isCafeWithAddons = selectedCafeCategory?.has_addons ?? false;
  const categoryAddons = isCafeWithAddons ? addons.filter((a) => a.category_id === selectedCafeCategory?.id) : [];

  const handleItemSelect = (itemId: string) => {
    if (itemId === "cafe_add_new") {
      setIsAddingCafeItem(true);
      setIsAddingCategory(false);
      setIsAddingAddon(false);
      setSelectedItemId("");
      return;
    }
    if (itemId === "cafe_add_category") {
      setIsAddingCategory(true);
      setIsAddingCafeItem(false);
      setIsAddingAddon(false);
      setSelectedItemId("");
      return;
    }
    if (itemId === "cafe_add_addon") {
      setIsAddingAddon(true);
      setIsAddingCafeItem(false);
      setIsAddingCategory(false);
      setSelectedItemId("");
      return;
    }
    setIsAddingCafeItem(false);
    setIsAddingCategory(false);
    setIsAddingAddon(false);
    setSelectedItemId(itemId);
    setSelectedAddons([]);
    setProteinFlavor("");
    setCustomFlavor("");
    setQuantity(1);

    const item = allChargeItems.find((i) => i.id === itemId);
    if (item) {
      if (item.amount !== null) setChargeAmount(item.amount.toString());
      else setChargeAmount("");
      setChargeDescription(item.description);
      setChargeType(item.chargeType);
    }
  };

  // When addons or flavor are selected, recalculate amount
  const getEffectiveAmount = () => {
    if (!selectedCafeItem) return parseFloat(chargeAmount) || 0;
    let base = Number(selectedCafeItem.price);
    const addonTotal = addons
      .filter((a) => selectedAddons.includes(a.id))
      .reduce((s, a) => s + Number(a.price), 0);
    return base + addonTotal;
  };

  const isCafeItem = chargeType === "cafe" && selectedCafeItem;
  const unitAmount = isCafeItem ? getEffectiveAmount() : parseFloat(chargeAmount) || 0;
  const effectiveAmount = unitAmount * quantity;
  const cafeTax = isCafeItem ? calculateTax(effectiveAmount) : 0;
  const totalWithTax = isCafeItem ? effectiveAmount + cafeTax : effectiveAmount;

  const handleSaveNewItem = async () => {
    const price = parseFloat(newItemFields.price);
    if (!newItemFields.category_id || isNaN(price) || price <= 0) {
      toast.error("Select a category and enter a valid price");
      return;
    }
    await addItem.mutateAsync({
      category_id: newItemFields.category_id,
      brand_name: newItemFields.brand_name || undefined,
      flavor: newItemFields.flavor || undefined,
      size: newItemFields.size || undefined,
      price,
    });
    setNewItemFields({ brand_name: "", flavor: "", size: "", price: "", category_id: "" });
    setIsAddingCafeItem(false);
  };

  const handleSaveNewCategory = async () => {
    if (!newCategoryName.trim()) return;
    await addCategory.mutateAsync(newCategoryName.trim());
    setNewCategoryName("");
    setIsAddingCategory(false);
  };

  const handleSaveNewAddon = async () => {
    const price = parseFloat(newAddonFields.price);
    if (!newAddonFields.name.trim() || !newAddonFields.category_id || isNaN(price) || price <= 0) {
      toast.error("Fill in all fields");
      return;
    }
    await addAddon.mutateAsync({ name: newAddonFields.name.trim(), price, category_id: newAddonFields.category_id });
    setNewAddonFields({ name: "", price: "", category_id: "" });
    setIsAddingAddon(false);
  };

  const handleCharge = async () => {
    const finalAmount = isCafeItem ? totalWithTax : effectiveAmount;
    const amountInCents = Math.round(finalAmount * 100);
    if (isNaN(amountInCents) || amountInCents < 50) {
      toast.error("Minimum charge amount is $0.50");
      return;
    }

    let desc = chargeDescription.trim();
    if (quantity > 1) desc = `${quantity}x ${desc}`;
    if (isCafeItem) {
      const flavorStr = proteinFlavor === "other" ? customFlavor || "Custom" : proteinFlavor;
      if (flavorStr) desc += ` (${flavorStr})`;
      if (selectedAddons.length > 0) {
        const addonNames = addons.filter((a) => selectedAddons.includes(a.id)).map((a) => a.name);
        desc += ` + ${addonNames.join(", ")}`;
      }
      desc += ` (incl. MI 6% tax)`;
    }

    if (!desc) {
      toast.error("Please enter a description");
      return;
    }

    setIsCharging(true);
    try {
      if (isManualPayment) {
        // For non-members, use user_id; for members, use member_id
        const insertData: any = {
          amount: amountInCents,
          description: `[${manualPaymentMethod.toUpperCase()}] ${desc} (${chargeType})`,
          status: "succeeded",
          charged_by: user?.id || "unknown",
          user_id: nonMember?.userId || user?.id || "unknown",
        };
        if (!nonMember) {
          insertData.member_id = member.id;
        }
        const { error } = await supabase.from("manual_charges").insert(insertData);
        if (error) throw error;

        if (alsoActivate && isPendingActivation) {
          const { error: activateError } = await supabase
            .from("members")
            .update({ status: "active", activated_at: new Date().toISOString(), subscription_status: "none", updated_at: new Date().toISOString() })
            .eq("id", member.id);
          if (activateError) {
            toast.error("Payment recorded but failed to activate member");
          } else {
            toast.success(`Manual payment of $${finalAmount.toFixed(2)} recorded & member activated`);
            onChargeSuccess?.();
            resetAndClose();
            return;
          }
        }
        toast.success(`Manual payment of $${finalAmount.toFixed(2)} recorded`);
      } else {
        // For non-members, pass stripeCustomerId directly; for members, pass memberId
        const chargeBody: any = {
          action: "charge_saved_card_with_3ds",
          amount: amountInCents,
          description: desc,
        };
        if (nonMember?.stripeCustomerId) {
          chargeBody.stripeCustomerId = nonMember.stripeCustomerId;
        } else {
          chargeBody.memberId = member.id;
        }
        const { data, error } = await supabase.functions.invoke("stripe-payment", {
          body: chargeBody,
        });
        if (error) throw error;
        if (data?.requires_action && onRequires3DS) {
          onRequires3DS(amountInCents, desc);
          resetAndClose();
          return;
        }
        if (!data?.success) throw new Error(data?.error || "Charge failed");
        toast.success(`Successfully charged $${finalAmount.toFixed(2)}`);
      }
      onChargeSuccess?.();
      resetAndClose();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to process payment");
    } finally {
      setIsCharging(false);
    }
  };

  const resetAndClose = () => {
    setSelectedItemId("");
    setChargeAmount("");
    setChargeDescription("");
    setChargeType("other");
    setIsManualPayment(false);
    setManualPaymentMethod("cash");
    setAlsoActivate(false);
    setIsAddingCafeItem(false);
    setIsAddingCategory(false);
    setIsAddingAddon(false);
    setSelectedAddons([]);
    setProteinFlavor("");
    setCustomFlavor("");
    setQuantity(1);
    onOpenChange(false);
  };

  // Group items for the select
  const groups = allChargeItems.reduce((acc, item) => {
    if (!acc[item.group]) acc[item.group] = [];
    acc[item.group].push(item);
    return acc;
  }, {} as Record<string, ChargeItem[]>);

  const showingForm = isAddingCafeItem || isAddingCategory || isAddingAddon;
  const addonCategoryOptions = categories.filter((c) => c.has_addons);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Charge / Record Payment</DialogTitle>
          <DialogDescription>
            {member.first_name} {member.last_name} — Select an item or enter a custom charge
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Item selector */}
          <div>
            <Label>Charge Item</Label>
            <Select value={selectedItemId} onValueChange={handleItemSelect}>
              <SelectTrigger>
                <SelectValue placeholder="Select an item..." />
              </SelectTrigger>
              <SelectContent className="max-h-[300px]">
                {Object.entries(groups).map(([group, items]) => (
                  <SelectGroup key={group}>
                    <SelectLabel>{group}</SelectLabel>
                    {items.map((item) => (
                      <SelectItem key={item.id} value={item.id}>
                        {item.id.startsWith("cafe_add") ? (
                          <span className="flex items-center gap-1 text-primary">
                            <Plus className="h-3 w-3" /> {item.label.replace("+ ", "")}
                          </span>
                        ) : (
                          item.label
                        )}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Add New Category form */}
          {isAddingCategory && (
            <div className="rounded-lg border border-primary/20 bg-primary/5 p-3 space-y-3">
              <p className="text-sm font-medium">Add New Category</p>
              <Input value={newCategoryName} onChange={(e) => setNewCategoryName(e.target.value)} placeholder="e.g. Kombucha" />
              <div className="flex gap-2">
                <Button size="sm" onClick={handleSaveNewCategory} disabled={addCategory.isPending}>
                  {addCategory.isPending && <Loader2 className="h-4 w-4 animate-spin mr-1" />} Save
                </Button>
                <Button size="sm" variant="outline" onClick={() => setIsAddingCategory(false)}>Cancel</Button>
              </div>
            </div>
          )}

          {/* Add New Item form */}
          {isAddingCafeItem && (
            <div className="rounded-lg border border-primary/20 bg-primary/5 p-3 space-y-3">
              <p className="text-sm font-medium">Add New Cafe Item</p>
              <div>
                <Label className="text-xs">Category</Label>
                <Select value={newItemFields.category_id} onValueChange={(v) => setNewItemFields((p) => ({ ...p, category_id: v }))}>
                  <SelectTrigger><SelectValue placeholder="Select category..." /></SelectTrigger>
                  <SelectContent>
                    {categories.map((c) => (
                      <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label className="text-xs">Brand</Label>
                  <Input value={newItemFields.brand_name} onChange={(e) => setNewItemFields((p) => ({ ...p, brand_name: e.target.value }))} placeholder="e.g. Fiji" />
                </div>
                <div>
                  <Label className="text-xs">Flavor</Label>
                  <Input value={newItemFields.flavor} onChange={(e) => setNewItemFields((p) => ({ ...p, flavor: e.target.value }))} placeholder="e.g. Greens 3" />
                </div>
                <div>
                  <Label className="text-xs">Size</Label>
                  <Input value={newItemFields.size} onChange={(e) => setNewItemFields((p) => ({ ...p, size: e.target.value }))} placeholder="e.g. 16oz" />
                </div>
                <div>
                  <Label className="text-xs">Price ($)</Label>
                  <div className="relative">
                    <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input type="number" step="0.01" min="0.01" value={newItemFields.price} onChange={(e) => setNewItemFields((p) => ({ ...p, price: e.target.value }))} className="pl-9" />
                  </div>
                </div>
              </div>
              <div className="flex gap-2">
                <Button size="sm" onClick={handleSaveNewItem} disabled={addItem.isPending}>
                  {addItem.isPending && <Loader2 className="h-4 w-4 animate-spin mr-1" />} Save Item
                </Button>
                <Button size="sm" variant="outline" onClick={() => setIsAddingCafeItem(false)}>Cancel</Button>
              </div>
            </div>
          )}

          {/* Add New Add-on form */}
          {isAddingAddon && (
            <div className="rounded-lg border border-primary/20 bg-primary/5 p-3 space-y-3">
              <p className="text-sm font-medium">Add New Add-on</p>
              <div>
                <Label className="text-xs">Category (must have add-ons enabled)</Label>
                <Select value={newAddonFields.category_id} onValueChange={(v) => setNewAddonFields((p) => ({ ...p, category_id: v }))}>
                  <SelectTrigger><SelectValue placeholder="Select category..." /></SelectTrigger>
                  <SelectContent>
                    {addonCategoryOptions.map((c) => (
                      <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label className="text-xs">Name</Label>
                  <Input value={newAddonFields.name} onChange={(e) => setNewAddonFields((p) => ({ ...p, name: e.target.value }))} placeholder="e.g. Collagen" />
                </div>
                <div>
                  <Label className="text-xs">Price ($)</Label>
                  <Input type="number" step="0.01" value={newAddonFields.price} onChange={(e) => setNewAddonFields((p) => ({ ...p, price: e.target.value }))} />
                </div>
              </div>
              <div className="flex gap-2">
                <Button size="sm" onClick={handleSaveNewAddon} disabled={addAddon.isPending}>
                  {addAddon.isPending && <Loader2 className="h-4 w-4 animate-spin mr-1" />} Save Add-on
                </Button>
                <Button size="sm" variant="outline" onClick={() => setIsAddingAddon(false)}>Cancel</Button>
              </div>
            </div>
          )}

          {/* Protein shake customization when a cafe item with addons is selected */}
          {isCafeWithAddons && selectedCafeItem && (
            <div className="rounded-lg border p-3 space-y-3 bg-muted/30">
              <p className="text-sm font-medium">Shake Customization</p>
              <div className="flex gap-2 items-end">
                <div className="flex-1">
                  <Label className="text-xs">Flavor</Label>
                  <Select value={proteinFlavor} onValueChange={setProteinFlavor}>
                    <SelectTrigger><SelectValue placeholder="Pick flavor..." /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="vanilla">Vanilla</SelectItem>
                      <SelectItem value="chocolate">Chocolate</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {proteinFlavor === "other" && (
                  <div className="flex-1">
                    <Label className="text-xs">Specify</Label>
                    <Input value={customFlavor} onChange={(e) => setCustomFlavor(e.target.value)} placeholder="Flavor name..." />
                  </div>
                )}
              </div>
              {categoryAddons.length > 0 && (
                <div className="space-y-2">
                  <Label className="text-xs">Add-ons</Label>
                  <div className="grid grid-cols-2 gap-2">
                    {categoryAddons.map((addon) => (
                      <label key={addon.id} className="flex items-center gap-2 text-sm cursor-pointer">
                        <Checkbox
                          checked={selectedAddons.includes(addon.id)}
                          onCheckedChange={(checked) =>
                            setSelectedAddons((prev) =>
                              checked ? [...prev, addon.id] : prev.filter((id) => id !== addon.id)
                            )
                          }
                        />
                        {addon.name} <Badge variant="secondary" className="text-xs">+${Number(addon.price).toFixed(2)}</Badge>
                      </label>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Quantity selector */}
          {selectedItemId && !showingForm && selectedItemId !== "custom" && (
            <div className="flex items-center justify-between rounded-lg border p-3">
              <Label className="text-sm font-medium">Quantity</Label>
              <div className="flex items-center gap-3">
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                  disabled={quantity <= 1}
                >
                  −
                </Button>
                <span className="w-8 text-center font-semibold">{quantity}</span>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => setQuantity((q) => q + 1)}
                >
                  +
                </Button>
              </div>
            </div>
          )}

          {/* Amount & description */}
          {!showingForm && (
            <>
              <div>
                <Label>Amount ($)</Label>
                <div className="relative">
                  <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    type="number"
                    step="0.01"
                    min="0.50"
                    placeholder="0.00"
                    value={isCafeItem ? effectiveAmount.toFixed(2) : chargeAmount}
                    onChange={(e) => !isCafeItem && setChargeAmount(e.target.value)}
                    className="pl-9"
                    readOnly={!!isCafeItem}
                  />
                </div>
              </div>

              {/* Tax line for cafe items */}
              {/* Fee breakdown */}
              {(isCafeItem || (!isManualPayment && effectiveAmount > 0)) && (
                <div className="rounded-lg border p-3 space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span>Subtotal</span>
                    <span>${effectiveAmount.toFixed(2)}</span>
                  </div>
                  {isCafeItem && (
                    <div className="flex justify-between text-muted-foreground">
                      <span>MI Sales Tax (6%)</span>
                      <span>${cafeTax.toFixed(2)}</span>
                    </div>
                  )}
                  {!isManualPayment && (
                    <div className="flex justify-between text-muted-foreground">
                      <span>Processing Fee</span>
                      <span>+${calculateProcessingFeeFromDollars(isCafeItem ? totalWithTax : effectiveAmount).toFixed(2)}</span>
                    </div>
                  )}
                  <div className="flex justify-between font-semibold border-t pt-1">
                    <span>Total</span>
                    <span>${(isCafeItem ? totalWithTax : effectiveAmount + (!isManualPayment ? calculateProcessingFeeFromDollars(effectiveAmount) : 0)).toFixed(2)}</span>
                  </div>
                </div>
              )}

              <div>
                <Label>Description</Label>
                <Textarea value={chargeDescription} onChange={(e) => setChargeDescription(e.target.value)} placeholder="Charge description..." rows={2} />
              </div>

              {/* Manual payment toggle */}
              <div className="flex items-center justify-between rounded-lg border p-3">
                <div className="flex items-center gap-2">
                  <Banknote className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <Label className="text-sm font-medium">Record as manual payment</Label>
                    <p className="text-xs text-muted-foreground">Do not charge card — record cash/check/external payment</p>
                  </div>
                </div>
                <Switch checked={isManualPayment} onCheckedChange={setIsManualPayment} />
              </div>

              {isManualPayment && isPendingActivation && (chargeType === "membership_dues" || chargeType === "initiation_fee") && (
                <div className="flex items-center justify-between rounded-lg border border-accent bg-accent/10 p-3">
                  <div>
                    <Label className="text-sm font-medium">Also activate this member</Label>
                    <p className="text-xs text-muted-foreground">Set member status to active after recording payment</p>
                  </div>
                  <Switch checked={alsoActivate} onCheckedChange={setAlsoActivate} />
                </div>
              )}

              {isManualPayment && (
                <div>
                  <Label>Payment Method</Label>
                  <Select value={manualPaymentMethod} onValueChange={setManualPaymentMethod}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="cash">Cash</SelectItem>
                      <SelectItem value="check">Check</SelectItem>
                      <SelectItem value="external">External (Venmo, Zelle, etc.)</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
            </>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={resetAndClose} disabled={isCharging}>Cancel</Button>
          {!showingForm && (
            <Button onClick={handleCharge} disabled={isCharging || (isCafeItem ? totalWithTax < 0.5 : !chargeAmount)}>
              {isCharging && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              {isManualPayment ? "Record" : "Charge"} ${isCafeItem ? totalWithTax.toFixed(2) : chargeAmount || "0.00"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
