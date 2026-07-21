import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

export interface CafeOrderItem {
  id: number;
  name: string;
  price: number;
  quantity: number;
  category: string;
}

export interface CafeOrder {
  id: string;
  member_id: string | null;
  user_id: string | null;
  order_items: CafeOrderItem[];
  total_amount: number;
  status: "pending" | "preparing" | "ready" | "completed" | "cancelled";
  payment_method: string | null;
  payment_intent_id: string | null;
  estimated_ready_at: string | null;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
}

interface CreateOrderParams {
  orderItems: CafeOrderItem[];
  paymentMethod: "card" | "member_account" | "cash";
  paymentIntentId?: string;
  /** Override buyer attribution (used by Front Desk POS) */
  overrideMemberId?: string | null;
  overrideUserId?: string | null;
  note?: string | null;
}

export function useCreateCafeOrder() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      orderItems,
      paymentMethod,
      paymentIntentId,
      overrideMemberId,
      overrideUserId,
      note,
    }: CreateOrderParams) => {
      if (!user) {
        throw new Error("You must be signed in to place an order");
      }

      // Calculate total
      const totalAmount = orderItems.reduce((sum, item) => sum + item.price * item.quantity, 0);

      // Attribute the order to the buyer (POS) or, for self-order, the signed-in user
      let attributedUserId: string | null = overrideUserId ?? user.id;
      let attributedMemberId: string | null = overrideMemberId ?? null;

      // Self-order path — look up member_id from signed-in user
      if (overrideMemberId === undefined && overrideUserId === undefined) {
        const { data: memberData } = await supabase
          .from("members")
          .select("id")
          .eq("user_id", user.id)
          .maybeSingle();
        attributedMemberId = memberData?.id || null;
      }

      // Create order
      try {
        const { data, error } = await (supabase.from as any)("cafe_orders")
          .insert({
            user_id: attributedUserId,
            member_id: attributedMemberId,
            order_items: orderItems,
            total_amount: totalAmount,
            status: "pending",
            payment_method: paymentMethod,
            payment_intent_id: paymentIntentId || null,
            estimated_ready_at: new Date(Date.now() + 15 * 60 * 1000).toISOString(), // 15 minutes from now
            note: note || null,
          })
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
      queryClient.invalidateQueries({ queryKey: ["cafe-orders"] });
      toast.success("Order placed successfully! Your order will be ready shortly.");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to place order");
    },
  });
}

export function useMyCafeOrders() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["cafe-orders", user?.id],
    queryFn: async (): Promise<CafeOrder[]> => {
      if (!user) return [];

      try {
        const { data, error } = await (supabase.from as any)("cafe_orders")
          .select("*")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false });

        if (error) {
          if (error.code === "42P01" || error.message?.includes("does not exist")) {
            console.warn("cafe_orders table not found, returning empty array");
            return [];
          }
          throw error;
        }

        return (data || []) as CafeOrder[];
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

export function useCancelCafeOrder() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (orderId: string) => {
      try {
        const { data, error } = await (supabase.from as any)("cafe_orders")
          .update({
            status: "cancelled",
            updated_at: new Date().toISOString(),
          })
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
      queryClient.invalidateQueries({ queryKey: ["cafe-orders"] });
      toast.success("Order cancelled successfully");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to cancel order");
    },
  });
}



