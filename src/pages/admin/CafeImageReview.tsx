import { useMemo, useState } from "react";
import { useAllCafeMenuItems, useAllCafeMenuCategories, useUpdateCafeMenuItem } from "@/hooks/useCafeMenu";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";

type Row = { itemId: string; itemName: string; categoryName: string; url: string; isPrimary: boolean; index: number };

export default function CafeImageReview() {
  const { data: items = [] } = useAllCafeMenuItems();
  const { data: cats = [] } = useAllCafeMenuCategories();
  const update = useUpdateCafeMenuItem();
  const [removing, setRemoving] = useState<string | null>(null);

  const catMap = useMemo(() => Object.fromEntries(cats.map((c) => [c.id, c])), [cats]);

  const rows = useMemo(() => {
    const out: Row[] = [];
    for (const it of items) {
      const cat = it.category_id ? catMap[it.category_id] : null;
      if (!cat || cat.section !== "cafe" || !cat.is_active || !it.is_active) continue;
      const label = [it.brand_name, it.item_name, it.flavor].filter(Boolean).join(" — ") || "Untitled";
      const urls = new Set<string>();
      if (it.image_url) urls.add(it.image_url);
      (it.image_urls || []).forEach((u) => u && urls.add(u));
      let i = 0;
      for (const url of urls) {
        out.push({
          itemId: it.id,
          itemName: label,
          categoryName: cat.name,
          url,
          isPrimary: url === it.image_url,
          index: i++,
        });
      }
    }
    return out;
  }, [items, catMap]);

  const grouped = useMemo(() => {
    const g: Record<string, Row[]> = {};
    for (const r of rows) {
      (g[r.categoryName] ||= []).push(r);
    }
    return g;
  }, [rows]);

  async function removeImage(row: Row) {
    if (!confirm(`Remove this image from ${row.itemName}?`)) return;
    setRemoving(row.url);
    try {
      const item = items.find((i) => i.id === row.itemId);
      if (!item) return;
      const newUrls = (item.image_urls || []).filter((u) => u !== row.url);
      const newPrimary = item.image_url === row.url ? (newUrls[0] ?? null) : item.image_url;
      await update.mutateAsync({ id: row.itemId, image_url: newPrimary, image_urls: newUrls });

      // Delete from storage
      const marker = "/cafe-menu-images/";
      const idx = row.url.indexOf(marker);
      if (idx >= 0) {
        const path = row.url.substring(idx + marker.length);
        await supabase.storage.from("cafe-menu-images").remove([path]);
      }
      toast.success("Image removed");
    } catch (e: any) {
      toast.error(e?.message || "Failed to remove");
    } finally {
      setRemoving(null);
    }
  }

  return (
    <div className="p-6 space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Cafe Image Review</h1>
        <p className="text-sm text-muted-foreground">
          All active cafe item images. Click Remove to delete an image from the item and storage.
        </p>
      </div>

      {Object.keys(grouped).length === 0 && <p>No images found.</p>}

      {Object.entries(grouped).map(([catName, list]) => (
        <section key={catName} className="space-y-3">
          <h2 className="text-lg font-semibold border-b pb-1">{catName} ({list.length})</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {list.map((row) => (
              <Card key={row.url} className="overflow-hidden">
                <div className="aspect-square bg-muted">
                  <img src={row.url} alt={row.itemName} className="w-full h-full object-cover" />
                </div>
                <div className="p-3 space-y-2">
                  <div className="text-sm font-medium leading-tight">{row.itemName}</div>
                  <div className="text-xs text-muted-foreground">
                    {row.isPrimary ? "Primary" : `Extra #${row.index}`}
                  </div>
                  <Button
                    size="sm"
                    variant="destructive"
                    className="w-full"
                    disabled={removing === row.url}
                    onClick={() => removeImage(row)}
                  >
                    <Trash2 className="w-3 h-3 mr-1" />
                    {removing === row.url ? "Removing..." : "Remove"}
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
