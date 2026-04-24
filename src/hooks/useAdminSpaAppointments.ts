import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { SpaAppointment } from "./useSpaBooking";

export interface SpaCustomer {
  type: "member" | "non_member" | "guest";
  id: string | null;
  first_name: string;
  last_name: string;
  email: string | null;
  stripe_customer_id?: string | null;
  card_last4?: string | null;
  card_brand?: string | null;
}

export interface AdminSpaAppointment extends SpaAppointment {
  member?: {
    id: string;
    first_name: string;
    last_name: string;
    email: string;
    stripe_customer_id?: string | null;
    card_last4?: string | null;
    card_brand?: string | null;
  } | null;
  user?: {
    id: string;
    email: string;
  } | null;
  staff?: {
    id: string;
    full_name: string;
  } | null;
  /** Unified customer info — works for members, non-members, and walk-in guests */
  customer?: SpaCustomer | null;
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
            member:members(id, first_name, last_name, email, stripe_customer_id, card_last4, card_brand),
            staff:spa_therapists(id, full_name)
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
          const d = filters.appointmentDate;
          const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
          query = query.eq("appointment_date", dateStr);
        }

        if (filters?.dateFrom) {
          const d = filters.dateFrom;
          const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
          query = query.gte("appointment_date", dateStr);
        }

        if (filters?.dateTo) {
          const d = filters.dateTo;
          const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
          query = query.lte("appointment_date", dateStr);
        }

        const { data, error } = await query;

        if (error) {
          if (error.code === "42P01" || error.message?.includes("does not exist")) {
            console.warn("spa_appointments table not found, returning empty array");
            return [];
          }
          throw error;
        }

        const rawRows = (data || []).map((apt: any) => ({
          ...apt,
          member: apt.member ? (Array.isArray(apt.member) ? apt.member[0] : apt.member) : null,
          user: null,
          staff: apt.staff ? (Array.isArray(apt.staff) ? apt.staff[0] : apt.staff) : null,
        }));

        // For appointments without a member but with a user_id, fetch non_member_profiles
        const nonMemberUserIds = Array.from(
          new Set(
            rawRows
              .filter((r: any) => !r.member && r.user_id)
              .map((r: any) => r.user_id)
          )
        );

        let nonMemberMap: Record<string, any> = {};
        if (nonMemberUserIds.length > 0) {
          try {
            const { data: nmData } = await (supabase.from as any)("non_member_profiles")
              .select("user_id, first_name, last_name, email, stripe_customer_id, card_brand, card_last4")
              .in("user_id", nonMemberUserIds);
            (nmData || []).forEach((nm: any) => {
              nonMemberMap[nm.user_id] = nm;
            });
          } catch (e) {
            console.warn("Failed to fetch non_member_profiles fallback", e);
          }
        }

        return rawRows.map((apt: any): AdminSpaAppointment => {
          let customer: SpaCustomer | null = null;
          if (apt.member) {
            customer = {
              type: "member",
              id: apt.member.id,
              first_name: apt.member.first_name,
              last_name: apt.member.last_name,
              email: apt.member.email,
              stripe_customer_id: apt.member.stripe_customer_id ?? null,
              card_brand: apt.member.card_brand ?? null,
              card_last4: apt.member.card_last4 ?? null,
            };
          } else if (apt.user_id && nonMemberMap[apt.user_id]) {
            const nm = nonMemberMap[apt.user_id];
            customer = {
              type: "non_member",
              id: nm.user_id,
              first_name: nm.first_name || "",
              last_name: nm.last_name || "",
              email: nm.email || null,
              stripe_customer_id: nm.stripe_customer_id ?? null,
              card_brand: nm.card_brand ?? null,
              card_last4: nm.card_last4 ?? null,
            };
          } else {
            // Walk-in guest — try to extract from staff_notes header line "Guest: Name <email>"
            const notes: string = apt.staff_notes || "";
            const match = notes.match(/^Guest:\s*([^<\n]+?)(?:\s*<([^>]+)>)?\s*$/m);
            if (match) {
              const fullName = match[1].trim();
              const parts = fullName.split(" ");
              customer = {
                type: "guest",
                id: null,
                first_name: parts[0] || "Guest",
                last_name: parts.slice(1).join(" ") || "",
                email: match[2] || null,
              };
            }
          }
          return { ...apt, customer };
        }) as AdminSpaAppointment[];
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
