import { useState } from "react";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Loader2, Plus, Package, Pencil, Trash2 } from "lucide-react";
import {
  useMerchProducts,
  useMerchInventory,
  useCreateMerchProduct,
  useUpdateMerchProduct,
  useUpsertMerchInventory,
  type MerchProduct,
} from "@/hooks/useMerchProducts";
import { supabase } from "@/integrations/supabase/client";
import { MultiImageUploader } from "@/components/admin/MultiImageUploader";
import { toast } from "sonner";

async function uploadMerchImage(file: File): Promise<string> {
  const { uploadImageToBucket } = await import("@/lib/uploadImage");
  return uploadImageToBucket("merch-images", file);
}


const DEFAULT_SIZES = ["XS", "S", "M", "L", "XL", "2XL", "3XL"];
const DEFAULT_COLORS = ["Black", "White", "Gray", "Navy", "Red", "Blue", "Green", "Pink", "Purple", "Tan", "Brown", "Camo", "Olive"];
const DEFAULT_CATEGORIES = ["Apparel", "Hoodies", "T-Shirts", "Hats", "Bottoms", "Skincare", "Hair Care", "Supplements", "Wellness", "Accessories", "Other"];

interface ProductFormData {
  name: string;
  description: string;
  price: string;
  category: string;
  sizes: string[];
  colors: string[];
  allow_preorder: boolean;
  is_active: boolean;
}

const emptyForm: ProductFormData = {
  name: "",
  description: "",
  price: "",
  category: "Apparel",
  sizes: [],
  colors: [],
  allow_preorder: true,
  is_active: true,
};

export default function MerchManager() {
  const { data: products, isLoading } = useMerchProducts();
  const { data: inventory } = useMerchInventory();
  const createProduct = useCreateMerchProduct();
  const updateProduct = useUpdateMerchProduct();
  const upsertInventory = useUpsertMerchInventory();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<MerchProduct | null>(null);
  const [form, setForm] = useState<ProductFormData>(emptyForm);
  const [imageUrls, setImageUrls] = useState<string[]>([]);
  const [inventoryDialog, setInventoryDialog] = useState<MerchProduct | null>(null);
  const [inventoryValues, setInventoryValues] = useState<Record<string, number>>({});
  const [customCategory, setCustomCategory] = useState("");
  const [customColor, setCustomColor] = useState("");

  const openCreate = () => {
    setEditingProduct(null);
    setForm(emptyForm);
    setImageUrls([]);
    setDialogOpen(true);
  };

  const openEdit = (p: MerchProduct) => {
    setEditingProduct(p);
    setForm({
      name: p.name,
      description: p.description || "",
      price: p.price.toString(),
      category: p.category,
      sizes: p.sizes,
      colors: p.colors,
      allow_preorder: p.allow_preorder,
      is_active: p.is_active,
    });
    setImageUrls(p.image_urls || []);
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.name || !form.price) return;

    const payload: any = {
      name: form.name,
      description: form.description || null,
      price: parseFloat(form.price),
      category: form.category,
      sizes: form.sizes,
      colors: form.colors,
      allow_preorder: form.allow_preorder,
      is_active: form.is_active,
      image_urls: imageUrls,
    };

    if (editingProduct) {
      await updateProduct.mutateAsync({ id: editingProduct.id, ...payload });
    } else {
      await createProduct.mutateAsync(payload);
    }

    setDialogOpen(false);
    setImageUrls([]);
  };

  const toggleSize = (size: string) => {
    setForm((f) => ({
      ...f,
      sizes: f.sizes.includes(size) ? f.sizes.filter((s) => s !== size) : [...f.sizes, size],
    }));
  };

  const toggleColor = (color: string) => {
    setForm((f) => ({
      ...f,
      colors: f.colors.includes(color) ? f.colors.filter((c) => c !== color) : [...f.colors, color],
    }));
  };

  const openInventory = (p: MerchProduct) => {
    const vals: Record<string, number> = {};
    for (const size of p.sizes) {
      for (const color of p.colors) {
        const key = `${size}|${color}`;
        const inv = inventory?.find((i) => i.product_id === p.id && i.size === size && i.color === color);
        vals[key] = inv?.quantity ?? 0;
      }
    }
    setInventoryValues(vals);
    setInventoryDialog(p);
  };

  const saveInventory = async () => {
    if (!inventoryDialog) return;
    const items = Object.entries(inventoryValues).map(([key, quantity]) => {
      const [size, color] = key.split("|");
      return { product_id: inventoryDialog.id, size, color, quantity };
    });
    await upsertInventory.mutateAsync(items);
    setInventoryDialog(null);
  };


  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Storm Shop Manager</h1>
            <p className="text-muted-foreground">Manage products, apparel, wellness items & more</p>
          </div>
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4 mr-2" /> Add Product
          </Button>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {products?.map((product) => (
              <Card key={product.id}>
                <CardContent className="p-4 space-y-3">
                  {product.image_urls[0] ? (
                    <img src={product.image_urls[0]} alt={product.name} className="w-full h-40 object-cover rounded" />
                  ) : (
                    <div className="w-full h-40 bg-muted rounded flex items-center justify-center">
                      <Package className="h-10 w-10 text-muted-foreground" />
                    </div>
                  )}
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="font-semibold">{product.name}</h3>
                      <p className="text-sm text-muted-foreground">{product.category}</p>
                    </div>
                    <p className="text-primary font-bold">${product.price.toFixed(2)}</p>
                  </div>
                  <div className="flex gap-1 flex-wrap">
                    {product.sizes.map((s) => (
                      <Badge key={s} variant="outline" className="text-xs">{s}</Badge>
                    ))}
                  </div>
                  <div className="flex gap-1 flex-wrap">
                    {product.colors.map((c) => (
                      <Badge key={c} variant="secondary" className="text-xs">{c}</Badge>
                    ))}
                  </div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    {!product.is_active && <Badge variant="destructive">Inactive</Badge>}
                    {product.allow_preorder && <Badge variant="outline">Preorder</Badge>}
                  </div>
                  <div className="flex gap-2 pt-1">
                    <Button size="sm" variant="outline" onClick={() => openEdit(product)} className="flex-1">
                      <Pencil className="h-3 w-3 mr-1" /> Edit
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => openInventory(product)} className="flex-1">
                      Inventory
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Create/Edit Dialog */}
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingProduct ? "Edit Product" : "Add Product"}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Name</Label>
                <Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
              </div>
              <div>
                <Label>Description</Label>
                <Textarea value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Price</Label>
                  <Input type="number" step="0.01" value={form.price} onChange={(e) => setForm((f) => ({ ...f, price: e.target.value }))} />
                </div>
                 <div>
                   <Label>Category</Label>
                   <select
                     className="flex h-11 w-full rounded-sm border border-input bg-background px-3 py-2 text-sm"
                     value={DEFAULT_CATEGORIES.includes(form.category) ? form.category : "__custom__"}
                     onChange={(e) => {
                       if (e.target.value === "__custom__") {
                         setCustomCategory(form.category && !DEFAULT_CATEGORIES.includes(form.category) ? form.category : "");
                         setForm((f) => ({ ...f, category: "" }));
                       } else {
                         setCustomCategory("");
                         setForm((f) => ({ ...f, category: e.target.value }));
                       }
                     }}
                   >
                     {DEFAULT_CATEGORIES.map((c) => (
                       <option key={c} value={c}>{c}</option>
                     ))}
                     <option value="__custom__">Custom…</option>
                   </select>
                   {((!DEFAULT_CATEGORIES.includes(form.category) && form.category !== "") || customCategory !== "" || form.category === "") && (
                     <Input
                       className="mt-2"
                       placeholder="Enter custom category"
                       value={customCategory || (DEFAULT_CATEGORIES.includes(form.category) ? "" : form.category)}
                       onChange={(e) => {
                         setCustomCategory(e.target.value);
                         setForm((f) => ({ ...f, category: e.target.value }));
                       }}
                     />
                   )}
                 </div>
              </div>

              <div>
                <Label>Sizes <span className="text-xs text-muted-foreground">(optional — skip for non-apparel)</span></Label>
                <div className="flex gap-2 flex-wrap mt-1">
                  {DEFAULT_SIZES.map((s) => (
                    <Button
                      key={s}
                      type="button"
                      size="sm"
                      variant={form.sizes.includes(s) ? "default" : "outline"}
                      onClick={() => toggleSize(s)}
                    >
                      {s}
                    </Button>
                  ))}
                </div>
              </div>

              <div>
                <Label>Colors <span className="text-xs text-muted-foreground">(optional)</span></Label>
                <div className="flex gap-2 flex-wrap mt-1">
                  {DEFAULT_COLORS.map((c) => (
                    <Button
                      key={c}
                      type="button"
                      size="sm"
                      variant={form.colors.includes(c) ? "default" : "outline"}
                      onClick={() => toggleColor(c)}
                    >
                      {c}
                    </Button>
                  ))}
                  {form.colors.filter((c) => !DEFAULT_COLORS.includes(c)).map((c) => (
                    <Button
                      key={c}
                      type="button"
                      size="sm"
                      variant="default"
                      onClick={() => toggleColor(c)}
                    >
                      {c} ×
                    </Button>
                  ))}
                </div>
                <div className="flex gap-2 mt-2">
                  <Input
                    placeholder="Add custom color"
                    value={customColor}
                    onChange={(e) => setCustomColor(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && customColor.trim()) {
                        e.preventDefault();
                        if (!form.colors.includes(customColor.trim())) {
                          setForm((f) => ({ ...f, colors: [...f.colors, customColor.trim()] }));
                        }
                        setCustomColor("");
                      }
                    }}
                    className="h-8"
                  />
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      if (customColor.trim() && !form.colors.includes(customColor.trim())) {
                        setForm((f) => ({ ...f, colors: [...f.colors, customColor.trim()] }));
                      }
                      setCustomColor("");
                    }}
                  >
                    Add
                  </Button>
                </div>
              </div>

              <MultiImageUploader
                label="Product Images"
                value={imageUrls}
                onChange={setImageUrls}
                onPersist={editingProduct ? async (urls) => {
                  await updateProduct.mutateAsync({ id: editingProduct.id, image_urls: urls });
                } : undefined}
                upload={editingProduct ? (file) =>
                  import("@/lib/uploadImage").then(({ uploadImageToBucket }) =>
                    uploadImageToBucket("merch-images", file, { type: "merch_product", id: editingProduct.id }),
                  ) : uploadMerchImage}
                uploadPersists={Boolean(editingProduct)}
                maxImages={8}
              />

              <div className="flex items-center gap-6">
                <div className="flex items-center gap-2">
                  <Switch checked={form.is_active} onCheckedChange={(v) => setForm((f) => ({ ...f, is_active: v }))} />
                  <Label>Active</Label>
                </div>
                <div className="flex items-center gap-2">
                  <Switch checked={form.allow_preorder} onCheckedChange={(v) => setForm((f) => ({ ...f, allow_preorder: v }))} />
                  <Label>Allow Preorder</Label>
                </div>
              </div>

              <Button className="w-full" onClick={handleSave} disabled={createProduct.isPending || updateProduct.isPending}>
                {(createProduct.isPending || updateProduct.isPending) && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                {editingProduct ? "Save Changes" : "Create Product"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Inventory Dialog */}
        <Dialog open={!!inventoryDialog} onOpenChange={(open) => !open && setInventoryDialog(null)}>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Inventory: {inventoryDialog?.name}</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              {inventoryDialog?.sizes.map((size) => (
                <div key={size}>
                  <p className="font-medium text-sm mb-1">{size}</p>
                  <div className="grid grid-cols-2 gap-2">
                    {inventoryDialog?.colors.map((color) => {
                      const key = `${size}|${color}`;
                      return (
                        <div key={key} className="flex items-center gap-2">
                          <Label className="text-xs w-16 shrink-0">{color}</Label>
                          <Input
                            type="number"
                            min={0}
                            className="h-8"
                            value={inventoryValues[key] ?? 0}
                            onChange={(e) =>
                              setInventoryValues((v) => ({ ...v, [key]: parseInt(e.target.value) || 0 }))
                            }
                          />
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
              <Button className="w-full" onClick={saveInventory} disabled={upsertInventory.isPending}>
                {upsertInventory.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Save Inventory
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </AdminLayout>
  );
}
