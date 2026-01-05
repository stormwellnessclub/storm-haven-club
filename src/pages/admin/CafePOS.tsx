import { AdminLayout } from "@/components/admin/AdminLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Coffee, Search, CreditCard, Plus, Minus, ShoppingCart, User, Clock, CheckCircle2, XCircle, Loader2 } from "lucide-react";
import { useState } from "react";
import { useAdminCafeOrders, useUpdateCafeOrderStatus } from "@/hooks/useAdminCafeOrders";
import { useCreateCafeOrder, CafeOrderItem } from "@/hooks/useCafeOrder";
import { format } from "date-fns";

const menuItems = [
  { id: 1, name: 'Espresso', price: 4.50, category: 'Coffee' },
  { id: 2, name: 'Latte', price: 5.50, category: 'Coffee' },
  { id: 3, name: 'Cappuccino', price: 5.50, category: 'Coffee' },
  { id: 4, name: 'Cold Brew', price: 5.00, category: 'Coffee' },
  { id: 5, name: 'Green Smoothie', price: 8.00, category: 'Smoothies' },
  { id: 6, name: 'Protein Shake', price: 9.00, category: 'Smoothies' },
  { id: 7, name: 'Avocado Toast', price: 12.00, category: 'Food' },
  { id: 8, name: 'Acai Bowl', price: 14.00, category: 'Food' },
  { id: 9, name: 'Energy Bar', price: 4.00, category: 'Snacks' },
  { id: 10, name: 'Protein Bites', price: 6.00, category: 'Snacks' },
];

interface CartItem {
  id: number;
  name: string;
  price: number;
  quantity: number;
}

export default function CafePOS() {
  const [cart, setCart] = useState<CartItem[]>([]);
  const [memberSearch, setMemberSearch] = useState('');
  const [selectedMember, setSelectedMember] = useState<{ name: string; cardOnFile: boolean } | null>(null);
  const [statusFilter, setStatusFilter] = useState<string | undefined>(undefined);
  
  const { data: orders, isLoading: ordersLoading } = useAdminCafeOrders({ status: statusFilter });
  const updateStatus = useUpdateCafeOrderStatus();
  const createOrder = useCreateCafeOrder();

  const addToCart = (item: typeof menuItems[0]) => {
    setCart(prev => {
      const existing = prev.find(c => c.id === item.id);
      if (existing) {
        return prev.map(c => c.id === item.id ? { ...c, quantity: c.quantity + 1 } : c);
      }
      return [...prev, { ...item, quantity: 1 }];
    });
  };

  const updateQuantity = (id: number, delta: number) => {
    setCart(prev => prev
      .map(item => item.id === id ? { ...item, quantity: item.quantity + delta } : item)
      .filter(item => item.quantity > 0)
    );
  };

  const total = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);

  const clearCart = () => {
    setCart([]);
    setSelectedMember(null);
    setMemberSearch('');
  };

  const handlePlaceOrder = async () => {
    if (cart.length === 0) return;

    const orderItems: CafeOrderItem[] = cart.map(item => ({
      id: item.id,
      name: item.name,
      price: item.price,
      quantity: item.quantity,
      category: menuItems.find(m => m.id === item.id)?.category || 'Other',
    }));

    try {
      await createOrder.mutateAsync({
        orderItems,
        paymentMethod: selectedMember?.cardOnFile ? "member_account" : "card",
      });
      clearCart();
    } catch (error) {
      console.error("Failed to place order:", error);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending':
        return 'bg-amber-500/10 text-amber-600 border-amber-500/30';
      case 'preparing':
        return 'bg-blue-500/10 text-blue-600 border-blue-500/30';
      case 'ready':
        return 'bg-green-500/10 text-green-600 border-green-500/30';
      case 'completed':
        return 'bg-muted text-muted-foreground border-border';
      case 'cancelled':
        return 'bg-destructive/10 text-destructive border-destructive/30';
      default:
        return 'bg-muted text-muted-foreground border-border';
    }
  };

  const pendingOrders = orders?.filter(o => ['pending', 'preparing', 'ready'].includes(o.status)) || [];
  const recentOrders = orders?.slice(0, 20) || [];

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Cafe POS</h1>
          <p className="text-muted-foreground">
            Process cafe orders and payments
          </p>
        </div>

        <Tabs defaultValue="orders" className="space-y-6">
          <TabsList>
            <TabsTrigger value="orders">Order Queue</TabsTrigger>
            <TabsTrigger value="pos">POS Terminal</TabsTrigger>
          </TabsList>

          <TabsContent value="orders" className="space-y-4">
            <div className="flex gap-2">
              <Button 
                variant={statusFilter === undefined ? "default" : "outline"}
                size="sm"
                onClick={() => setStatusFilter(undefined)}
              >
                All
              </Button>
              <Button 
                variant={statusFilter === "pending" ? "default" : "outline"}
                size="sm"
                onClick={() => setStatusFilter("pending")}
              >
                Pending
              </Button>
              <Button 
                variant={statusFilter === "preparing" ? "default" : "outline"}
                size="sm"
                onClick={() => setStatusFilter("preparing")}
              >
                Preparing
              </Button>
              <Button 
                variant={statusFilter === "ready" ? "default" : "outline"}
                size="sm"
                onClick={() => setStatusFilter("ready")}
              >
                Ready
              </Button>
              <Button 
                variant={statusFilter === "completed" ? "default" : "outline"}
                size="sm"
                onClick={() => setStatusFilter("completed")}
              >
                Completed
              </Button>
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
                        <CardTitle className="text-base">
                          Order #{order.id.slice(0, 8)}
                        </CardTitle>
                        <Badge className={getStatusColor(order.status)}>
                          {order.status}
                        </Badge>
                      </div>
                      <CardDescription>
                        {order.member ? (
                          `${order.member.first_name} ${order.member.last_name}`
                        ) : (
                          order.user?.email || 'Guest'
                        )}
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="space-y-1">
                        {(order.order_items as any[]).map((item: any, idx: number) => (
                          <div key={idx} className="flex justify-between text-sm">
                            <span>{item.quantity}x {item.name}</span>
                            <span>${(item.price * item.quantity).toFixed(2)}</span>
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
                      {['pending', 'preparing', 'ready'].includes(order.status) && (
                        <div className="flex gap-2 pt-2">
                          {order.status === 'pending' && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => updateStatus.mutate({ orderId: order.id, status: 'preparing' })}
                              className="flex-1"
                            >
                              Start Preparing
                            </Button>
                          )}
                          {order.status === 'preparing' && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => updateStatus.mutate({ orderId: order.id, status: 'ready' })}
                              className="flex-1"
                            >
                              Mark Ready
                            </Button>
                          )}
                          {order.status === 'ready' && (
                            <Button
                              size="sm"
                              onClick={() => updateStatus.mutate({ orderId: order.id, status: 'completed' })}
                              className="flex-1"
                            >
                              Complete
                            </Button>
                          )}
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => updateStatus.mutate({ orderId: order.id, status: 'cancelled' })}
                          >
                            Cancel
                          </Button>
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
          {/* Menu Items */}
          <div className="lg:col-span-2 space-y-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2">
                  <Coffee className="h-5 w-5" />
                  Menu
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                  {menuItems.map((item) => (
                    <Button
                      key={item.id}
                      variant="outline"
                      className="h-auto p-3 flex flex-col items-start"
                      onClick={() => addToCart(item)}
                    >
                      <span className="font-medium">{item.name}</span>
                      <span className="text-sm text-muted-foreground">${item.price.toFixed(2)}</span>
                    </Button>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Cart & Payment */}
          <div className="space-y-4">
            {/* Member Lookup */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <User className="h-4 w-4" />
                  Member Lookup
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    className="pl-9"
                    placeholder="Search member..."
                    value={memberSearch}
                    onChange={(e) => setMemberSearch(e.target.value)}
                  />
                </div>
                {selectedMember && (
                  <div className="mt-3 p-3 bg-muted rounded-lg">
                    <p className="font-medium">{selectedMember.name}</p>
                    {selectedMember.cardOnFile && (
                      <p className="text-sm text-muted-foreground flex items-center gap-1">
                        <CreditCard className="h-3 w-3" />
                        Card on file available
                      </p>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Cart */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <ShoppingCart className="h-4 w-4" />
                  Cart
                </CardTitle>
              </CardHeader>
              <CardContent>
                {cart.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    Cart is empty
                  </p>
                ) : (
                  <div className="space-y-2">
                    {cart.map((item) => (
                      <div key={item.id} className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium">{item.name}</p>
                          <p className="text-xs text-muted-foreground">
                            ${item.price.toFixed(2)} each
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="outline"
                            size="icon"
                            className="h-6 w-6"
                            onClick={() => updateQuantity(item.id, -1)}
                          >
                            <Minus className="h-3 w-3" />
                          </Button>
                          <span className="w-6 text-center text-sm">{item.quantity}</span>
                          <Button
                            variant="outline"
                            size="icon"
                            className="h-6 w-6"
                            onClick={() => updateQuantity(item.id, 1)}
                          >
                            <Plus className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    ))}
                    <div className="border-t pt-2 mt-3">
                      <div className="flex justify-between font-semibold">
                        <span>Total</span>
                        <span>${total.toFixed(2)}</span>
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Payment Buttons */}
            <div className="space-y-2">
              <Button 
                className="w-full" 
                disabled={cart.length === 0 || createOrder.isPending}
                onClick={handlePlaceOrder}
              >
                {createOrder.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Processing...
                  </>
                ) : (
                  <>
                    <CreditCard className="h-4 w-4 mr-2" />
                    {selectedMember?.cardOnFile ? 'Charge Card on File' : 'Place Order'}
                  </>
                )}
              </Button>
              <Button variant="ghost" className="w-full" onClick={clearCart}>
                Clear Cart
              </Button>
            </div>
          </div>
        </div>
          </TabsContent>
        </Tabs>
      </div>
    </AdminLayout>
  );
}
