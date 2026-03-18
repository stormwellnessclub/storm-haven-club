import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { startOfWeek, format } from "date-fns";

export interface KidsCareHourEntry {
  id?: string;
  week_start: string;
  day_of_week: number;
  open_time: string;
  close_time: string;
  is_closed: boolean;
  notes: string | null;
  created_by?: string;
  created_at?: string;
  updated_at?: string;
}

function getMonday(date: Date): string {
  const monday = startOfWeek(date, { weekStartsOn: 1 });
  return format(monday, "yyyy-MM-dd");
}

export function useKidsCareHoursForWeek(weekStart: Date) {
  const mondayStr = getMonday(weekStart);

  return useQuery({
    queryKey: ["kids-care-hours", mondayStr],
    queryFn: async (): Promise<KidsCareHourEntry[]> => {
      try {
        const { data, error } = await (supabase.from as any)("kids_care_hours")
          .select("*")
          .eq("week_start", mondayStr)
          .order("day_of_week", { ascending: true });

        if (error) {
          if (error.code === "42P01" || error.message?.includes("does not exist")) return [];
          throw error;
        }
        return (data || []) as KidsCareHourEntry[];
      } catch (e: any) {
        if (e?.code === "42P01" || e?.message?.includes("does not exist")) return [];
        throw e;
      }
    },
  });
}

export function useKidsCareHoursForDate(date: Date | undefined) {
  const mondayStr = date ? getMonday(date) : "";
  const dayOfWeek = date ? date.getDay() : -1;

  return useQuery({
    queryKey: ["kids-care-hours-day", mondayStr, dayOfWeek],
    queryFn: async (): Promise<KidsCareHourEntry | null> => {
      if (!date) return null;
      try {
        const { data, error } = await (supabase.from as any)("kids_care_hours")
          .select("*")
          .eq("week_start", mondayStr)
          .eq("day_of_week", dayOfWeek)
          .maybeSingle();

        if (error) {
          if (error.code === "42P01" || error.message?.includes("does not exist")) return null;
          throw error;
        }
        return data as KidsCareHourEntry | null;
      } catch (e: any) {
        if (e?.code === "42P01" || e?.message?.includes("does not exist")) return null;
        throw e;
      }
    },
    enabled: !!date,
  });
}

export function useSaveKidsCareHours() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (entries: KidsCareHourEntry[]) => {
      if (!user) throw new Error("Not authenticated");

      // Upsert each entry
      for (const entry of entries) {
        const { error } = await (supabase.from as any)("kids_care_hours")
          .upsert(
            {
              week_start: entry.week_start,
              day_of_week: entry.day_of_week,
              open_time: entry.open_time,
              close_time: entry.close_time,
              is_closed: entry.is_closed,
              notes: entry.notes,
              created_by: user.id,
              updated_at: new Date().toISOString(),
            },
            { onConflict: "week_start,day_of_week" }
          );

        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["kids-care-hours"] });
      queryClient.invalidateQueries({ queryKey: ["kids-care-hours-day"] });
      toast.success("Kids Care hours saved");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to save hours");
    },
  });
}

export function useConfirmPickup() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (bookingId: string) => {
      const { error } = await (supabase.from as any)("kids_care_bookings")
        .update({
          parent_confirmed_pickup: true,
          parent_confirmed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", bookingId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["kids-care-bookings"] });
      queryClient.invalidateQueries({ queryKey: ["admin-kids-care-bookings"] });
      toast.success("Pickup confirmed!");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to confirm pickup");
    },
  });
}

export { getMonday };
