import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { format } from "date-fns";
import { KidsCareBooking } from "./useKidsCareBooking";

export interface AdminKidsCareBooking extends KidsCareBooking {
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
  checkedInByStaff?: {
    id: string;
    full_name: string;
  } | null;
  checkedOutByStaff?: {
    id: string;
    full_name: string;
  } | null;
  child_allergies?: string | null;
  child_medical_conditions?: string | null;
  child_medications?: string | null;
  child_emergency_contact_name?: string | null;
  child_emergency_contact_phone?: string | null;
  child_relationship_to_child?: string | null;
  child_authorized_pickup_persons?: string | null;
  child_special_instructions?: string | null;
  child_photo_release?: boolean | null;
}

interface AdminKidsCareBookingsFilters {
  status?: string;
  memberId?: string;
  bookingDate?: Date;
  dateFrom?: Date;
  dateTo?: Date;
  ageGroup?: string;
}

export function useAdminKidsCareBookings(filters?: AdminKidsCareBookingsFilters) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["admin-kids-care-bookings", filters],
    queryFn: async (): Promise<AdminKidsCareBooking[]> => {
      if (!user) return [];

      const params: Record<string, unknown> = {};

      if (filters?.bookingDate) {
        params.p_booking_date = format(filters.bookingDate, "yyyy-MM-dd");
      }
      if (filters?.dateFrom) {
        params.p_date_from = format(filters.dateFrom, "yyyy-MM-dd");
      }
      if (filters?.dateTo) {
        params.p_date_to = format(filters.dateTo, "yyyy-MM-dd");
      }
      if (filters?.status) {
        params.p_status = filters.status;
      }
      if (filters?.memberId) {
        params.p_member_id = filters.memberId;
      }
      if (filters?.ageGroup) {
        params.p_age_group = filters.ageGroup;
      }

      const { data, error } = await supabase.rpc(
        "get_admin_kids_care_bookings" as any,
        params
      );

      if (error) {
        console.error("Error fetching admin kids care bookings:", error);
        throw error;
      }

      return (data || []).map((row: any) => ({
        ...row,
        member: row.parent_first_name || row.parent_last_name || row.parent_email
          ? {
              id: row.member_id || "",
              first_name: row.parent_first_name || "",
              last_name: row.parent_last_name || "",
              email: row.parent_email || "",
            }
          : null,
        user: null,
        checkedInByStaff: null,
        checkedOutByStaff: null,
        child_allergies: row.child_allergies || null,
        child_medical_conditions: row.child_medical_conditions || null,
        child_medications: row.child_medications || null,
        child_emergency_contact_name: row.child_emergency_contact_name || null,
        child_emergency_contact_phone: row.child_emergency_contact_phone || null,
        child_relationship_to_child: row.child_relationship_to_child || null,
        child_authorized_pickup_persons: row.child_authorized_pickup_persons || null,
        child_special_instructions: row.child_special_instructions || null,
        child_photo_release: row.child_photo_release ?? null,
      })) as AdminKidsCareBooking[];
    },
    enabled: !!user,
  });
}

export function useUpdateKidsCareBookingStatus() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({ 
      bookingId, 
      status 
    }: { 
      bookingId: string; 
      status: string;
    }) => {
      if (!user) throw new Error("You must be signed in");

      const updateData: any = {
        status,
        updated_at: new Date().toISOString(),
      };

      if (status === "checked_in") {
        updateData.checked_in_at = new Date().toISOString();
        updateData.checked_in_by = user.id;
      }

      if (status === "checked_out") {
        updateData.checked_out_at = new Date().toISOString();
        updateData.checked_out_by = user.id;
      }

      try {
        const { data, error } = await (supabase.from as any)("kids_care_bookings")
          .update(updateData)
          .eq("id", bookingId)
          .select()
          .single();

        if (error) {
          if (error.code === "42P01" || error.message?.includes("does not exist")) {
            throw new Error("Kids care booking is not yet available. Please check back later.");
          }
          throw error;
        }

        return data as KidsCareBooking;
      } catch (error: any) {
        if (error?.code === "42P01" || error?.message?.includes("does not exist")) {
          throw new Error("Kids care booking is not yet available. Please check back later.");
        }
        throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-kids-care-bookings"] });
      queryClient.invalidateQueries({ queryKey: ["kids-care-bookings"] });
      toast.success("Booking status updated");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to update booking status");
    },
  });
}
