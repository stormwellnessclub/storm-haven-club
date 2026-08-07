import { AdminLayout } from "@/components/admin/AdminLayout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Coffee, Clock, Loader2, ShoppingBag, RotateCcw } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useState } from "react";
import { useAdminCafeOrders, useUpdateCafeOrderStatus } from "@/hooks/useAdminCafeOrders";
import { useCreateCafeOrder, CafeOrderItem } from "@/hooks/useCafeOrder";
import { format } from "date-fns";
import { CafePOSMenu, type POSCartItem } from "@/components/admin/CafePOSMenu";
import { CafePOSCart, type CreditApplication } from "@/components/admin/CafePOSCart";
import { MerchPOSTab } from "@/components/admin/MerchPOSTab";
import { calculateTax } from "@/hooks/useCafeMenu";
import { calculateProcessingFeeFromDollars } from "@/lib/processingFee";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { redeemCafeCredit, type RedeemCartItem } from "@/hooks/useMemberCafeCredit";
import { useQueryClient } from "@tanstack/react-query";
import type { POSCustomer } from "@/components/admin/POSCustomerSearch";

export default function CafePOS() {
  const [cart, setCart] = useState<POSCartItem[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<POSCustomer | null>(null);
  const [statusFilter, setStatusFilter] = useState<string | undefined>(undefined);
  const [isCharging, setIsCharging] = useState(false);
  const queryClient = useQueryClient();

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

  const handlePlaceOrder = async (paymentMethod: "card" | "cash" = "card", credit: CreditApplication | null = null) => {
    if (cart.length === 0) return;
    setIsCharging(true);

    try {
      // Gross subtotal (pre-credit)
      const subtotal = cart.reduce((sum, item) => {
        const addonTotal = item.addons.reduce((s, a) => s + a.price, 0);
        return sum + (item.basePrice + addonTotal) * item.quantity;
      }, 0);

      const itemDiscount = (credit?.itemDiscountCents || 0) / 100;
      const subtotalAfterItem = Math.max(0, subtotal - itemDiscount);
      const tax = calculateTax(subtotalAfterItem);
      const cashApplied = (credit?.cashApplyCents || 0) / 100;
      const preCashTotal = subtotalAfterItem + tax;
      const remainingDue = Math.max(0, preCashTotal - cashApplied);

      const isCardCharge = remainingDue > 0 && paymentMethod === "card" && selectedCustomer?.stripeCustomerId && selectedCustomer.cardOnFile;
      const processingFee = isCardCharge ? calculateProcessingFeeFromDollars(remainingDue) : 0;
      const total = remainingDue + processingFee;
      const itemNames = cart.map((i) => i.name).join(", ");

      // Build order items
      const orderItems: CafeOrderItem[] = cart.map((item) => ({
        id: parseInt(item.itemId.slice(0, 8), 16) || 0,
        name: item.name,
        price: item.basePrice + item.addons.reduce((s, a) => s + a.price, 0),
        quantity: item.quantity,
        category: item.categoryName,
      }));
      if (itemDiscount > 0) {
        orderItems.push({ id: 0, name: "Prepaid item credit", price: -itemDiscount, quantity: 1, category: "Credit" });
      }
      orderItems.push({ id: 0, name: `MI Sales Tax (6%)`, price: tax, quantity: 1, category: "Tax" });
      if (cashApplied > 0) {
        orderItems.push({ id: 0, name: "Cafe cash credit", price: -cashApplied, quantity: 1, category: "Credit" });
      }
      if (processingFee > 0) {
        orderItems.push({ id: 0, name: "Processing Fee", price: processingFee, quantity: 1, category: "Fee" });
      }

      const orderPaymentMethod = remainingDue === 0
        ? "member_account" // fully covered by credit
        : paymentMethod === "cash"
          ? "cash"
          : (selectedCustomer?.cardOnFile ? "member_account" : "card");

      // 1. Create order row first
      const order = await createOrder.mutateAsync({
        orderItems,
        paymentMethod: orderPaymentMethod,
      });

      // 2. Redeem credit against the order
      if (credit && selectedCustomer?.memberId) {
        const cartItemsPayload: RedeemCartItem[] = cart.map((item) => {
          const unitPriceCents = Math.round((item.basePrice + item.addons.reduce((s, a) => s + a.price, 0)) * 100);
          return {
            menu_item_id: item.itemId,
            quantity: item.quantity,
            unit_price_cents: unitPriceCents,
            name: item.name,
          };
        });
        try {
          await redeemCafeCredit({
            memberId: selectedCustomer.memberId,
            cafeOrderId: order.id,
            cartItems: cartItemsPayload,
            cashToApplyCents: credit.cashApplyCents,
          });
        } catch (e: any) {
          console.error("Credit redemption failed", e);
          toast.error("Credit redemption failed: " + (e?.message || "unknown"));
          // Continue with charge anyway — order exists.
        }
        queryClient.invalidateQueries({ queryKey: ["cafe-credit-balance", selectedCustomer.memberId] });
        queryClient.invalidateQueries({ queryKey: ["cafe-credit-ledger", selectedCustomer.memberId] });
      }

      // 3. Charge card for remaining due
      if (isCardCharge) {
        const amountCents = Math.round(total * 100);
        const { data: chargeResult, error: chargeError } = await supabase.functions.invoke("stripe-payment", {
          body: {
            action: "charge_saved_card",
            stripeCustomerId: selectedCustomer!.stripeCustomerId,
            amount: amountCents,
            description: `Cafe POS - ${itemNames}`,
            chargeType: "pos",
            processingFee: Math.round(processingFee * 100),
            subtotal: Math.round(subtotalAfterItem * 100),
            taxAmount: Math.round(tax * 100),
          },
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

      toast.success(
        remainingDue === 0
          ? "Order completed with credit"
          : paymentMethod === "cash"
            ? "Cash sale recorded"
            : "Order placed"
      );
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
          <h1 className="text-2xl font-bold">Cafe POS</h1>
          <p className="text-muted-foreground">Process cafe orders and payments</p>
        </div>

        <Tabs defaultValue="orders" className="space-y-6">
          <TabsList>
            <TabsTrigger value="orders">Order Queue</TabsTrigger>
            <TabsTrigger value="pos">POS Terminal</TabsTrigger>
            <TabsTrigger value="merch"><ShoppingBag className="h-4 w-4 mr-1" />Storm Shop</TabsTrigger>
          </TabsList>

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
                        {order.member
                          ? `${order.member.first_name} ${order.member.last_name}`
                          : (order.user?.first_name || order.user?.last_name)
                            ? `${order.user?.first_name || ""} ${order.user?.last_name || ""}`.trim() + " (non-member)"
                            : order.user?.email || "Guest"}
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
                      {(order.status === "cancelled" || order.status === "completed") &&
                        Date.now() - new Date(order.updated_at).getTime() < 24 * 60 * 60 * 1000 && (
                          <div className="pt-2">
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button size="sm" variant="outline" className="w-full">
                                  <RotateCcw className="h-3 w-3 mr-1" />
                                  {order.status === "cancelled" ? "Reopen Order" : "Undo Complete"}
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>
                                    {order.status === "cancelled" ? "Reopen this cancelled order?" : "Move this order back to Ready?"}
                                  </AlertDialogTitle>
                                  <AlertDialogDescription>
                                    {order.status === "cancelled"
                                      ? "The order will move back to Pending and reappear in the active queue."
                                      : "The order will move back to Ready so it can be re-completed or adjusted."}
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Nevermind</AlertDialogCancel>
                                  <AlertDialogAction
                                    onClick={() =>
                                      updateStatus.mutate({
                                        orderId: order.id,
                                        status: order.status === "cancelled" ? "pending" : "ready",
                                      })
                                    }
                                  >
                                    Yes, undo
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </div>
                        )}
                    </CardContent>
                  </Card>
                ))}
                {recentOrders.length === 0 && (
                  <div className="col-span-full text-center py-12 text-muted-foreground">
                    <Coffee className="h-12 w-12 mx-auto mb-3 opacity-50" />
                    <p>No orders found</p>
                  </div>
                )}
              </div>
            )}
          </TabsContent>

          <TabsContent value="pos">
            <div className="grid gap-6 lg:grid-cols-3">
              <div className="lg:col-span-2">
                <CafePOSMenu onAddToCart={addToCart} />
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
        </Tabs>
      </div>
    </AdminLayout>
  );
}
