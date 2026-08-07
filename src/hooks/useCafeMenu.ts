import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

export type CafeMenuSection = 'cafe' | 'spa' | 'shop';

export interface CafeMenuCategory {
  id: string;
  name: string;
  display_order: number;
  has_addons: boolean;
  is_active: boolean;
  description: string | null;
  image_url: string | null;
  section: CafeMenuSection;
}

export interface CafeMenuItem {
  id: string;
  category_id: string | null;
  brand_name: string | null;
  flavor: string | null;
  item_name: string | null;
  size: string | null;
  description: string | null;
  protein_flavor: string | null;
  price: number;
  is_active: boolean;
  image_url: string | null;
  image_urls: string[];
  stock_quantity: number | null;
  is_seasonal: boolean;
  seasonal_label: string | null;
  display_order: number;
  calories: number | null;
  dietary_tags: string[] | null;
}

export interface CafeMenuAddon {
  id: string;
  name: string;
  price: number;
  category_id: string | null;
  is_active: boolean;
  display_order: number;
  group_name?: string | null;
  selection_type?: "single" | "multi" | null;
  is_required?: boolean | null;
}

// Active categories only (for POS and front-facing)
export function useCafeMenuCategories(section?: CafeMenuSection) {
  return useQuery({
    queryKey: ["cafe_menu_categories", section ?? "all_active"],
    queryFn: async (): Promise<CafeMenuCategory[]> => {
      let query = (supabase.from as any)("cafe_menu_categories")
        .select("*")
        .eq("is_active", true)
        .order("display_order");
      if (section) {
        query = query.eq("section", section);
      }
      const { data, error } = await query;
      if (error) throw error;
      return (data || []) as CafeMenuCategory[];
    },
  });
}

// ALL categories including inactive (for admin menu manager)
export function useAllCafeMenuCategories() {
  return useQuery({
    queryKey: ["cafe_menu_categories", "all"],
    queryFn: async (): Promise<CafeMenuCategory[]> => {
      const { data, error } = await (supabase.from as any)("cafe_menu_categories")
        .select("*")
        .order("display_order");
      if (error) throw error;
      return (data || []) as CafeMenuCategory[];
    },
  });
}

// Active items only (for POS and front-facing)
export function useCafeMenuItems() {
  return useQuery({
    queryKey: ["cafe_menu_items"],
    queryFn: async (): Promise<CafeMenuItem[]> => {
      const { data, error } = await (supabase.from as any)("cafe_menu_items")
        .select("*")
        .eq("is_active", true)
        .order("display_order");
      if (error) throw error;
      return (data || []) as CafeMenuItem[];
    },
  });
}

// ALL items including inactive (for admin menu manager)
export function useAllCafeMenuItems() {
  return useQuery({
    queryKey: ["cafe_menu_items", "all"],
    queryFn: async (): Promise<CafeMenuItem[]> => {
      const { data, error } = await (supabase.from as any)("cafe_menu_items")
        .select("*")
        .order("display_order");
      if (error) throw error;
      return (data || []) as CafeMenuItem[];
    },
  });
}

export function useCafeMenuAddons() {
  return useQuery({
    queryKey: ["cafe_menu_addons"],
    queryFn: async (): Promise<CafeMenuAddon[]> => {
      const { data, error } = await (supabase.from as any)("cafe_menu_addons")
        .select("*")
        .eq("is_active", true)
        .order("display_order");
      if (error) throw error;
      return (data || []) as CafeMenuAddon[];
    },
  });
}

// ALL addons including inactive (for admin)
export function useAllCafeMenuAddons() {
  return useQuery({
    queryKey: ["cafe_menu_addons", "all"],
    queryFn: async (): Promise<CafeMenuAddon[]> => {
      const { data, error } = await (supabase.from as any)("cafe_menu_addons")
        .select("*")
        .order("display_order");
      if (error) throw error;
      return (data || []) as CafeMenuAddon[];
    },
  });
}

export function useAddCafeCategory() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (name: string) => {
      const { data: existing } = await (supabase.from as any)("cafe_menu_categories")
        .select("display_order")
        .order("display_order", { ascending: false })
        .limit(1);
      const nextOrder = (existing?.[0]?.display_order ?? 0) + 1;
      const { data, error } = await (supabase.from as any)("cafe_menu_categories")
        .insert({ name, display_order: nextOrder })
        .select()
        .single();
      if (error) throw error;
      return data as CafeMenuCategory;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cafe_menu_categories"] });
      toast.success("Category added");
    },
    onError: () => toast.error("Failed to add category"),
  });
}

export function useUpdateCafeCategory() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: { id: string; name?: string; is_active?: boolean; description?: string; image_url?: string; display_order?: number; has_addons?: boolean; section?: CafeMenuSection }) => {
      const { error } = await (supabase.from as any)("cafe_menu_categories")
        .update(updates)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cafe_menu_categories"] });
    },
  });
}

export function useAddCafeMenuItem() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (item: {
      category_id: string;
      brand_name?: string;
      flavor?: string;
      item_name?: string;
      size?: string;
      description?: string;
      price: number;
      image_url?: string;
      image_urls?: string[];
      stock_quantity?: number | null;
      is_seasonal?: boolean;
      seasonal_label?: string;
      display_order?: number;
      calories?: number | null;
      dietary_tags?: string[];
    }) => {
      const { data, error } = await (supabase.from as any)("cafe_menu_items")
        .insert({ ...item, created_by: user?.id })
        .select()
        .single();
      if (error) throw error;
      const requestedUrls = item.image_urls ?? [];
      const savedUrls = Array.isArray(data?.image_urls) ? data.image_urls : [];
      if (requestedUrls.length > 0 && requestedUrls.some((url) => !savedUrls.includes(url))) {
        throw new Error("The item was created, but its image was not saved. Reopen the item and try the image again.");
      }
      return data as CafeMenuItem;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cafe_menu_items"] });
      toast.success("Item added");
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Failed to add item"),
  });
}

export function useAddCafeAddon() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (addon: { name: string; price: number; category_id: string }) => {
      const { data, error } = await (supabase.from as any)("cafe_menu_addons")
        .insert({ ...addon, created_by: user?.id })
        .select()
        .single();
      if (error) throw error;
      return data as CafeMenuAddon;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cafe_menu_addons"] });
      toast.success("Add-on added");
    },
    onError: () => toast.error("Failed to add add-on"),
  });
}

export function useUpdateCafeMenuItem() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: { id: string; [key: string]: any }) => {
      const { data, error } = await (supabase.from as any)("cafe_menu_items")
        .update(updates)
        .eq("id", id)
        .select("id");
      if (error) throw error;
      if (!data || data.length === 0) {
        throw new Error("Save blocked: your account doesn't have permission to edit menu items.");
      }
      if (Array.isArray(updates.image_urls)) {
        const { data: verified, error: verifyError } = await (supabase.from as any)("cafe_menu_items")
          .select("image_url, image_urls")
          .eq("id", id)
          .single();
        if (verifyError) throw verifyError;
        const savedUrls = Array.isArray(verified?.image_urls) ? verified.image_urls : [];
        if (savedUrls.length !== updates.image_urls.length ||
          updates.image_urls.some((url: string, index: number) => savedUrls[index] !== url) ||
          (updates.image_urls[0] ?? null) !== (verified?.image_url ?? null)) {
          throw new Error("The menu item saved, but its primary image did not persist.");
        }
      }
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["cafe_menu_items"] });
    },
  });
}

export function useUpdateCafeAddon() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: { id: string; price?: number; is_active?: boolean }) => {
      const { error } = await (supabase.from as any)("cafe_menu_addons")
        .update(updates)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cafe_menu_addons"] });
    },
  });
}

export const MI_SALES_TAX_RATE = 0.06;

export function calculateTax(subtotal: number): number {
  return Math.round(subtotal * MI_SALES_TAX_RATE * 100) / 100;
}

// Upload image to cafe-menu-images bucket
export async function uploadCafeMenuImage(file: File): Promise<string> {
  const { uploadImageToBucket } = await import("@/lib/uploadImage");
  return uploadImageToBucket("cafe-menu-images", file);
}

