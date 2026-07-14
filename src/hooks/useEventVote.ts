import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

export interface VoteTally {
  option_key: string;
  vote_count: number;
  total_votes: number;
  percentage: number | null;
}

export function useEventVoteTallies(eventSlug: string) {
  return useQuery({
    queryKey: ["event-vote-tallies", eventSlug],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("event_vote_tallies")
        .select("*")
        .eq("event_slug", eventSlug);
      if (error) throw error;
      return (data ?? []) as VoteTally[];
    },
    refetchInterval: 15000,
  });
}

export function useMyEventVote(eventSlug: string) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["my-event-vote", eventSlug, user?.id],
    queryFn: async () => {
      if (!user) return null;
      const { data, error } = await supabase
        .from("event_votes")
        .select("*")
        .eq("event_slug", eventSlug)
        .eq("user_id", user.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });
}

export function useCastVote(eventSlug: string, voterType: "member" | "non_member") {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (optionKey: string) => {
      if (!user) throw new Error("Please sign in to vote.");
      const { error } = await supabase.from("event_votes").upsert(
        {
          event_slug: eventSlug,
          user_id: user.id,
          option_key: optionKey,
          voter_type: voterType,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "event_slug,user_id" },
      );
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["event-vote-tallies", eventSlug] });
      qc.invalidateQueries({ queryKey: ["my-event-vote", eventSlug] });
      toast.success("Thanks for voting!");
    },
    onError: (e: any) => toast.error(e?.message || "Could not record your vote."),
  });
}
