import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Loader2, ShoppingBag, Package } from "lucide-react";
import { useMerchProducts, useMerchInventory, type MerchProduct } from "@/hooks/useMerchProducts";
import type { POSCartItem } from "@/components/admin/CafePOSMenu";

interface MerchPOSTabProps {
  onAddToCart: (item: POSCartItem) => void;
}

export function MerchPOSTab({ onAddToCart }: MerchPOSTabProps) {
  const { data: products, isLoading } = useMerchProducts(true);
  const { data: inventory } = useMerchInventory();
  const [selectedProduct, setSelectedProduct] = useState<MerchProduct | null>(null);
  const [selectedSize, setSelectedSize] = useState("");
  const [selectedColor, setSelectedColor] = useState("");

  const categories = [...new Set(products?.map((p) => p.category) || [])];

  const getStock = (productId: string, size: string, color: string) => {
    return inventory?.find((i) => i.product_id === productId && i.size === size && i.color === color)?.quantity ?? 0;
  };

  const handleAddToCart = () => {
    if (!selectedProduct) return;
    const label = `${selectedProduct.name}${selectedSize ? ` - ${selectedSize}` : ""}${selectedColor ? ` / ${selectedColor}` : ""}`;
    const cartKey = `${selectedProduct.id}-${selectedSize}-${selectedColor}`;

    onAddToCart({
      itemId: cartKey,
      name: label,
      basePrice: selectedProduct.price,
      quantity: 1,
      categoryName: selectedProduct.category,
      addons: [],
    });

    setSelectedProduct(null);
    setSelectedSize("");
    setSelectedColor("");
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {categories.map((cat) => (
        <div key={cat}>
          <h3 className="text-lg font-semibold mb-3">{cat}</h3>
          <div className="grid gap-3 grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
            {products
              ?.filter((p) => p.category === cat)
              .map((product) => (
                <Card
                  key={product.id}
                  className="cursor-pointer hover:border-primary/50 transition-colors"
                  onClick={() => {
                    setSelectedProduct(product);
                    setSelectedSize(product.sizes[0] || "");
                    setSelectedColor(product.colors[0] || "");
                  }}
                >
                  <CardContent className="p-3">
                    {product.image_urls[0] ? (
                      <img
                        src={product.image_urls[0]}
                        alt={product.name}
                        className="w-full h-24 object-cover rounded mb-2"
                      />
                    ) : (
                      <div className="w-full h-24 bg-muted rounded mb-2 flex items-center justify-center">
                        <Package className="h-8 w-8 text-muted-foreground" />
                      </div>
                    )}
                    <p className="font-medium text-sm truncate">{product.name}</p>
                    <p className="text-primary font-semibold text-sm">${product.price.toFixed(2)}</p>
                  </CardContent>
                </Card>
              ))}
          </div>
        </div>
      ))}

      {(!products || products.length === 0) && (
        <div className="text-center py-12 text-muted-foreground">
          <ShoppingBag className="h-12 w-12 mx-auto mb-3 opacity-50" />
          <p>No merch products yet</p>
          <p className="text-sm">Add products in the Merch Manager</p>
        </div>
      )}

      <Dialog open={!!selectedProduct} onOpenChange={(open) => !open && setSelectedProduct(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{selectedProduct?.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {selectedProduct?.image_urls[0] && (
              <img
                src={selectedProduct.image_urls[0]}
                alt={selectedProduct.name}
                className="w-full h-48 object-cover rounded"
              />
            )}
            <p className="text-lg font-semibold text-primary">${selectedProduct?.price.toFixed(2)}</p>

            {(selectedProduct?.sizes?.length ?? 0) > 0 && (
              <div>
                <label className="text-sm font-medium mb-1 block">Size</label>
                <Select value={selectedSize} onValueChange={setSelectedSize}>
                  <SelectTrigger><SelectValue placeholder="Select size" /></SelectTrigger>
                  <SelectContent>
                    {selectedProduct?.sizes.map((s) => (
                      <SelectItem key={s} value={s}>{s}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {(selectedProduct?.colors?.length ?? 0) > 0 && (
              <div>
                <label className="text-sm font-medium mb-1 block">Color</label>
                <Select value={selectedColor} onValueChange={setSelectedColor}>
                  <SelectTrigger><SelectValue placeholder="Select color" /></SelectTrigger>
                  <SelectContent>
                    {selectedProduct?.colors.map((c) => (
                      <SelectItem key={c} value={c}>{c}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {selectedProduct && selectedSize && selectedColor && (
              <div className="flex items-center gap-2">
                <Badge variant="outline">
                  Stock: {getStock(selectedProduct.id, selectedSize, selectedColor)}
                </Badge>
              </div>
            )}

            <Button className="w-full" onClick={handleAddToCart}>
              Add to Cart
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
