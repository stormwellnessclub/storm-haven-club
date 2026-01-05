import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { format, differenceInHours, parse, addHours } from "date-fns";

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
  special_instructions: string | null;
  parent_notes: string | null;
  checked_in_at: string | null;
  checked_out_at: string | null;
  checked_in_by: string | null;
  checked_out_by: string | null;
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
  infants: { name: "Infants", min: 0.25, max: 1, spots: 4 }, // 3 months to 1 year
  toddlers: { name: "Toddlers", min: 1, max: 3, spots: 8 },
  preschool: { name: "Preschool", min: 3, max: 5, spots: 10 },
  schoolAge: { name: "School Age", min: 5, max: 10, spots: 12 },
};

function getAgeGroup(age: number): string {
  if (age >= 0.25 && age < 1) return "Infants";
  if (age >= 1 && age < 3) return "Toddlers";
  if (age >= 3 && age < 5) return "Preschool";
  if (age >= 5 && age <= 10) return "School Age";
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
      if (hoursUntilBooking > 48) {
        throw new Error("Kids care bookings can only be made up to 48 hours in advance");
      }

      // Validate session duration (max 2 hours per child per day)
      const startTimeObj = parse(params.startTime, "HH:mm", new Date());
      const endTimeObj = parse(params.endTime, "HH:mm", new Date());
      const durationHours = differenceInHours(endTimeObj, startTimeObj);

      if (durationHours <= 0 || durationHours > 2) {
        throw new Error("Kids care sessions must be between 1 minute and 2 hours");
      }

      // Check for existing booking for same child on same date
      const { data: existingBooking } = await supabase
        .from("kids_care_bookings")
        .select("id")
        .eq("user_id", user.id)
        .eq("booking_date", format(params.bookingDate, "yyyy-MM-dd"))
        .eq("child_name", params.childName)
        .in("status", ["confirmed", "checked_in"])
        .maybeSingle();

      if (existingBooking) {
        throw new Error("This child already has a booking for this date");
      }

      // Determine age group
      const ageGroup = getAgeGroup(params.childAge);

      // Check age group capacity (basic check - could be enhanced with real-time capacity)
      // For now, we'll allow booking and let staff manage capacity at check-in

      // Create booking
      const { data, error } = await supabase
        .from("kids_care_bookings")
        .insert({
          member_id: memberData.id,
          user_id: user.id,
          child_name: params.childName,
          child_age: params.childAge,
          child_dob: params.childDob ? format(params.childDob, "yyyy-MM-dd") : null,
          booking_date: format(params.bookingDate, "yyyy-MM-dd"),
          start_time: format(parse(params.startTime, "HH:mm", new Date()), "HH:mm:ss"),
          end_time: format(parse(params.endTime, "HH:mm", new Date()), "HH:mm:ss"),
          status: "confirmed",
          pass_id: params.passId,
          age_group: ageGroup,
          special_instructions: params.specialInstructions || null,
          parent_notes: params.parentNotes || null,
        })
        .select()
        .single();

      if (error) throw error;

      // Note: We don't deduct from pass here - that happens at check-in or could be done separately
      // The pass validation ensures they have a valid pass, but actual deduction is at check-in time

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

      const { data, error } = await supabase
        .from("kids_care_bookings")
        .select("*")
        .eq("user_id", user.id)
        .order("booking_date", { ascending: true })
        .order("start_time", { ascending: true });

      if (error) throw error;

      return (data || []) as KidsCareBooking[];
    },
    enabled: !!user,
  });
}

export function useCancelKidsCareBooking() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ bookingId, reason }: { bookingId: string; reason?: string }) => {
      // Check cancellation policy (2 hours before start time)
      const { data: booking, error: fetchError } = await supabase
        .from("kids_care_bookings")
        .select("booking_date, start_time")
        .eq("id", bookingId)
        .single();

      if (fetchError) throw fetchError;

      const bookingDateTime = new Date(`${booking.booking_date}T${booking.start_time}`);
      const hoursUntilBooking = differenceInHours(bookingDateTime, new Date());

      if (hoursUntilBooking < 2) {
        throw new Error("Cancellations must be made at least 2 hours before the booking start time");
      }

      const { data, error } = await supabase
        .from("kids_care_bookings")
        .update({
          status: "cancelled",
          cancelled_at: new Date().toISOString(),
          cancellation_reason: reason || "Cancelled by parent",
          updated_at: new Date().toISOString(),
        })
        .eq("id", bookingId)
        .select()
        .single();

      if (error) throw error;

      return data as KidsCareBooking;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["kids-care-bookings"] });
      toast.success("Booking cancelled successfully");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to cancel booking");
    },
  });
}



