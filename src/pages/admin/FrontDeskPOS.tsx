import { AdminLayout } from "@/components/admin/AdminLayout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Sparkles, Clock, Loader2, ShoppingBag } from "lucide-react";
import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAdminCafeOrders, useUpdateCafeOrderStatus } from "@/hooks/useAdminCafeOrders";
import { useCreateCafeOrder, CafeOrderItem } from "@/hooks/useCafeOrder";
import { format } from "date-fns";
import { CafePOSMenu, type POSCartItem } from "@/components/admin/CafePOSMenu";
import { CafePOSCart } from "@/components/admin/CafePOSCart";
import { MerchPOSTab } from "@/components/admin/MerchPOSTab";
import { calculateTax } from "@/hooks/useCafeMenu";
import { calculateProcessingFeeFromDollars } from "@/lib/processingFee";
import { supabase } from "@/integrations/supabase/client";
import { kioskHeaders } from "@/lib/kiosk";
import { toast } from "sonner";
import type { POSCustomer } from "@/components/admin/POSCustomerSearch";

export default function FrontDeskPOS() {
  const [cart, setCart] = useState<POSCartItem[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<POSCustomer | null>(null);
  const [statusFilter, setStatusFilter] = useState<string | undefined>(undefined);
  const [isCharging, setIsCharging] = useState(false);

  const location = useLocation();
  const navigate = useNavigate();

  // Pre-select a customer when navigated in from MemberDetailSheet's "Sell" button
  useEffect(() => {
    const preset = (location.state as { presetCustomer?: POSCustomer } | null)?.presetCustomer;
    if (preset) {
      setSelectedCustomer(preset);
      navigate(location.pathname, { replace: true, state: null });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const { data: orders, isLoading: ordersLoading } = useAdminCafeOrders({ status: statusFilter });
  const updateStatus = useUpdateCafeOrderStatus();
  const createOrder = useCreateCafeOrder();

  const addToCart = (item: POSCartItem) => {
    setCart((prev) => {
      const key = item.itemId + (item.proteinFlavor || "");
      const existing = prev.find((c) => c.itemId + (c.proteinFlavor || "") === key);
      if (existing) {
        return prev.map((c) =>
          c.itemId + (c.proteinFlavor || "") === key ? { ...c, quantity: c.quantity + 1 } : c
        );
      }
      return [...prev, item];
    });
  };

  const updateQuantity = (itemId: string, delta: number) => {
    setCart((prev) =>
      prev
        .map((item) => (item.itemId === itemId ? { ...item, quantity: item.quantity + delta } : item))
        .filter((item) => item.quantity > 0)
    );
  };

  const clearCart = () => {
    setCart([]);
    setSelectedCustomer(null);
  };

  const handlePlaceOrder = async (
    paymentMethod: "card" | "cash" = "card",
    _credit?: unknown,
    note: string = ""
  ) => {
    if (cart.length === 0) return;
    setIsCharging(true);

    try {
      const subtotal = cart.reduce((sum, item) => {
        const addonTotal = item.addons.reduce((s, a) => s + a.price, 0);
        return sum + (item.basePrice + addonTotal) * item.quantity;
      }, 0);
      const tax = calculateTax(subtotal);
      const isCardCharge = paymentMethod === "card" && selectedCustomer?.stripeCustomerId && selectedCustomer.cardOnFile;
      const processingFee = isCardCharge ? calculateProcessingFeeFromDollars(subtotal + tax) : 0;
      const total = subtotal + tax + processingFee;

      const itemNames = cart.map((i) => i.name).join(", ");
      const receiptLineItems = cart.map((item) => ({
        name: item.name,
        quantity: item.quantity,
        unit_price: item.basePrice + item.addons.reduce((s, a) => s + a.price, 0),
      }));

      // If paying by card and customer has card on file, charge via Stripe first
      if (isCardCharge) {
        const amountCents = Math.round(total * 100);
        const { data: chargeResult, error: chargeError } = await supabase.functions.invoke("stripe-payment", {
          body: {
            action: "charge_saved_card",
            stripeCustomerId: selectedCustomer.stripeCustomerId,
            amount: amountCents,
            description: `Front Desk POS - ${itemNames}`,
            chargeType: "pos",
            processingFee: Math.round(processingFee * 100),
            subtotal: Math.round(subtotal * 100),
            taxAmount: Math.round(tax * 100),
            note: note || undefined,
            lineItems: receiptLineItems,
            recipientEmail: selectedCustomer.email || undefined,
            recipientName: selectedCustomer.name || undefined,
          },
          headers: kioskHeaders(),
        });


        if (chargeError) {
          toast.error("Payment failed: " + (chargeError.message || "Unknown error"));
          setIsCharging(false);
          return;
        }

        if (chargeResult && !chargeResult.success) {
          toast.error("Card declined: " + (chargeResult.error || "Payment was not successful"));
          setIsCharging(false);
          return;
        }

        toast.success("Card charged successfully");
      }

      // Create the order record
      const orderItems: CafeOrderItem[] = cart.map((item) => ({
        id: parseInt(item.itemId.slice(0, 8), 16) || 0,
        name: item.name,
        price: item.basePrice + item.addons.reduce((s, a) => s + a.price, 0),
        quantity: item.quantity,
        category: item.categoryName,
      }));

      orderItems.push({
        id: 0,
        name: `MI Sales Tax (6%)`,
        price: tax,
        quantity: 1,
        category: "Tax",
      });

      if (processingFee > 0) {
        orderItems.push({
          id: 0,
          name: "Processing Fee",
          price: processingFee,
          quantity: 1,
          category: "Fee",
        });
      }

      const orderPaymentMethod = paymentMethod === "cash" ? "cash" : (selectedCustomer?.cardOnFile ? "member_account" : "card");

      await createOrder.mutateAsync({
        orderItems,
        paymentMethod: orderPaymentMethod,
        overrideMemberId: selectedCustomer?.memberId ?? null,
        overrideUserId: selectedCustomer?.userId ?? null,
        note: note || null,
      });

      toast.success(paymentMethod === "cash" ? "Cash sale recorded" : "Order placed");
      clearCart();
    } catch (error: any) {
      console.error("Failed to place order:", error);
      toast.error(error?.message || "Failed to place order");
    } finally {
      setIsCharging(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "pending": return "bg-amber-500/10 text-amber-600 border-amber-500/30";
      case "preparing": return "bg-blue-500/10 text-blue-600 border-blue-500/30";
      case "ready": return "bg-green-500/10 text-green-600 border-green-500/30";
      case "completed": return "bg-muted text-muted-foreground border-border";
      case "cancelled": return "bg-destructive/10 text-destructive border-destructive/30";
      default: return "bg-muted text-muted-foreground border-border";
    }
  };

  const recentOrders = orders?.slice(0, 20) || [];

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Front Desk POS</h1>
          <p className="text-muted-foreground">Process spa services, retail sales, and front desk transactions</p>
        </div>

        <Tabs defaultValue="pos" className="space-y-6">
          <TabsList>
            <TabsTrigger value="pos">POS Terminal</TabsTrigger>
            <TabsTrigger value="merch"><ShoppingBag className="h-4 w-4 mr-1" />Storm Shop</TabsTrigger>
            <TabsTrigger value="orders">Order Queue</TabsTrigger>
          </TabsList>

          <TabsContent value="pos">
            <div className="grid gap-6 lg:grid-cols-3">
              <div className="lg:col-span-2">
                <CafePOSMenu onAddToCart={addToCart} highlightCategories={["Spa"]} />
              </div>
              <CafePOSCart
                cart={cart}
                updateQuantity={updateQuantity}
                selectedCustomer={selectedCustomer}
                onCustomerSelect={setSelectedCustomer}
                onPlaceOrder={handlePlaceOrder}
                onClearCart={clearCart}
                isPlacing={isCharging || createOrder.isPending}
              />
            </div>
          </TabsContent>

          <TabsContent value="merch">
            <div className="grid gap-6 lg:grid-cols-3">
              <div className="lg:col-span-2">
                <MerchPOSTab onAddToCart={addToCart} />
              </div>
              <CafePOSCart
                cart={cart}
                updateQuantity={updateQuantity}
                selectedCustomer={selectedCustomer}
                onCustomerSelect={setSelectedCustomer}
                onPlaceOrder={handlePlaceOrder}
                onClearCart={clearCart}
                isPlacing={isCharging || createOrder.isPending}
              />
            </div>
          </TabsContent>

          <TabsContent value="orders" className="space-y-4">
            <div className="flex gap-2 flex-wrap">
              {[undefined, "pending", "preparing", "ready", "completed"].map((s) => (
                <Button key={s ?? "all"} variant={statusFilter === s ? "default" : "outline"} size="sm" onClick={() => setStatusFilter(s)}>
                  {s ? s.charAt(0).toUpperCase() + s.slice(1) : "All"}
                </Button>
              ))}
            </div>

            {ordersLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {recentOrders.map((order) => (
                  <Card key={order.id}>
                    <CardHeader className="pb-3">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-base">Order #{order.id.slice(0, 8)}</CardTitle>
                        <Badge className={getStatusColor(order.status)}>{order.status}</Badge>
                      </div>
                      <CardDescription>
                        {order.member ? `${order.member.first_name} ${order.member.last_name}` : order.user?.email || "Guest"}
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="space-y-1">
                        {(order.order_items as any[]).map((item: any, idx: number) => (
                          <div key={idx} className="space-y-0.5">
                            <div className="flex justify-between text-sm">
                              <span>{item.quantity}x {item.name}</span>
                              <span>${(item.price * item.quantity).toFixed(2)}</span>
                            </div>
                            {item.note && (
                              <p className="text-xs italic text-amber-700 dark:text-amber-400">
                                Note: {item.note}
                              </p>
                            )}
                          </div>
                        ))}
                      </div>
                      <div className="border-t pt-2">
                        <div className="flex justify-between font-semibold">
                          <span>Total</span>
                          <span>${Number(order.total_amount).toFixed(2)}</span>
                        </div>
                      </div>
                      {order.estimated_ready_at && (
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Clock className="h-3 w-3" />
                          Ready: {format(new Date(order.estimated_ready_at), "h:mm a")}
                        </div>
                      )}
                      <div className="text-xs text-muted-foreground">
                        {format(new Date(order.created_at), "MMM d, h:mm a")}
                      </div>
                      {["pending", "preparing", "ready"].includes(order.status) && (
                        <div className="flex gap-2 pt-2">
                          {order.status === "pending" && (
                            <Button size="sm" variant="outline" onClick={() => updateStatus.mutate({ orderId: order.id, status: "preparing" })} className="flex-1">
                              Start Preparing
                            </Button>
                          )}
                          {order.status === "preparing" && (
                            <Button size="sm" variant="outline" onClick={() => updateStatus.mutate({ orderId: order.id, status: "ready" })} className="flex-1">
                              Mark Ready
                            </Button>
                          )}
                          {order.status === "ready" && (
                            <Button size="sm" onClick={() => updateStatus.mutate({ orderId: order.id, status: "completed" })} className="flex-1">
                              Complete
                            </Button>
                          )}
                          <Button size="sm" variant="destructive" onClick={() => updateStatus.mutate({ orderId: order.id, status: "cancelled" })}>
                            Cancel
                          </Button>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
                {recentOrders.length === 0 && (
                  <div className="col-span-full text-center py-12 text-muted-foreground">
                    <Sparkles className="h-12 w-12 mx-auto mb-3 opacity-50" />
                    <p>No orders found</p>
                  </div>
                )}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </AdminLayout>
  );
}
