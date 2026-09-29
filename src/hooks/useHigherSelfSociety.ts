import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export const SOCIETY_THEMES = [
  "Philosophy & meaning",
  "Personal growth",
  "Women's stories",
  "Wellness & the body",
  "Spirituality",
  "Literary fiction",
  "Memoir",
  "Leadership & purpose",
];

export const SOCIETY_RHYTHMS = [
  { value: "thursday_evening", label: "Thursday evening · 7:00–8:30 PM" },
  { value: "sunday_twilight", label: "Sunday twilight · 5:00–6:30 PM" },
  { value: "either", label: "Either works for me" },
];

export function useMySocietyInterest() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["hss-mine", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("higher_self_society_interest")
        .select("*")
        .eq("user_id", user!.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });
}

export function useSocietyRoster() {
  return useQuery({
    queryKey: ["hss-roster"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("higher_self_society_interest")
        .select("*")
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useSubmitSocietyInterest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (v: {
      themes: string[];
      rhythm: string;
      book: string;
      reason: string;
      guest: boolean;
      guestName: string;
    }) => {
      const { data, error } = await supabase.rpc("submit_higher_self_society_interest", {
        _themes: v.themes,
        _preferred_rhythm: v.rhythm,
        _book_suggestion: v.book,
        _book_reason: v.reason,
        _guest_requested: v.guest,
        _guest_name: v.guestName,
      });
      if (error) throw error;
      return data as { success: boolean; guest_allowed: boolean };
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["hss-mine"] });
      qc.invalidateQueries({ queryKey: ["hss-roster"] });
    },
  });
}

export function useUpdateGuestStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, guest_status }: { id: string; guest_status: string }) => {
      const { error } = await supabase
        .from("higher_self_society_interest")
        .update({ guest_status })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["hss-roster"] }),
  });
}
