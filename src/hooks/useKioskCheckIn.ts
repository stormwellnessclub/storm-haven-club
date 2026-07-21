import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface KioskCheckInResult {
  success: boolean;
  access_granted: boolean;
  already_in?: boolean;
  is_first_visit?: boolean;
  denial_reason?: string;
  message?: string;
  check_in_id?: string;
  member?: {
    first_name: string;
    last_name: string;
    membership_type: string;
    photo_url?: string | null;
    status?: string;
  };
  error?: string;
}

export function useKioskCheckIn() {
  const [isCheckingIn, setIsCheckingIn] = useState(false);

  const checkInMember = async (memberIdText: string): Promise<KioskCheckInResult> => {
    setIsCheckingIn(true);
    try {
      const { data, error } = await (supabase.rpc as any)("kiosk_check_in_member", {
        p_member_id_text: memberIdText,
      });
      if (error) throw error;
      return data as KioskCheckInResult;
    } catch (err: any) {
      toast.error(err?.message || "Check-in failed");
      return { success: false, access_granted: false, error: err?.message };
    } finally {
      setIsCheckingIn(false);
    }
  };

  const checkInGuest = async (guestPassId: string): Promise<boolean> => {
    setIsCheckingIn(true);
    try {
      const { data, error } = await (supabase.rpc as any)("kiosk_check_in_guest", {
        p_guest_pass_id: guestPassId,
      });
      if (error) throw error;
      if (!data?.success) {
        toast.error(data?.error || "Guest check-in failed");
        return false;
      }
      return true;
    } catch (err: any) {
      toast.error(err?.message || "Guest check-in failed");
      return false;
    } finally {
      setIsCheckingIn(false);
    }
  };

  const checkInClass = async (bookingId: string): Promise<boolean> => {
    setIsCheckingIn(true);
    try {
      const { data, error } = await (supabase.rpc as any)("kiosk_check_in_class", {
        p_booking_id: bookingId,
      });
      if (error) throw error;
      if (!data?.success) {
        toast.error(data?.error || "Class check-in failed");
        return false;
      }
      return true;
    } catch (err: any) {
      toast.error(err?.message || "Class check-in failed");
      return false;
    } finally {
      setIsCheckingIn(false);
    }
  };

  const checkInKidsCare = async (bookingId: string): Promise<boolean> => {
    setIsCheckingIn(true);
    try {
      const { data, error } = await (supabase.rpc as any)("kiosk_check_in_kids_care", {
        p_booking_id: bookingId,
      });
      if (error) throw error;
      if (!data?.success) {
        toast.error(data?.error || "Kids Care check-in failed");
        return false;
      }
      return true;
    } catch (err: any) {
      toast.error(err?.message || "Kids Care check-in failed");
      return false;
    } finally {
      setIsCheckingIn(false);
    }
  };

  const checkOutKidsCare = async (bookingId: string): Promise<boolean> => {
    setIsCheckingIn(true);
    try {
      const { data, error } = await (supabase.rpc as any)("kiosk_check_out_kids_care", {
        p_booking_id: bookingId,
      });
      if (error) throw error;
      if (!data?.success) {
        toast.error(data?.error || "Kids Care check-out failed");
        return false;
      }
      return true;
    } catch (err: any) {
      toast.error(err?.message || "Kids Care check-out failed");
      return false;
    } finally {
      setIsCheckingIn(false);
    }
  };

  const checkInSpa = async (spaId: string): Promise<boolean> => {
    setIsCheckingIn(true);
    try {
      const { data, error } = await (supabase.rpc as any)("kiosk_check_in_spa", {
        p_spa_id: spaId,
      });
      if (error) throw error;
      if (!data?.success) {
        toast.error(data?.error || "Spa check-in failed");
        return false;
      }
      return true;
    } catch (err: any) {
      toast.error(err?.message || "Spa check-in failed");
      return false;
    } finally {
      setIsCheckingIn(false);
    }
  };

  return { checkInMember, checkInGuest, checkInClass, checkInSpa, checkInKidsCare, checkOutKidsCare, isCheckingIn };
}
