import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface MerchProduct {
  id: string;
  name: string;
  description: string | null;
  price: number;
  image_urls: string[];
  sizes: string[];
  colors: string[];
  category: string;
  is_active: boolean;
  allow_preorder: boolean;
  display_order: number;
  created_at: string;
  updated_at: string;
  created_by: string | null;
}

export interface MerchInventoryItem {
  id: string;
  product_id: string;
  size: string;
  color: string;
  quantity: number;
}

export interface MerchOrder {
  id: string;
  user_id: string | null;
  customer_name: string | null;
  customer_email: string | null;
  customer_phone: string | null;
  order_items: any[];
  total_amount: number;
  payment_method: string;
  status: string;
  is_preorder: boolean;
  member_id: string | null;
  stripe_payment_intent_id: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export function useMerchProducts(activeOnly = false) {
  return useQuery({
    queryKey: ["merch-products", activeOnly],
    queryFn: async () => {
      let query = supabase.from("merch_products").select("*").order("display_order").order("name");
      if (activeOnly) query = query.eq("is_active", true);
      const { data, error } = await query;
      if (error) throw error;
      return data as MerchProduct[];
    },
  });
}

export function useMerchInventory(productId?: string) {
  return useQuery({
    queryKey: ["merch-inventory", productId],
    queryFn: async () => {
      let query = supabase.from("merch_inventory").select("*");
      if (productId) query = query.eq("product_id", productId);
      const { data, error } = await query;
      if (error) throw error;
      return data as MerchInventoryItem[];
    },
  });
}

export function useCreateMerchProduct() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (product: Partial<MerchProduct>) => {
      const { data, error } = await supabase.from("merch_products").insert(product as any).select().single();
      if (error) throw error;
      const requestedUrls = product.image_urls ?? [];
      const savedUrls = Array.isArray(data?.image_urls) ? data.image_urls : [];
      if (requestedUrls.length > 0 && requestedUrls.some((url) => !savedUrls.includes(url))) {
        throw new Error("The product was created, but its image was not saved. Reopen the product and try the image again.");
      }
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["merch-products"] });
      toast.success("Product created");
    },
    onError: (e: any) => toast.error(e.message),
  });
}

export function useUpdateMerchProduct() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<MerchProduct> & { id: string }) => {
      const { data, error } = await supabase
        .from("merch_products")
        .update({ ...updates, updated_at: new Date().toISOString() } as any)
        .eq("id", id)
        .select("id");
      if (error) throw error;
      if (!data || data.length === 0) {
        throw new Error("Save blocked: your account doesn't have permission to edit Storm Shop products.");
      }
      if (Array.isArray(updates.image_urls)) {
        const { data: verified, error: verifyError } = await supabase
          .from("merch_products")
          .select("image_urls")
          .eq("id", id)
          .single();
        if (verifyError) throw verifyError;
        const savedUrls = Array.isArray(verified?.image_urls) ? verified.image_urls : [];
        if (updates.image_urls.some((url) => !savedUrls.includes(url))) {
          throw new Error("The product saved, but its image did not persist.");
        }
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["merch-products"] });
      toast.success("Product updated");
    },
    onError: (e: any) => toast.error(e.message),
  });
}

export function useUpsertMerchInventory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (items: Omit<MerchInventoryItem, "id">[]) => {
      const { error } = await supabase.from("merch_inventory").upsert(items as any, { onConflict: "product_id,size,color" });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["merch-inventory"] });
      toast.success("Inventory updated");
    },
    onError: (e: any) => toast.error(e.message),
  });
}

export function useMerchOrders(status?: string) {
  return useQuery({
    queryKey: ["merch-orders", status],
    queryFn: async () => {
      let query = supabase.from("merch_orders").select("*").order("created_at", { ascending: false });
      if (status) query = query.eq("status", status);
      const { data, error } = await query;
      if (error) throw error;
      return data as MerchOrder[];
    },
  });
}

export function useCreateMerchOrder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (order: Partial<MerchOrder>) => {
      const { data, error } = await supabase.from("merch_orders").insert(order as any).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["merch-orders"] });
    },
    onError: (e: any) => toast.error(e.message),
  });
}

export function useUpdateMerchOrderStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase.from("merch_orders").update({ status, updated_at: new Date().toISOString() } as any).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["merch-orders"] });
      toast.success("Order status updated");
    },
    onError: (e: any) => toast.error(e.message),
  });
}
