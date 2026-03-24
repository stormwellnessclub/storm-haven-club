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
  child_preferred_activities?: string | null;
  // Pass info from JOIN (pass_id already in KidsCareBooking)
  pass_type?: string | null;
  pass_status?: string | null;
  pass_classes_remaining?: number | null;
  pass_classes_total?: number | null;
  pass_purchased_at?: string | null;
  pass_expires_at?: string | null;
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
        child_preferred_activities: row.child_preferred_activities || null,
        pass_id: row.pass_id || null,
        pass_type: row.pass_type || null,
        pass_status: row.pass_status || null,
        pass_classes_remaining: row.pass_classes_remaining ?? null,
        pass_classes_total: row.pass_classes_total ?? null,
        pass_purchased_at: row.pass_purchased_at || null,
        pass_expires_at: row.pass_expires_at || null,
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

export function useAdminCancelKidsCareBooking() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({ bookingId, reason }: { bookingId: string; reason?: string }) => {
      if (!user) throw new Error("You must be signed in");
      const { data, error } = await supabase.rpc("admin_cancel_kids_care_booking" as any, {
        p_booking_id: bookingId,
        p_cancellation_reason: reason || "Cancelled by admin",
      });
      if (error) throw error;
      if (data && !(data as any).success) throw new Error((data as any).error);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-kids-care-bookings"] });
      queryClient.invalidateQueries({ queryKey: ["kids-care-bookings"] });
      toast.success("Booking cancelled and credit restored");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to cancel booking");
    },
  });
}

export function useAdminUpdateKidsCareBookingTime() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({ bookingId, startTime, endTime }: { bookingId: string; startTime: string; endTime: string }) => {
      if (!user) throw new Error("You must be signed in");
      const { data, error } = await (supabase.from as any)("kids_care_bookings")
        .update({ start_time: startTime, end_time: endTime, updated_at: new Date().toISOString() })
        .eq("id", bookingId)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-kids-care-bookings"] });
      queryClient.invalidateQueries({ queryKey: ["kids-care-bookings"] });
      toast.success("Booking time updated");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to update booking time");
    },
  });
}

export function useAdminCreateKidsCareBooking() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (params: {
      userId: string;
      memberId: string;
      childName: string;
      childAge: number;
      bookingDate: string;
      startTime: string;
      endTime: string;
      passId: string;
      specialInstructions?: string;
    }) => {
      if (!user) throw new Error("You must be signed in");
      const { data, error } = await supabase.rpc("admin_create_kids_care_booking" as any, {
        p_user_id: params.userId,
        p_member_id: params.memberId,
        p_child_name: params.childName,
        p_child_age: params.childAge,
        p_booking_date: params.bookingDate,
        p_start_time: params.startTime,
        p_end_time: params.endTime,
        p_pass_id: params.passId,
        p_special_instructions: params.specialInstructions || null,
      });
      if (error) throw error;
      if (data && !(data as any).success) throw new Error((data as any).error);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-kids-care-bookings"] });
      queryClient.invalidateQueries({ queryKey: ["kids-care-bookings"] });
      toast.success("Booking created successfully");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to create booking");
    },
  });
}
