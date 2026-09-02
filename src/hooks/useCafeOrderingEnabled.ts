import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

/**
 * Global kill switch for customer-facing (online) cafe ordering.
 * Front desk / kiosk POS is unaffected — staff can always ring up in person.
 */
export function useCafeOrderingEnabled() {
  return useQuery({
    queryKey: ["cafe-ordering-enabled"],
    queryFn: async (): Promise<boolean> => {
      const { data, error } = await (supabase.from as any)("cafe_ordering_settings")
        .select("online_ordering_enabled")
        .maybeSingle();
      if (error) {
        console.warn("cafe_ordering_settings read failed", error);
        return true;
      }
      return data?.online_ordering_enabled ?? true;
    },
    staleTime: 30_000,
    refetchInterval: 60_000,
  });
}

export function useSetCafeOrderingEnabled() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (enabled: boolean) => {
      const { data: userRes } = await supabase.auth.getUser();
      const { error } = await (supabase.from as any)("cafe_ordering_settings")
        .update({
          online_ordering_enabled: enabled,
          updated_at: new Date().toISOString(),
          updated_by: userRes?.user?.id ?? null,
        })
        .eq("id", true);
      if (error) throw error;
      return enabled;
    },
    onSuccess: (enabled) => {
      queryClient.invalidateQueries({ queryKey: ["cafe-ordering-enabled"] });
      toast.success(enabled ? "Online ordering is open" : "Online ordering is closed");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to update online ordering");
    },
  });
}
