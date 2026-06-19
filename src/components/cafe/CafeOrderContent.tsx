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

interface ParsedDescription {
  description: string;
  benefits: string;
  nutrition: string;
  size: string;
  proteinFlavor: string;
}

function parseItemDescription(item: DbMenuItem): ParsedDescription {
  const raw = item.description || "";
  let description = "";
  let benefits = "";
  let nutrition = "";
  const benefitsMatch = raw.match(/benefits\s*:/i);
  const nutritionMatch = raw.match(/nutri(?:tion(?:al)?|ent)\s*(?:profile|info|facts)?\s*:/i);
  const benefitsIdx = benefitsMatch ? raw.indexOf(benefitsMatch[0]) : -1;
  const nutritionIdx = nutritionMatch ? raw.indexOf(nutritionMatch[0]) : -1;
  const firstSplit = Math.min(
    ...[benefitsIdx, nutritionIdx].filter((i) => i >= 0).concat([raw.length])
  );
  description = raw.slice(0, firstSplit).trim();
  if (benefitsIdx >= 0) {
    const end = nutritionIdx > benefitsIdx ? nutritionIdx : raw.length;
    benefits = raw.slice(benefitsIdx + benefitsMatch![0].length, end).trim();
  }
  if (nutritionIdx >= 0) {
    const end = benefitsIdx > nutritionIdx ? benefitsIdx : raw.length;
    nutrition = raw.slice(nutritionIdx + nutritionMatch![0].length, end).trim();
  }
  return { description, benefits, nutrition, size: item.size || "", proteinFlavor: item.protein_flavor || "" };
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

  const stickyTopClass = variant === "public" ? "top-20" : "top-14 sm:top-16";
  const summaryTopClass = variant === "public" ? "top-40" : "top-28 sm:top-32";
  const sectionPad = variant === "public" ? "py-8" : "py-4";

  return (
    <>
      {showHero && (
        <section className="relative pt-32 pb-16 min-h-[50vh] flex items-center overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-charcoal to-charcoal/90" />
          <div className="relative z-10 container mx-auto px-6">
            <div className="max-w-3xl">
              <p className="text-gold-light text-sm uppercase tracking-widest mb-4">The Storm Café</p>
              <h1 className="heading-display text-primary-foreground mb-6">Nourish From Within</h1>
              <p className="text-primary-foreground/80 text-lg leading-relaxed">
                Fuel your wellness journey with our carefully curated menu of fresh juices,
                smoothies, energy drinks, and healthy options.
              </p>
            </div>
          </div>
        </section>
      )}

      {/* Category Filters */}
      <section className={`${sectionPad} bg-background border-b border-border sticky ${stickyTopClass} z-30`}>
        <div className="container mx-auto px-4 sm:px-6">
          <div className="flex items-center justify-between gap-2">
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setSelectedCategoryId(null)}
                className={`filter-badge ${!selectedCategoryId ? "filter-badge-active" : ""}`}
              >
                All
              </button>
              {categories.map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => setSelectedCategoryId(cat.id)}
                  className={`filter-badge ${selectedCategoryId === cat.id ? "filter-badge-active" : ""}`}
                >
                  {cat.name}
                </button>
              ))}
            </div>
            {cartCount > 0 && (
              <div className="hidden md:flex items-center gap-2 text-sm">
                <ShoppingBag className="w-4 h-4" />
                <span>{cartCount} items</span>
                <span className="text-gold font-semibold">${cartSubtotal.toFixed(2)}</span>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Menu Grid */}
      <section className={`${variant === "public" ? "py-16" : "py-8"} bg-background`}>
        <div className="container mx-auto px-4 sm:px-6">
          {isLoading ? (
            <div className="flex justify-center py-20">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : filteredItems.length === 0 ? (
            <p className="text-center text-muted-foreground py-20">No items available right now.</p>
          ) : (
            <div className="grid lg:grid-cols-3 gap-8">
              <div className="lg:col-span-2">
                <div className="grid md:grid-cols-2 gap-4">
                  {filteredItems.map((item) => {
                    const isSoldOut = item.stock_quantity === 0;
                    const name = getItemDisplayName(item);
                    const parsed = parseItemDescription(item);
                    const catName = categories.find((c) => c.id === item.category_id)?.name || "";
                    return (
                      <div key={item.id} className={`card-luxury overflow-hidden group relative ${isSoldOut ? "opacity-60" : ""}`}>
                        {isSoldOut && (
                          <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/60">
                            <Badge variant="destructive" className="text-sm px-4 py-1">Sold Out</Badge>
                          </div>
                        )}
                        {item.image_url && (
                          <div className="relative h-48 overflow-hidden">
                            <img
                              src={item.image_url}
                              alt={name}
                              className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                              loading="lazy"
                            />
                            <div className="absolute inset-0 bg-gradient-to-t from-background/80 to-transparent" />
                          </div>
                        )}
                        <div className="p-5">
                          {item.is_seasonal && (
                            <div className="mb-2">
                              <Badge className="bg-accent text-accent-foreground text-xs">
                                {item.seasonal_label || "Limited Time"}
                              </Badge>
                            </div>
                          )}
                          <div className="flex justify-between items-start mb-1">
                            <div>
                              <h3 className="font-serif text-lg font-medium">{name}</h3>
                              <p className="text-xs text-muted-foreground">{catName}</p>
                            </div>
                            <div className="text-right shrink-0 ml-3">
                              <span className="text-gold font-semibold">${item.price.toFixed(2)}</span>
                              {item.calories && (
                                <p className="text-sm text-foreground/60">{item.calories} cal</p>
                              )}
                            </div>
                          </div>
                          {parsed.size && <p className="text-xs text-muted-foreground mb-1">{parsed.size}</p>}
                          {parsed.proteinFlavor && (
                            <p className="text-xs text-muted-foreground mb-1">Protein: {parsed.proteinFlavor}</p>
                          )}
                          {parsed.description && (
                            <p className="text-muted-foreground text-sm mb-3">{parsed.description}</p>
                          )}
                          {(parsed.benefits || parsed.nutrition) && (
                            <Collapsible>
                              <CollapsibleTrigger className="flex items-center gap-1 text-xs text-foreground/50 hover:text-foreground/70 transition-colors mb-2 group/trigger">
                                <ChevronDown className="w-3 h-3 transition-transform group-data-[state=open]/trigger:rotate-180" />
                                Nutritional Info
                              </CollapsibleTrigger>
                              <CollapsibleContent className="space-y-2 mb-3">
                                {parsed.benefits && (
                                  <div>
                                    <p className="text-xs font-semibold text-foreground/70 uppercase tracking-wide mb-1">Benefits</p>
                                    <ul className="text-muted-foreground text-xs leading-relaxed space-y-0.5 pl-3">
                                      {parsed.benefits.split(/[•·]/).filter(b => b.trim()).map((benefit, i) => (
                                        <li key={i} className="list-disc">{benefit.trim()}</li>
                                      ))}
                                    </ul>
                                  </div>
                                )}
                                {parsed.nutrition && (
                                  <div>
                                    <p className="text-xs font-semibold text-foreground/70 uppercase tracking-wide mb-1">Nutritional Profile</p>
                                    <ul className="text-muted-foreground text-xs leading-relaxed space-y-0.5 pl-3">
                                      {parsed.nutrition.split(/[•·,]/).filter(n => n.trim()).map((nutrient, i) => (
                                        <li key={i} className="list-disc">{nutrient.trim()}</li>
                                      ))}
                                    </ul>
                                  </div>
                                )}
                              </CollapsibleContent>
                            </Collapsible>
                          )}
                          <div className="flex items-center justify-between mt-3">
                            <div className="flex items-center gap-2 flex-wrap">
                              {item.dietary_tags?.map((d) => (
                                <span key={d} className="text-xs px-2 py-0.5 bg-secondary text-secondary-foreground rounded-sm">
                                  {d}
                                </span>
                              ))}
                            </div>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleItemTap(item)}
                              disabled={isSoldOut}
                            >
                              <Plus className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Order Summary */}
              <div className="lg:col-span-1">
                <div className={`card-luxury p-6 sticky ${summaryTopClass}`}>
                  <h3 className="font-serif text-xl mb-4 flex items-center gap-2">
                    <ShoppingBag className="w-5 h-5" />
                    Your Order
                  </h3>
                  {cart.length === 0 ? (
                    <p className="text-muted-foreground text-sm text-center py-8">
                      Your order is empty. Add items from the menu.
                    </p>
                  ) : (
                    <>
                      <div className="space-y-4 mb-6">
                        {cart.map((item) => {
                          const unit = item.price + item.addons.reduce((s, a) => s + a.price, 0);
                          return (
                            <div key={item.key} className="flex items-start justify-between gap-2">
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium">{item.name}</p>
                                {item.addons.length > 0 && (
                                  <p className="text-xs text-muted-foreground">
                                    {item.addons.map((a) => `+ ${a.name}`).join(", ")}
                                  </p>
                                )}
                                <p className="text-xs text-muted-foreground">${unit.toFixed(2)} each</p>
                              </div>
                              <div className="flex items-center gap-2 shrink-0">
                                <button
                                  onClick={() => updateQuantity(item.key, -1)}
                                  className="w-7 h-7 rounded-sm border border-border flex items-center justify-center hover:bg-secondary transition-colors"
                                >
                                  <Minus className="w-3 h-3" />
                                </button>
                                <span className="w-6 text-center text-sm">{item.quantity}</span>
                                <button
                                  onClick={() => updateQuantity(item.key, 1)}
                                  className="w-7 h-7 rounded-sm border border-border flex items-center justify-center hover:bg-secondary transition-colors"
                                >
                                  <Plus className="w-3 h-3" />
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                      <div className="border-t border-border pt-4 mb-4 space-y-1">
                        <div className="flex justify-between items-center text-sm text-muted-foreground">
                          <span>Subtotal</span>
                          <span>${cartSubtotal.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between items-center text-sm text-muted-foreground">
                          <span>MI Sales Tax (6%)</span>
                          <span>${cartTax.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between items-center text-sm text-muted-foreground">
                          <span>Processing Fee</span>
                          <span>${cartProcessingFee.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between items-center font-medium pt-1 border-t border-border">
                          <span>Total</span>
                          <span className="text-accent font-semibold text-xl">${cartTotal.toFixed(2)}</span>
                        </div>
                      </div>
                      <Button
                        className="w-full"
                        size="lg"
                        onClick={handlePlaceOrder}
                        disabled={!user || createOrder.isPending}
                      >
                        {createOrder.isPending ? (
                          <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Processing...</>
                        ) : (
                          "Place Order"
                        )}
                      </Button>
                      {!user && (
                        <p className="text-xs text-muted-foreground text-center mt-2">
                          <a href="/auth" className="text-accent hover:underline">Sign in</a> to place an order
                        </p>
                      )}
                    </>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </section>

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
    </>
  );
}
