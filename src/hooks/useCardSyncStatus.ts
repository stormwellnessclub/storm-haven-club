import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface CardSyncFailure {
  id: string;
  member_id: string | null;
  stripe_customer_id: string | null;
  error_message: string | null;
  retry_count: number;
  resolved_at: string | null;
  created_at: string;
  member?: {
    first_name: string;
    last_name: string;
    email: string;
    member_id: string;
  } | null;
}

export function useCardSyncFailures() {
  return useQuery({
    queryKey: ["card-sync-failures"],
    queryFn: async (): Promise<CardSyncFailure[]> => {
      const { data, error } = await supabase
        .from("card_sync_failures")
        .select(`
          *,
          member:members(first_name, last_name, email, member_id)
        `)
        .is("resolved_at", null)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return (data || []) as CardSyncFailure[];
    },
  });
}

export function useLogCardSyncFailure() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      memberId,
      stripeCustomerId,
      errorMessage,
    }: {
      memberId?: string;
      stripeCustomerId?: string;
      errorMessage: string;
    }) => {
      const { data, error } = await supabase
        .from("card_sync_failures")
        .insert({
          member_id: memberId || null,
          stripe_customer_id: stripeCustomerId || null,
          error_message: errorMessage,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["card-sync-failures"] });
    },
  });
}

export function useResolveCardSyncFailure() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (failureId: string) => {
      const { error } = await supabase
        .from("card_sync_failures")
        .update({ resolved_at: new Date().toISOString() })
        .eq("id", failureId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["card-sync-failures"] });
    },
  });
}

export function useRetryCardSync() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      failureId,
      memberId,
      stripeCustomerId,
    }: {
      failureId: string;
      memberId?: string;
      stripeCustomerId?: string;
    }) => {
      // First get current retry count
      const { data: currentFailure } = await supabase
        .from("card_sync_failures")
        .select("retry_count")
        .eq("id", failureId)
        .single();

      // Increment retry count
      const { error: updateError } = await supabase
        .from("card_sync_failures")
        .update({ retry_count: (currentFailure?.retry_count || 0) + 1 })
        .eq("id", failureId);

      if (updateError) {
        console.warn("Failed to update retry count:", updateError);
      }

      // Attempt sync
      const { data, error } = await supabase.functions.invoke("stripe-payment", {
        body: {
          action: "sync_member_card_metadata",
          memberId,
          stripeCustomerId,
        },
      });

      if (error) throw error;

      // If successful, mark as resolved
      if (data?.success) {
        await supabase
          .from("card_sync_failures")
          .update({ resolved_at: new Date().toISOString() })
          .eq("id", failureId);
      }

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["card-sync-failures"] });
      queryClient.invalidateQueries({ queryKey: ["user-membership"] });
    },
  });
}

/**
 * Sync card metadata with exponential backoff retry
 */
export async function syncCardMetadataWithRetry(
  memberId: string,
  stripeCustomerId?: string,
  maxAttempts: number = 3
): Promise<{ success: boolean; error?: string }> {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const { data, error } = await supabase.functions.invoke("stripe-payment", {
        body: {
          action: "sync_member_card_metadata",
          memberId,
          stripeCustomerId,
        },
      });

      if (error) throw error;
      if (data?.success) {
        return { success: true };
      }
      
      throw new Error(data?.error || "Sync failed");
    } catch (e: any) {
      console.warn(`Card sync attempt ${attempt}/${maxAttempts} failed:`, e.message);
      
      if (attempt === maxAttempts) {
        // Log failure to database on final attempt
        await supabase.from("card_sync_failures").insert({
          member_id: memberId,
          stripe_customer_id: stripeCustomerId || null,
          error_message: e.message,
        });
        
        return { success: false, error: e.message };
      }
      
      // Exponential backoff: 1s, 2s, 4s...
      await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, attempt - 1)));
    }
  }
  
  return { success: false, error: "Max retries exceeded" };
}