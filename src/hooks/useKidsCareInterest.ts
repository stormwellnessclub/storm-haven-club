import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";

interface KidsCareInterestData {
  email: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
  childrenCount: number;
  childrenAges: string;
  notes?: string;
}

export function useJoinKidsCareInterest() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: KidsCareInterestData) => {
      const { data: result, error } = await supabase
        .from("kids_care_interest_waitlist")
        .insert({
          user_id: user?.id || null,
          email: data.email,
          first_name: data.firstName,
          last_name: data.lastName,
          phone: data.phone,
          children_count: data.childrenCount,
          children_ages: data.childrenAges,
          notes: data.notes,
        })
        .select()
        .single();

      if (error) throw error;
      return result;
    },
    onSuccess: () => {
      toast.success("You've been added to our Kids Care interest list!");
      queryClient.invalidateQueries({ queryKey: ["kids-care-interest"] });
    },
    onError: (error: Error) => {
      console.error("Error joining interest waitlist:", error);
      toast.error("Failed to join interest list. Please try again.");
    },
  });
}

export function useKidsCareInterestList() {
  return useQuery({
    queryKey: ["kids-care-interest"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("kids_care_interest_waitlist")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data;
    },
  });
}

export function useUpdateKidsCareInterestStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { data, error } = await supabase
        .from("kids_care_interest_waitlist")
        .update({ status })
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast.success("Status updated");
      queryClient.invalidateQueries({ queryKey: ["kids-care-interest"] });
    },
    onError: (error: Error) => {
      toast.error("Failed to update status");
      console.error(error);
    },
  });
}
