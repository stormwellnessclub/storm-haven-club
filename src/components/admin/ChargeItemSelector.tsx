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
import { DollarSign, Loader2, Banknote, Plus, X, ShoppingCart, Search } from "lucide-react";
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
import { useMerchProducts, type MerchProduct } from "@/hooks/useMerchProducts";

interface ChargeItem {
  id: string;
  label: string;
  amount: number | null;
  description: string;
  chargeType: string;
  group: string;
}

interface CartEntry {
  key: string;
  label: string;
  description: string;
  chargeType: string;
  unitAmount: number;
  quantity: number;
  isCafe: boolean;
  isTaxable: boolean;
  addonNames: string[];
  flavorStr: string;
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
    { id: "kids_care_monthly", label: "Kids Care Monthly Pass ($75)", amount: 75, description: "Kids Care Monthly Pass - 16 sessions", chargeType: "kids_care", group: "Kids Care" },
    { id: "kids_care_single", label: "Kids Care Single Session ($40)", amount: 40, description: "Kids Care Single Session", chargeType: "kids_care", group: "Kids Care" },
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

  // Cart state
  const [cartItems, setCartItems] = useState<CartEntry[]>([]);

  // Current item selection state
  const [selectedItemId, setSelectedItemId] = useState("");
  const [chargeAmount, setChargeAmount] = useState("");
  const [chargeDescription, setChargeDescription] = useState("");
  const [chargeType, setChargeType] = useState("other");
  const [isManualPayment, setIsManualPayment] = useState(false);
  const [manualPaymentMethod, setManualPaymentMethod] = useState("cash");
  const [alsoActivate, setAlsoActivate] = useState(false);
  const [isCharging, setIsCharging] = useState(false);
  const [receiptNote, setReceiptNote] = useState("");

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

  // Fetch merch/apparel products
  const { data: merchProducts = [] } = useMerchProducts(true);

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

  // Build merch/apparel charge items grouped by category
  const merchChargeItems: ChargeItem[] = merchProducts.map((product) => ({
    id: `merch_${product.id}`,
    label: `${product.name} ($${Number(product.price).toFixed(2)})`,
    amount: Number(product.price),
    description: `Apparel - ${product.name}`,
    chargeType: "merch",
    group: `Storm Shop — ${product.category}`,
  }));

  // Add management actions
  const addNewCafeItem: ChargeItem = { id: "cafe_add_new", label: "+ Add New Item", amount: null, description: "", chargeType: "cafe", group: "Cafe Management" };
  const addNewCategory: ChargeItem = { id: "cafe_add_category", label: "+ Add New Category", amount: null, description: "", chargeType: "cafe", group: "Cafe Management" };
  const addNewAddon: ChargeItem = { id: "cafe_add_addon", label: "+ Add New Add-on", amount: null, description: "", chargeType: "cafe", group: "Cafe Management" };

  const allChargeItems = [...chargeItems, ...cafeChargeItems, ...merchChargeItems, addNewCafeItem, addNewCategory, addNewAddon];

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
  const isMerchItem = chargeType === "merch";
  const isTaxableItem = !!isCafeItem || isMerchItem;
  const unitAmount = isCafeItem ? getEffectiveAmount() : parseFloat(chargeAmount) || 0;

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

  // Add current selection to cart
  const handleAddToCart = () => {
    if (!selectedItemId && !chargeAmount) return;

    const flavorStr = proteinFlavor === "other" ? customFlavor || "Custom" : proteinFlavor;
    const addonNames = addons.filter((a) => selectedAddons.includes(a.id)).map((a) => a.name);

    let label = chargeDescription;
    if (isCafeItem && flavorStr) label += ` (${flavorStr})`;
    if (addonNames.length > 0) label += ` + ${addonNames.join(", ")}`;

    const entry: CartEntry = {
      key: `${selectedItemId}-${Date.now()}`,
      label,
      description: chargeDescription,
      chargeType,
      unitAmount,
      quantity,
      isCafe: !!isCafeItem,
      isTaxable: isTaxableItem,
      addonNames,
      flavorStr,
    };

    setCartItems((prev) => [...prev, entry]);

    // Reset selection
    setSelectedItemId("");
    setChargeAmount("");
    setChargeDescription("");
    setChargeType("other");
    setSelectedAddons([]);
    setProteinFlavor("");
    setCustomFlavor("");
    setQuantity(1);
  };

  const removeFromCart = (key: string) => {
    setCartItems((prev) => prev.filter((item) => item.key !== key));
  };

  // Cart totals
  const cartSubtotal = cartItems.reduce((sum, item) => sum + item.unitAmount * item.quantity, 0);
  const cartCafeTax = cartItems
    .filter((item) => item.isTaxable)
    .reduce((sum, item) => sum + calculateTax(item.unitAmount * item.quantity), 0);
  const cartTotalBeforeFee = cartSubtotal + cartCafeTax;
  const cartProcessingFee = !isManualPayment ? calculateProcessingFeeFromDollars(cartTotalBeforeFee) : 0;
  const cartGrandTotal = cartTotalBeforeFee + cartProcessingFee;

  // Auto-create Kids Care pass after successful charge
  const createKidsCarePassesFromCart = async (items: CartEntry[]) => {
    const kidsCareItems = items.filter((item) => item.chargeType === "kids_care");
    if (kidsCareItems.length === 0) return;

    // Resolve user_id
    let userId = nonMember?.userId;
    if (!userId) {
      const { data: memberData } = await supabase
        .from("members")
        .select("user_id")
        .eq("id", member.id)
        .single();
      userId = memberData?.user_id ?? undefined;
    }
    if (!userId) {
      console.error("Could not resolve user_id for Kids Care pass creation");
      toast.error("Pass created but could not link to user account");
      return;
    }

    for (const item of kidsCareItems) {
      const isMonthly = item.key.includes("kids_care_monthly");
      const classesTotal = isMonthly ? 16 : 1;
      const expiryDays = isMonthly ? 30 : 7;
      const passType = isMonthly ? "kids_care_monthly" : "kids_care_single";
      const now = new Date();
      const expiresAt = new Date(now.getTime() + expiryDays * 24 * 60 * 60 * 1000);

      for (let q = 0; q < item.quantity; q++) {
        const { error } = await supabase.from("class_passes").insert({
          user_id: userId,
          member_id: nonMember ? null : member.id,
          category: "other" as any,
          pass_type: passType,
          classes_total: classesTotal,
          classes_remaining: classesTotal,
          price_paid: item.unitAmount,
          is_member_price: !nonMember,
          purchased_at: now.toISOString(),
          expires_at: expiresAt.toISOString(),
          status: "active" as any,
        });
        if (error) {
          console.error("Failed to create Kids Care pass:", error);
          toast.error("Payment succeeded but failed to create pass. Please grant manually.");
        } else {
          toast.success(`Kids Care ${isMonthly ? "Monthly" : "Single"} Pass created (${classesTotal} sessions)`);
        }
      }
    }
    queryClient.invalidateQueries({ queryKey: ["kids-care-passes"] });
    queryClient.invalidateQueries({ queryKey: ["class-passes"] });
  };

  // Auto-create Class Passes (singles + 10-packs) after successful charge
  const createClassPassesFromCart = async (items: CartEntry[]) => {
    const classPassItems = items.filter((item) => item.chargeType === "class_pass");
    if (classPassItems.length === 0) return;

    // Resolve user_id (mirrors Kids Care helper)
    let userId = nonMember?.userId;
    if (!userId) {
      const { data: memberData } = await supabase
        .from("members")
        .select("user_id")
        .eq("id", member.id)
        .single();
      userId = memberData?.user_id ?? undefined;
    }
    if (!userId) {
      console.error("Could not resolve user_id for Class Pass creation");
      toast.error("Pass charged but could not link to user account — please grant manually");
      return;
    }

    // Map cart item key -> pass spec
    const PASS_SPEC: Record<string, { category: "pilates_cycling" | "other"; pass_type: string; classes_total: number; expiry_days: number; is_member_price: boolean }> = {
      single_member_pilates:    { category: "pilates_cycling", pass_type: "single",  classes_total: 1,  expiry_days: 30,  is_member_price: true  },
      single_member_other:      { category: "other",           pass_type: "single",  classes_total: 1,  expiry_days: 30,  is_member_price: true  },
      single_nonmember_pilates: { category: "pilates_cycling", pass_type: "single",  classes_total: 1,  expiry_days: 30,  is_member_price: false },
      single_nonmember_other:   { category: "other",           pass_type: "single",  classes_total: 1,  expiry_days: 30,  is_member_price: false },
      "10pack_member_pilates":    { category: "pilates_cycling", pass_type: "10-pack", classes_total: 10, expiry_days: 180, is_member_price: true  },
      "10pack_member_other":      { category: "other",           pass_type: "10-pack", classes_total: 10, expiry_days: 180, is_member_price: true  },
      "10pack_nonmember_pilates": { category: "pilates_cycling", pass_type: "10-pack", classes_total: 10, expiry_days: 180, is_member_price: false },
      "10pack_nonmember_other":   { category: "other",           pass_type: "10-pack", classes_total: 10, expiry_days: 180, is_member_price: false },
    };

    for (const item of classPassItems) {
      const spec = PASS_SPEC[item.key];
      if (!spec) {
        console.warn("Unknown class_pass cart key, skipping fulfillment:", item.key);
        continue;
      }
      const now = new Date();
      const expiresAt = new Date(now.getTime() + spec.expiry_days * 24 * 60 * 60 * 1000);

      for (let q = 0; q < item.quantity; q++) {
        const { error } = await supabase.from("class_passes").insert({
          user_id: userId,
          member_id: nonMember ? null : member.id,
          category: spec.category as any,
          pass_type: spec.pass_type,
          classes_total: spec.classes_total,
          classes_remaining: spec.classes_total,
          price_paid: item.unitAmount,
          is_member_price: spec.is_member_price,
          purchased_at: now.toISOString(),
          expires_at: expiresAt.toISOString(),
          status: "active" as any,
        });
        if (error) {
          console.error("Failed to create Class Pass:", error);
          toast.error("Payment succeeded but failed to create class pass. Please grant manually.");
        } else {
          toast.success(`${spec.pass_type === "10-pack" ? "10-Pack" : "Single"} class pass created (${spec.classes_total} classes)`);
        }
      }
    }
    queryClient.invalidateQueries({ queryKey: ["class-passes"] });
    queryClient.invalidateQueries({ queryKey: ["user-credits"] });
  };

  const handleCharge = async () => {
    if (cartItems.length === 0) {
      toast.error("Add at least one item to the cart");
      return;
    }

    const amountInCents = Math.round(cartGrandTotal * 100);
    if (isNaN(amountInCents) || amountInCents < 50) {
      toast.error("Minimum charge amount is $0.50");
      return;
    }

    // Build combined description
    const descParts = cartItems.map((item) => {
      let desc = item.quantity > 1 ? `${item.quantity}x ` : "";
      desc += item.label;
      return desc;
    });
    let desc = descParts.join(" | ");

    const hasTaxable = cartItems.some((item) => item.isTaxable);
    if (hasTaxable) desc += " (incl. MI 6% tax)";

    setIsCharging(true);
    try {
      if (isManualPayment) {
        const insertData: any = {
          amount: amountInCents,
          description: `[${manualPaymentMethod.toUpperCase()}] ${desc}`,
          status: "succeeded",
          charged_by: user?.id || "unknown",
          user_id: nonMember?.userId || user?.id || "unknown",
          note: receiptNote.trim() || null,
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
            toast.success(`Manual payment of $${cartTotalBeforeFee.toFixed(2)} recorded & member activated`);
            onChargeSuccess?.();
            resetAndClose();
            return;
          }
        }
        toast.success(`Manual payment of $${cartTotalBeforeFee.toFixed(2)} recorded`);
      } else {
        // Determine dominant payment type for tax reporting
        const hasCafe = cartItems.some((item) => item.isCafe);
        const hasMerch = cartItems.some((item) => item.chargeType === "merch");
        let paymentType = "manual_charge";
        if (hasCafe && !hasMerch) paymentType = "cafe_order";
        else if (hasMerch && !hasCafe) paymentType = "merch_order";
        else if (hasCafe && hasMerch) paymentType = "cafe_order"; // mixed defaults to café

        const taxAmountCents = Math.round(cartCafeTax * 100);
        const subtotalCents = Math.round(cartSubtotal * 100);
        const processingFeeCents = Math.round(cartProcessingFee * 100);

        const chargeBody: any = {
          action: "charge_saved_card_with_3ds",
          amount: amountInCents,
          description: desc,
          chargeType: "pos",
          processingFee: processingFeeCents,
          taxAmount: taxAmountCents,
          subtotal: subtotalCents,
          payment_type: paymentType,
          note: receiptNote.trim() || undefined,
          lineItems: cartItems.map((it) => ({
            name: it.label,
            quantity: it.quantity,
            unit_price: it.unitAmount,
          })),
          recipientEmail: (nonMember as any)?.email || (member as any)?.email || undefined,
          recipientName: (nonMember as any)?.name
            || `${(member as any)?.first_name ?? ""} ${(member as any)?.last_name ?? ""}`.trim()
            || undefined,
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
        toast.success(`Successfully charged $${cartGrandTotal.toFixed(2)}`);
      }

      // Auto-create Kids Care passes for any kids_care items in cart
      await createKidsCarePassesFromCart(cartItems);
      // Auto-create Class Passes for any class_pass items in cart
      await createClassPassesFromCart(cartItems);

      onChargeSuccess?.();
      resetAndClose();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to process payment");
    } finally {
      setIsCharging(false);
    }
  };

  const resetAndClose = () => {
    setCartItems([]);
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


  const [itemSearch, setItemSearch] = useState("");

  // Filter items by search
  const filteredGroups = Object.entries(groups).reduce((acc, [group, items]) => {
    if (!itemSearch.trim()) {
      acc[group] = items;
      return acc;
    }
    const q = itemSearch.toLowerCase();
    const filtered = items.filter(
      (item) =>
        item.label.toLowerCase().includes(q) ||
        item.group.toLowerCase().includes(q) ||
        item.description.toLowerCase().includes(q)
    );
    if (filtered.length > 0) acc[group] = filtered;
    return acc;
  }, {} as Record<string, ChargeItem[]>);

  const showingForm = isAddingCafeItem || isAddingCategory || isAddingAddon;
  const addonCategoryOptions = categories.filter((c) => c.has_addons);
  const canAddToCart = selectedItemId && !showingForm && unitAmount >= 0.01;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Charge / Record Payment</DialogTitle>
          <DialogDescription>
            {member.first_name} {member.last_name} — Browse items, add to cart, then charge
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-hidden grid grid-cols-1 md:grid-cols-[1fr_320px] gap-4 min-h-0">
          {/* LEFT: Item browser */}
          <div className="flex flex-col min-h-0 overflow-hidden">
            {/* Search */}
            <div className="relative mb-3">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                value={itemSearch}
                onChange={(e) => setItemSearch(e.target.value)}
                placeholder="Search items... (e.g. protein, guest pass, pilates)"
                className="pl-9"
              />
            </div>

            {/* Item list */}
            <div className="flex-1 overflow-y-auto space-y-3 pr-1 pb-2">
              {Object.entries(filteredGroups).map(([group, items]) => (
                <div key={group}>
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 sticky top-0 bg-background py-1 z-10">
                    {group}
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                    {items.map((item) => {
                      const isSelected = selectedItemId === item.id;
                      const isManagement = item.id.startsWith("cafe_add");
                      return (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => handleItemSelect(item.id)}
                          className={`text-left px-3 py-2 rounded-md border text-sm transition-colors ${
                            isSelected
                              ? "border-primary bg-primary/10 ring-1 ring-primary"
                              : "border-border hover:border-primary/50 hover:bg-muted/50"
                          } ${isManagement ? "text-primary border-dashed" : ""}`}
                        >
                          {isManagement ? (
                            <span className="flex items-center gap-1.5">
                              <Plus className="h-3.5 w-3.5" /> {item.label.replace("+ ", "")}
                            </span>
                          ) : (
                            <span className="line-clamp-2">{item.label}</span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
              {Object.keys(filteredGroups).length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-8">No items match "{itemSearch}"</p>
              )}
            </div>
          </div>

          {/* RIGHT: Cart + customization + totals */}
          <div className="flex flex-col min-h-0 overflow-y-auto border-l pl-4 space-y-3">
            {/* Customization area for selected item */}
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

            {/* Shake customization */}
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
                    <div className="grid grid-cols-1 gap-1.5">
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

            {/* Quantity */}
            {selectedItemId && !showingForm && selectedItemId !== "custom" && (
              <div className="flex items-center justify-between rounded-lg border p-3">
                <Label className="text-sm font-medium">Quantity</Label>
                <div className="flex items-center gap-3">
                  <Button type="button" variant="outline" size="icon" className="h-8 w-8" onClick={() => setQuantity((q) => Math.max(1, q - 1))} disabled={quantity <= 1}>−</Button>
                  <span className="w-8 text-center font-semibold">{quantity}</span>
                  <Button type="button" variant="outline" size="icon" className="h-8 w-8" onClick={() => setQuantity((q) => q + 1)}>+</Button>
                </div>
              </div>
            )}

            {/* Custom amount */}
            {selectedItemId === "custom" && !showingForm && (
              <div className="space-y-2">
                <div>
                  <Label>Amount ($)</Label>
                  <div className="relative">
                    <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input type="number" step="0.01" min="0.50" placeholder="0.00" value={chargeAmount} onChange={(e) => setChargeAmount(e.target.value)} className="pl-9" />
                  </div>
                </div>
                <div>
                  <Label>Description</Label>
                  <Textarea value={chargeDescription} onChange={(e) => setChargeDescription(e.target.value)} placeholder="Charge description..." rows={2} />
                </div>
              </div>
            )}

            {/* Add to cart button */}
            {selectedItemId && !showingForm && (
              <Button variant="secondary" className="w-full" onClick={handleAddToCart} disabled={!canAddToCart}>
                <Plus className="h-4 w-4 mr-2" />
                Add to Cart — ${(unitAmount * quantity).toFixed(2)}
              </Button>
            )}

            {/* Cart */}
            {cartItems.length > 0 && (
              <div className="rounded-lg border bg-muted/30 p-3 space-y-2">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <ShoppingCart className="h-4 w-4" />
                  Cart ({cartItems.length} {cartItems.length === 1 ? "item" : "items"})
                </div>
                <div className="space-y-1">
                  {cartItems.map((item) => (
                    <div key={item.key} className="flex items-center justify-between text-sm gap-2">
                      <span className="truncate flex-1">
                        {item.quantity > 1 && <span className="font-medium">{item.quantity}× </span>}
                        {item.label}
                      </span>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="font-medium">${(item.unitAmount * item.quantity).toFixed(2)}</span>
                        <Button variant="ghost" size="icon" className="h-5 w-5 text-muted-foreground hover:text-destructive" onClick={() => removeFromCart(item.key)}>
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Totals */}
            {cartItems.length > 0 && (
              <>
                <div className="rounded-lg border p-3 space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span>Subtotal</span>
                    <span>${cartSubtotal.toFixed(2)}</span>
                  </div>
                  {cartCafeTax > 0 && (
                    <div className="flex justify-between text-muted-foreground">
                      <span>MI Sales Tax (6%)</span>
                      <span>${cartCafeTax.toFixed(2)}</span>
                    </div>
                  )}
                  {!isManualPayment && (
                    <div className="flex justify-between text-muted-foreground">
                      <span>Processing Fee</span>
                      <span>+${cartProcessingFee.toFixed(2)}</span>
                    </div>
                  )}
                  <div className="flex justify-between font-semibold border-t pt-1">
                    <span>Total</span>
                    <span>${cartGrandTotal.toFixed(2)}</span>
                  </div>
                </div>

                {/* Manual payment toggle */}
                <div className="flex items-center justify-between rounded-lg border p-3">
                  <div className="flex items-center gap-2">
                    <Banknote className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <Label className="text-sm font-medium">Manual payment</Label>
                      <p className="text-xs text-muted-foreground">Cash/check/external</p>
                    </div>
                  </div>
                  <Switch checked={isManualPayment} onCheckedChange={setIsManualPayment} />
                </div>

                {isManualPayment && isPendingActivation && cartItems.some((i) => i.chargeType === "membership_dues" || i.chargeType === "initiation_fee") && (
                  <div className="flex items-center justify-between rounded-lg border border-accent bg-accent/10 p-3">
                    <div>
                      <Label className="text-sm font-medium">Also activate member</Label>
                      <p className="text-xs text-muted-foreground">Set status to active</p>
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

                <Button className="w-full" onClick={handleCharge} disabled={isCharging}>
                  {isCharging && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                  {isManualPayment ? "Record" : "Charge"} ${isManualPayment ? cartTotalBeforeFee.toFixed(2) : cartGrandTotal.toFixed(2)}
                </Button>
              </>
            )}

            {cartItems.length === 0 && !selectedItemId && !showingForm && (
              <div className="text-center py-8 text-muted-foreground text-sm">
                <ShoppingCart className="h-8 w-8 mx-auto mb-2 opacity-40" />
                <p>Select items from the left to build your cart</p>
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={resetAndClose} disabled={isCharging}>Cancel</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
