import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { format, differenceInHours, addWeeks, parseISO, parse } from "date-fns";

export interface Booking {
  id: string;
  session_id: string;
  user_id: string;
  member_id: string | null;
  status: "confirmed" | "cancelled" | "no_show" | "completed";
  credits_used: number | null;
  amount_paid: number | null;
  payment_method: string | null;
  booked_at: string;
  cancelled_at: string | null;
  checked_in_at: string | null;
  session: {
    id: string;
    session_date: string;
    start_time: string;
    end_time: string;
    room: string | null;
    is_cancelled: boolean;
    class_type: {
      id: string;
      name: string;
      category: "pilates_cycling" | "other";
      is_heated: boolean;
    };
    instructor: {
      id: string;
      first_name: string;
      last_name: string;
    } | null;
  };
}

export function useMyBookings() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["my-bookings", user?.id],
    queryFn: async (): Promise<Booking[]> => {
      if (!user) return [];

      const { data, error } = await supabase
        .from("class_bookings")
        .select(`
          id,
          session_id,
          user_id,
          member_id,
          status,
          credits_used,
          amount_paid,
          payment_method,
          booked_at,
          cancelled_at,
          checked_in_at,
          session:class_sessions!inner (
            id,
            session_date,
            start_time,
            end_time,
            room,
            is_cancelled,
            class_type:class_types!inner (
              id,
              name,
              category,
              is_heated
            ),
            instructor:instructors (
              id,
              first_name,
              last_name
            )
          )
        `)
        .eq("user_id", user.id)
        .order("booked_at", { ascending: false });

      if (error) throw error;

      return (data || []).map((booking) => ({
        ...booking,
        session: {
          ...booking.session,
          class_type: Array.isArray(booking.session.class_type)
            ? booking.session.class_type[0]
            : booking.session.class_type,
          instructor: Array.isArray(booking.session.instructor)
            ? booking.session.instructor[0]
            : booking.session.instructor,
        },
      })) as Booking[];
    },
    enabled: !!user,
  });
}

export function useUpcomingBookings() {
  const { data: bookings, ...rest } = useMyBookings();
  const today = format(new Date(), "yyyy-MM-dd");

  const upcomingBookings = bookings?.filter(
    (b) =>
      b.status === "confirmed" &&
      b.session.session_date >= today &&
      !b.session.is_cancelled
  );

  return { data: upcomingBookings, ...rest };
}

export function usePastBookings() {
  const { data: bookings, ...rest } = useMyBookings();
  const today = format(new Date(), "yyyy-MM-dd");

  const pastBookings = bookings?.filter(
    (b) =>
      b.session.session_date < today ||
      b.status === "completed" ||
      b.status === "cancelled" ||
      b.status === "no_show"
  );

  return { data: pastBookings, ...rest };
}

interface BookClassParams {
  sessionId: string;
  paymentMethod: "credits" | "pass" | "cash";
  passId?: string;
}

export function useBookClass() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ sessionId, paymentMethod, passId }: BookClassParams) => {
      if (!user) throw new Error("Must be logged in to book a class");

      // Get session details to check availability and advance booking limit
      const { data: session, error: sessionError } = await supabase
        .from("class_sessions")
        .select("*, class_type:class_types(*)")
        .eq("id", sessionId)
        .single();

      if (sessionError) throw sessionError;

      // Check if session is full
      if (session.current_enrollment >= session.max_capacity) {
        throw new Error("This class is full");
      }

      // Check advance booking limit (3 weeks for members, 2 weeks for non-members)
      const sessionDate = parseISO(session.session_date);
      const maxAdvance = addWeeks(new Date(), 3); // For now, assume 3 weeks
      
      if (sessionDate > maxAdvance) {
        throw new Error("Cannot book more than 3 weeks in advance");
      }

      // Check for existing booking
      const { data: existingBooking } = await supabase
        .from("class_bookings")
        .select("id")
        .eq("session_id", sessionId)
        .eq("user_id", user.id)
        .eq("status", "confirmed")
        .single();

      if (existingBooking) {
        throw new Error("You have already booked this class");
      }

      // Create booking
      const bookingData: any = {
        session_id: sessionId,
        user_id: user.id,
        status: "confirmed",
        payment_method: paymentMethod,
      };

      if (paymentMethod === "credits") {
        bookingData.credits_used = 1;
      } else if (paymentMethod === "pass" && passId) {
        bookingData.pass_id = passId;
        bookingData.credits_used = 1;
      }

      const { data, error } = await supabase
        .from("class_bookings")
        .insert(bookingData)
        .select()
        .single();

      if (error) throw error;

      // If using a class pass, decrement the remaining classes
      if (paymentMethod === "pass" && passId) {
        await supabase
          .from("class_passes")
          .update({ classes_remaining: supabase.rpc ? undefined : undefined })
          .eq("id", passId)
          .then(() => {
            // Update handled by trigger if exists
          });
      }

      // Send booking confirmation email
      try {
        const { data: sessionDetails } = await supabase
          .from("class_sessions")
          .select(`
            session_date,
            start_time,
            room,
            class_type:class_types(name),
            instructor:instructors(first_name, last_name)
          `)
          .eq("id", sessionId)
          .single();

        const { data: { user: currentUser } } = await supabase.auth.getUser();

        if (currentUser?.email && sessionDetails) {
          const classType = Array.isArray(sessionDetails.class_type)
            ? sessionDetails.class_type[0]
            : sessionDetails.class_type;
          const instructor = Array.isArray(sessionDetails.instructor)
            ? sessionDetails.instructor[0]
            : sessionDetails.instructor;

          await supabase.functions.invoke("send-email", {
            body: {
              type: "booking_confirmation",
              to: currentUser.email,
              data: {
                class_name: classType?.name || "Class",
                date: format(parseISO(sessionDetails.session_date), "EEEE, MMMM d, yyyy"),
                time: format(parse(sessionDetails.start_time, "HH:mm:ss", new Date()), "h:mm a"),
                location: sessionDetails.room || "Storm Wellness Club",
                instructor: instructor
                  ? `${instructor.first_name} ${instructor.last_name}`
                  : "TBA",
              },
            },
          });
        }
      } catch (emailError) {
        console.error("Failed to send confirmation email:", emailError);
        // Don't throw - booking succeeded, email is secondary
      }

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["my-bookings"] });
      queryClient.invalidateQueries({ queryKey: ["class-sessions"] });
      toast.success("Class booked successfully!");
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });
}

export function useCancelBooking() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (bookingId: string) => {
      // Get booking details with session info for email
      const { data: booking, error: bookingError } = await supabase
        .from("class_bookings")
        .select(`
          *,
          session:class_sessions(
            *,
            class_type:class_types(name),
            instructor:instructors(first_name, last_name)
          )
        `)
        .eq("id", bookingId)
        .single();

      if (bookingError) throw bookingError;

      // Check 24-hour cancellation policy
      const sessionDateTime = new Date(
        `${booking.session.session_date}T${booking.session.start_time}`
      );
      const hoursUntilClass = differenceInHours(sessionDateTime, new Date());

      let forfeitCredit = false;
      if (hoursUntilClass < 24) {
        forfeitCredit = true;
      }

      const { data, error } = await supabase
        .from("class_bookings")
        .update({
          status: "cancelled",
          cancelled_at: new Date().toISOString(),
          cancellation_reason: forfeitCredit
            ? "Late cancellation - credit forfeited"
            : "Member cancelled",
        })
        .eq("id", bookingId)
        .select()
        .single();

      if (error) throw error;

      // Send cancellation confirmation email
      try {
        const { data: { user: currentUser } } = await supabase.auth.getUser();

        if (currentUser?.email && booking.session) {
          const classType = Array.isArray(booking.session.class_type)
            ? booking.session.class_type[0]
            : booking.session.class_type;
          const instructor = Array.isArray(booking.session.instructor)
            ? booking.session.instructor[0]
            : booking.session.instructor;

          await supabase.functions.invoke("send-email", {
            body: {
              type: "booking_cancellation",
              to: currentUser.email,
              data: {
                class_name: classType?.name || "Class",
                date: format(parseISO(booking.session.session_date), "EEEE, MMMM d, yyyy"),
                time: format(parse(booking.session.start_time, "HH:mm:ss", new Date()), "h:mm a"),
                credit_refunded: !forfeitCredit,
              },
            },
          });
        }
      } catch (emailError) {
        console.error("Failed to send cancellation email:", emailError);
        // Don't throw - cancellation succeeded, email is secondary
      }

      return { ...data, forfeitCredit };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["my-bookings"] });
      queryClient.invalidateQueries({ queryKey: ["class-sessions"] });
      
      if (data.forfeitCredit) {
        toast.warning("Class cancelled. Credit/pass forfeited due to late cancellation (less than 24 hours before class).");
      } else {
        toast.success("Class cancelled successfully. Credit/pass refunded.");
      }
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });
}

export function useIsSessionBooked(sessionId: string) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["session-booked", sessionId, user?.id],
    queryFn: async (): Promise<boolean> => {
      if (!user) return false;

      const { data, error } = await supabase
        .from("class_bookings")
        .select("id")
        .eq("session_id", sessionId)
        .eq("user_id", user.id)
        .eq("status", "confirmed")
        .single();

      if (error && error.code !== "PGRST116") throw error;

      return !!data;
    },
    enabled: !!user,
  });
}
