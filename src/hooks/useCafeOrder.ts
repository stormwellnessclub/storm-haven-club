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
  paymentMethod: "card" | "member_account";
  paymentIntentId?: string;
}

export function useCreateCafeOrder() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ orderItems, paymentMethod, paymentIntentId }: CreateOrderParams) => {
      if (!user) {
        throw new Error("You must be signed in to place an order");
      }

      // Calculate total
      const totalAmount = orderItems.reduce((sum, item) => sum + item.price * item.quantity, 0);

      // Get member_id if user is a member
      const { data: memberData } = await supabase
        .from("members")
        .select("id")
        .eq("user_id", user.id)
        .maybeSingle();

      // Create order
      const { data, error } = await supabase
        .from("cafe_orders")
        .insert({
          user_id: user.id,
          member_id: memberData?.id || null,
          order_items: orderItems,
          total_amount: totalAmount,
          status: "pending",
          payment_method: paymentMethod,
          payment_intent_id: paymentIntentId || null,
          estimated_ready_at: new Date(Date.now() + 15 * 60 * 1000).toISOString(), // 15 minutes from now
        })
        .select()
        .single();

      if (error) throw error;

      return data as CafeOrder;
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

      const { data, error } = await supabase
        .from("cafe_orders")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (error) throw error;

      return (data || []) as CafeOrder[];
    },
    enabled: !!user,
  });
}

export function useCancelCafeOrder() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (orderId: string) => {
      const { data, error } = await supabase
        .from("cafe_orders")
        .update({
          status: "cancelled",
          updated_at: new Date().toISOString(),
        })
        .eq("id", orderId)
        .select()
        .single();

      if (error) throw error;

      return data as CafeOrder;
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



