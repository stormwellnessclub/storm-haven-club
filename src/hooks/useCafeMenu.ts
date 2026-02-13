import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

export interface CafeMenuCategory {
  id: string;
  name: string;
  display_order: number;
  has_addons: boolean;
  is_active: boolean;
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
}

export interface CafeMenuAddon {
  id: string;
  name: string;
  price: number;
  category_id: string | null;
  is_active: boolean;
  display_order: number;
}

export function useCafeMenuCategories() {
  return useQuery({
    queryKey: ["cafe_menu_categories"],
    queryFn: async (): Promise<CafeMenuCategory[]> => {
      const { data, error } = await (supabase.from as any)("cafe_menu_categories")
        .select("*")
        .eq("is_active", true)
        .order("display_order");
      if (error) throw error;
      return (data || []) as CafeMenuCategory[];
    },
  });
}

export function useCafeMenuItems() {
  return useQuery({
    queryKey: ["cafe_menu_items"],
    queryFn: async (): Promise<CafeMenuItem[]> => {
      const { data, error } = await (supabase.from as any)("cafe_menu_items")
        .select("*")
        .eq("is_active", true)
        .order("brand_name");
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
    }) => {
      const { data, error } = await (supabase.from as any)("cafe_menu_items")
        .insert({ ...item, created_by: user?.id })
        .select()
        .single();
      if (error) throw error;
      return data as CafeMenuItem;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cafe_menu_items"] });
      toast.success("Item added");
    },
    onError: () => toast.error("Failed to add item"),
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
    mutationFn: async ({ id, ...updates }: { id: string; price?: number; is_active?: boolean }) => {
      const { error } = await (supabase.from as any)("cafe_menu_items")
        .update(updates)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cafe_menu_items"] });
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
