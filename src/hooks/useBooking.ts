import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { format, addWeeks, parseISO, parse } from "date-fns";

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
      category: string;
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
  paymentMethod: "credits" | "pass";
  passId?: string;
}

export function useBookClass() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ sessionId, paymentMethod, passId }: BookClassParams) => {
      // Validate and refresh session to ensure JWT is current for RLS
      const { data: { session: authSession }, error: sessionRefreshError } = 
        await supabase.auth.getSession();
      
      if (sessionRefreshError || !authSession) {
        throw new Error("Your session has expired. Please sign in again.");
      }

      const currentUserId = authSession.user.id;

      // Get session details to check advance booking limit
      const { data: session, error: sessionError } = await supabase
        .from("class_sessions")
        .select("session_date, class_type:class_types(*)")
        .eq("id", sessionId)
        .single();

      if (sessionError) throw sessionError;

      // Check advance booking limit (3 weeks for members, 2 weeks for non-members)
      const sessionDate = parseISO(session.session_date);
      const maxAdvance = addWeeks(new Date(), 3); // For now, assume 3 weeks
      
      if (sessionDate > maxAdvance) {
        throw new Error("Cannot book more than 3 weeks in advance");
      }

      // Validate agreements for pass-based bookings
      if (paymentMethod === "pass" && passId) {
        const { data: pass, error: passError } = await supabase
          .from("class_passes")
          .select("pass_type")
          .eq("id", passId)
          .single();

        if (passError) throw passError;
        if (!pass) throw new Error("Invalid pass");

        const isGuestPass = pass.pass_type?.toLowerCase().includes("guest") || 
                           pass.pass_type?.toLowerCase().includes("day") ||
                           pass.pass_type === "guest_pass";
        
        const isSingleClassPass = pass.pass_type?.toLowerCase().includes("single") ||
                                  pass.pass_type === "single_class_pass";
        
        if (isGuestPass || isSingleClassPass) {
          // Check if user has signed the required agreement
          const { data: profile, error: profileError } = await (supabase
            .from("profiles")
            .select("guest_pass_agreement_signed, single_class_pass_agreement_signed")
            .eq("user_id", currentUserId)
            .single() as any);

          if (profileError) throw profileError;
          
          if (isGuestPass && (!profile || !(profile as any).guest_pass_agreement_signed)) {
            throw new Error("Guest Pass Agreement required. Please sign the agreement on the Waivers & Agreements page before booking.");
          }
          
          if (isSingleClassPass && (!profile || !(profile as any).single_class_pass_agreement_signed)) {
            throw new Error("Single Class Pass Agreement required. Please sign the agreement on the Waivers & Agreements page before booking.");
          }
        }
      }

      // Prepare variables for atomic booking function
      let memberCreditId: string | null = null;
      let passIdToUse: string | null = passId || null;

      // Find credit ID if using credits payment
      if (paymentMethod === "credits") {
        const { data: credit, error: creditError } = await supabase
          .from("member_credits")
          .select("id")
          .eq("user_id", currentUserId)
          .eq("credit_type", "class")
          .gt("expires_at", new Date().toISOString())
          .gt("credits_remaining", 0)
          .order("expires_at", { ascending: true })
          .limit(1)
          .maybeSingle();

        if (creditError) throw creditError;
        if (!credit) throw new Error("No available class credits");

        memberCreditId = credit.id;
      }

      // Use atomic booking function to prevent race conditions
      let bookingResult: any;
      try {
        const { data, error: bookingFunctionError } = await (supabase.rpc as any)("create_atomic_class_booking", {
          _session_id: sessionId,
          _user_id: currentUserId,
          _payment_method: paymentMethod,
          _member_credit_id: memberCreditId,
          _pass_id: passIdToUse,
        });

        if (bookingFunctionError) {
          if (bookingFunctionError.code === "42883" || bookingFunctionError.message?.includes("does not exist")) {
            throw new Error("Class booking system is temporarily unavailable. Please try again later.");
          }
          throw bookingFunctionError;
        }

        bookingResult = data;
      } catch (error: any) {
        if (error?.code === "42883" || error?.message?.includes("does not exist")) {
          throw new Error("Class booking system is temporarily unavailable. Please try again later.");
        }
        throw error;
      }

      const result = bookingResult as { success: boolean; error?: string; booking_id?: string };
      if (!result?.success) {
        throw new Error(result?.error || "Failed to create booking");
      }

      // Get the created booking for return value and email
      const { data: booking, error: fetchBookingError } = await supabase
        .from("class_bookings")
        .select("*")
        .eq("id", result.booking_id!)
        .single();

      if (fetchBookingError) throw fetchBookingError;

      // Check if user is claiming from waitlist (has 'notified' status for this session)
      const { data: waitlistEntry } = await supabase
        .from("class_waitlist")
        .select("id, status")
        .eq("session_id", sessionId)
        .eq("user_id", currentUserId)
        .eq("status", "notified")
        .maybeSingle();

      const isWaitlistClaim = !!waitlistEntry;

      // If claiming from waitlist, update the waitlist entry to 'claimed'
      if (isWaitlistClaim && waitlistEntry) {
        await supabase
          .from("class_waitlist")
          .update({
            status: "claimed",
            claimed_at: new Date().toISOString(),
          })
          .eq("id", waitlistEntry.id);
      }

      // Send booking confirmation email (or waitlist claim confirmation)
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

          // Send different email based on whether this was a waitlist claim
          await supabase.functions.invoke("send-email", {
            body: {
              type: isWaitlistClaim ? "waitlist_claim_confirmation" : "booking_confirmation",
              to: currentUser.email,
              data: {
                class_name: classType?.name || "Class",
                className: classType?.name || "Class",
                date: format(parseISO(sessionDetails.session_date), "EEEE, MMMM d, yyyy"),
                time: format(parse(sessionDetails.start_time, "HH:mm:ss", new Date()), "h:mm a"),
                room: sessionDetails.room || undefined,
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

      return booking;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["my-bookings"] });
      queryClient.invalidateQueries({ queryKey: ["class-sessions"] });
      queryClient.invalidateQueries({ queryKey: ["user-credits"] });
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
      // Validate and refresh session to ensure JWT is current for RLS
      const { data: { session: authSession }, error: sessionRefreshError } = 
        await supabase.auth.getSession();
      
      if (sessionRefreshError || !authSession) {
        throw new Error("Your session has expired. Please sign in again.");
      }

      // Use atomic RPC to cancel booking and restore credits in one transaction
      const { data: result, error: rpcError } = await (supabase.rpc as any)("cancel_class_booking", {
        _booking_id: bookingId,
      });

      if (rpcError) {
        if (rpcError.code === "42883" || rpcError.message?.includes("does not exist")) {
          throw new Error("Cancellation system is temporarily unavailable. Please try again later.");
        }
        throw rpcError;
      }

      const cancelResult = result as {
        success: boolean;
        error?: string;
        forfeit_credit?: boolean;
        session_id?: string;
        session_date?: string;
        start_time?: string;
        room?: string;
        class_name?: string;
        instructor_name?: string;
      };

      if (!cancelResult?.success) {
        throw new Error(cancelResult?.error || "Failed to cancel booking");
      }

      // Send cancellation confirmation email (secondary - don't block on failure)
      try {
        const { data: { user: currentUser } } = await supabase.auth.getUser();

        if (currentUser?.email && cancelResult.session_date) {
          await supabase.functions.invoke("send-email", {
            body: {
              type: "booking_cancellation",
              to: currentUser.email,
              data: {
                className: cancelResult.class_name || "Class",
                date: format(parseISO(cancelResult.session_date), "EEEE, MMMM d, yyyy"),
                time: format(parse(cancelResult.start_time || "00:00:00", "HH:mm:ss", new Date()), "h:mm a"),
                creditRefunded: !cancelResult.forfeit_credit,
              },
            },
          });
        }
      } catch (emailError) {
        console.error("Failed to send cancellation email:", emailError);
      }

      // Notify next person on waitlist
      try {
        if (cancelResult.session_id) {
          await supabase.functions.invoke("notify-waitlist", {
            body: { session_id: cancelResult.session_id },
          });
        }
      } catch (waitlistError) {
        console.error("Failed to notify waitlist:", waitlistError);
      }

      return { forfeitCredit: cancelResult.forfeit_credit };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["my-bookings"] });
      queryClient.invalidateQueries({ queryKey: ["class-sessions"] });
      queryClient.invalidateQueries({ queryKey: ["user-credits"] });
      
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
