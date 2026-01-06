import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface ProcessMembershipPaymentParams {
  memberId: string;
  tier: string;
  gender: string;
  isFoundingMember: boolean;
  startDate: string;
  skipAnnualFee?: boolean;
  sendLink?: boolean;
}

interface ProcessClassPackageParams {
  userId: string;
  category: string;
  passType: 'single' | 'tenPack';
  isMember: boolean;
  sendLink?: boolean;
}

interface ChargeSavedCardParams {
  memberId: string;
  customerId: string;
  amount: number; // in cents
  description: string;
}

interface UpdateBillingTypeParams {
  memberId: string;
  subscriptionId: string;
  billingType: 'monthly' | 'annual';
}

interface ManageSubscriptionParams {
  subscriptionId: string;
  action: 'pause' | 'cancel' | 'resume';
}

export function useProcessMembershipPayment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: ProcessMembershipPaymentParams) => {
      const { data, error } = await supabase.functions.invoke("stripe-payment", {
        body: {
          action: params.sendLink ? "create_membership_payment_link" : "process_membership_payment",
          ...params,
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["admin-members"] });
      if (data?.url) {
        toast.success("Payment link created. Copy the link to send to the member.");
      } else {
        toast.success("Membership payment processed successfully");
      }
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to process membership payment");
    },
  });
}

export function useProcessClassPackage() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: ProcessClassPackageParams) => {
      const { data, error } = await supabase.functions.invoke("stripe-payment", {
        body: {
          action: params.sendLink ? "create_class_pass_link" : "process_class_pass",
          ...params,
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["admin-members"] });
      if (data?.url) {
        toast.success("Payment link created. Copy the link to send to the customer.");
      } else {
        toast.success("Class package processed successfully");
      }
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to process class package");
    },
  });
}

export function useCreatePaymentLink() {
  return useMutation({
    mutationFn: async (params: { type: 'membership' | 'class_pass'; data: any }) => {
      const { data, error } = await supabase.functions.invoke("stripe-payment", {
        body: {
          action: params.type === 'membership' ? "create_membership_payment_link" : "create_class_pass_link",
          ...params.data,
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      return data;
    },
    onSuccess: () => {
      toast.success("Payment link created");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to create payment link");
    },
  });
}

export function useChargeSavedCard() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: ChargeSavedCardParams) => {
      const { data, error } = await supabase.functions.invoke("stripe-payment", {
        body: {
          action: "charge_saved_card",
          memberId: params.memberId,
          stripeCustomerId: params.customerId,
          amount: params.amount,
          description: params.description,
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["charge-history"] });
      queryClient.invalidateQueries({ queryKey: ["admin-members"] });
      toast.success("Payment processed successfully");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to charge card");
    },
  });
}

export function useUpdateBillingType() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: UpdateBillingTypeParams) => {
      const { data, error } = await supabase.functions.invoke("stripe-payment", {
        body: {
          action: "update_subscription_billing",
          subscriptionId: params.subscriptionId,
          billingType: params.billingType,
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-members"] });
      toast.success("Billing type updated successfully");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to update billing type");
    },
  });
}

export function useManageSubscription() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: ManageSubscriptionParams) => {
      const { data, error } = await supabase.functions.invoke("stripe-payment", {
        body: {
          action: `${params.action}_subscription`,
          subscriptionId: params.subscriptionId,
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["admin-members"] });
      toast.success(`Subscription ${variables.action}d successfully`);
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to manage subscription");
    },
  });
}
