import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

export function useWaitlistCounts(sessionIds: string[]) {
  return useQuery({
    queryKey: ["waitlist-counts", sessionIds],
    enabled: sessionIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_waitlist_counts", {
        p_session_ids: sessionIds,
      });

      if (error) throw error;
      const counts: Record<string, number> = {};
      for (const entry of (data as any[]) || []) {
        counts[entry.session_id] = Number(entry.count);
      }
      return counts;
    },
  });
}

export function useWaitlistStatus(sessionIds: string[]) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["waitlist-status", user?.id, sessionIds],
    enabled: !!user && sessionIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("class_waitlist")
        .select("id, session_id, status, position")
        .eq("user_id", user!.id)
        .in("session_id", sessionIds)
        .in("status", ["waiting", "notified"]);

      if (error) throw error;
      // Return a map of session_id -> waitlist entry
      const map: Record<string, { id: string; status: string; position: number }> = {};
      for (const entry of data || []) {
        map[entry.session_id] = { id: entry.id, status: entry.status, position: entry.position };
      }
      return map;
    },
  });
}

export function useJoinWaitlist() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ sessionId }: { sessionId: string }) => {
      if (!user) throw new Error("Please sign in first.");

      // Get next position
      const { data: maxPos } = await supabase
        .from("class_waitlist")
        .select("position")
        .eq("session_id", sessionId)
        .order("position", { ascending: false })
        .limit(1)
        .single();

      const nextPosition = (maxPos?.position ?? 0) + 1;

      const { error } = await supabase.from("class_waitlist").insert({
        session_id: sessionId,
        user_id: user.id,
        position: nextPosition,
        status: "waiting",
      });

      if (error) {
        if (error.code === "23505") throw new Error("You're already on the waitlist.");
        throw error;
      }

      return { position: nextPosition };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["waitlist-status"] });
      toast.success("Added to Waitlist", {
        description: `You're #${data.position} on the waitlist. We'll notify you if a spot opens.`,
      });
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });
}
