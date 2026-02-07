import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface PaymentMethod {
  id: string;
  brand: string | null;
  last4: string | null;
  expMonth: number | null;
  expYear: number | null;
  nickname: string | null;
  isDefault: boolean;
  createdAt: string;
}

interface AdminPaymentMethodsResponse {
  paymentMethods: PaymentMethod[];
  hasPaymentMethod: boolean;
  stripeCustomerId?: string;
  customerSource?: 'database' | 'stripe_lookup';
  message?: string;
  memberEmail?: string;
}

export function useAdminMemberPaymentMethods(memberId: string | undefined) {
  return useQuery<AdminPaymentMethodsResponse>({
    queryKey: ["admin-member-payment-methods", memberId],
    queryFn: async () => {
      if (!memberId) {
        return { paymentMethods: [], hasPaymentMethod: false };
      }

      console.log("[useAdminMemberPaymentMethods] Fetching for member:", memberId);

      const { data, error } = await supabase.functions.invoke("stripe-payment", {
        body: {
          action: "admin_list_member_payment_methods",
          memberId,
        },
      });

      console.log("[useAdminMemberPaymentMethods] Response:", data, "Error:", error);

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      return data as AdminPaymentMethodsResponse;
    },
    enabled: !!memberId,
    staleTime: 30000, // Consider data fresh for 30 seconds
  });
}

export function useRefreshAdminMemberPaymentMethods() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (memberId: string) => {
      const { data, error } = await supabase.functions.invoke("stripe-payment", {
        body: {
          action: "admin_list_member_payment_methods",
          memberId,
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      return data as AdminPaymentMethodsResponse;
    },
    onSuccess: (data, memberId) => {
      queryClient.setQueryData(["admin-member-payment-methods", memberId], data);
      
      if (data.hasPaymentMethod) {
        toast.success(`Found ${data.paymentMethods.length} payment method(s) in Stripe`);
        // Also invalidate the main member query to refresh cached card metadata
        queryClient.invalidateQueries({ queryKey: ["admin-member-detail", memberId] });
      } else {
        toast.info(data.message || "No payment methods found in Stripe");
      }
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to fetch payment methods from Stripe");
    },
  });
}
