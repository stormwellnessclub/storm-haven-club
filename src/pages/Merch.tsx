import { useState } from "react";
import { useMerchProducts, useMerchInventory, useCreateMerchOrder } from "@/hooks/useMerchProducts";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Loader2, Package, ShoppingBag, ArrowLeft, Check } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import type { MerchProduct } from "@/hooks/useMerchProducts";

export default function Merch() {
  const { data: products, isLoading } = useMerchProducts(true);
  const { data: inventory } = useMerchInventory();
  const createOrder = useCreateMerchOrder();
  const { user } = useAuth();

  const [selectedProduct, setSelectedProduct] = useState<MerchProduct | null>(null);
  const [selectedSize, setSelectedSize] = useState("");
  const [selectedColor, setSelectedColor] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [guestName, setGuestName] = useState("");
  const [guestEmail, setGuestEmail] = useState("");
  const [guestPhone, setGuestPhone] = useState("");
  const [orderPlaced, setOrderPlaced] = useState(false);

  const categories = [...new Set(products?.filter((p) => p.allow_preorder).map((p) => p.category) || [])];

  const getStock = (productId: string, size: string, color: string) => {
    return inventory?.find((i) => i.product_id === productId && i.size === size && i.color === color)?.quantity ?? 0;
  };

  const handlePreorder = async () => {
    if (!selectedProduct) return;
    const name = user ? "" : guestName;
    const email = user?.email || guestEmail;
    if (!email) {
      toast.error("Email is required");
      return;
    }

    const totalAmount = selectedProduct.price * quantity;
    await createOrder.mutateAsync({
      user_id: user?.id || null,
      customer_name: name || null,
      customer_email: email,
      customer_phone: guestPhone || null,
      order_items: [
        {
          product_id: selectedProduct.id,
          name: selectedProduct.name,
          size: selectedSize,
          color: selectedColor,
          quantity,
          price: selectedProduct.price,
        },
      ],
      total_amount: totalAmount,
      payment_method: "preorder_card",
      is_preorder: true,
      status: "pending",
    });

    setOrderPlaced(true);
    toast.success("Preorder placed successfully!");
  };

  const resetSelection = () => {
    setSelectedProduct(null);
    setSelectedSize("");
    setSelectedColor("");
    setQuantity(1);
    setCheckoutOpen(false);
    setOrderPlaced(false);
    setGuestName("");
    setGuestEmail("");
    setGuestPhone("");
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // Product detail view
  if (selectedProduct && !checkoutOpen) {
    return (
      <div className="min-h-screen bg-background">
        <div className="max-w-4xl mx-auto px-4 py-8">
          <Button variant="ghost" onClick={resetSelection} className="mb-6">
            <ArrowLeft className="h-4 w-4 mr-2" /> Back to Store
          </Button>
          <div className="grid md:grid-cols-2 gap-8">
            <div>
              {selectedProduct.image_urls[0] ? (
                <img
                  src={selectedProduct.image_urls[0]}
                  alt={selectedProduct.name}
                  className="w-full rounded-lg object-cover aspect-square"
                />
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
              {selectedProduct.description && (
                <p className="text-muted-foreground">{selectedProduct.description}</p>
              )}

              {selectedProduct.sizes.length > 0 && (
                <div>
                  <Label className="mb-2 block">Size</Label>
                  <div className="flex gap-2 flex-wrap">
                    {selectedProduct.sizes.map((s) => (
                      <Button
                        key={s}
                        size="sm"
                        variant={selectedSize === s ? "default" : "outline"}
                        onClick={() => setSelectedSize(s)}
                      >
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
                      <Button
                        key={c}
                        size="sm"
                        variant={selectedColor === c ? "default" : "outline"}
                        onClick={() => setSelectedColor(c)}
                      >
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

              <Button
                className="w-full"
                size="lg"
                onClick={() => setCheckoutOpen(true)}
                disabled={
                  (selectedProduct.sizes.length > 0 && !selectedSize) ||
                  (selectedProduct.colors.length > 0 && !selectedColor)
                }
              >
                <ShoppingBag className="h-4 w-4 mr-2" />
                Preorder — ${(selectedProduct.price * quantity).toFixed(2)}
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Checkout dialog
  if (checkoutOpen && selectedProduct) {
    return (
      <div className="min-h-screen bg-background">
        <div className="max-w-md mx-auto px-4 py-12">
          {orderPlaced ? (
            <Card>
              <CardContent className="p-8 text-center space-y-4">
                <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
                  <Check className="h-8 w-8 text-primary" />
                </div>
                <h2 className="text-2xl font-bold">Preorder Confirmed!</h2>
                <p className="text-muted-foreground">
                  We'll notify you when your {selectedProduct.name} is ready for pickup.
                </p>
                <Button onClick={resetSelection} className="w-full">Back to Store</Button>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="p-6 space-y-4">
                <Button variant="ghost" onClick={() => setCheckoutOpen(false)}>
                  <ArrowLeft className="h-4 w-4 mr-2" /> Back
                </Button>
                <h2 className="text-xl font-bold">Complete Preorder</h2>
                <div className="bg-muted p-3 rounded space-y-1">
                  <p className="font-medium">{selectedProduct.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {selectedSize && `Size: ${selectedSize}`} {selectedColor && `• Color: ${selectedColor}`} • Qty: {quantity}
                  </p>
                  <p className="font-semibold text-primary">${(selectedProduct.price * quantity).toFixed(2)}</p>
                </div>

                {!user && (
                  <>
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
                  </>
                )}

                {user && (
                  <p className="text-sm text-muted-foreground">Ordering as {user.email}</p>
                )}

                <Button className="w-full" onClick={handlePreorder} disabled={createOrder.isPending}>
                  {createOrder.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Place Preorder
                </Button>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    );
  }

  // Store grid
  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="text-center mb-10">
          <h1 className="text-4xl font-bold">Storm Shop</h1>
          <p className="text-muted-foreground mt-2">Branded gear, wellness products & more — preorder now</p>
        </div>

        {categories.length === 0 && (
          <div className="text-center py-16 text-muted-foreground">
            <ShoppingBag className="h-16 w-16 mx-auto mb-4 opacity-50" />
            <p className="text-lg">Coming soon!</p>
            <p>Check back for new merch drops.</p>
          </div>
        )}

        {categories.map((cat) => (
          <div key={cat} className="mb-10">
            <h2 className="text-2xl font-semibold mb-4">{cat}</h2>
            <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
              {products
                ?.filter((p) => p.category === cat && p.allow_preorder)
                .map((product) => (
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
    </div>
  );
}
