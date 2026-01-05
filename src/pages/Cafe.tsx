import { useState, useEffect } from "react";
import { Layout } from "@/components/Layout";
import { SectionHeading } from "@/components/SectionHeading";
import { Button } from "@/components/ui/button";
import { Plus, Minus, ShoppingBag, Loader2, CreditCard, User } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { useCreateCafeOrder } from "@/hooks/useCafeOrder";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
// Food imagery
import matchaLatte from "@/assets/food/matcha-latte.jpg";
import coffeeLatteArt from "@/assets/food/coffee-latte-art.jpg";
import avocadoToast from "@/assets/food/avocado-toast.jpg";
import cucumberSalad from "@/assets/food/cucumber-salad.jpg";
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

interface MenuItem {
  id: number;
  name: string;
  description: string;
  price: number;
  category: string;
  calories?: number;
  dietary?: string[];
  image?: string;
}

const menuItems: MenuItem[] = [
  // Smoothies
  {
    id: 1,
    name: "Green Storm",
    description: "Spinach, kale, banana, mango, coconut water",
    price: 9.50,
    category: "Smoothies",
    calories: 180,
    dietary: ["Vegan", "GF"],
  },
  {
    id: 2,
    name: "Berry Blast",
    description: "Mixed berries, acai, almond milk, honey",
    price: 10.00,
    category: "Smoothies",
    calories: 220,
    dietary: ["GF"],
  },
  {
    id: 3,
    name: "Protein Power",
    description: "Banana, peanut butter, oat milk, whey protein, cacao",
    price: 12.00,
    category: "Smoothies",
    calories: 350,
    dietary: ["GF"],
  },
  // Fresh Juices
  {
    id: 4,
    name: "Immunity Boost",
    description: "Orange, carrot, ginger, turmeric",
    price: 8.00,
    category: "Fresh Juices",
    calories: 120,
    dietary: ["Vegan", "GF"],
  },
  {
    id: 5,
    name: "Green Machine",
    description: "Cucumber, celery, apple, lemon, mint",
    price: 8.50,
    category: "Fresh Juices",
    calories: 90,
    dietary: ["Vegan", "GF"],
  },
  // Bowls
  {
    id: 6,
    name: "Acai Bowl",
    description: "Acai blend, granola, fresh berries, honey, coconut flakes",
    price: 14.00,
    category: "Bowls",
    calories: 420,
    dietary: ["Vegan option", "GF"],
  },
  {
    id: 7,
    name: "Protein Bowl",
    description: "Quinoa, grilled chicken, avocado, roasted vegetables",
    price: 16.00,
    category: "Bowls",
    calories: 520,
    dietary: ["GF"],
  },
  {
    id: 8,
    name: "Buddha Bowl",
    description: "Brown rice, chickpeas, hummus, roasted veggies, tahini",
    price: 15.00,
    category: "Bowls",
    calories: 480,
    dietary: ["Vegan", "GF"],
  },
  // Light Bites
  {
    id: 9,
    name: "Avocado Toast",
    description: "Sourdough, smashed avocado, cherry tomatoes, microgreens",
    price: 11.00,
    category: "Light Bites",
    calories: 340,
    dietary: ["Vegan"],
    image: avocadoToast,
  },
  {
    id: 10,
    name: "Energy Bites",
    description: "Date, almond, cacao, coconut (3 pieces)",
    price: 6.00,
    category: "Light Bites",
    calories: 180,
    dietary: ["Vegan", "GF"],
  },
  // Drinks
  {
    id: 11,
    name: "Matcha Latte",
    description: "Ceremonial grade matcha, oat milk",
    price: 6.50,
    category: "Drinks",
    calories: 140,
    dietary: ["Vegan", "GF"],
    image: matchaLatte,
  },
  {
    id: 12,
    name: "Cold Brew",
    description: "House-made cold brew, available with oat milk",
    price: 5.00,
    category: "Drinks",
    calories: 5,
    dietary: ["Vegan", "GF"],
    image: coffeeLatteArt,
  },
];

const categories = ["All", "Smoothies", "Fresh Juices", "Bowls", "Light Bites", "Drinks"];

interface CartItem extends MenuItem {
  quantity: number;
}

export default function Cafe() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const createOrder = useCreateCafeOrder();
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [showPaymentDialog, setShowPaymentDialog] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<"card" | "member_account">("card");
  const [selectedPaymentMethodId, setSelectedPaymentMethodId] = useState<string | null>(null);
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);

  const filteredItems = selectedCategory === "All"
    ? menuItems
    : menuItems.filter(item => item.category === selectedCategory);

  const addToCart = (item: MenuItem) => {
    setCart(prev => {
      const existing = prev.find(i => i.id === item.id);
      if (existing) {
        return prev.map(i => i.id === item.id ? { ...i, quantity: i.quantity + 1 } : i);
      }
      return [...prev, { ...item, quantity: 1 }];
    });
    toast.success(`${item.name} added to order`);
  };

  const updateQuantity = (id: number, delta: number) => {
    setCart(prev => {
      return prev.map(item => {
        if (item.id === id) {
          const newQty = item.quantity + delta;
          return newQty > 0 ? { ...item, quantity: newQty } : item;
        }
        return item;
      }).filter(item => item.quantity > 0);
    });
  };

  const removeFromCart = (id: number) => {
    setCart(prev => prev.filter(item => item.id !== id));
  };

  const cartTotal = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
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
    if (cart.length === 0) {
      toast.error("Your cart is empty");
      return;
    }

    setIsProcessingPayment(true);

    try {
      let paymentIntentId: string | undefined;

      // Convert cart items to order items format
      const orderItems = cart.map(item => ({
        id: item.id,
        name: item.name,
        price: item.price,
        quantity: item.quantity,
        category: item.category,
      }));

      const totalAmountCents = Math.round(cartTotal * 100);

      // Process payment based on method
      if (paymentMethod === "card" && selectedPaymentMethodId) {
        // Charge saved card
        const { data: memberData } = await supabase
          .from("members")
          .select("id, stripe_customer_id")
          .eq("user_id", user!.id)
          .maybeSingle();

        const customerId = memberData?.stripe_customer_id;

        if (!customerId) {
          throw new Error("No payment method on file. Please add a payment method first.");
        }

        const { data: chargeData, error: chargeError } = await supabase.functions.invoke("stripe-payment", {
          body: {
            action: "charge_saved_card",
            amount: totalAmountCents,
            description: `Cafe Order - ${orderItems.map(i => i.name).join(", ")}`,
            stripeCustomerId: customerId,
            paymentMethodId: selectedPaymentMethodId,
          },
        });

        if (chargeError) throw chargeError;
        if (chargeData?.error) throw new Error(chargeData.error);

        paymentIntentId = chargeData?.paymentIntentId || chargeData?.id;
      } else if (paymentMethod === "member_account") {
        // Member account charging - just create order without payment intent
        // Payment will be charged to member account
        paymentIntentId = undefined;
      } else {
        throw new Error("Please select a payment method");
      }

      // Create order
      await createOrder.mutateAsync({
        orderItems,
        paymentMethod: paymentMethod === "member_account" ? "member_account" : "card",
        paymentIntentId,
      });

      // Clear cart
      setCart([]);
      setShowPaymentDialog(false);
      setPaymentMethod("card");
      setSelectedPaymentMethodId(null);
    } catch (error: any) {
      console.error("Failed to process order:", error);
      toast.error(error.message || "Failed to process order. Please try again.");
    } finally {
      setIsProcessingPayment(false);
    }
  };

  // Fetch saved payment methods for card selection
  const [savedPaymentMethods, setSavedPaymentMethods] = useState<any[]>([]);
  
  useEffect(() => {
    if (user && showPaymentDialog && paymentMethod === "card") {
      supabase.functions.invoke("stripe-payment", {
        body: { action: "list_payment_methods" },
      }).then(({ data, error }) => {
        if (!error && data?.paymentMethods) {
          setSavedPaymentMethods(data.paymentMethods);
          if (data.paymentMethods.length > 0) {
            setSelectedPaymentMethodId(data.paymentMethods[0].id);
          }
        }
      });
    }
  }, [user, showPaymentDialog, paymentMethod]);

  return (
    <Layout>
      {/* Hero */}
      <section className="relative pt-32 pb-16 min-h-[60vh] flex items-center overflow-hidden">
        <div className="absolute inset-0">
          <img src={matchaLatte} alt="Storm Café" className="w-full h-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-r from-charcoal/90 via-charcoal/70 to-charcoal/50" />
        </div>
        <div className="relative z-10 container mx-auto px-6">
          <div className="max-w-3xl">
            <p className="text-gold-light text-sm uppercase tracking-widest mb-4">The Storm Café</p>
            <h1 className="heading-display text-primary-foreground mb-6">Nourish From Within</h1>
            <p className="text-primary-foreground/80 text-lg leading-relaxed">
              Fuel your wellness journey with our carefully curated menu of fresh juices, 
              smoothies, health bowls, and clean eating options.
            </p>
          </div>
        </div>
      </section>

      {/* Category Filters */}
      <section className="py-8 bg-background border-b border-border sticky top-20 z-40">
        <div className="container mx-auto px-6">
          <div className="flex items-center justify-between">
            <div className="flex flex-wrap gap-2">
              {categories.map((category) => (
                <button
                  key={category}
                  onClick={() => setSelectedCategory(category)}
                  className={`filter-badge ${selectedCategory === category ? "filter-badge-active" : ""}`}
                >
                  {category}
                </button>
              ))}
            </div>
            {cartCount > 0 && (
              <div className="hidden md:flex items-center gap-2 text-sm">
                <ShoppingBag className="w-4 h-4" />
                <span>{cartCount} items</span>
                <span className="text-accent font-semibold">${cartTotal.toFixed(2)}</span>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Menu Grid */}
      <section className="py-16 bg-background">
        <div className="container mx-auto px-6">
          <div className="grid lg:grid-cols-3 gap-8">
            {/* Menu Items */}
            <div className="lg:col-span-2">
              <div className="grid md:grid-cols-2 gap-4">
                {filteredItems.map((item) => (
                  <div key={item.id} className="card-luxury overflow-hidden group">
                    {item.image && (
                      <div className="relative h-48 overflow-hidden">
                        <img 
                          src={item.image} 
                          alt={item.name} 
                          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" 
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-background/80 to-transparent" />
                      </div>
                    )}
                    <div className="p-5">
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <h3 className="font-serif text-lg">{item.name}</h3>
                          <p className="text-xs text-muted-foreground">{item.category}</p>
                        </div>
                        <span className="text-accent font-semibold">${item.price.toFixed(2)}</span>
                      </div>
                      
                      <p className="text-muted-foreground text-sm mb-3">{item.description}</p>
                    
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {item.dietary?.map((d) => (
                          <span key={d} className="text-xs px-2 py-0.5 bg-secondary text-secondary-foreground rounded-sm">
                            {d}
                          </span>
                        ))}
                        {item.calories && (
                          <span className="text-xs text-muted-foreground">{item.calories} cal</span>
                        )}
                      </div>
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => addToCart(item)}
                      >
                        <Plus className="w-4 h-4" />
                      </Button>
                    </div>
                    </div>
                  </div>
                ))}
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
                            <p className="text-xs text-muted-foreground">
                              ${item.price.toFixed(2)} each
                            </p>
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
                    
                    <div className="border-t border-border pt-4 mb-4">
                      <div className="flex justify-between items-center">
                        <span className="font-medium">Total</span>
                        <span className="text-accent font-semibold text-xl">
                          ${cartTotal.toFixed(2)}
                        </span>
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
        </div>
      </section>

      {/* Payment Dialog */}
      <Dialog open={showPaymentDialog} onOpenChange={setShowPaymentDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Complete Your Order</DialogTitle>
            <DialogDescription>
              Review your order and select a payment method
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Payment Method</label>
              <Select value={paymentMethod} onValueChange={(value: "card" | "member_account") => setPaymentMethod(value)}>
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

            <div className="border-t pt-4">
              <div className="flex justify-between items-center text-lg font-semibold">
                <span>Total</span>
                <span className="text-accent">${cartTotal.toFixed(2)}</span>
              </div>
            </div>
          </div>

          <div className="flex gap-2 justify-end">
            <Button
              variant="outline"
              onClick={() => setShowPaymentDialog(false)}
              disabled={isProcessingPayment}
            >
              Cancel
            </Button>
            <Button
              onClick={handleConfirmOrder}
              disabled={isProcessingPayment || (paymentMethod === "card" && !selectedPaymentMethodId)}
            >
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
