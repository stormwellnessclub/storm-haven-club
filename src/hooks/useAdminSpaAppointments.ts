import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { SpaAppointment } from "./useSpaBooking";

export interface AdminSpaAppointment extends SpaAppointment {
  member?: {
    id: string;
    first_name: string;
    last_name: string;
    email: string;
  } | null;
  user?: {
    id: string;
    email: string;
  } | null;
  staff?: {
    id: string;
    full_name: string;
  } | null;
}

interface AdminSpaAppointmentsFilters {
  status?: string;
  memberId?: string;
  staffId?: string;
  dateFrom?: Date;
  dateTo?: Date;
  appointmentDate?: Date;
}

export function useAdminSpaAppointments(filters?: AdminSpaAppointmentsFilters) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["admin-spa-appointments", filters],
    queryFn: async (): Promise<AdminSpaAppointment[]> => {
      if (!user) return [];

      try {
        let query = (supabase.from as any)("spa_appointments")
          .select(`
            *,
            member:members(id, first_name, last_name, email)
          `)
          .order("appointment_date", { ascending: true })
          .order("appointment_time", { ascending: true });

        if (filters?.status) {
          query = query.eq("status", filters.status);
        }

        if (filters?.memberId) {
          query = query.eq("member_id", filters.memberId);
        }

        if (filters?.staffId) {
          query = query.eq("staff_id", filters.staffId);
        }

        if (filters?.appointmentDate) {
          query = query.eq("appointment_date", filters.appointmentDate.toISOString().split("T")[0]);
        }

        if (filters?.dateFrom) {
          query = query.gte("appointment_date", filters.dateFrom.toISOString().split("T")[0]);
        }

        if (filters?.dateTo) {
          query = query.lte("appointment_date", filters.dateTo.toISOString().split("T")[0]);
        }

        const { data, error } = await query;

        if (error) {
          if (error.code === "42P01" || error.message?.includes("does not exist")) {
            console.warn("spa_appointments table not found, returning empty array");
            return [];
          }
          throw error;
        }

        return (data || []).map((apt: any) => ({
          ...apt,
          member: apt.member ? (Array.isArray(apt.member) ? apt.member[0] : apt.member) : null,
          user: null, // User info can be fetched separately if needed
          staff: null, // Staff info can be fetched separately if needed
        })) as AdminSpaAppointment[];
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

export function useUpdateSpaAppointmentStatus() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({ 
      appointmentId, 
      status,
      staffNotes 
    }: { 
      appointmentId: string; 
      status: string;
      staffNotes?: string;
    }) => {
      if (!user) throw new Error("You must be signed in");

      const updateData: any = {
        status,
        updated_at: new Date().toISOString(),
      };

      if (status === "completed") {
        updateData.completed_at = new Date().toISOString();
      }

      if (status === "confirmed" || status === "checked_in") {
        updateData.checked_in_at = new Date().toISOString();
      }

      if (staffNotes !== undefined) {
        updateData.staff_notes = staffNotes;
      }

      try {
        const { data, error } = await (supabase.from as any)("spa_appointments")
          .update(updateData)
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
      queryClient.invalidateQueries({ queryKey: ["admin-spa-appointments"] });
      queryClient.invalidateQueries({ queryKey: ["spa-appointments"] });
      toast.success("Appointment updated");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to update appointment");
    },
  });
}

