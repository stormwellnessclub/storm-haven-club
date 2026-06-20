import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export interface PendingClassMilestone {
  id: string;
  milestone: number | null;
  awarded_at: string;
  total_at_award: number | null;
}

/**
 * Returns the current member's most recent unseen class milestone (if any).
 * Used by the member portal to mount the Celestial Gold celebration overlay.
 */
export function usePendingClassMilestone() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["pending-class-milestone", user?.id],
    enabled: !!user?.id,
    staleTime: 60_000,
    refetchOnWindowFocus: false,
    queryFn: async (): Promise<PendingClassMilestone | null> => {
      const { data, error } = await (supabase.rpc as any)("get_pending_class_milestone");
      if (error) {
        console.warn("get_pending_class_milestone failed", error);
        return null;
      }
      return (data as PendingClassMilestone | null) ?? null;
    },
  });
}

/**
 * Marks all unseen class milestones for this user as celebrated.
 * Called when the overlay is dismissed so older milestones don't queue up.
 */
export function useMarkClassMilestonesSeen() {
  const qc = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async () => {
      const { data, error } = await (supabase.rpc as any)("mark_class_milestones_seen");
      if (error) throw error;
      return (data as number) ?? 0;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["pending-class-milestone", user?.id] });
    },
  });
}
