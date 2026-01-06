import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { CafeOrder } from "./useCafeOrder";

export interface AdminCafeOrder extends CafeOrder {
  member?: {
    id: string;
    first_name: string;
    last_name: string;
    email: string;
  } | null;
  user?: {
    id: string;
    email: string;
  } | null;
}

interface AdminCafeOrdersFilters {
  status?: string;
  memberId?: string;
  dateFrom?: Date;
  dateTo?: Date;
}

export function useAdminCafeOrders(filters?: AdminCafeOrdersFilters) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["admin-cafe-orders", filters],
    queryFn: async (): Promise<AdminCafeOrder[]> => {
      if (!user) return [];

      try {
        let query = (supabase.from as any)("cafe_orders")
          .select(`
            *,
            member:members(id, first_name, last_name, email)
          `)
          .order("created_at", { ascending: false });

        if (filters?.status) {
          query = query.eq("status", filters.status);
        }

        if (filters?.memberId) {
          query = query.eq("member_id", filters.memberId);
        }

        if (filters?.dateFrom) {
          query = query.gte("created_at", filters.dateFrom.toISOString());
        }

        if (filters?.dateTo) {
          query = query.lte("created_at", filters.dateTo.toISOString());
        }

        const { data, error } = await query;

        if (error) {
          if (error.code === "42P01" || error.message?.includes("does not exist")) {
            console.warn("cafe_orders table not found, returning empty array");
            return [];
          }
          throw error;
        }

        return (data || []).map((order: any) => ({
          ...order,
          member: order.member ? (Array.isArray(order.member) ? order.member[0] : order.member) : null,
          user: null, // User info can be fetched separately if needed
        })) as AdminCafeOrder[];
      } catch (error: any) {
        if (error?.code === "42P01" || error?.message?.includes("does not exist")) {
          console.warn("cafe_orders table not found, returning empty array");
          return [];
        }
        throw error;
      }
    },
    enabled: !!user,
  });
}

export function useUpdateCafeOrderStatus() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({ orderId, status }: { orderId: string; status: string }) => {
      if (!user) throw new Error("You must be signed in");

      const updateData: any = {
        status,
        updated_at: new Date().toISOString(),
      };

      if (status === "completed") {
        updateData.completed_at = new Date().toISOString();
      }

      try {
        const { data, error } = await (supabase.from as any)("cafe_orders")
          .update(updateData)
          .eq("id", orderId)
          .select()
          .single();

        if (error) {
          if (error.code === "42P01" || error.message?.includes("does not exist")) {
            throw new Error("Cafe ordering is not yet available. Please check back later.");
          }
          throw error;
        }

        return data as CafeOrder;
      } catch (error: any) {
        if (error?.code === "42P01" || error?.message?.includes("does not exist")) {
          throw new Error("Cafe ordering is not yet available. Please check back later.");
        }
        throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-cafe-orders"] });
      queryClient.invalidateQueries({ queryKey: ["cafe-orders"] });
      toast.success("Order status updated");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to update order status");
    },
  });
}

