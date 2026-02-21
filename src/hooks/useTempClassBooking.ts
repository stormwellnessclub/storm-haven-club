import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useUserCredits } from "@/hooks/useUserCredits";
import { useMyBookings } from "@/hooks/useBooking";
import { toast } from "sonner";
import { format } from "date-fns";

function parseTimeToDb(timeStr: string): string {
  const [time, period] = timeStr.split(" ");
  let [hours, minutes] = time.split(":").map(Number);
  if (period === "PM" && hours !== 12) hours += 12;
  if (period === "AM" && hours === 12) hours = 0;
  return `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}:00`;
}

function addMinutesToTime(dbTime: string, mins: number): string {
  const [h, m] = dbTime.split(":").map(Number);
  const totalMin = h * 60 + m + mins;
  const newH = Math.floor(totalMin / 60) % 24;
  const newM = totalMin % 60;
  return `${newH.toString().padStart(2, "0")}:${newM.toString().padStart(2, "0")}:00`;
}

export function useTempClassBooking() {
  const { user } = useAuth();
  const { data: credits } = useUserCredits();
  const { data: bookings = [] } = useMyBookings();
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const validPasses =
    credits?.classPasses.filter(
      (p) =>
        p.classes_remaining > 0 &&
        ["reformer", "cycling", "pilates_cycling"].includes(p.category)
    ) || [];

  const hasClassCredits =
    credits?.isMember &&
    credits?.memberStatus === "active" &&
    credits?.classCredits &&
    credits.classCredits.credits_remaining > 0;

  const hasValidPass = validPasses.length > 0;
  const canBook = hasValidPass || !!hasClassCredits;
  const isMember = !!credits?.isMember;

  const bookedKeys = new Set(
    bookings
      .filter((b) => b.status === "confirmed")
      .map((b) => `${b.session.session_date}_${b.session.start_time}`)
  );

  const isBooked = (date: Date, time: string) => {
    const dateStr = format(date, "yyyy-MM-dd");
    const dbTime = parseTimeToDb(time);
    return bookedKeys.has(`${dateStr}_${dbTime}`);
  };

  const bookMutation = useMutation({
    mutationFn: async ({
      className,
      date,
      time,
    }: {
      className: string;
      date: Date;
      time: string;
    }) => {
      if (!user) throw new Error("Please sign in to book a class.");

      const {
        data: { session: authSession },
      } = await supabase.auth.getSession();
      if (!authSession) throw new Error("Session expired. Please sign in again.");

      const dbTime = parseTimeToDb(time);
      const endTime = addMinutesToTime(dbTime, 50);
      const dateStr = format(date, "yyyy-MM-dd");

      const { data: sessionId, error: sessionError } = await (supabase.rpc as any)(
        "find_or_create_temp_class_session",
        {
          _class_name: className,
          _session_date: dateStr,
          _start_time: dbTime,
          _end_time: endTime,
          _max_capacity: 8,
        }
      );

      if (sessionError) throw sessionError;
      if (!sessionId) throw new Error("Failed to create class session");

      let paymentMethod: string;
      let memberCreditId: string | null = null;
      let passId: string | null = null;

      if (hasValidPass) {
        paymentMethod = "pass";
        passId = validPasses[0].id;
      } else if (hasClassCredits && credits?.classCredits) {
        paymentMethod = "credits";
        memberCreditId = credits.classCredits.id;
      } else {
        throw new Error("No valid class pass or credits available.");
      }

      const { data: result, error: bookError } = await (supabase.rpc as any)(
        "create_atomic_class_booking",
        {
          _session_id: sessionId,
          _user_id: user.id,
          _payment_method: paymentMethod,
          _member_credit_id: memberCreditId,
          _pass_id: passId,
        }
      );

      if (bookError) throw bookError;
      if (!result?.success) throw new Error(result?.error || "Booking failed");

      // Send confirmation email (fire-and-forget)
      const formattedDate = format(date, "EEEE, MMM d, yyyy");
      supabase.functions.invoke("send-email", {
        body: {
          type: "booking_confirmation",
          to: user.email,
          data: {
            class_name: className,
            date: formattedDate,
            time,
            location: "Reformer Studio",
          },
        },
      }).catch(() => {});

      return { className, date, time, formattedDate };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["my-bookings"] });
      queryClient.invalidateQueries({ queryKey: ["user-credits"] });
      queryClient.invalidateQueries({ queryKey: ["class-sessions"] });
      queryClient.invalidateQueries({ queryKey: ["temp-schedule-enrollment"] });
      queryClient.invalidateQueries({ queryKey: ["soft-launch-sessions"] });
      queryClient.invalidateQueries({ queryKey: ["portal-bookings"] });

      const bookingsPath = isMember ? "/member/bookings" : "/portal/bookings";

      toast.success("Booking Confirmed ✅", {
        description: `${data.className} — ${data.formattedDate} at ${data.time}`,
        duration: 8000,
        action: {
          label: "View Bookings",
          onClick: () => navigate(bookingsPath),
        },
      });
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  return {
    isLoggedIn: !!user,
    canBook,
    hasValidPass,
    hasClassCredits: !!hasClassCredits,
    validPasses,
    isBooked,
    bookClass: bookMutation.mutate,
    isBooking: bookMutation.isPending,
  };
}
