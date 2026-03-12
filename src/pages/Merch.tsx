import { useState, useEffect } from "react";
import { useMerchProducts, useMerchInventory, useCreateMerchOrder } from "@/hooks/useMerchProducts";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Loader2, Package, ShoppingBag, ShoppingCart, ArrowLeft, Check, CreditCard, User, Plus, Minus, Trash2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { calculateProcessingFeeFromDollars } from "@/lib/processingFee";
import type { MerchProduct } from "@/hooks/useMerchProducts";

const MI_SALES_TAX_RATE = 0.06;

interface CartItem {
  product: MerchProduct;
  size: string;
  color: string;
  quantity: number;
}

function cartItemKey(item: CartItem) {
  return `${item.product.id}-${item.size}-${item.color}`;
}

export default function Merch() {
  const { data: products, isLoading } = useMerchProducts(true);
  const { data: inventory } = useMerchInventory();
  const createOrder = useCreateMerchOrder();
  const { user } = useAuth();

  const [selectedProduct, setSelectedProduct] = useState<MerchProduct | null>(null);
  const [selectedSize, setSelectedSize] = useState("");
  const [selectedColor, setSelectedColor] = useState("");
  const [quantity, setQuantity] = useState(1);

  // Cart
  const [cart, setCart] = useState<CartItem[]>([]);
  const [showCart, setShowCart] = useState(false);

  // Payment
  const [showPaymentDialog, setShowPaymentDialog] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<"card" | "member_account">("card");
  const [selectedPaymentMethodId, setSelectedPaymentMethodId] = useState<string | null>(null);
  const [savedPaymentMethods, setSavedPaymentMethods] = useState<any[]>([]);
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);
  const [orderPlaced, setOrderPlaced] = useState(false);

  // Guest preorder fallback
  const [guestCheckout, setGuestCheckout] = useState(false);
  const [guestName, setGuestName] = useState("");
  const [guestEmail, setGuestEmail] = useState("");
  const [guestPhone, setGuestPhone] = useState("");

  const categories = [...new Set(products?.map((p) => p.category) || [])];

  // Stock helper: check if a product has any inventory
  const getProductStock = (productId: string) => {
    if (!inventory) return 0;
    return inventory.filter((i) => i.product_id === productId).reduce((sum, i) => sum + i.quantity, 0);
  };
  const cartCount = cart.reduce((sum, i) => sum + i.quantity, 0);
  const cartSubtotal = cart.reduce((sum, i) => sum + i.product.price * i.quantity, 0);
  const cartTax = cartSubtotal * MI_SALES_TAX_RATE;
  const cartProcessingFee = calculateProcessingFeeFromDollars(cartSubtotal + cartTax);
  const cartTotal = cartSubtotal + cartTax + cartProcessingFee;

  const addToCart = () => {
    if (!selectedProduct) return;
    const newItem: CartItem = { product: selectedProduct, size: selectedSize, color: selectedColor, quantity };
    setCart((prev) => {
      const key = cartItemKey(newItem);
      const existing = prev.find((i) => cartItemKey(i) === key);
      if (existing) {
        return prev.map((i) => (cartItemKey(i) === key ? { ...i, quantity: i.quantity + quantity } : i));
      }
      return [...prev, newItem];
    });
    toast.success(`${selectedProduct.name} added to cart`);
    resetProductSelection();
  };

  const updateCartQuantity = (key: string, delta: number) => {
    setCart((prev) =>
      prev.map((i) => (cartItemKey(i) === key ? { ...i, quantity: Math.max(0, i.quantity + delta) } : i)).filter((i) => i.quantity > 0)
    );
  };

  const removeFromCart = (key: string) => {
    setCart((prev) => prev.filter((i) => cartItemKey(i) !== key));
  };

  const resetProductSelection = () => {
    setSelectedProduct(null);
    setSelectedSize("");
    setSelectedColor("");
    setQuantity(1);
  };

  const resetAll = () => {
    resetProductSelection();
    setCart([]);
    setShowCart(false);
    setShowPaymentDialog(false);
    setOrderPlaced(false);
    setGuestCheckout(false);
    setGuestName("");
    setGuestEmail("");
    setGuestPhone("");
  };

  // Fetch payment methods when dialog opens
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

  const handleCheckout = () => {
    if (cart.length === 0) {
      toast.error("Your cart is empty");
      return;
    }
    if (!user) {
      setGuestCheckout(true);
      return;
    }
    setShowPaymentDialog(true);
  };

  const handlePayment = async () => {
    if (cart.length === 0) return;
    setIsProcessingPayment(true);
    try {
      let paymentIntentId: string | undefined;
      const totalAmountCents = Math.round(cartTotal * 100);
      const description = `Storm Shop - ${cart.map((i) => `${i.product.name}${i.size ? ` (${i.size})` : ""}${i.color ? ` [${i.color}]` : ""} x${i.quantity}`).join(", ")}`;

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
            description,
            stripeCustomerId: customerId,
            paymentMethodId: selectedPaymentMethodId,
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
            description,
          },
        });
        if (chargeError) throw chargeError;
        if (chargeData?.error) throw new Error(chargeData.error);
        if (!chargeData?.paymentIntentId) throw new Error("Payment failed.");
        paymentIntentId = chargeData.paymentIntentId;
      } else {
        throw new Error("Please select a payment method");
      }

      // Create merch order as paid
      await createOrder.mutateAsync({
        user_id: user!.id,
        customer_email: user!.email || null,
        order_items: cart.map((i) => ({
          product_id: i.product.id,
          name: i.product.name,
          size: i.size,
          color: i.color,
          quantity: i.quantity,
          price: i.product.price,
        })),
        total_amount: cartTotal,
        payment_method: paymentMethod === "member_account" ? "member_account" : "card",
        stripe_payment_intent_id: paymentIntentId || null,
        is_preorder: false,
        status: "paid",
      });

      setOrderPlaced(true);
      toast.success("Order placed and paid!");
    } catch (error: any) {
      console.error("Payment failed:", error);
      toast.error(error.message || "Failed to process payment.");
    } finally {
      setIsProcessingPayment(false);
    }
  };

  const handleGuestPreorder = async () => {
    if (cart.length === 0) return;
    const email = user?.email || guestEmail;
    if (!email) {
      toast.error("Email is required");
      return;
    }

    await createOrder.mutateAsync({
      user_id: user?.id || null,
      customer_name: guestName || null,
      customer_email: email,
      customer_phone: guestPhone || null,
      order_items: cart.map((i) => ({
        product_id: i.product.id,
        name: i.product.name,
        size: i.size,
        color: i.color,
        quantity: i.quantity,
        price: i.product.price,
      })),
      total_amount: cartSubtotal,
      payment_method: "preorder_card",
      is_preorder: true,
      status: "pending",
    });

    setOrderPlaced(true);
    toast.success("Preorder placed successfully!");
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // Order confirmation
  if (orderPlaced) {
    return (
      <div className="min-h-screen bg-background">
        <div className="max-w-md mx-auto px-4 py-12">
          <Card>
            <CardContent className="p-8 text-center space-y-4">
              <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
                <Check className="h-8 w-8 text-primary" />
              </div>
              <h2 className="text-2xl font-bold">{guestCheckout ? "Preorder Confirmed!" : "Order Confirmed!"}</h2>
              <p className="text-muted-foreground">
                {guestCheckout
                  ? "We'll notify you when your items are ready for pickup."
                  : "Your payment has been processed. We'll notify you when your items are ready."}
              </p>
              <Button onClick={resetAll} className="w-full">Back to Store</Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // Product detail view
  if (selectedProduct) {
    return (
      <div className="min-h-screen bg-background">
        <div className="max-w-4xl mx-auto px-4 py-8">
          <div className="flex items-center justify-between mb-6">
            <Button variant="ghost" onClick={resetProductSelection}>
              <ArrowLeft className="h-4 w-4 mr-2" /> Back to Store
            </Button>
            {cartCount > 0 && (
              <Button variant="outline" onClick={() => { resetProductSelection(); setShowCart(true); }}>
                <ShoppingCart className="h-4 w-4 mr-2" />
                Cart ({cartCount})
              </Button>
            )}
          </div>
          <div className="grid md:grid-cols-2 gap-8">
            <div>
              {selectedProduct.image_urls[0] ? (
                <img src={selectedProduct.image_urls[0]} alt={selectedProduct.name} className="w-full rounded-lg object-cover aspect-square" />
              ) : (
                <div className="w-full aspect-square bg-muted rounded-lg flex items-center justify-center">
                  <Package className="h-16 w-16 text-muted-foreground" />
                </div>
              )}
              {selectedProduct.image_urls.length > 1 && (
                <div className="flex gap-2 mt-3">
                  {selectedProduct.image_urls.map((url, i) => (
                    <img key={i} src={url} className="h-16 w-16 object-cover rounded cursor-pointer border" alt="" />
                  ))}
                </div>
              )}
            </div>
            <div className="space-y-4">
              <div>
                <Badge variant="outline">{selectedProduct.category}</Badge>
                <h1 className="text-3xl font-bold mt-2">{selectedProduct.name}</h1>
                <p className="text-2xl font-semibold text-primary mt-1">${selectedProduct.price.toFixed(2)}</p>
              </div>
              {selectedProduct.description && <p className="text-muted-foreground">{selectedProduct.description}</p>}

              {selectedProduct.sizes.length > 0 && (
                <div>
                  <Label className="mb-2 block">Size</Label>
                  <div className="flex gap-2 flex-wrap">
                    {selectedProduct.sizes.map((s) => (
                      <Button key={s} size="sm" variant={selectedSize === s ? "default" : "outline"} onClick={() => setSelectedSize(s)}>
                        {s}
                      </Button>
                    ))}
                  </div>
                </div>
              )}

              {selectedProduct.colors.length > 0 && (
                <div>
                  <Label className="mb-2 block">Color</Label>
                  <div className="flex gap-2 flex-wrap">
                    {selectedProduct.colors.map((c) => (
                      <Button key={c} size="sm" variant={selectedColor === c ? "default" : "outline"} onClick={() => setSelectedColor(c)}>
                        {c}
                      </Button>
                    ))}
                  </div>
                </div>
              )}

              <div>
                <Label className="mb-2 block">Quantity</Label>
                <div className="flex items-center gap-2">
                  <Button size="sm" variant="outline" onClick={() => setQuantity(Math.max(1, quantity - 1))}>-</Button>
                  <span className="w-8 text-center font-medium">{quantity}</span>
                  <Button size="sm" variant="outline" onClick={() => setQuantity(quantity + 1)}>+</Button>
                </div>
              </div>

              {(() => {
                const stock = getProductStock(selectedProduct.id);
                const isOutOfStock = stock === 0 && !selectedProduct.allow_preorder;
                const isPreorder = stock === 0 && selectedProduct.allow_preorder;
                return (
                  <Button
                    className="w-full"
                    size="lg"
                    onClick={addToCart}
                    disabled={
                      isOutOfStock ||
                      (selectedProduct.sizes.length > 0 && !selectedSize) ||
                      (selectedProduct.colors.length > 0 && !selectedColor)
                    }
                  >
                    <ShoppingCart className="h-4 w-4 mr-2" />
                    {isOutOfStock
                      ? "Out of Stock"
                      : isPreorder
                        ? `Pre-order — $${(selectedProduct.price * quantity).toFixed(2)}`
                        : `Add to Cart — $${(selectedProduct.price * quantity).toFixed(2)}`}
                  </Button>
                );
              })()}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Cart view
  if (showCart) {
    return (
      <div className="min-h-screen bg-background">
        <div className="max-w-2xl mx-auto px-4 py-8">
          <Button variant="ghost" onClick={() => setShowCart(false)} className="mb-6">
            <ArrowLeft className="h-4 w-4 mr-2" /> Continue Shopping
          </Button>
          <h1 className="text-3xl font-bold mb-6">Your Cart</h1>

          {cart.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground">
              <ShoppingCart className="h-16 w-16 mx-auto mb-4 opacity-50" />
              <p className="text-lg">Your cart is empty</p>
              <Button className="mt-4" onClick={() => setShowCart(false)}>Browse Products</Button>
            </div>
          ) : (
            <div className="space-y-4">
              {cart.map((item) => {
                const key = cartItemKey(item);
                return (
                  <Card key={key}>
                    <CardContent className="p-4 flex items-center gap-4">
                      {item.product.image_urls[0] ? (
                        <img src={item.product.image_urls[0]} alt={item.product.name} className="h-16 w-16 object-cover rounded" />
                      ) : (
                        <div className="h-16 w-16 bg-muted rounded flex items-center justify-center">
                          <Package className="h-6 w-6 text-muted-foreground" />
                        </div>
                      )}
                      <div className="flex-1">
                        <p className="font-semibold">{item.product.name}</p>
                        <p className="text-sm text-muted-foreground">
                          {item.size && `Size: ${item.size}`} {item.color && `• Color: ${item.color}`}
                        </p>
                        <p className="text-sm text-primary font-medium">${item.product.price.toFixed(2)} each</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button size="icon" variant="outline" className="h-8 w-8" onClick={() => updateCartQuantity(key, -1)}>
                          <Minus className="h-3 w-3" />
                        </Button>
                        <span className="w-6 text-center font-medium">{item.quantity}</span>
                        <Button size="icon" variant="outline" className="h-8 w-8" onClick={() => updateCartQuantity(key, 1)}>
                          <Plus className="h-3 w-3" />
                        </Button>
                        <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive" onClick={() => removeFromCart(key)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}

              <Card>
                <CardContent className="p-4 space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Subtotal</span>
                    <span>${cartSubtotal.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Sales Tax (6%)</span>
                    <span>${cartTax.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Processing Fee</span>
                    <span>${cartProcessingFee.toFixed(2)}</span>
                  </div>
                  <div className="border-t pt-2 flex justify-between font-semibold text-lg">
                    <span>Total</span>
                    <span className="text-primary">${cartTotal.toFixed(2)}</span>
                  </div>
                </CardContent>
              </Card>

              <Button className="w-full" size="lg" onClick={handleCheckout}>
                <ShoppingBag className="h-4 w-4 mr-2" />
                {user ? `Pay $${cartTotal.toFixed(2)}` : "Preorder"}
              </Button>
            </div>
          )}
        </div>

        {/* Guest preorder dialog */}
        <Dialog open={guestCheckout} onOpenChange={setGuestCheckout}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Complete Preorder</DialogTitle>
              <DialogDescription>Enter your details to place a preorder</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="bg-muted p-3 rounded space-y-1">
                {cart.map((item) => (
                  <p key={cartItemKey(item)} className="text-sm">
                    {item.product.name} {item.size && `(${item.size})`} {item.color && `[${item.color}]`} x{item.quantity} — ${(item.product.price * item.quantity).toFixed(2)}
                  </p>
                ))}
                <p className="font-semibold text-primary mt-2">Subtotal: ${cartSubtotal.toFixed(2)}</p>
              </div>
              <div>
                <Label>Name</Label>
                <Input value={guestName} onChange={(e) => setGuestName(e.target.value)} placeholder="Your name" />
              </div>
              <div>
                <Label>Email *</Label>
                <Input type="email" value={guestEmail} onChange={(e) => setGuestEmail(e.target.value)} placeholder="your@email.com" />
              </div>
              <div>
                <Label>Phone</Label>
                <Input value={guestPhone} onChange={(e) => setGuestPhone(e.target.value)} placeholder="(optional)" />
              </div>
              <Button className="w-full" onClick={handleGuestPreorder} disabled={createOrder.isPending}>
                {createOrder.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Place Preorder
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  // Store grid
  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-10">
          <div className="text-center flex-1">
            <h1 className="text-4xl font-bold">Storm Shop</h1>
            <p className="text-muted-foreground mt-2">Branded gear, wellness products & more</p>
          </div>
          {cartCount > 0 && (
            <Button variant="outline" onClick={() => setShowCart(true)} className="relative">
              <ShoppingCart className="h-4 w-4 mr-2" />
              Cart
              <Badge className="absolute -top-2 -right-2 h-5 w-5 p-0 flex items-center justify-center text-xs">
                {cartCount}
              </Badge>
            </Button>
          )}
        </div>

        {categories.length === 0 && (
          <div className="text-center py-16 text-muted-foreground">
            <ShoppingBag className="h-16 w-16 mx-auto mb-4 opacity-50" />
            <p className="text-lg">Coming soon!</p>
            <p>Check back for new product drops.</p>
          </div>
        )}

        {categories.map((cat) => (
          <div key={cat} className="mb-10">
            <h2 className="text-2xl font-semibold mb-4">{cat}</h2>
            <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
              {products
                ?.filter((p) => p.category === cat)
                .map((product) => {
                  const stock = getProductStock(product.id);
                  const outOfStock = stock === 0 && !product.allow_preorder;
                  return (
                  <Card
                    key={product.id}
                    className="cursor-pointer hover:border-primary/50 transition-colors overflow-hidden"
                    onClick={() => {
                      setSelectedProduct(product);
                      setSelectedSize(product.sizes[0] || "");
                      setSelectedColor(product.colors[0] || "");
                    }}
                  >
                    {product.image_urls[0] ? (
                      <img src={product.image_urls[0]} alt={product.name} className="w-full h-56 object-cover" />
                    ) : (
                      <div className="w-full h-56 bg-muted flex items-center justify-center">
                        <Package className="h-12 w-12 text-muted-foreground" />
                      </div>
                    )}
                    <CardContent className="p-4">
                      <h3 className="font-semibold">{product.name}</h3>
                      <p className="text-primary font-bold mt-1">${product.price.toFixed(2)}</p>
                      <div className="flex gap-1 mt-2 flex-wrap">
                        {product.colors.map((c) => (
                          <Badge key={c} variant="outline" className="text-xs">{c}</Badge>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                ))}
            </div>
          </div>
        ))}
      </div>

      {/* Payment Dialog for logged-in members */}
      <Dialog open={showPaymentDialog} onOpenChange={setShowPaymentDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Complete Your Order</DialogTitle>
            <DialogDescription>Review your order and select a payment method</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="bg-muted p-3 rounded space-y-1 max-h-40 overflow-y-auto">
              {cart.map((item) => (
                <p key={cartItemKey(item)} className="text-sm">
                  {item.product.name} {item.size && `(${item.size})`} {item.color && `[${item.color}]`} x{item.quantity} — ${(item.product.price * item.quantity).toFixed(2)}
                </p>
              ))}
            </div>

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

            <div className="border-t pt-3 space-y-1">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Subtotal</span>
                <span>${cartSubtotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Sales Tax (6%)</span>
                <span>${cartTax.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Processing Fee</span>
                <span>${cartProcessingFee.toFixed(2)}</span>
              </div>
              <div className="flex justify-between font-semibold text-lg pt-1">
                <span>Total</span>
                <span className="text-primary">${cartTotal.toFixed(2)}</span>
              </div>
            </div>
          </div>
          <div className="flex gap-2 justify-end">
            <Button variant="outline" onClick={() => setShowPaymentDialog(false)} disabled={isProcessingPayment}>
              Cancel
            </Button>
            <Button onClick={handlePayment} disabled={isProcessingPayment || (paymentMethod === "card" && !selectedPaymentMethodId)}>
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
    </div>
  );
}
