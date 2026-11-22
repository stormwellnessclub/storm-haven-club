import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { format, differenceInHours, differenceInMinutes, parse, addHours } from "date-fns";

export interface KidsCareBooking {
  id: string;
  member_id: string;
  user_id: string;
  child_name: string;
  child_age: number;
  child_dob: string | null;
  booking_date: string;
  start_time: string;
  end_time: string;
  status: "confirmed" | "checked_in" | "checked_out" | "cancelled" | "no_show";
  pass_id: string | null;
  age_group: string | null;
  room: string | null;
  special_instructions: string | null;
  parent_notes: string | null;
  checked_in_at: string | null;
  checked_out_at: string | null;
  checked_in_by: string | null;
  checked_out_by: string | null;
  parent_confirmed_pickup: boolean;
  parent_confirmed_at: string | null;
  created_at: string;
  updated_at: string;
  cancelled_at: string | null;
  cancellation_reason: string | null;
}

interface BookKidsCareParams {
  childName: string;
  childAge: number;
  childDob?: Date;
  bookingDate: Date;
  startTime: string; // "HH:mm" format
  endTime: string; // "HH:mm" format
  specialInstructions?: string;
  parentNotes?: string;
  passId: string;
}

const AGE_GROUPS = {
  infants: { name: "Infants", min: 0.333, max: 1, spots: 4 }, // 4 months to 1 year
  toddlers: { name: "Toddlers", min: 1, max: 3, spots: 8 },
  preschool: { name: "Preschool", min: 3, max: 5, spots: 10 },
  schoolAge: { name: "School Age", min: 5, max: 8, spots: 12 },
};

function getAgeGroup(age: number): string {
  if (age >= 0.333 && age < 1) return "Infants";
  if (age >= 1 && age < 3) return "Toddlers";
  if (age >= 3 && age < 5) return "Preschool";
  if (age >= 5 && age <= 8) return "School Age";
  return "Unknown";
}

export function useKidsCarePasses() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["kids-care-passes", user?.id],
    queryFn: async () => {
      if (!user) return [];

      // Kids Care Passes - check for passes with category 'other' and pass_type containing 'kids' or 'care'
      // Or a specific pass_type like 'kids_care'
      const { data, error } = await supabase
        .from("class_passes")
        .select("*")
        .eq("user_id", user.id)
        .eq("status", "active")
        .or("pass_type.ilike.%kids%,pass_type.ilike.%care%,pass_type.eq.kids_care")
        .gt("expires_at", new Date().toISOString())
        .gt("classes_remaining", 0);

      if (error) throw error;

      return (data || []).filter((pass) => 
        pass.pass_type?.toLowerCase().includes("kids") || 
        pass.pass_type?.toLowerCase().includes("care") ||
        pass.pass_type === "kids_care"
      );
    },
    enabled: !!user,
  });
}

export type KidsCarePassEnded = { endedAt: string; reason: "expired" | "used_up" };

/**
 * The family's most recent Kids Care pass has ended (date passed in the last 30 days,
 * or all sessions used) and they have no usable pass. Passes never auto-renew, so this
 * drives the "buy a new pass" banner. Child profiles are kept, so rebuying needs no re-entry.
 */
export function useKidsCarePassEnded() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["kids-care-pass-ended", user?.id],
    queryFn: async (): Promise<KidsCarePassEnded | null> => {
      if (!user) return null;
      const { data, error } = await supabase
        .from("class_passes")
        .select("id, classes_remaining, expires_at, status")
        .eq("user_id", user.id)
        .ilike("pass_type", "kids_care%")
        .order("expires_at", { ascending: false })
        .limit(10);
      if (error) throw error;
      const now = new Date();
      const rows = data || [];
      const usable = rows.some(
        (p) => (p.status ?? "active") === "active" && new Date(p.expires_at) > now && (p.classes_remaining ?? 0) > 0,
      );
      if (usable || rows.length === 0) return null;
      const latest = rows[0];
      const expires = new Date(latest.expires_at);
      if (expires <= now) {
        const daysAgo = (now.getTime() - expires.getTime()) / 86_400_000;
        return daysAgo <= 30 ? { endedAt: latest.expires_at, reason: "expired" } : null;
      }
      return { endedAt: latest.expires_at, reason: "used_up" };
    },
    enabled: !!user,
  });
}

export function useBookKidsCare() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: BookKidsCareParams) => {
      if (!user) {
        throw new Error("You must be signed in to book kids care");
      }

      // Validate that user has an active Kids Care Pass
      const { data: passes, error: passError } = await supabase
        .from("class_passes")
        .select("*")
        .eq("user_id", user.id)
        .eq("id", params.passId)
        .eq("status", "active")
        .or("pass_type.ilike.%kids%,pass_type.ilike.%care%,pass_type.eq.kids_care")
        .gt("expires_at", new Date().toISOString())
        .gt("classes_remaining", 0)
        .single();

      if (passError || !passes) {
        throw new Error("Valid Kids Care Pass required. Please purchase a Kids Care Pass first.");
      }

      // Get member_id
      const { data: memberData, error: memberError } = await supabase
        .from("members")
        .select("id")
        .eq("user_id", user.id)
        .maybeSingle();

      if (memberError) throw memberError;
      if (!memberData) {
        throw new Error("Membership required to book kids care");
      }

      // Validate booking date is within 48 hours advance window
      const bookingDateTime = new Date(params.bookingDate);
      const [startHour, startMin] = params.startTime.split(":").map(Number);
      bookingDateTime.setHours(startHour, startMin, 0, 0);

      const hoursUntilBooking = differenceInHours(bookingDateTime, new Date());
      if (hoursUntilBooking < 0) {
        throw new Error("Cannot book in the past");
      }
      const sevenDaysInHours = 7 * 24;
      if (hoursUntilBooking > sevenDaysInHours) {
        throw new Error("Kids care bookings can only be made up to 7 days in advance");
      }

      // Validate session duration (max 2 hours per child per day)
      const startTimeObj = parse(params.startTime, "HH:mm", new Date());
      const endTimeObj = parse(params.endTime, "HH:mm", new Date());
      const durationMinutes = differenceInMinutes(endTimeObj, startTimeObj);

      if (durationMinutes <= 0 || durationMinutes > 120) {
        throw new Error("Kids care sessions must be between 1 minute and 2 hours");
      }

      // Per-child pass validation: check if pass is already used by a different child
      try {
        const { data: existingPassBooking } = await (supabase.from as any)("kids_care_bookings")
          .select("child_name")
          .eq("pass_id", params.passId)
          .not("status", "in", '("cancelled","no_show")')
          .neq("child_name", params.childName)
          .limit(1)
          .maybeSingle();

        if (existingPassBooking) {
          throw new Error(`This pass is already assigned to ${existingPassBooking.child_name}. Each child needs their own pass.`);
        }
      } catch (error: any) {
        if (error?.code === "42P01" || error?.message?.includes("does not exist")) {
          // Table doesn't exist yet, skip validation
        } else if (error.message?.includes("already assigned")) {
          throw error;
        } else {
          console.warn("Error checking pass-child assignment:", error);
        }
      }

      // Check for existing booking for same child on same date
      try {
        const { data: existingBooking } = await (supabase.from as any)("kids_care_bookings")
          .select("id")
          .eq("user_id", user.id)
          .eq("booking_date", format(params.bookingDate, "yyyy-MM-dd"))
          .eq("child_name", params.childName)
          .in("status", ["confirmed", "checked_in"])
          .maybeSingle();

        if (existingBooking) {
          throw new Error("This child already has a booking for this date");
        }
      } catch (error: any) {
        if (error?.code === "42P01" || error?.message?.includes("does not exist")) {
          // Table doesn't exist yet, skip validation
        } else if (error.message === "This child already has a booking for this date") {
          throw error;
        } else {
          console.warn("Error checking existing booking:", error);
        }
      }

      // Age group and room are worked out on the server with the same
      // buckets as getAgeGroup(). Staff manage capacity at check-in.

      // Create the booking and take one visit off the pass together on the
      // server. Members can't change pass balances directly, so a direct
      // update here would silently fail and leave the visit unused.
      const { data, error } = await (supabase.rpc as any)("member_book_kids_care", {
        p_pass_id: params.passId,
        p_child_name: params.childName,
        p_child_age: params.childAge,
        p_child_dob: params.childDob ? format(params.childDob, "yyyy-MM-dd") : null,
        p_booking_date: format(params.bookingDate, "yyyy-MM-dd"),
        p_start_time: format(parse(params.startTime, "HH:mm", new Date()), "HH:mm:ss"),
        p_end_time: format(parse(params.endTime, "HH:mm", new Date()), "HH:mm:ss"),
        p_special_instructions: params.specialInstructions || null,
        p_parent_notes: params.parentNotes || null,
      });

      if (error) throw error;

      return data as KidsCareBooking;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["kids-care-bookings"] });
      queryClient.invalidateQueries({ queryKey: ["kids-care-passes"] });
      toast.success("Kids care booking created successfully!");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to create booking");
    },
  });
}

export function useMyKidsCareBookings() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["kids-care-bookings", user?.id],
    queryFn: async (): Promise<KidsCareBooking[]> => {
      if (!user) return [];

      try {
        const { data, error } = await (supabase.from as any)("kids_care_bookings")
          .select("*")
          .eq("user_id", user.id)
          .order("booking_date", { ascending: true })
          .order("start_time", { ascending: true });

        if (error) {
          if (error.code === "42P01" || error.message?.includes("does not exist")) {
            console.warn("kids_care_bookings table not found, returning empty array");
            return [];
          }
          throw error;
        }

        return (data || []) as KidsCareBooking[];
      } catch (error: any) {
        if (error?.code === "42P01" || error?.message?.includes("does not exist")) {
          console.warn("kids_care_bookings table not found, returning empty array");
          return [];
        }
        throw error;
      }
    },
    enabled: !!user,
  });
}

export function useCancelKidsCareBooking() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ bookingId, reason }: { bookingId: string; reason?: string }) => {
      // Check cancellation policy (2 hours before start time)
      try {
        const { data: booking, error: fetchError } = await (supabase.from as any)("kids_care_bookings")
          .select("booking_date, start_time, pass_id")
          .eq("id", bookingId)
          .single();

        if (fetchError) {
          if (fetchError.code === "42P01" || fetchError.message?.includes("does not exist")) {
            throw new Error("Kids care booking is not yet available. Please check back later.");
          }
          throw fetchError;
        }

        const bookingDateTime = new Date(`${booking.booking_date}T${booking.start_time}`);
        const hoursUntilBooking = differenceInHours(bookingDateTime, new Date());

        if (hoursUntilBooking < 2) {
          throw new Error("Cancellations must be made at least 2 hours before the booking start time");
        }

        // Cancel and give the visit back to the pass together on the server.
        const { data, error } = await (supabase.rpc as any)("member_cancel_kids_care_booking", {
          p_booking_id: bookingId,
          p_reason: reason || "Cancelled by parent",
        });

        if (error) throw error;

        return data as KidsCareBooking;
      } catch (error: any) {
        if (error?.code === "42P01" || error?.message?.includes("does not exist")) {
          throw new Error("Kids care booking is not yet available. Please check back later.");
        }
        throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["kids-care-bookings"] });
      queryClient.invalidateQueries({ queryKey: ["kids-care-passes"] });
      toast.success("Booking cancelled successfully");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to cancel booking");
    },
  });
}



