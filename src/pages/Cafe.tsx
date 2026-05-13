import { useState, useEffect } from "react";
import { SEOHead } from "@/components/SEOHead";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Plus, Minus, ShoppingBag, Loader2, CreditCard, User, ChevronDown, MessageSquare } from "lucide-react";
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
  type CafeMenuCategory,
  type CafeMenuAddon,
} from "@/hooks/useCafeMenu";
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

interface CartItem {
  id: string;
  name: string;
  price: number;
  category: string;
  quantity: number;
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

  // Split on known headings (case-insensitive)
  const benefitsMatch = raw.match(/benefits\s*:/i);
  const nutritionMatch = raw.match(/nutri(?:tion(?:al)?|ent)\s*(?:profile|info|facts)?\s*:/i);

  const benefitsIdx = benefitsMatch ? raw.indexOf(benefitsMatch[0]) : -1;
  const nutritionIdx = nutritionMatch ? raw.indexOf(nutritionMatch[0]) : -1;

  // Determine section boundaries
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

  return {
    description,
    benefits,
    nutrition,
    size: item.size || "",
    proteinFlavor: item.protein_flavor || "",
  };
}

export default function Cafe() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const createOrder = useCreateCafeOrder();
  const { data: categories = [], isLoading: catLoading } = useCafeMenuCategories('cafe');
  const { data: menuItems = [], isLoading: itemsLoading } = useCafeMenuItems();

  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [showPaymentDialog, setShowPaymentDialog] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<"card" | "member_account">("card");
  const [selectedPaymentMethodId, setSelectedPaymentMethodId] = useState<string | null>(null);
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);
  const [savedPaymentMethods, setSavedPaymentMethods] = useState<any[]>([]);
  const [smsOptIn, setSmsOptIn] = useState(false);
  const [showSmsOptIn, setShowSmsOptIn] = useState(false);

  const isLoading = catLoading || itemsLoading;

  const filteredItems = selectedCategoryId
    ? menuItems.filter((item) => item.category_id === selectedCategoryId)
    : menuItems;

  const addToCart = (item: DbMenuItem) => {
    if (item.stock_quantity === 0) {
      toast.error("This item is sold out");
      return;
    }
    const name = getItemDisplayName(item);
    const catName = categories.find((c) => c.id === item.category_id)?.name || "";
    setCart((prev) => {
      const existing = prev.find((i) => i.id === item.id);
      if (existing) {
        return prev.map((i) => (i.id === item.id ? { ...i, quantity: i.quantity + 1 } : i));
      }
      return [...prev, { id: item.id, name, price: item.price, category: catName, quantity: 1 }];
    });
    toast.success(`${name} added to order`);
  };

  const updateQuantity = (id: string, delta: number) => {
    setCart((prev) =>
      prev
        .map((item) => (item.id === id ? { ...item, quantity: item.quantity + delta } : item))
        .filter((item) => item.quantity > 0)
    );
  };

  const cartSubtotal = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
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

  const handleConfirmOrder = async () => {
    if (cart.length === 0) return;
    setIsProcessingPayment(true);
    try {
      let paymentIntentId: string | undefined;
      const orderItems = cart.map((item) => ({
        id: parseInt(item.id.slice(0, 8), 16) || 0,
        name: item.name,
        price: item.price,
        quantity: item.quantity,
        category: item.category,
      }));
      const totalAmountCents = Math.round(cartTotal * 100);
      const processingFeeCents = Math.round(cartProcessingFee * 100);
      const taxAmountCents = Math.round(cartTax * 100);
      const subtotalCents = Math.round(cartSubtotal * 100);
      const itemDesc = `Cafe Order - ${orderItems.map((i) => i.name).join(", ")} (incl. MI 6% tax)`;

      if (paymentMethod === "card" && selectedPaymentMethodId) {
        const { data: memberData } = await supabase
          .from("members")
          .select("id, stripe_customer_id")
          .eq("user_id", user!.id)
          .maybeSingle();
        const customerId = memberData?.stripe_customer_id;
        if (!customerId) throw new Error("No payment method on file.");
        const { data: chargeData, error: chargeError } = await supabase.functions.invoke("stripe-payment", {
          body: {
            action: "charge_saved_card",
            amount: totalAmountCents,
            description: itemDesc,
            stripeCustomerId: customerId,
            paymentMethodId: selectedPaymentMethodId,
            chargeType: "pos",
            processingFee: processingFeeCents,
            taxAmount: taxAmountCents,
            subtotal: subtotalCents,
          },
        });
        if (chargeError) throw chargeError;
        if (chargeData?.error) throw new Error(chargeData.error);
        paymentIntentId = chargeData?.paymentIntentId || chargeData?.id;
      } else if (paymentMethod === "member_account") {
        const { data: memberData } = await supabase
          .from("members")
          .select("id, stripe_customer_id")
          .eq("user_id", user!.id)
          .maybeSingle();
        if (!memberData?.id) throw new Error("You must be a member to use member account charging");
        if (!memberData.stripe_customer_id) throw new Error("No payment method on file.");
        const { data: chargeData, error: chargeError } = await supabase.functions.invoke("stripe-payment", {
          body: {
            action: "charge_saved_card",
            memberId: memberData.id,
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
        if (!chargeData?.paymentIntentId) throw new Error("Payment failed.");
        paymentIntentId = chargeData.paymentIntentId;
      } else {
        throw new Error("Please select a payment method");
      }

      // Add tax + fee as line items in the order record
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

      // Flip SMS opt-in if the user checked it
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

  useEffect(() => {
    if (user && showPaymentDialog && paymentMethod === "card") {
      supabase.functions
        .invoke("stripe-payment", { body: { action: "list_payment_methods" } })
        .then(({ data, error }) => {
          if (!error && data?.paymentMethods) {
            setSavedPaymentMethods(data.paymentMethods);
            if (data.paymentMethods.length > 0) setSelectedPaymentMethodId(data.paymentMethods[0].id);
          }
        });
    }
  }, [user, showPaymentDialog, paymentMethod]);

  // When payment dialog opens, check if user has SMS opt-in already; if not, show the nudge
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

  return (
    <Layout>
      <SEOHead title="Café" description="In-house café with smoothies, protein shakes, acai bowls, cold-pressed juices, coffee, and healthy snacks at Storm Wellness Club." path="/cafe" />
      {/* Hero */}
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

      {/* Category Filters */}
      <section className="py-8 bg-background border-b border-border sticky top-20 z-40">
        <div className="container mx-auto px-6">
          <div className="flex items-center justify-between">
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
      <section className="py-16 bg-background">
        <div className="container mx-auto px-6">
          {isLoading ? (
            <div className="flex justify-center py-20">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : filteredItems.length === 0 ? (
            <p className="text-center text-muted-foreground py-20">No items available right now.</p>
          ) : (
            <div className="grid lg:grid-cols-3 gap-8">
              {/* Menu Items */}
              <div className="lg:col-span-2">
                <div className="grid md:grid-cols-2 gap-4">
                  {filteredItems.map((item) => {
                    const isSoldOut = item.stock_quantity === 0;
                    const name = getItemDisplayName(item);
                    const parsed = parseItemDescription(item);
                    const catName = categories.find((c) => c.id === item.category_id)?.name || "";

                    return (
                      <div key={item.id} className={`card-luxury overflow-hidden group relative ${isSoldOut ? "opacity-60" : ""}`}>
                        {/* Sold out overlay */}
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
                          {/* Seasonal badge - inline, not absolute */}
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
                          {parsed.size && (
                            <p className="text-xs text-muted-foreground mb-1">{parsed.size}</p>
                          )}
                          {parsed.proteinFlavor && (
                            <p className="text-xs text-muted-foreground mb-1">Protein: {parsed.proteinFlavor}</p>
                          )}
                          {parsed.description && (
                            <p className="text-muted-foreground text-sm mb-3">{parsed.description}</p>
                          )}
                          {/* Collapsible nutritional info */}
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
                              onClick={() => addToCart(item)}
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
                <div className="card-luxury p-6 sticky top-40">
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
                        {cart.map((item) => (
                          <div key={item.id} className="flex items-center justify-between">
                            <div className="flex-1">
                              <p className="text-sm font-medium">{item.name}</p>
                              <p className="text-xs text-muted-foreground">${item.price.toFixed(2)} each</p>
                            </div>
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => updateQuantity(item.id, -1)}
                                className="w-7 h-7 rounded-sm border border-border flex items-center justify-center hover:bg-secondary transition-colors"
                              >
                                <Minus className="w-3 h-3" />
                              </button>
                              <span className="w-6 text-center text-sm">{item.quantity}</span>
                              <button
                                onClick={() => updateQuantity(item.id, 1)}
                                className="w-7 h-7 rounded-sm border border-border flex items-center justify-center hover:bg-secondary transition-colors"
                              >
                                <Plus className="w-3 h-3" />
                              </button>
                            </div>
                          </div>
                        ))}
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
                          <>
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            Processing...
                          </>
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
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Complete Your Order</DialogTitle>
            <DialogDescription>Review your order and select a payment method</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Payment Method</label>
              <Select value={paymentMethod} onValueChange={(v: "card" | "member_account") => setPaymentMethod(v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="card">
                    <div className="flex items-center gap-2">
                      <CreditCard className="w-4 h-4" />
                      Credit/Debit Card
                    </div>
                  </SelectItem>
                  <SelectItem value="member_account">
                    <div className="flex items-center gap-2">
                      <User className="w-4 h-4" />
                      Charge to Member Account
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
            {paymentMethod === "card" && savedPaymentMethods.length > 0 && (
              <div className="space-y-2">
                <label className="text-sm font-medium">Select Card</label>
                <Select value={selectedPaymentMethodId || ""} onValueChange={setSelectedPaymentMethodId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a card" />
                  </SelectTrigger>
                  <SelectContent>
                    {savedPaymentMethods.map((pm) => (
                      <SelectItem key={pm.id} value={pm.id}>
                        {pm.card?.brand?.toUpperCase()} •••• {pm.card?.last4} (Expires {pm.card?.exp_month}/{pm.card?.exp_year})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            {paymentMethod === "card" && savedPaymentMethods.length === 0 && (
              <div className="p-4 bg-muted/50 border border-muted rounded-md">
                <p className="text-sm text-muted-foreground">
                  No saved payment methods found. Please add a payment method in your{" "}
                  <a href="/member/payment-methods" className="underline font-medium">member portal</a>.
                </p>
              </div>
            )}
            <div className="border-t pt-4 space-y-1">
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
              <div className="flex justify-between items-center text-lg font-semibold pt-1 border-t">
                <span>Total</span>
                <span className="text-accent">${cartTotal.toFixed(2)}</span>
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
            <Button onClick={handleConfirmOrder} disabled={isProcessingPayment || (paymentMethod === "card" && !selectedPaymentMethodId)}>
              {isProcessingPayment ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Processing...
                </>
              ) : (
                `Pay $${cartTotal.toFixed(2)}`
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </Layout>
  );
}
