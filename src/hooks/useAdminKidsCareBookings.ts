import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
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

      try {
        let query = (supabase.from as any)("kids_care_bookings")
          .select(`
            *,
            member:members(id, first_name, last_name, email)
          `)
          .order("booking_date", { ascending: true })
          .order("start_time", { ascending: true });

        if (filters?.status) {
          query = query.eq("status", filters.status);
        }

        if (filters?.memberId) {
          query = query.eq("member_id", filters.memberId);
        }

        if (filters?.bookingDate) {
          query = query.eq("booking_date", filters.bookingDate.toISOString().split("T")[0]);
        }

        if (filters?.dateFrom) {
          query = query.gte("booking_date", filters.dateFrom.toISOString().split("T")[0]);
        }

        if (filters?.dateTo) {
          query = query.lte("booking_date", filters.dateTo.toISOString().split("T")[0]);
        }

        if (filters?.ageGroup) {
          query = query.eq("age_group", filters.ageGroup);
        }

        const { data, error } = await query;

        if (error) {
          if (error.code === "42P01" || error.message?.includes("does not exist")) {
            console.warn("kids_care_bookings table not found, returning empty array");
            return [];
          }
          throw error;
        }

        return (data || []).map((booking: any) => ({
          ...booking,
          member: booking.member ? (Array.isArray(booking.member) ? booking.member[0] : booking.member) : null,
          user: null, // User info can be fetched separately if needed
          checkedInByStaff: null, // Staff info can be fetched separately if needed
          checkedOutByStaff: null, // Staff info can be fetched separately if needed
        })) as AdminKidsCareBooking[];
      } catch (error: any) {
        if (error?.code === "42P01" || error?.message?.includes("does not exist")) {
          console.warn("kids_care_bookings table not found, returning empty array");
          return [];
        }
        throw error;
      }
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

