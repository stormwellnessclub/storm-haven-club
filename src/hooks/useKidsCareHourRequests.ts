import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface HourRequest {
  id: string;
  user_id: string;
  preferred_days: string[];
  preferred_start_time: string | null;
  preferred_end_time: string | null;
  notes: string | null;
  status: string;
  created_at: string;
}

export function useMyHourRequests() {
  return useQuery({
    queryKey: ["kids-care-hour-requests", "mine"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data, error } = await supabase
        .from("kids_care_hour_requests")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as HourRequest[];
    },
  });
}

export function useSubmitHourRequest() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (request: {
      preferred_days: string[];
      preferred_start_time: string;
      preferred_end_time: string;
      notes?: string;
    }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { error } = await supabase
        .from("kids_care_hour_requests")
        .insert({
          user_id: user.id,
          preferred_days: request.preferred_days,
          preferred_start_time: request.preferred_start_time,
          preferred_end_time: request.preferred_end_time,
          notes: request.notes || null,
        });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["kids-care-hour-requests"] });
      toast.success("Your hour request has been submitted!");
    },
    onError: (error) => {
      toast.error("Failed to submit request: " + error.message);
    },
  });
}

export interface AdminHourRequest extends HourRequest {
  profiles: { first_name: string; last_name: string; email: string } | null;
}

export function useAdminHourRequests() {
  return useQuery({
    queryKey: ["kids-care-hour-requests", "admin"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("kids_care_hour_requests")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;

      // Fetch profile info for each unique user_id
      const userIds = [...new Set((data as HourRequest[]).map((r) => r.user_id))];
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, first_name, last_name, email")
        .in("user_id", userIds);

      const profileMap = new Map(
        (profiles || []).map((p) => [p.user_id, p])
      );

      return (data as HourRequest[]).map((r) => ({
        ...r,
        profiles: profileMap.get(r.user_id) || null,
      })) as AdminHourRequest[];
    },
  });
}

export function useUpdateHourRequestStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase
        .from("kids_care_hour_requests")
        .update({ status })
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["kids-care-hour-requests"] });
      toast.success("Request status updated");
    },
    onError: (error) => {
      toast.error("Failed to update: " + error.message);
    },
  });
}
