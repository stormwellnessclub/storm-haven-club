import { AdminLayout } from "@/components/admin/AdminLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Coffee, Search, CreditCard, Plus, Minus, ShoppingCart, User } from "lucide-react";
import { useState } from "react";

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

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Cafe POS</h1>
          <p className="text-muted-foreground">
            Process cafe orders and payments
          </p>
        </div>

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
              <Button className="w-full" disabled={cart.length === 0}>
                <CreditCard className="h-4 w-4 mr-2" />
                Pay with Card
              </Button>
              {selectedMember?.cardOnFile && (
                <Button variant="outline" className="w-full" disabled={cart.length === 0}>
                  Charge Card on File
                </Button>
              )}
              <Button variant="ghost" className="w-full" onClick={clearCart}>
                Clear Cart
              </Button>
            </div>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}
