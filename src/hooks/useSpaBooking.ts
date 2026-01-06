import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { format, addMinutes, parseISO, parse } from "date-fns";

export interface SpaAppointment {
  id: string;
  member_id: string | null;
  user_id: string | null;
  service_id: number;
  service_name: string;
  service_category: string;
  service_price: number;
  member_price: number | null;
  appointment_date: string;
  appointment_time: string;
  duration_minutes: number;
  cleanup_minutes: number;
  status: "confirmed" | "completed" | "cancelled" | "no_show";
  staff_id: string | null;
  staff_notes: string | null;
  member_notes: string | null;
  payment_method: string | null;
  payment_intent_id: string | null;
  amount_paid: number | null;
  created_at: string;
  updated_at: string;
  cancelled_at: string | null;
  checked_in_at: string | null;
  completed_at: string | null;
}

interface BookSpaAppointmentParams {
  serviceId: number;
  serviceName: string;
  serviceCategory: string;
  servicePrice: number;
  appointmentDate: Date;
  appointmentTime: string; // "HH:mm" format
  durationMinutes: number;
  cleanupMinutes?: number;
  memberNotes?: string;
  paymentMethod: "card" | "member_account";
  paymentIntentId?: string;
  staffId?: string;
}

interface CheckAvailabilityParams {
  appointmentDate: Date;
  appointmentTime: string;
  durationMinutes: number;
  staffId?: string;
}

export function useSpaBookAppointment() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: BookSpaAppointmentParams) => {
      if (!user) {
        throw new Error("You must be signed in to book an appointment");
      }

      // Check availability first
      const timeObj = parse(params.appointmentTime, "HH:mm", new Date());
      const appointmentDateTime = new Date(params.appointmentDate);
      appointmentDateTime.setHours(timeObj.getHours(), timeObj.getMinutes(), 0, 0);
      const endDateTime = addMinutes(appointmentDateTime, params.durationMinutes + (params.cleanupMinutes || 15));

      // Check for overlapping appointments
      try {
        const { data: conflictingAppointments, error: conflictError } = await (supabase.from as any)("spa_appointments")
          .select("id")
          .eq("appointment_date", format(params.appointmentDate, "yyyy-MM-dd"))
          .in("status", ["confirmed", "pending"])
          .or(
            params.staffId
              ? `and(staff_id.eq.${params.staffId},appointment_time.lte.${format(endDateTime, "HH:mm:ss")})`
              : `appointment_time.lte.${format(endDateTime, "HH:mm:ss")}`
          );

        if (conflictError) {
          if (conflictError.code === "42P01" || conflictError.message?.includes("does not exist")) {
            // Table doesn't exist yet, skip conflict check
          } else {
            throw conflictError;
          }
        }
      } catch (error: any) {
        if (error?.code === "42P01" || error?.message?.includes("does not exist")) {
          // Table doesn't exist yet, skip conflict check
        } else {
          throw error;
        }
      }

      // Get member_id if user is a member
      const { data: memberData } = await supabase
        .from("members")
        .select("id, membership_type")
        .eq("user_id", user.id)
        .maybeSingle();

      // Calculate price (apply member discount if applicable)
      let finalPrice = params.servicePrice;
      let memberPrice = null;

      if (memberData) {
        // Apply member discount based on tier
        const tier = memberData.membership_type?.toLowerCase() || "";
        let discount = 0;
        if (tier.includes("diamond")) discount = 0.12;
        else if (tier.includes("platinum")) discount = 0.10;
        else if (tier.includes("gold")) discount = 0.08;
        else if (tier.includes("silver")) discount = 0.05;

        if (discount > 0) {
          memberPrice = Math.round(params.servicePrice * (1 - discount) * 100) / 100;
          finalPrice = memberPrice;
        }
      }

      // Create appointment
      try {
        const { data, error } = await (supabase.from as any)("spa_appointments")
          .insert({
            user_id: user.id,
            member_id: memberData?.id || null,
            service_id: params.serviceId,
            service_name: params.serviceName,
            service_category: params.serviceCategory,
            service_price: params.servicePrice,
            member_price: memberPrice,
            appointment_date: format(params.appointmentDate, "yyyy-MM-dd"),
            appointment_time: format(parse(params.appointmentTime, "HH:mm", new Date()), "HH:mm:ss"),
            duration_minutes: params.durationMinutes,
            cleanup_minutes: params.cleanupMinutes || 15,
            status: "confirmed",
            member_notes: params.memberNotes || null,
            payment_method: params.paymentMethod,
            payment_intent_id: params.paymentIntentId || null,
            amount_paid: finalPrice,
            staff_id: params.staffId || null,
          })
          .select()
          .single();

        if (error) {
          if (error.code === "42P01" || error.message?.includes("does not exist")) {
            throw new Error("Spa appointments are not yet available. Please check back later.");
          }
          throw error;
        }

        return data as SpaAppointment;
      } catch (error: any) {
        if (error?.code === "42P01" || error?.message?.includes("does not exist")) {
          throw new Error("Spa appointments are not yet available. Please check back later.");
        }
        throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["spa-appointments"] });
      toast.success("Spa appointment booked successfully!");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to book appointment");
    },
  });
}

export function useCheckSpaAvailability() {
  return useMutation({
    mutationFn: async ({ appointmentDate, appointmentTime, durationMinutes, staffId }: CheckAvailabilityParams) => {
      const timeObj = parse(appointmentTime, "HH:mm", new Date());
      const appointmentDateTime = new Date(appointmentDate);
      appointmentDateTime.setHours(timeObj.getHours(), timeObj.getMinutes(), 0, 0);
      const endDateTime = addMinutes(appointmentDateTime, durationMinutes + 15);

      // Check for conflicting appointments
      try {
        let query = (supabase.from as any)("spa_appointments")
          .select("id, appointment_time, duration_minutes")
          .eq("appointment_date", format(appointmentDate, "yyyy-MM-dd"))
          .in("status", ["confirmed", "pending"]);

        if (staffId) {
          query = query.eq("staff_id", staffId);
        }

        const { data, error } = await query;

        if (error) {
          if (error.code === "42P01" || error.message?.includes("does not exist")) {
            // Table doesn't exist yet, return available
            return {
              available: true,
              conflictingAppointments: [],
            };
          }
          throw error;
        }

        // Check if any appointments overlap
        const hasConflict = (data || []).some((apt) => {
          const aptStart = parse(apt.appointment_time, "HH:mm:ss", new Date());
          const aptStartFull = new Date(appointmentDate);
          aptStartFull.setHours(aptStart.getHours(), aptStart.getMinutes(), 0, 0);
          const aptEnd = addMinutes(aptStartFull, apt.duration_minutes + 15);

          return (
            (appointmentDateTime >= aptStartFull && appointmentDateTime < aptEnd) ||
            (endDateTime > aptStartFull && endDateTime <= aptEnd) ||
            (appointmentDateTime <= aptStartFull && endDateTime >= aptEnd)
          );
        });

        return {
          available: !hasConflict,
          conflictingAppointments: data || [],
        };
      } catch (error: any) {
        if (error?.code === "42P01" || error?.message?.includes("does not exist")) {
          // Table doesn't exist yet, return available
          return {
            available: true,
            conflictingAppointments: [],
          };
        }
        throw error;
      }
    },
  });
}

export function useMySpaAppointments() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["spa-appointments", user?.id],
    queryFn: async (): Promise<SpaAppointment[]> => {
      if (!user) return [];

      try {
        const { data, error } = await (supabase.from as any)("spa_appointments")
          .select("*")
          .eq("user_id", user.id)
          .order("appointment_date", { ascending: true })
          .order("appointment_time", { ascending: true });

        if (error) {
          if (error.code === "42P01" || error.message?.includes("does not exist")) {
            console.warn("spa_appointments table not found, returning empty array");
            return [];
          }
          throw error;
        }

        return (data || []) as SpaAppointment[];
      } catch (error: any) {
        if (error?.code === "42P01" || error?.message?.includes("does not exist")) {
          console.warn("spa_appointments table not found, returning empty array");
          return [];
        }
        throw error;
      }
    },
    enabled: !!user,
  });
}

export function useCancelSpaAppointment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ appointmentId, reason }: { appointmentId: string; reason?: string }) => {
      try {
        const { data, error } = await (supabase.from as any)("spa_appointments")
          .update({
            status: "cancelled",
            cancelled_at: new Date().toISOString(),
            cancellation_reason: reason || "Cancelled by member",
            updated_at: new Date().toISOString(),
          })
          .eq("id", appointmentId)
          .select()
          .single();

        if (error) {
          if (error.code === "42P01" || error.message?.includes("does not exist")) {
            throw new Error("Spa appointments are not yet available. Please check back later.");
          }
          throw error;
        }

        return data as SpaAppointment;
      } catch (error: any) {
        if (error?.code === "42P01" || error?.message?.includes("does not exist")) {
          throw new Error("Spa appointments are not yet available. Please check back later.");
        }
        throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["spa-appointments"] });
      toast.success("Appointment cancelled successfully");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to cancel appointment");
    },
  });
}



