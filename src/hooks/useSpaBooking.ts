import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { format, addMinutes, parseISO, parse } from "date-fns";

export interface SpaAppointment {
  id: string;
  member_id: string | null;
  user_id: string | null;
  service_id: string;
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
  serviceId: string;
  serviceName: string;
  serviceCategory: string;
  servicePrice: number;
  appointmentDate: Date;
  appointmentTime: string; // "HH:mm" format
  durationMinutes: number;
  cleanupMinutes?: number;
  memberNotes?: string;
  paymentMethod: "card" | "member_account" | "credit";
  paymentIntentId?: string;
  staffId?: string;
  creditType?: "red_light" | "dry_cryo";
  creditId?: string;
}

interface CheckAvailabilityParams {
  appointmentDate: Date;
  appointmentTime: string;
  durationMinutes: number;
  staffId?: string;
  roomId?: string;
}

export function useSpaBookAppointment() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: BookSpaAppointmentParams) => {
      if (!user) {
        throw new Error("You must be signed in to book an appointment");
      }

      // Check for conflicts only when a specific staff member is assigned
      // Without a staff/room constraint, member bookings shouldn't globally block slots
      if (params.staffId) {
        try {
          const appointmentTimeStr = format(parse(params.appointmentTime, "HH:mm", new Date()), "HH:mm:ss");
          const { data: conflictCheck, error: conflictError } = await (supabase.rpc as any)('check_spa_appointment_conflict', {
            p_appointment_date: format(params.appointmentDate, "yyyy-MM-dd"),
            p_appointment_time: appointmentTimeStr,
            p_duration_minutes: params.durationMinutes,
            p_cleanup_minutes: params.cleanupMinutes || 15,
            p_staff_id: params.staffId,
            p_exclude_appointment_id: null
          });

          if (conflictError) {
            if (!(conflictError.code === "42883" || conflictError.message?.includes("does not exist"))) {
              throw conflictError;
            }
          } else if (conflictCheck && conflictCheck.length > 0 && conflictCheck[0].has_conflict) {
            throw new Error('This time slot is already booked. Please select a different time.');
          }
        } catch (error: any) {
          if (error?.message?.includes('already booked')) {
            throw error;
          }
          // For other errors (missing function, etc.), allow booking to proceed
          console.warn('Conflict check skipped:', error?.message);
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
    mutationFn: async ({ appointmentDate, appointmentTime, durationMinutes, staffId, roomId }: CheckAvailabilityParams) => {
      const timeObj = parse(appointmentTime, "HH:mm", new Date());
      const appointmentDateTime = new Date(appointmentDate);
      appointmentDateTime.setHours(timeObj.getHours(), timeObj.getMinutes(), 0, 0);
      const endDateTime = addMinutes(appointmentDateTime, durationMinutes + 15);

      const checkOverlap = (data: any[]) => {
        return (data || []).filter((apt: any) => {
          const aptStart = parse(apt.appointment_time, "HH:mm:ss", new Date());
          const aptStartFull = new Date(appointmentDate);
          aptStartFull.setHours(aptStart.getHours(), aptStart.getMinutes(), 0, 0);
          const aptEnd = addMinutes(aptStartFull, (apt.duration_minutes || 60) + (apt.cleanup_minutes || 15));

          return (
            (appointmentDateTime >= aptStartFull && appointmentDateTime < aptEnd) ||
            (endDateTime > aptStartFull && endDateTime <= aptEnd) ||
            (appointmentDateTime <= aptStartFull && endDateTime >= aptEnd)
          );
        });
      };

      try {
        let allConflicting: any[] = [];

        // Check therapist conflicts
        if (staffId) {
          let query = (supabase.from as any)("spa_appointments")
            .select("id, appointment_time, duration_minutes, cleanup_minutes, service_name, staff_id, room_id")
            .eq("appointment_date", format(appointmentDate, "yyyy-MM-dd"))
            .in("status", ["confirmed", "pending"])
            .eq("staff_id", staffId);

          const { data, error } = await query;

          if (error) {
            if (!(error.code === "42P01" || error.message?.includes("does not exist"))) {
              throw error;
            }
          } else {
            allConflicting.push(...checkOverlap(data));
          }
        }

        // Check room conflicts
        if (roomId) {
          let query = (supabase.from as any)("spa_appointments")
            .select("id, appointment_time, duration_minutes, cleanup_minutes, service_name, staff_id, room_id")
            .eq("appointment_date", format(appointmentDate, "yyyy-MM-dd"))
            .in("status", ["confirmed", "pending"])
            .eq("room_id", roomId);

          const { data, error } = await query;

          if (error) {
            if (!(error.code === "42P01" || error.message?.includes("does not exist"))) {
              throw error;
            }
          } else {
            const roomConflicts = checkOverlap(data);
            // Deduplicate by id
            const existingIds = new Set(allConflicting.map((c: any) => c.id));
            for (const rc of roomConflicts) {
              if (!existingIds.has(rc.id)) {
                allConflicting.push({ ...rc, _conflictType: "room" });
              }
            }
          }
        }

        return {
          available: allConflicting.length === 0,
          conflictingAppointments: allConflicting,
        };
      } catch (error: any) {
        if (error?.code === "42P01" || error?.message?.includes("does not exist")) {
          return { available: true, conflictingAppointments: [] };
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



