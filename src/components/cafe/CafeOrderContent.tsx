import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Plus, Minus, ShoppingBag, Loader2, CreditCard, User, ChevronDown, MessageSquare, CheckCircle, AlertCircle } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { useCreateCafeOrder } from "@/hooks/useCafeOrder";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  useCafeMenuCategories,
  useCafeMenuItems,
  useCafeMenuAddons,
  calculateTax,
  type CafeMenuItem as DbMenuItem,
  type CafeMenuAddon,
} from "@/hooks/useCafeMenu";
import { useCafeMenuRealtime } from "@/hooks/useCafeMenuRealtime";
import { CafeAddonDialog } from "@/components/cafe/CafeAddonDialog";
import { calculateProcessingFeeFromDollars } from "@/lib/processingFee";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { StripeProvider } from "@/components/StripeProvider";
import { PaymentElement, useStripe, useElements } from "@stripe/react-stripe-js";
import { CafeRatingBadge } from "@/components/cafe/CafeRatingBadge";
import { CafeItemReviews } from "@/components/cafe/CafeItemReviews";
import { CafeReviewPrompt } from "@/components/cafe/CafeReviewPrompt";

interface CartAddon {
  id: string;
  name: string;
  price: number;
}

interface CartItem {
  key: string;
  itemId: string;
  name: string;
  price: number;
  category: string;
  quantity: number;
  addons: CartAddon[];
}

function getItemDisplayName(item: DbMenuItem): string {
  const base = item.item_name || item.brand_name || "Unnamed Item";
  if (item.flavor && item.flavor !== base) return `${base} — ${item.flavor}`;
  return base;
}

interface FunctionalIngredient {
  ingredient: string;
  benefit: string;
}

interface ParsedDescription {
  description: string;
  benefits: string;
  nutrition: string;
  functionalBlend: FunctionalIngredient[];
  size: string;
  proteinFlavor: string;
}

function parseFunctionalBlend(block: string): FunctionalIngredient[] {
  const text = block.trim();
  if (!text) return [];

  // Bullet format: "• Lion's Mane — Supports focus..."
  const bulletLines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => /^[•·\-*]/.test(l));
  if (bulletLines.length >= 2) {
    const out: FunctionalIngredient[] = [];
    for (const line of bulletLines) {
      const stripped = line.replace(/^[•·\-*]\s*/, "");
      const m = stripped.split(/\s+[—–-]\s+/);
      if (m.length >= 2) {
        out.push({ ingredient: m[0].trim(), benefit: m.slice(1).join(" — ").trim() });
      } else {
        out.push({ ingredient: stripped.trim(), benefit: "" });
      }
    }
    return out.filter((e) => e.ingredient);
  }

  // Block format: ingredient line, then benefit line(s), separated by blank lines
  const blocks = text.split(/\n\s*\n+/).map((b) => b.trim()).filter(Boolean);
  const out: FunctionalIngredient[] = [];
  for (const b of blocks) {
    const lines = b.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    if (lines.length === 0) continue;
    const ingredient = lines[0].replace(/[:\-—–]\s*$/, "");
    const benefit = lines.slice(1).join(" ").trim();
    if (ingredient) out.push({ ingredient, benefit });
  }
  return out;
}

function parseItemDescription(item: DbMenuItem): ParsedDescription {
  const raw = item.description || "";
  let description = "";
  let benefits = "";
  let nutrition = "";
  let functionalBlock = "";
  const benefitsMatch = raw.match(/(?:^|\n)\s*benefits\s*:?\s*(?:\n|$)/i);
  const nutritionMatch = raw.match(/(?:^|\n)\s*nutri(?:tion(?:al)?|ent)\s*(?:profile|info|facts)?\s*:?\s*(?:\n|$)/i);
  const functionalMatch = raw.match(/(?:^|\n)\s*functional\s*blend\s*:?\s*(?:\n|$)/i);

  const benefitsIdx = benefitsMatch ? raw.indexOf(benefitsMatch[0]) : -1;
  const nutritionIdx = nutritionMatch ? raw.indexOf(nutritionMatch[0]) : -1;
  const functionalIdx = functionalMatch ? raw.indexOf(functionalMatch[0]) : -1;

  const allIdx = [benefitsIdx, nutritionIdx, functionalIdx].filter((i) => i >= 0);
  const firstSplit = allIdx.length ? Math.min(...allIdx) : raw.length;
  description = raw.slice(0, firstSplit).trim();

  // Strip a leading repeated item name from the intro paragraph
  const firstLineBreak = description.indexOf("\n");
  if (firstLineBreak > 0) {
    const firstLine = description.slice(0, firstLineBreak).trim();
    if (firstLine.toLowerCase() === (item.item_name || "").toLowerCase().trim()) {
      description = description.slice(firstLineBreak + 1).trim();
    }
  }

  const sectionEnd = (start: number, headerLen: number): number => {
    const after = start + headerLen;
    const candidates = [benefitsIdx, nutritionIdx, functionalIdx]
      .filter((i) => i > start)
      .concat([raw.length]);
    return Math.min(...candidates);
  };

  if (functionalIdx >= 0) {
    functionalBlock = raw.slice(functionalIdx + functionalMatch![0].length, sectionEnd(functionalIdx, functionalMatch![0].length)).trim();
  }
  if (benefitsIdx >= 0) {
    benefits = raw.slice(benefitsIdx + benefitsMatch![0].length, sectionEnd(benefitsIdx, benefitsMatch![0].length)).trim();
  }
  if (nutritionIdx >= 0) {
    nutrition = raw.slice(nutritionIdx + nutritionMatch![0].length, sectionEnd(nutritionIdx, nutritionMatch![0].length)).trim();
  }

  const functionalBlend = parseFunctionalBlend(functionalBlock);

  return {
    description,
    benefits,
    nutrition,
    functionalBlend,
    size: item.size || "",
    proteinFlavor: item.protein_flavor || "",
  };
}

// Derive short uppercase benefit pills for a menu item card.
// Prefer admin-set dietary_tags; otherwise extract keywords from functional blend benefits.
const BENEFIT_KEYWORDS = [
  "hydration", "immunity", "energy", "recovery", "focus", "calm", "sleep",
  "antioxidant", "anti-inflammatory", "gut health", "gut support", "digestion",
  "protein", "collagen", "metabolism", "detox", "endurance", "strength",
  "skin", "mood", "stamina", "performance",
];
function getBenefitTags(
  item: { dietary_tags?: string[] | null },
  parsed: { functionalBlend: { benefit: string }[] }
): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  const push = (s: string) => {
    const key = s.trim().toUpperCase();
    if (!key || seen.has(key)) return;
    seen.add(key);
    out.push(key);
  };
  if (item.dietary_tags && item.dietary_tags.length > 0) {
    item.dietary_tags.forEach(push);
    return out;
  }
  const blob = parsed.functionalBlend.map((e) => e.benefit).join(" ").toLowerCase();
  BENEFIT_KEYWORDS.forEach((kw) => {
    if (blob.includes(kw)) push(kw === "gut support" ? "gut support" : kw);
  });
  return out;
}

interface SavedPaymentMethod {
  id: string;
  brand?: string;
  last4?: string;
  expMonth?: number;
  expYear?: number;
  nickname?: string | null;
  isDefault?: boolean;
}

// Embedded card-add form for non-members
function InlineAddCardForm({ onSuccess, onCancel }: { onSuccess: () => void; onCancel: () => void }) {
  const stripe = useStripe();
  const elements = useElements();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);
    if (!stripe || !elements) return;
    setIsSubmitting(true);
    try {
      const { error: submitError } = await elements.submit();
      if (submitError) {
        setErr(submitError.message || "Please complete the form");
        setIsSubmitting(false);
        return;
      }
      const { error, setupIntent } = await stripe.confirmSetup({
        elements,
        redirect: "if_required",
        confirmParams: { return_url: window.location.href },
      });
      if (error) {
        setErr(error.message || "Card setup failed");
        setIsSubmitting(false);
        return;
      }
      if (!setupIntent || setupIntent.status !== "succeeded") {
        setErr("Card setup incomplete. Please try again.");
        setIsSubmitting(false);
        return;
      }
      await supabase.functions.invoke("stripe-payment", {
        body: { action: "sync_nonmember_card_metadata" },
      });
      toast.success("Card saved");
      onSuccess();
    } catch (e: any) {
      setErr(e?.message || "An unexpected error occurred");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div className="min-h-[180px] relative">
        {!isReady && (
          <div className="absolute inset-0 flex items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-accent" />
          </div>
        )}
        <PaymentElement options={{ layout: "tabs" }} onReady={() => setIsReady(true)} />
      </div>
      {err && <p className="text-sm text-destructive">{err}</p>}
      <div className="flex gap-2 justify-end">
        <Button type="button" variant="outline" size="sm" onClick={onCancel} disabled={isSubmitting}>
          Cancel
        </Button>
        <Button type="submit" size="sm" disabled={!stripe || !elements || isSubmitting || !isReady}>
          {isSubmitting ? (
            <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Saving...</>
          ) : (
            <><CreditCard className="mr-2 h-4 w-4" />Save Card</>
          )}
        </Button>
      </div>
    </form>
  );
}

interface CafeOrderContentProps {
  variant: "public" | "member" | "nonmember";
  showHero?: boolean;
}

export function CafeOrderContent({ variant, showHero = false }: CafeOrderContentProps) {
  useCafeMenuRealtime("cafe-menu-customer");
  const { user } = useAuth();
  const navigate = useNavigate();
  const createOrder = useCreateCafeOrder();
  const { data: categories = [], isLoading: catLoading } = useCafeMenuCategories('cafe');
  const { data: menuItems = [], isLoading: itemsLoading } = useCafeMenuItems();
  const { data: addons = [] } = useCafeMenuAddons();

  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [showPaymentDialog, setShowPaymentDialog] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<"card" | "member_account">("card");
  const [selectedPaymentMethodId, setSelectedPaymentMethodId] = useState<string | null>(null);
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);
  const [savedPaymentMethods, setSavedPaymentMethods] = useState<SavedPaymentMethod[]>([]);
  const [smsOptIn, setSmsOptIn] = useState(false);
  const [showSmsOptIn, setShowSmsOptIn] = useState(false);
  const [addonDialogItem, setAddonDialogItem] = useState<DbMenuItem | null>(null);
  const [detailItem, setDetailItem] = useState<DbMenuItem | null>(null);
  const [groupPickerItems, setGroupPickerItems] = useState<DbMenuItem[] | null>(null);
  // Resolved per-user mode (may upgrade variant="public" to member/nonmember)
  const [resolvedMode, setResolvedMode] = useState<"member" | "nonmember" | null>(
    variant === "member" ? "member" : variant === "nonmember" ? "nonmember" : null
  );
  const [memberId, setMemberId] = useState<string | null>(null);
  // Inline add-card flow (non-members only)
  const [showAddCard, setShowAddCard] = useState(false);
  const [setupClientSecret, setSetupClientSecret] = useState<string | null>(null);
  const [setupLoading, setSetupLoading] = useState(false);
  const [setupError, setSetupError] = useState<string | null>(null);
  const setupKeyRef = useRef(0);

  const isLoading = catLoading || itemsLoading;

  // Resolve member vs non-member for public variant
  useEffect(() => {
    if (!user) {
      setResolvedMode(null);
      setMemberId(null);
      return;
    }
    let active = true;
    (async () => {
      const { data } = await supabase
        .from("members")
        .select("id")
        .eq("user_id", user.id)
        .maybeSingle();
      if (!active) return;
      if (data?.id) {
        setMemberId(data.id);
        if (variant === "public") setResolvedMode("member");
      } else {
        setMemberId(null);
        if (variant === "public") setResolvedMode("nonmember");
      }
    })();
    return () => { active = false; };
  }, [user, variant]);

  // Force "card" payment when in non-member mode (no member account option)
  useEffect(() => {
    if (resolvedMode === "nonmember" && paymentMethod === "member_account") {
      setPaymentMethod("card");
    }
  }, [resolvedMode, paymentMethod]);

  // Scope public cafe page strictly to cafe-section items (categories are already filtered to section='cafe')
  const cafeCategoryIds = new Set(categories.map((c) => c.id));
  const sectionScopedItems =
    variant === "public"
      ? menuItems.filter((i) => i.category_id && cafeCategoryIds.has(i.category_id))
      : menuItems;
  const filteredItems = selectedCategoryId
    ? sectionScopedItems.filter((item) => item.category_id === selectedCategoryId)
    : sectionScopedItems;

  // Category-aware image framing: packaged goods get contained on a neutral bg, prepared food gets edge-to-edge cover
  const CONTAIN_CATEGORIES = new Set([
    "Energy Drinks",
    "Water",
    "Refreshers",
    "Shots",
    "Preworkout",
    "Supplements",
  ]);
  const getImageFit = (categoryName: string): "contain" | "cover" =>
    CONTAIN_CATEGORIES.has(categoryName) ? "contain" : "cover";

  const getAddonsForItem = (item: DbMenuItem): CafeMenuAddon[] => {
    if (!item.category_id) return [];
    const cat = categories.find((c) => c.id === item.category_id);
    if (!cat?.has_addons) return [];
    return addons.filter((a) => a.category_id === item.category_id);
  };

  const buildCartKey = (itemId: string, addonIds: string[]) =>
    `${itemId}::${[...addonIds].sort().join(",")}`;

  const addItemToCart = (item: DbMenuItem, selectedAddons: CartAddon[]) => {
    const name = getItemDisplayName(item);
    const catName = categories.find((c) => c.id === item.category_id)?.name || "";
    const key = buildCartKey(item.id, selectedAddons.map((a) => a.id));
    setCart((prev) => {
      const existing = prev.find((i) => i.key === key);
      if (existing) {
        return prev.map((i) => (i.key === key ? { ...i, quantity: i.quantity + 1 } : i));
      }
      return [
        ...prev,
        { key, itemId: item.id, name, price: item.price, category: catName, quantity: 1, addons: selectedAddons },
      ];
    });
    toast.success(`${name} added to order`);
  };

  const handleItemTap = (item: DbMenuItem) => {
    if (item.stock_quantity === 0) {
      toast.error("This item is sold out");
      return;
    }
    const itemAddons = getAddonsForItem(item);
    if (itemAddons.length > 0) {
      setAddonDialogItem(item);
      return;
    }
    addItemToCart(item, []);
  };

  const updateQuantity = (key: string, delta: number) => {
    setCart((prev) =>
      prev.map((item) => (item.key === key ? { ...item, quantity: item.quantity + delta } : item))
        .filter((item) => item.quantity > 0)
    );
  };

  const lineTotal = (item: CartItem) =>
    (item.price + item.addons.reduce((s, a) => s + a.price, 0)) * item.quantity;

  const cartSubtotal = cart.reduce((sum, item) => sum + lineTotal(item), 0);
  const cartTax = calculateTax(cartSubtotal);
  const cartProcessingFee = calculateProcessingFeeFromDollars(cartSubtotal + cartTax);
  const cartTotal = cartSubtotal + cartTax + cartProcessingFee;
  const cartCount = cart.reduce((sum, item) => sum + item.quantity, 0);

  const handlePlaceOrder = async () => {
    if (!user) {
      toast.error("Please sign in to place an order");
      navigate("/auth");
      return;
    }
    if (cart.length === 0) {
      toast.error("Your cart is empty");
      return;
    }
    setShowPaymentDialog(true);
  };

  // Load saved payment methods when dialog opens
  const loadCards = async () => {
    if (!user || !resolvedMode) return;
    try {
      if (resolvedMode === "member") {
        if (!memberId) return;
        const { data, error } = await supabase.functions.invoke("stripe-payment", {
          body: { action: "list_payment_methods", memberId },
        });
        if (error) throw error;
        const pms: SavedPaymentMethod[] = data?.paymentMethods || [];
        setSavedPaymentMethods(pms);
        if (pms.length > 0) {
          const def = pms.find((p) => p.isDefault) || pms[0];
          setSelectedPaymentMethodId(def.id);
        } else {
          setSelectedPaymentMethodId(null);
        }
      } else {
        const { data, error } = await supabase.functions.invoke("stripe-payment", {
          body: { action: "list_nonmember_payment_methods" },
        });
        if (error) throw error;
        const pms: SavedPaymentMethod[] = data?.paymentMethods || [];
        setSavedPaymentMethods(pms);
        if (pms.length > 0) {
          const def = pms.find((p) => p.isDefault) || pms[0];
          setSelectedPaymentMethodId(def.id);
        } else {
          setSelectedPaymentMethodId(null);
        }
      }
    } catch (e) {
      console.error("Failed to load payment methods", e);
    }
  };

  useEffect(() => {
    if (showPaymentDialog && paymentMethod === "card") {
      loadCards();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showPaymentDialog, paymentMethod, resolvedMode, memberId]);

  // SMS opt-in nudge
  useEffect(() => {
    if (!user || !showPaymentDialog) return;
    supabase
      .from("profiles")
      .select("sms_opt_in, phone")
      .eq("id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        const optedIn = (data as any)?.sms_opt_in === true;
        const hasPhone = !!(data as any)?.phone;
        setShowSmsOptIn(!optedIn && hasPhone);
        setSmsOptIn(false);
      });
  }, [user, showPaymentDialog]);

  // Fetch setup intent for non-member inline add-card
  const beginAddCard = async () => {
    setShowAddCard(true);
    setSetupLoading(true);
    setSetupError(null);
    setSetupClientSecret(null);
    try {
      const { data, error } = await supabase.functions.invoke("stripe-payment", {
        body: { action: "create_nonmember_setup_intent" },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setSetupClientSecret(data.clientSecret);
      setupKeyRef.current += 1;
    } catch (e: any) {
      setSetupError(e?.message || "Failed to start card setup");
    } finally {
      setSetupLoading(false);
    }
  };

  const handleCardAdded = async () => {
    setShowAddCard(false);
    setSetupClientSecret(null);
    await loadCards();
  };

  const handleConfirmOrder = async () => {
    if (cart.length === 0) return;
    setIsProcessingPayment(true);
    try {
      let paymentIntentId: string | undefined;
      const orderItems = cart.map((item) => {
        const addonsLabel = item.addons.length ? ` (+ ${item.addons.map((a) => a.name).join(", ")})` : "";
        const unitPrice = item.price + item.addons.reduce((s, a) => s + a.price, 0);
        return {
          id: parseInt(item.itemId.slice(0, 8), 16) || 0,
          name: `${item.name}${addonsLabel}`,
          price: unitPrice,
          quantity: item.quantity,
          category: item.category,
        };
      });
      const totalAmountCents = Math.round(cartTotal * 100);
      const processingFeeCents = Math.round(cartProcessingFee * 100);
      const taxAmountCents = Math.round(cartTax * 100);
      const subtotalCents = Math.round(cartSubtotal * 100);
      const itemDesc = `Cafe Order - ${orderItems.map((i) => i.name).join(", ")} (incl. MI 6% tax)`;

      if (resolvedMode === "member" && paymentMethod === "card" && selectedPaymentMethodId) {
        if (!memberId) throw new Error("Member record not found.");
        const { data: chargeData, error: chargeError } = await supabase.functions.invoke("stripe-payment", {
          body: {
            action: "charge_saved_card",
            memberId,
            amount: totalAmountCents,
            description: itemDesc,
            paymentMethodId: selectedPaymentMethodId,
            chargeType: "pos",
            processingFee: processingFeeCents,
            taxAmount: taxAmountCents,
            subtotal: subtotalCents,
          },
        });
        if (chargeError) throw chargeError;
        if (chargeData?.error) throw new Error(chargeData.error);
        if (chargeData?.success === false) throw new Error(chargeData.error || "Card was declined.");
        paymentIntentId = chargeData?.paymentIntentId;
      } else if (resolvedMode === "member" && paymentMethod === "member_account") {
        if (!memberId) throw new Error("You must be a member to use member account charging");
        const { data: chargeData, error: chargeError } = await supabase.functions.invoke("stripe-payment", {
          body: {
            action: "charge_saved_card",
            memberId,
            amount: totalAmountCents,
            description: itemDesc,
            chargeType: "pos",
            processingFee: processingFeeCents,
            taxAmount: taxAmountCents,
            subtotal: subtotalCents,
          },
        });
        if (chargeError) throw chargeError;
        if (chargeData?.error) throw new Error(chargeData.error);
        if (chargeData?.success === false) throw new Error(chargeData.error || "Card was declined.");
        if (!chargeData?.paymentIntentId) throw new Error("Payment failed.");
        paymentIntentId = chargeData.paymentIntentId;
      } else if (resolvedMode === "nonmember") {
        if (!selectedPaymentMethodId) throw new Error("Please add a card to continue.");
        const { data: chargeData, error: chargeError } = await supabase.functions.invoke("stripe-payment", {
          body: {
            action: "charge_nonmember_saved_card",
            amount: totalAmountCents,
            description: itemDesc,
            paymentMethodId: selectedPaymentMethodId,
            chargeType: "pos",
            processingFee: processingFeeCents,
            taxAmount: taxAmountCents,
            subtotal: subtotalCents,
          },
        });
        if (chargeError) throw chargeError;
        if (chargeData?.error) throw new Error(chargeData.error);
        if (chargeData?.success === false) throw new Error(chargeData.error || "Card was declined.");
        paymentIntentId = chargeData?.paymentIntentId;
      } else {
        throw new Error("Please select a payment method");
      }

      const fullOrderItems = [
        ...orderItems,
        { id: 0, name: "MI Sales Tax (6%)", price: cartTax, quantity: 1, category: "Tax" },
        ...(cartProcessingFee > 0 ? [{ id: 0, name: "Processing Fee", price: cartProcessingFee, quantity: 1, category: "Fee" }] : []),
      ];

      await createOrder.mutateAsync({
        orderItems: fullOrderItems,
        paymentMethod: paymentMethod === "member_account" ? "member_account" : "card",
        paymentIntentId,
      });

      if (smsOptIn && user) {
        await supabase.from("profiles").update({ sms_opt_in: true }).eq("id", user.id);
      }

      setCart([]);
      setShowPaymentDialog(false);
      setPaymentMethod("card");
      setSelectedPaymentMethodId(null);
    } catch (error: any) {
      console.error("Failed to process order:", error);
      toast.error(error.message || "Failed to process order.");
    } finally {
      setIsProcessingPayment(false);
    }
  };

  // ──────────────────────────────────────────────────────────────
  // Editorial Storm Café UI
  // 4 intent tabs → sub-rail → items grid → sticky cart (desktop)
  // 4 intent tabs → sub-pills → single-column → sticky bottom bar (mobile)
  // ──────────────────────────────────────────────────────────────
  const INTENT_GROUPS: { id: string; label: string; categoryNames: string[] }[] = [
    { id: "eat", label: "Cafe Bites", categoryNames: ["Cafe Bites"] },
    {
      id: "smoothies",
      label: "Smoothies",
      categoryNames: ["Smoothies", "Functional Smoothie", "Protein Smoothie"],
    },
    { id: "coffee", label: "Coffee Bar", categoryNames: ["Coffee & Lattes", "Matcha"] },
    {
      id: "energy",
      label: "Energy & Hydration",
      categoryNames: ["Cold Pressed Juice", "Energy Drinks", "Amino Acid Slushie", "Refreshers", "Water"],
    },
  ];
  const displayCategoryName = (name: string) => name;

  // Which intent groups actually have categories that exist + have items
  const intentToCategories = INTENT_GROUPS.map((g) => ({
    ...g,
    categories: categories.filter(
      (c) =>
        g.categoryNames.some((n) => n.toLowerCase() === c.name.toLowerCase()) &&
        sectionScopedItems.some((i) => i.category_id === c.id)
    ),
  })).filter((g) => g.categories.length > 0);

  const [activeIntentId, setActiveIntentId] = useState<string | null>(null);
  // Sync default intent once categories load
  useEffect(() => {
    if (!activeIntentId && intentToCategories.length > 0) {
      setActiveIntentId(intentToCategories[0].id);
    }
  }, [activeIntentId, intentToCategories]);

  const activeIntent =
    intentToCategories.find((g) => g.id === activeIntentId) || intentToCategories[0];

  // Auto-select first sub-category when intent changes
  useEffect(() => {
    if (!activeIntent) return;
    const stillValid = activeIntent.categories.some((c) => c.id === selectedCategoryId);
    if (!stillValid) {
      setSelectedCategoryId(activeIntent.categories[0]?.id ?? null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeIntent?.id]);

  const visibleItemsBase = selectedCategoryId
    ? sectionScopedItems.filter((i) => i.category_id === selectedCategoryId)
    : activeIntent
    ? sectionScopedItems.filter((i) =>
        activeIntent.categories.some((c) => c.id === i.category_id)
      )
    : sectionScopedItems;

  // Cafe Bites sub-tabs: Toast · Chia Pudding · Plates · Acai Bowls · Seasonal
  const isBitesIntent = activeIntent?.id === "eat";
  const bitesSubDefs: { id: string; label: string; match: (i: DbMenuItem) => boolean }[] = [
    { id: "toast", label: "Toast", match: (i) => /toast/i.test(i.item_name || "") },
    {
      id: "chia",
      label: "Chia Pudding",
      match: (i) => {
        const n = (i.item_name || "").toLowerCase();
        return n.includes("chia") || n.includes("sago") || n.includes("overnight oats");
      },
    },
    {
      id: "plates",
      label: "Plates",
      match: (i) => {
        const n = (i.item_name || "").toLowerCase();
        return n.includes("mezze") || n.includes("melt") || n.includes("baked");
      },
    },
    {
      id: "acai",
      label: "Acai Bowls",
      match: (i) => {
        const n = (i.item_name || "").toLowerCase();
        return n.includes("acai") || n.includes("bowl");
      },
    },
    { id: "seasonal", label: "Seasonal", match: (i) => !!i.is_seasonal },
  ];
  const classifyBites = (i: DbMenuItem): string | null => {
    for (const d of bitesSubDefs) if (d.match(i)) return d.id;
    return null;
  };
  const availableBitesSubs = isBitesIntent
    ? bitesSubDefs.filter((d) => visibleItemsBase.some((i) => classifyBites(i) === d.id))
    : [];
  const [bitesSubId, setBitesSubId] = useState<string | null>(null);
  const availableBitesKey = availableBitesSubs.map((d) => d.id).join(",");
  useEffect(() => {
    if (!isBitesIntent) return;
    if (!bitesSubId || !availableBitesSubs.some((d) => d.id === bitesSubId)) {
      setBitesSubId(availableBitesSubs[0]?.id ?? null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isBitesIntent, availableBitesKey]);

  const visibleItems =
    isBitesIntent && bitesSubId
      ? visibleItemsBase.filter((i) => classifyBites(i) === bitesSubId)
      : visibleItemsBase;

  const [mobileBagOpen, setMobileBagOpen] = useState(false);

  const headerStickyTop = variant === "public" ? "top-16 md:top-20" : "top-0";

  const renderCartLines = () =>
    cart.map((item) => {
      const unit = item.price + item.addons.reduce((s, a) => s + a.price, 0);
      return (
        <div key={item.key} className="flex items-start justify-between gap-3 py-3 border-b border-cafe-line/60 last:border-0">
          <div className="flex-1 min-w-0">
            <p className="font-cafe-serif text-sm uppercase tracking-wide text-cafe-burgundy leading-snug">
              {item.quantity}× {item.name}
            </p>
            {item.addons.length > 0 && (
              <p className="font-cafe-mono text-[9px] uppercase tracking-widest text-cafe-burgundy/60 mt-1">
                {item.addons.map((a) => `+ ${a.name}`).join(" · ")}
              </p>
            )}
            <div className="flex items-center gap-2 mt-2">
              <button
                onClick={() => updateQuantity(item.key, -1)}
                className="w-6 h-6 border border-cafe-line text-cafe-burgundy hover:bg-cafe-stone transition-colors flex items-center justify-center"
                aria-label="Decrease"
              >
                <Minus className="w-3 h-3" />
              </button>
              <button
                onClick={() => updateQuantity(item.key, 1)}
                className="w-6 h-6 border border-cafe-line text-cafe-burgundy hover:bg-cafe-stone transition-colors flex items-center justify-center"
                aria-label="Increase"
              >
                <Plus className="w-3 h-3" />
              </button>
            </div>
          </div>
          <span className="font-cafe-serif italic text-sm text-cafe-burgundy shrink-0">
            ${(unit * item.quantity).toFixed(2)}
          </span>
        </div>
      );
    });

  const cartTotalsBlock = (
    <div className="mt-6 pt-5 border-t border-cafe-line/70 space-y-2">
      <div className="flex justify-between font-cafe-mono text-[10px] tracking-widest uppercase text-cafe-burgundy/70">
        <span>Subtotal</span>
        <span>${cartSubtotal.toFixed(2)}</span>
      </div>
      <div className="flex justify-between font-cafe-mono text-[10px] tracking-widest uppercase text-cafe-burgundy/70">
        <span>MI Tax (6%)</span>
        <span>${cartTax.toFixed(2)}</span>
      </div>
      <div className="flex justify-between font-cafe-mono text-[10px] tracking-widest uppercase text-cafe-burgundy/70">
        <span>Processing Fee</span>
        <span>${cartProcessingFee.toFixed(2)}</span>
      </div>
      <div className="flex justify-between items-baseline pt-3 mt-2 border-t border-cafe-line/70">
        <span className="font-cafe-mono text-[11px] tracking-widest uppercase text-cafe-burgundy">Total</span>
        <span className="font-cafe-serif italic text-2xl text-cafe-burgundy">${cartTotal.toFixed(2)}</span>
      </div>
    </div>
  );

  const cartCheckoutButton = (
    <button
      onClick={handlePlaceOrder}
      disabled={!user || cart.length === 0 || createOrder.isPending}
      className="w-full mt-6 bg-[hsl(var(--cafe-terracotta))] hover:bg-[hsl(var(--cafe-terracotta-deep))] disabled:opacity-40 disabled:cursor-not-allowed text-white font-cafe-mono text-[11px] tracking-[0.2em] uppercase py-4 transition-colors"
    >
      {createOrder.isPending ? "Processing…" : "Checkout"}
    </button>
  );

  return (
    <>
      {showHero && (
        <section className="bg-cafe-cream border-b border-cafe-line">
          <div className="container mx-auto px-6 py-10 flex flex-col md:flex-row md:items-end md:justify-between gap-6">
            <div className="flex flex-col md:flex-row md:items-center gap-4">
              <h1 className="font-cafe-serif text-3xl md:text-[36px] leading-none tracking-tight text-cafe-terracotta uppercase">
                Storm Café
              </h1>
              <div className="hidden md:block h-6 w-px bg-cafe-terracotta/30" />
              <span className="font-cafe-mono text-[10px] tracking-[0.25em] uppercase text-cafe-terracotta/80">
                Est. 2024 · Livonia MI
              </span>
            </div>
          </div>
        </section>
      )}

      {isLoading ? (
        <div className="bg-cafe-cream py-32 flex justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-cafe-terracotta" />
        </div>
      ) : intentToCategories.length === 0 ? (
        <div className="bg-cafe-cream py-32 text-center text-cafe-burgundy/60 font-cafe-mono text-xs uppercase tracking-widest">
          No items available right now.
        </div>
      ) : (
        <div className="bg-cafe-cream text-cafe-burgundy">
          {/* Intent tabs */}
          <div className={`bg-cafe-cream/95 backdrop-blur-sm border-b border-cafe-line sticky ${headerStickyTop} z-30`}>
            <div className="container mx-auto px-4">
              <div className="flex overflow-x-auto no-scrollbar justify-start md:justify-center">
                {intentToCategories.map((g) => {
                  const active = g.id === activeIntent?.id;
                  return (
                    <button
                      key={g.id}
                      onClick={() => setActiveIntentId(g.id)}
                      className={`whitespace-nowrap px-5 md:px-8 py-4 font-cafe-mono text-[10px] md:text-[11px] tracking-[0.2em] uppercase transition-colors border-b-2 ${
                        active
                          ? "border-[hsl(var(--cafe-terracotta))] text-cafe-terracotta"
                          : "border-transparent text-cafe-burgundy/50 hover:text-cafe-burgundy"
                      }`}
                    >
                      {g.label}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Body: sub-rail · items · cart */}
          <div className="container mx-auto px-0 md:px-4">
            <div className="flex flex-col lg:flex-row gap-0 lg:gap-0">
              {/* Sub-rail (desktop) */}
              {activeIntent && activeIntent.categories.length > 1 && (
                <aside className="hidden lg:block w-[220px] shrink-0 border-r border-cafe-line p-8">
                  <p className="font-cafe-mono text-[9px] tracking-[0.25em] uppercase text-cafe-burgundy/40 mb-6">
                    Category
                  </p>
                  <ul className="space-y-4">
                    {activeIntent.categories.map((c) => {
                      const active = c.id === selectedCategoryId;
                      return (
                        <li key={c.id}>
                          <button
                            onClick={() => setSelectedCategoryId(c.id)}
                            className={`font-cafe-serif text-lg text-left transition-opacity ${
                              active
                                ? "text-cafe-terracotta italic border-l-2 border-cafe-terracotta pl-3"
                                : "text-cafe-burgundy/60 hover:text-cafe-burgundy pl-3"
                            }`}
                          >
                            {displayCategoryName(c.name)}
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </aside>
              )}

              {/* Cafe Bites sub-rail (desktop) */}
              {isBitesIntent && availableBitesSubs.length > 1 && (
                <aside className="hidden lg:block w-[220px] shrink-0 border-r border-cafe-line p-8">
                  <p className="font-cafe-mono text-[9px] tracking-[0.25em] uppercase text-cafe-burgundy/40 mb-6">
                    Category
                  </p>
                  <ul className="space-y-4">
                    {availableBitesSubs.map((d) => {
                      const active = d.id === bitesSubId;
                      return (
                        <li key={d.id}>
                          <button
                            onClick={() => setBitesSubId(d.id)}
                            className={`font-cafe-serif text-lg text-left transition-opacity ${
                              active
                                ? "text-cafe-terracotta italic border-l-2 border-cafe-terracotta pl-3"
                                : "text-cafe-burgundy/60 hover:text-cafe-burgundy pl-3"
                            }`}
                          >
                            {d.label}
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </aside>
              )}

              {/* Sub-pills (mobile/tablet) */}
              {activeIntent && activeIntent.categories.length > 1 && (
                <div className="lg:hidden px-4 pt-4 pb-2 flex gap-2 overflow-x-auto no-scrollbar">
                  {activeIntent.categories.map((c) => {
                    const active = c.id === selectedCategoryId;
                    return (
                      <button
                        key={c.id}
                        onClick={() => setSelectedCategoryId(c.id)}
                        className={`whitespace-nowrap px-4 py-1.5 font-cafe-mono text-[9px] tracking-widest uppercase rounded-full border transition-colors ${
                          active
                            ? "bg-[hsl(var(--cafe-terracotta))] text-white border-[hsl(var(--cafe-terracotta))]"
                            : "border-cafe-line text-cafe-burgundy/60"
                        }`}
                      >
                        {displayCategoryName(c.name)}
                      </button>
                    );
                  })}
                </div>
              )}

              {/* Cafe Bites sub-pills (mobile/tablet) */}
              {isBitesIntent && availableBitesSubs.length > 1 && (
                <div className="lg:hidden px-4 pt-4 pb-2 flex gap-2 overflow-x-auto no-scrollbar">
                  {availableBitesSubs.map((d) => {
                    const active = d.id === bitesSubId;
                    return (
                      <button
                        key={d.id}
                        onClick={() => setBitesSubId(d.id)}
                        className={`whitespace-nowrap px-4 py-1.5 font-cafe-mono text-[9px] tracking-widest uppercase rounded-full border transition-colors ${
                          active
                            ? "bg-[hsl(var(--cafe-terracotta))] text-white border-[hsl(var(--cafe-terracotta))]"
                            : "border-cafe-line text-cafe-burgundy/60"
                        }`}
                      >
                        {d.label}
                      </button>
                    );
                  })}
                </div>
              )}

              {/* Items grid */}
              <main className="flex-1 p-4 md:p-8 lg:p-10">
                <CafeReviewPrompt />
                {visibleItems.length === 0 ? (
                  <p className="text-center py-20 font-cafe-mono text-xs uppercase tracking-widest text-cafe-burgundy/50">
                    Nothing here yet.
                  </p>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 md:gap-x-10 gap-y-10 md:gap-y-14 pb-32 lg:pb-10">
                    {(() => {
                      // Group by item_name within the visible items (skip empty/null names)
                      const groups: { key: string; items: DbMenuItem[] }[] = [];
                      const seen = new Map<string, number>();
                      for (const it of visibleItems) {
                        const key = (it.item_name || "").trim().toLowerCase();
                        if (!key) {
                          groups.push({ key: `__solo_${it.id}`, items: [it] });
                          continue;
                        }
                        if (seen.has(key)) {
                          groups[seen.get(key)!].items.push(it);
                        } else {
                          seen.set(key, groups.length);
                          groups.push({ key, items: [it] });
                        }
                      }
                      return groups.map((g, idx) => {
                        const isGroup = g.items.length > 1;
                        const primary = g.items[0];
                        const item = primary;
                        const isSoldOut = isGroup
                          ? g.items.every((i) => i.stock_quantity === 0)
                          : item.stock_quantity === 0;
                        const parsed = parseItemDescription(item);
                        const catName = displayCategoryName(
                          categories.find((c) => c.id === item.category_id)?.name || ""
                        );
                        const sizeMeta = parsed.size || item.size || "";
                        const itemAddons = getAddonsForItem(item);
                        const idx3 = String(idx + 1).padStart(3, "0");

                        const hasDetails =
                          !!parsed.description ||
                          !!parsed.benefits ||
                          !!parsed.nutrition ||
                          parsed.functionalBlend.length > 0 ||
                          (item.dietary_tags && item.dietary_tags.length > 0) ||
                          !!item.calories;

                        // Group card
                        if (isGroup) {
                          const name = item.item_name || "";
                          const prices = g.items.map((i) => i.price);
                          const minPrice = Math.min(...prices);
                          const maxPrice = Math.max(...prices);
                          const priceLabel =
                            minPrice === maxPrice
                              ? `$${minPrice.toFixed(2)}`
                              : `From $${minPrice.toFixed(2)}`;
                          const groupImage = g.items.find((i) => i.image_url)?.image_url || null;
                          return (
                            <article
                              key={g.key}
                              onClick={() => setGroupPickerItems(g.items)}
                              className={`group flex flex-col cursor-pointer ${isSoldOut ? "opacity-50" : ""}`}
                            >
                              <div className="relative aspect-[4/5] bg-cafe-stone overflow-hidden mb-5 border border-cafe-line/60">
                                <span className="absolute top-3 left-3 font-cafe-mono text-[9px] tracking-[0.25em] text-cafe-burgundy/50">
                                  {idx3}
                                </span>
                                {groupImage ? (
                                  <img
                                    src={groupImage}
                                    alt={name}
                                    loading="lazy"
                                    className="w-full h-full object-cover"
                                  />
                                ) : (
                                  <div className="w-full h-full flex items-center justify-center">
                                    <span className="font-cafe-mono text-[10px] tracking-[0.3em] uppercase text-cafe-burgundy/30 italic">
                                      Image coming soon
                                    </span>
                                  </div>
                                )}
                                {isSoldOut && (
                                  <div className="absolute inset-0 bg-cafe-cream/70 flex items-center justify-center">
                                    <span className="font-cafe-mono text-[10px] tracking-[0.3em] uppercase text-cafe-burgundy">
                                      Sold Out
                                    </span>
                                  </div>
                                )}
                                <span className="absolute top-3 right-3 bg-cafe-burgundy/85 text-cafe-cream font-cafe-mono text-[8px] tracking-widest uppercase px-2 py-1">
                                  {g.items.length} Flavors
                                </span>
                              </div>

                              <div className="flex justify-between items-baseline gap-3 mb-1.5">
                                <h3 className="font-cafe-serif text-lg md:text-xl uppercase tracking-tight text-cafe-burgundy leading-tight">
                                  {name}
                                </h3>
                                <span className="font-cafe-serif italic text-lg text-cafe-burgundy shrink-0">
                                  {priceLabel}
                                </span>
                              </div>

                              <p className="font-cafe-mono text-[10px] tracking-widest uppercase text-cafe-burgundy/60 mb-3">
                                {[catName, sizeMeta].filter(Boolean).join(" / ")}
                              </p>

                              <div className="mt-auto flex items-center gap-5 pt-2">
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setGroupPickerItems(g.items);
                                  }}
                                  disabled={isSoldOut}
                                  className="bg-[hsl(var(--cafe-terracotta))] hover:bg-[hsl(var(--cafe-terracotta-deep))] disabled:opacity-40 text-white font-cafe-mono text-[10px] tracking-[0.2em] uppercase px-5 py-2.5 transition-colors"
                                >
                                  Choose Flavor
                                </button>
                              </div>
                            </article>
                          );
                        }

                        const name = getItemDisplayName(item);
                        return (
                          <article
                            key={item.id}
                            onClick={() => hasDetails && setDetailItem(item)}
                            className={`group flex flex-col ${isSoldOut ? "opacity-50" : ""} ${hasDetails ? "cursor-pointer" : ""}`}
                          >
                            {/* Image / Coming soon placeholder */}
                            <div className="relative aspect-[4/5] bg-cafe-stone overflow-hidden mb-5 border border-cafe-line/60">
                              <span className="absolute top-3 left-3 font-cafe-mono text-[9px] tracking-[0.25em] text-cafe-burgundy/50">
                                {idx3}
                              </span>
                              {item.image_url ? (
                                <img
                                  src={item.image_url}
                                  alt={name}
                                  loading="lazy"
                                  className="w-full h-full object-cover"
                                />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center">
                                  <span className="font-cafe-mono text-[10px] tracking-[0.3em] uppercase text-cafe-burgundy/30 italic">
                                    Image coming soon
                                  </span>
                                </div>
                              )}
                              {isSoldOut && (
                                <div className="absolute inset-0 bg-cafe-cream/70 flex items-center justify-center">
                                  <span className="font-cafe-mono text-[10px] tracking-[0.3em] uppercase text-cafe-burgundy">
                                    Sold Out
                                  </span>
                                </div>
                              )}
                              {item.is_seasonal && (
                                <span className="absolute top-3 right-3 bg-[hsl(var(--cafe-terracotta))] text-white font-cafe-mono text-[8px] tracking-widest uppercase px-2 py-1">
                                  {item.seasonal_label || "Limited"}
                                </span>
                              )}
                            </div>

                            {/* Name + price */}
                            <div className="flex justify-between items-baseline gap-3 mb-1.5">
                              <h3 className="font-cafe-serif text-lg md:text-xl uppercase tracking-tight text-cafe-burgundy leading-tight">
                                {name}
                              </h3>
                              <span className="font-cafe-serif italic text-lg text-cafe-burgundy shrink-0">
                                ${item.price.toFixed(2)}
                              </span>
                            </div>

                            {/* Meta */}
                            <div className="flex items-baseline justify-between gap-3 mb-3">
                              <p className="font-cafe-mono text-[10px] tracking-widest uppercase text-cafe-burgundy/60">
                                {[catName, sizeMeta].filter(Boolean).join(" / ")}
                                {item.calories ? ` · ${item.calories} kcal` : ""}
                              </p>
                              <CafeRatingBadge itemId={item.id} />
                            </div>

                            {/* Benefit pills */}
                            {(() => {
                              const tags = getBenefitTags(item, parsed).slice(0, 3);
                              if (tags.length === 0) return null;
                              return (
                                <div className="flex flex-wrap gap-1.5 mb-3">
                                  {tags.map((t) => (
                                    <span
                                      key={t}
                                      className="font-cafe-mono text-[9px] tracking-widest uppercase text-cafe-terracotta border border-cafe-line rounded-full px-2.5 py-0.5"
                                    >
                                      {t}
                                    </span>
                                  ))}
                                </div>
                              );
                            })()}

                            {/* Short teaser + tap to expand */}
                            {parsed.description && (
                              <p className="text-sm text-cafe-burgundy/75 leading-relaxed mb-2 line-clamp-2">
                                {parsed.description}
                              </p>
                            )}
                            {hasDetails && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setDetailItem(item);
                                }}
                                className="self-start font-cafe-mono text-[9px] tracking-[0.25em] uppercase text-cafe-burgundy/60 hover:text-cafe-terracotta underline underline-offset-4 decoration-cafe-line mb-4"
                              >
                                View details
                              </button>
                            )}

                            {/* Actions */}
                            <div className="mt-auto flex items-center gap-5 pt-2">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (isSoldOut) return;
                                  addItemToCart(item, []);
                                }}
                                disabled={isSoldOut}
                                className="bg-[hsl(var(--cafe-terracotta))] hover:bg-[hsl(var(--cafe-terracotta-deep))] disabled:opacity-40 text-white font-cafe-mono text-[10px] tracking-[0.2em] uppercase px-5 py-2.5 transition-colors"
                              >
                                Add to Order
                              </button>
                              {itemAddons.length > 0 && (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setAddonDialogItem(item);
                                  }}
                                  disabled={isSoldOut}
                                  className="font-cafe-mono text-[9px] tracking-[0.25em] uppercase text-cafe-burgundy/60 underline underline-offset-4 decoration-cafe-line hover:text-cafe-terracotta disabled:opacity-40"
                                >
                                  Customize
                                </button>
                              )}
                            </div>
                          </article>
                        );
                      });
                    })()}

                  </div>

                )}
              </main>

              {/* Sticky cart (desktop) */}
              <aside className="hidden md:block w-[300px] lg:w-[320px] shrink-0 border-l border-cafe-line bg-cafe-stone-soft">
                <div className={`sticky ${variant === "public" ? "top-32" : "top-12"} p-8`}>
                  <div className="flex items-baseline justify-between mb-6 pb-4 border-b border-cafe-line/70">
                    <h2 className="font-cafe-serif text-2xl uppercase tracking-tight text-cafe-burgundy">
                      Your Bag
                    </h2>
                    <span className="font-cafe-mono text-[10px] tracking-widest uppercase text-cafe-burgundy/60">
                      ({cartCount})
                    </span>
                  </div>
                  {cart.length === 0 ? (
                    <p className="font-cafe-mono text-[10px] tracking-widest uppercase text-cafe-burgundy/40 text-center py-12">
                      Your bag is empty
                    </p>
                  ) : (
                    <>
                      <div className="max-h-[40vh] overflow-y-auto">{renderCartLines()}</div>
                      {cartTotalsBlock}
                      {cartCheckoutButton}
                      {!user && (
                        <p className="text-xs text-cafe-burgundy/60 text-center mt-3">
                          <a href="/auth" className="text-cafe-terracotta underline underline-offset-4">
                            Sign in
                          </a>{" "}
                          to place an order
                        </p>
                      )}
                    </>
                  )}
                </div>
              </aside>
            </div>
          </div>

          {/* Mobile sticky bag bar */}
          {cartCount > 0 && (
            <button
              onClick={() => setMobileBagOpen(true)}
              className="md:hidden fixed bottom-24 left-4 right-4 z-50 bg-[hsl(var(--cafe-terracotta))] text-white shadow-[0_12px_40px_rgba(0,0,0,0.35)] flex items-center justify-between px-5 py-4 safe-area-bottom animate-pulse"
            >
              <span className="font-cafe-mono text-[11px] tracking-[0.2em] uppercase">
                {cartCount} {cartCount === 1 ? "item" : "items"} · ${cartSubtotal.toFixed(2)}
              </span>
              <span className="font-cafe-mono text-[11px] tracking-[0.2em] uppercase font-bold flex items-center gap-2">
                <ShoppingBag className="w-3.5 h-3.5" /> View Bag
              </span>
            </button>
          )}
        </div>
      )}

      {/* Mobile bag dialog */}
      <Dialog open={mobileBagOpen} onOpenChange={setMobileBagOpen}>
        <DialogContent className="bg-cafe-cream border-cafe-line max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-cafe-serif text-2xl uppercase tracking-tight text-cafe-burgundy">
              Your Bag ({cartCount})
            </DialogTitle>
            <DialogDescription className="font-cafe-mono text-[10px] tracking-widest uppercase text-cafe-burgundy/60">
              Review your order
            </DialogDescription>
          </DialogHeader>
          {cart.length === 0 ? (
            <p className="font-cafe-mono text-[10px] tracking-widest uppercase text-cafe-burgundy/40 text-center py-10">
              Your bag is empty
            </p>
          ) : (
            <>
              <div>{renderCartLines()}</div>
              {cartTotalsBlock}
              <button
                onClick={() => {
                  setMobileBagOpen(false);
                  handlePlaceOrder();
                }}
                disabled={!user || createOrder.isPending}
                className="w-full mt-6 bg-[hsl(var(--cafe-terracotta))] hover:bg-[hsl(var(--cafe-terracotta-deep))] disabled:opacity-40 text-white font-cafe-mono text-[11px] tracking-[0.2em] uppercase py-4"
              >
                {createOrder.isPending ? "Processing…" : "Checkout"}
              </button>
            </>
          )}
        </DialogContent>
      </Dialog>


      {/* Payment Dialog */}
      <Dialog open={showPaymentDialog} onOpenChange={setShowPaymentDialog}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Complete Your Order</DialogTitle>
            <DialogDescription>Review your order and select a payment method</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {resolvedMode === "member" && (
              <div className="space-y-2">
                <label className="text-sm font-medium">Payment Method</label>
                <Select value={paymentMethod} onValueChange={(v: "card" | "member_account") => setPaymentMethod(v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="card">
                      <div className="flex items-center gap-2">
                        <CreditCard className="w-4 h-4" /> Credit/Debit Card
                      </div>
                    </SelectItem>
                    <SelectItem value="member_account">
                      <div className="flex items-center gap-2">
                        <User className="w-4 h-4" /> Charge to Member Account
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}

            {paymentMethod === "card" && savedPaymentMethods.length > 0 && (
              <div className="space-y-2">
                <label className="text-sm font-medium">Select Card</label>
                <Select value={selectedPaymentMethodId || ""} onValueChange={setSelectedPaymentMethodId}>
                  <SelectTrigger><SelectValue placeholder="Select a card" /></SelectTrigger>
                  <SelectContent>
                    {savedPaymentMethods.map((pm) => (
                      <SelectItem key={pm.id} value={pm.id}>
                        {(pm.brand || "Card").toUpperCase()} •••• {pm.last4 || "****"}
                        {pm.expMonth && pm.expYear ? ` (Expires ${pm.expMonth}/${pm.expYear})` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* No-card state */}
            {paymentMethod === "card" && savedPaymentMethods.length === 0 && !showAddCard && (
              <div className="p-4 bg-muted/50 border border-muted rounded-md space-y-3">
                <p className="text-sm text-muted-foreground">
                  {resolvedMode === "nonmember"
                    ? "You need a card on file to place this order."
                    : "No saved payment methods found."}
                </p>
                {resolvedMode === "nonmember" ? (
                  <Button size="sm" onClick={beginAddCard}>
                    <Plus className="w-4 h-4 mr-1" /> Add a card
                  </Button>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    Add a card in your{" "}
                    <a href="/member/payment-methods" className="underline font-medium">
                      member portal
                    </a>
                    .
                  </p>
                )}
              </div>
            )}

            {/* Inline add-card form for non-members */}
            {showAddCard && resolvedMode === "nonmember" && (
              <div className="p-4 border rounded-md bg-background space-y-3">
                <p className="text-sm font-medium">Add a card to place this order</p>
                {setupLoading && (
                  <div className="py-6 text-center">
                    <Loader2 className="h-6 w-6 animate-spin mx-auto text-accent" />
                  </div>
                )}
                {setupError && (
                  <div className="py-4 text-center">
                    <AlertCircle className="h-6 w-6 mx-auto mb-2 text-destructive" />
                    <p className="text-destructive text-sm mb-3">{setupError}</p>
                    <Button variant="outline" size="sm" onClick={beginAddCard}>Try Again</Button>
                  </div>
                )}
                {setupClientSecret && !setupLoading && !setupError && (
                  <StripeProvider key={`cafe-setup-${setupKeyRef.current}`} clientSecret={setupClientSecret}>
                    <InlineAddCardForm
                      onSuccess={handleCardAdded}
                      onCancel={() => { setShowAddCard(false); setSetupClientSecret(null); }}
                    />
                  </StripeProvider>
                )}
              </div>
            )}

            <div className="border-t pt-4 space-y-1">
              <div className="flex justify-between items-center text-sm text-muted-foreground">
                <span>Subtotal</span><span>${cartSubtotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between items-center text-sm text-muted-foreground">
                <span>MI Sales Tax (6%)</span><span>${cartTax.toFixed(2)}</span>
              </div>
              <div className="flex justify-between items-center text-sm text-muted-foreground">
                <span>Processing Fee</span><span>${cartProcessingFee.toFixed(2)}</span>
              </div>
              <div className="flex justify-between items-center text-lg font-semibold pt-1 border-t">
                <span>Total</span><span className="text-accent">${cartTotal.toFixed(2)}</span>
              </div>
            </div>

            {showSmsOptIn && (
              <label className="flex items-start gap-2 rounded-md border bg-muted/30 p-3 cursor-pointer">
                <Checkbox
                  checked={smsOptIn}
                  onCheckedChange={(v) => setSmsOptIn(v === true)}
                  className="mt-0.5"
                />
                <div className="flex-1">
                  <div className="flex items-center gap-1.5 text-sm font-medium">
                    <MessageSquare className="h-3.5 w-3.5" /> Text me when it's ready
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    We'll text you order updates and the occasional cafe special. Reply STOP to opt out anytime.
                  </p>
                </div>
              </label>
            )}
          </div>
          <div className="flex gap-2 justify-end">
            <Button variant="outline" onClick={() => setShowPaymentDialog(false)} disabled={isProcessingPayment}>
              Cancel
            </Button>
            <Button
              onClick={handleConfirmOrder}
              disabled={
                isProcessingPayment ||
                (paymentMethod === "card" && !selectedPaymentMethodId)
              }
            >
              {isProcessingPayment ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Processing...</>
              ) : (
                `Pay $${cartTotal.toFixed(2)}`
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <CafeAddonDialog
        open={!!addonDialogItem}
        onOpenChange={(open) => !open && setAddonDialogItem(null)}
        item={addonDialogItem}
        itemDisplayName={addonDialogItem ? getItemDisplayName(addonDialogItem) : ""}
        addons={addonDialogItem ? getAddonsForItem(addonDialogItem) : []}
        onConfirm={(selected) => {
          if (addonDialogItem) {
            addItemToCart(
              addonDialogItem,
              selected.map((a) => ({ id: a.id, name: a.name, price: Number(a.price || 0) })),
            );
          }
          setAddonDialogItem(null);
        }}
      />

      {/* Item detail dialog */}
      <Dialog open={!!detailItem} onOpenChange={(open) => !open && setDetailItem(null)}>
        <DialogContent className="sm:max-w-xl bg-cafe-cream max-h-[90vh] overflow-y-auto">
          {detailItem && (() => {
            const d = parseItemDescription(detailItem);
            const name = getItemDisplayName(detailItem);
            const itemAddons = getAddonsForItem(detailItem);
            const isSoldOut = detailItem.stock_quantity === 0;
            return (
              <>
                <DialogHeader>
                  <DialogTitle className="font-cafe-serif text-2xl uppercase tracking-tight text-cafe-burgundy text-left">
                    {name}
                  </DialogTitle>
                  <DialogDescription className="font-cafe-mono text-[10px] tracking-widest uppercase text-cafe-burgundy/60 text-left">
                    ${detailItem.price.toFixed(2)}
                    {d.size ? ` · ${d.size}` : ""}
                    {detailItem.calories ? ` · ${detailItem.calories} kcal` : ""}
                  </DialogDescription>
                </DialogHeader>

                {detailItem.image_url && (
                  <div className="aspect-[4/3] w-full overflow-hidden border border-cafe-line/60 bg-cafe-stone">
                    <img
                      src={detailItem.image_url}
                      alt={name}
                      className="w-full h-full object-cover"
                    />
                  </div>
                )}

                <div className="space-y-6 text-cafe-burgundy">
                  {d.description && (
                    <p className="text-sm leading-relaxed">{d.description}</p>
                  )}

                  {d.functionalBlend.length > 0 && (
                    <div className="pt-1">
                      <div className="flex items-center gap-3 mb-5">
                        <span className="h-px flex-1 bg-cafe-line/70" />
                        <span className="font-cafe-mono text-[9px] tracking-[0.3em] uppercase text-cafe-burgundy/70">
                          Functional Blend
                        </span>
                        <span className="h-px flex-1 bg-cafe-line/70" />
                      </div>
                      <ul className="divide-y divide-cafe-line/60 border-y border-cafe-line/60">
                        {d.functionalBlend.map((entry, i) => (
                          <li key={i} className="py-3.5 first:pt-3 last:pb-3">
                            <p className="font-cafe-serif text-[15px] tracking-wide uppercase text-cafe-burgundy leading-snug">
                              {entry.ingredient}
                            </p>
                            {entry.benefit && (
                              <p className="mt-1 text-[13px] leading-relaxed text-cafe-burgundy/75">
                                {entry.benefit}
                              </p>
                            )}
                          </li>
                        ))}
                      </ul>
                      <p className="mt-3 font-cafe-mono text-[9px] tracking-[0.25em] uppercase text-cafe-burgundy/45 text-center italic">
                        Crafted to nourish · sip with intention
                      </p>
                    </div>
                  )}

                  {d.benefits && (
                    <div>
                      <p className="font-cafe-mono text-[9px] tracking-widest uppercase text-cafe-burgundy/70 mb-1.5">
                        Benefits
                      </p>
                      <ul className="text-sm leading-relaxed space-y-1 pl-4">
                        {d.benefits.split(/[•·]/).filter((b) => b.trim()).map((b, i) => (
                          <li key={i} className="list-disc">{b.trim()}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {d.nutrition && (
                    <div>
                      <p className="font-cafe-mono text-[9px] tracking-widest uppercase text-cafe-burgundy/70 mb-1.5">
                        Nutritional Profile
                      </p>
                      <ul className="text-sm leading-relaxed space-y-1 pl-4">
                        {d.nutrition.split(/[•·,]/).filter((n) => n.trim()).map((n, i) => (
                          <li key={i} className="list-disc">{n.trim()}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {detailItem.dietary_tags && detailItem.dietary_tags.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {detailItem.dietary_tags.map((t) => (
                        <span
                          key={t}
                          className="font-cafe-mono text-[9px] tracking-widest uppercase border border-cafe-line px-2 py-0.5 text-cafe-burgundy/70"
                        >
                          {t}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-5 pt-2">
                  <button
                    onClick={() => {
                      if (isSoldOut) return;
                      addItemToCart(detailItem, []);
                      setDetailItem(null);
                    }}
                    disabled={isSoldOut}
                    className="bg-[hsl(var(--cafe-terracotta))] hover:bg-[hsl(var(--cafe-terracotta-deep))] disabled:opacity-40 text-white font-cafe-mono text-[10px] tracking-[0.2em] uppercase px-5 py-2.5 transition-colors"
                  >
                    {isSoldOut ? "Sold Out" : "Add to Order"}
                  </button>
                  {itemAddons.length > 0 && (
                    <button
                      onClick={() => {
                        setAddonDialogItem(detailItem);
                        setDetailItem(null);
                      }}
                      disabled={isSoldOut}
                      className="font-cafe-mono text-[9px] tracking-[0.25em] uppercase text-cafe-burgundy/60 underline underline-offset-4 decoration-cafe-line hover:text-cafe-terracotta disabled:opacity-40"
                    >
                      Customize
                    </button>
                  )}
                </div>

                <CafeItemReviews menuItemId={detailItem.id} itemName={name} />
              </>
            );
          })()}
        </DialogContent>
      </Dialog>

      {/* Flavor picker dialog (grouped items) */}
      <Dialog open={!!groupPickerItems} onOpenChange={(open) => !open && setGroupPickerItems(null)}>
        <DialogContent className="bg-cafe-cream border-cafe-line max-w-lg max-h-[90vh] overflow-y-auto">
          {groupPickerItems && (
            <>
              <DialogHeader>
                <DialogTitle className="font-cafe-serif text-2xl uppercase tracking-tight text-cafe-burgundy">
                  {groupPickerItems[0].item_name}
                </DialogTitle>
                <DialogDescription className="font-cafe-mono text-[10px] tracking-widest uppercase text-cafe-burgundy/60">
                  Choose a flavor
                </DialogDescription>
              </DialogHeader>
              <ul className="divide-y divide-cafe-line/60 border-y border-cafe-line/60 mt-2">
                {groupPickerItems.map((f) => {
                  const soldOut = f.stock_quantity === 0;
                  const fparsed = parseItemDescription(f);
                  const fhasDetails =
                    !!fparsed.description ||
                    !!fparsed.benefits ||
                    !!fparsed.nutrition ||
                    fparsed.functionalBlend.length > 0 ||
                    (f.dietary_tags && f.dietary_tags.length > 0) ||
                    !!f.calories;
                  return (
                    <li key={f.id} className={`py-4 ${soldOut ? "opacity-50" : ""}`}>
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <p className="font-cafe-serif text-[15px] uppercase tracking-wide text-cafe-burgundy leading-snug">
                            {f.flavor || "Original"}
                          </p>
                          <p className="font-cafe-mono text-[10px] tracking-widest uppercase text-cafe-burgundy/60 mt-1">
                            ${f.price.toFixed(2)}
                            {f.calories ? ` · ${f.calories} kcal` : ""}
                          </p>
                        </div>
                        <div className="flex items-center gap-3 shrink-0">
                          {fhasDetails && (
                            <button
                              onClick={() => {
                                setDetailItem(f);
                                setGroupPickerItems(null);
                              }}
                              className="font-cafe-mono text-[9px] tracking-[0.25em] uppercase text-cafe-burgundy/60 underline underline-offset-4 decoration-cafe-line hover:text-cafe-terracotta"
                            >
                              Details
                            </button>
                          )}
                          <button
                            onClick={() => {
                              if (soldOut) return;
                              addItemToCart(f, []);
                              setGroupPickerItems(null);
                            }}
                            disabled={soldOut}
                            className="bg-[hsl(var(--cafe-terracotta))] hover:bg-[hsl(var(--cafe-terracotta-deep))] disabled:opacity-40 text-white font-cafe-mono text-[10px] tracking-[0.2em] uppercase px-4 py-2 transition-colors"
                          >
                            {soldOut ? "Sold Out" : "Add"}
                          </button>
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>


  );
}
