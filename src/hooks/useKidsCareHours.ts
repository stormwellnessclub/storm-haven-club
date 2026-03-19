import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { startOfWeek, format } from "date-fns";

// ─── Legacy types (kept for backward compat) ───
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

// ─── New slot-based types ───
export interface KidsCareHourSlot {
  id?: string;
  slot_date: string;
  open_time: string;
  close_time: string;
  label: string | null;
  notes: string | null;
  staff_name: string | null;
  created_by?: string;
  created_at?: string;
  updated_at?: string;
}

// Fetch all slots for a specific date
export function useKidsCareHourSlotsForDate(date: Date | undefined) {
  const dateStr = date ? format(date, "yyyy-MM-dd") : "";

  return useQuery({
    queryKey: ["kids-care-hour-slots", dateStr],
    queryFn: async (): Promise<KidsCareHourSlot[]> => {
      if (!dateStr) return [];
      const { data, error } = await (supabase.from as any)("kids_care_hour_slots")
        .select("*")
        .eq("slot_date", dateStr)
        .order("open_time", { ascending: true });

      if (error) throw error;
      return (data || []) as KidsCareHourSlot[];
    },
    enabled: !!date,
  });
}

// Save slots for a date: delete existing, insert new
export function useSaveKidsCareHourSlots() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({ date, slots }: { date: string; slots: Omit<KidsCareHourSlot, "id" | "created_by" | "created_at" | "updated_at">[] }) => {
      if (!user) throw new Error("Not authenticated");

      // Delete existing slots for this date
      const { error: deleteError } = await (supabase.from as any)("kids_care_hour_slots")
        .delete()
        .eq("slot_date", date);
      if (deleteError) throw deleteError;

      // Insert new slots (if any)
      if (slots.length > 0) {
        const rows = slots.map((s) => ({
          slot_date: date,
          open_time: s.open_time,
          close_time: s.close_time,
          label: s.label || null,
          notes: s.notes || null,
          staff_name: s.staff_name || null,
          created_by: user.id,
          updated_at: new Date().toISOString(),
        }));

        const { error: insertError } = await (supabase.from as any)("kids_care_hour_slots")
          .insert(rows);
        if (insertError) throw insertError;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["kids-care-hour-slots"] });
      toast.success("Kids Care hours saved");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to save hours");
    },
  });
}

// Copy slots from one date to multiple target dates
export function useCopyKidsCareHourSlots() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({ sourceDate, targetDates }: { sourceDate: string; targetDates: string[] }) => {
      if (!user) throw new Error("Not authenticated");

      // Fetch source slots
      const { data: sourceSlots, error: fetchError } = await (supabase.from as any)("kids_care_hour_slots")
        .select("open_time, close_time, label, notes, staff_name")
        .eq("slot_date", sourceDate);
      if (fetchError) throw fetchError;
      if (!sourceSlots || sourceSlots.length === 0) throw new Error("No slots to copy from source date");

      for (const targetDate of targetDates) {
        // Delete existing
        await (supabase.from as any)("kids_care_hour_slots").delete().eq("slot_date", targetDate);
        // Insert copied
        const rows = sourceSlots.map((s: any) => ({
          slot_date: targetDate,
          open_time: s.open_time,
          close_time: s.close_time,
          label: s.label,
          notes: s.notes,
          created_by: user.id,
        }));
        const { error } = await (supabase.from as any)("kids_care_hour_slots").insert(rows);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["kids-care-hour-slots"] });
      toast.success("Hours copied to selected dates");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to copy hours");
    },
  });
}

// ─── Member-facing: get slots for a date (used by booking modal) ───
// Returns array of slots instead of single range
export function useKidsCareHoursForDate(date: Date | undefined) {
  return useKidsCareHourSlotsForDate(date);
}

// ─── Legacy hooks (kept but no longer primary) ───
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

export function useSaveKidsCareHours() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (entries: KidsCareHourEntry[]) => {
      if (!user) throw new Error("Not authenticated");
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
