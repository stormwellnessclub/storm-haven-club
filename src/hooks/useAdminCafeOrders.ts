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
    first_name?: string | null;
    last_name?: string | null;
    phone?: string | null;
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
    queryKey: ["admin-cafe-orders", filters, user ? "auth" : "kiosk"],
    queryFn: async (): Promise<AdminCafeOrder[]> => {
      // Front desk / kiosk (no auth) — use SECURITY DEFINER RPC. RLS on
      // cafe_orders otherwise returns zero rows.
      if (!user) {
        try {
          const { data, error } = await (supabase.rpc as any)("kiosk_cafe_active_orders");
          if (error) throw error;
          let rows = (Array.isArray(data) ? data : []) as AdminCafeOrder[];

          if (filters?.status) rows = rows.filter((r) => r.status === filters.status);
          if (filters?.memberId) rows = rows.filter((r) => (r as any).member_id === filters.memberId);
          if (filters?.dateFrom) {
            const from = filters.dateFrom.getTime();
            rows = rows.filter((r) => new Date(r.created_at as any).getTime() >= from);
          }
          if (filters?.dateTo) {
            const to = filters.dateTo.getTime();
            rows = rows.filter((r) => new Date(r.created_at as any).getTime() <= to);
          }
          // Newest first for the queue view
          rows.sort((a, b) => new Date(b.created_at as any).getTime() - new Date(a.created_at as any).getTime());
          return rows;
        } catch (err) {
          console.error("kiosk_cafe_active_orders failed:", err);
          return [];
        }
      }

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

        const rows = (data || []).map((order: any) => ({
          ...order,
          member: order.member ? (Array.isArray(order.member) ? order.member[0] : order.member) : null,
          user: null as AdminCafeOrder["user"],
        })) as AdminCafeOrder[];

        // Look up non-member profile info for orders without a member record
        const nonMemberUserIds = Array.from(new Set(
          rows.filter((r) => !r.member && r.user_id).map((r) => r.user_id as string)
        ));
        if (nonMemberUserIds.length > 0) {
          const { data: nmProfiles } = await supabase
            .from("non_member_profiles")
            .select("user_id, first_name, last_name, email, phone")
            .in("user_id", nonMemberUserIds);
          const byUserId = new Map<string, any>();
          (nmProfiles || []).forEach((p: any) => byUserId.set(p.user_id, p));
          rows.forEach((r) => {
            if (!r.member && r.user_id && byUserId.has(r.user_id)) {
              const p = byUserId.get(r.user_id);
              r.user = {
                id: r.user_id,
                email: p.email || "",
                first_name: p.first_name,
                last_name: p.last_name,
                phone: p.phone,
              };
            }
          });
        }
        return rows;
      } catch (error: any) {
        if (error?.code === "42P01" || error?.message?.includes("does not exist")) {
          console.warn("cafe_orders table not found, returning empty array");
          return [];
        }
        throw error;
      }
    },
    // Enable on kiosk as well — queries the SECURITY DEFINER RPC without auth.
  });
}

export function useUpdateCafeOrderStatus() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({ orderId, status }: { orderId: string; status: string }) => {
      // Front desk / kiosk (no auth session) — route through the kiosk RPC.
      if (!user || isKioskMode()) {

        const { error } = await (supabase.rpc as any)("kiosk_update_cafe_order_status", {
          p_order_id: orderId,
          p_new_status: status,
        });
        if (error) throw error;
        return { id: orderId, status } as unknown as CafeOrder;
      }

      const updateData: any = {
        status,
        updated_at: new Date().toISOString(),
      };

      if (status === "completed") {
        updateData.completed_at = new Date().toISOString();
      } else {
        // Clear completed_at when reopening/undoing a completed order
        updateData.completed_at = null;
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

