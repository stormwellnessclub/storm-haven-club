import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

export type DeviceType = "physical_scanner" | "camera" | "manual_entry";

export interface FrozenClassBooking {
  id: string;
  class_name: string;
  start_time: string;
  session_date: string;
  status: string;
  already_checked_in: boolean;
  room?: string | null;
}

export interface FrozenSpaBooking {
  id: string;
  service_name: string;
  service_category?: string | null;
  appointment_time: string;
  duration_minutes?: number | null;
  status: string;
  already_checked_in: boolean;
  therapist?: string | null;
}

export interface ScanResult {
  success: boolean;
  access_granted: boolean;
  member?: {
    id: string;
    member_id: string;
    first_name: string;
    last_name: string;
    status: string;
    membership_type: string;
    email: string;
    photo_url?: string | null;
  };
  payment_status?: {
    isAnnualFeeOverdue: boolean;
    isDuesPastDue: boolean;
    hasRecentFailedPayment: boolean;
    hasNoSubscription: boolean;
    hasIncompleteSubscription: boolean;
  };
  denial_reason?: string;
  is_billing_block?: boolean;
  check_in_id?: string;
  log_id?: string;
  error?: string;
  message?: string;
  /** Frozen-member helpers: only populated when denial_reason === 'membership_frozen' */
  todays_class_bookings?: FrozenClassBooking[];
  todays_spa_bookings?: FrozenSpaBooking[];
  valid_class_passes?: number;
}

export interface ScannerAccessLog {
  id: string;
  member_id: string | null;
  member_id_text: string;
  scanned_by: string | null;
  access_granted: boolean;
  access_denied_reason: string | null;
  auto_checked_in: boolean;
  check_in_id: string | null;
  payment_status: {
    isAnnualFeeOverdue?: boolean;
    isDuesPastDue?: boolean;
  } | null;
  scanned_at: string;
  override_used: boolean;
  override_reason: string | null;
  device_type: string;
  notes: string | null;
  members?: {
    first_name: string;
    last_name: string;
    membership_type: string;
  };
}

export function useMemberScanner() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const scanMemberMutation = useMutation({
    mutationFn: async ({
      memberId,
      deviceType,
      autoCheckIn,
      override = false,
      overrideReason,
    }: {
      memberId: string;
      deviceType: DeviceType;
      autoCheckIn: boolean;
      override?: boolean;
      overrideReason?: string;
    }): Promise<ScanResult> => {
      if (!user) {
        throw new Error("You must be signed in to scan members");
      }

      try {
        const { data, error } = await (supabase.rpc as any)("process_member_scan", {
          p_member_id_text: memberId.trim(),
          p_scanned_by: user.id,
          p_auto_check_in: autoCheckIn,
          p_device_type: deviceType,
          p_override: override,
          p_override_reason: overrideReason || null,
        });

        if (error) {
          console.error("Scanner RPC error:", error);
          throw error;
        }

        if (!data || !data.success) {
          return {
            success: false,
            access_granted: false,
            error: data?.error || "Unknown error",
            message: data?.message || "Scan failed",
          };
        }

        return data as ScanResult;
      } catch (error: any) {
        console.error("Scan error:", error);
        if (error.code === "42883") {
          // Function does not exist
          console.error("process_member_scan RPC function not found");
          throw new Error("Scanner system is not available. Please contact support.");
        }
        throw error;
      }
    },
    onSuccess: (data) => {
      // Invalidate recent scans query
      queryClient.invalidateQueries({ queryKey: ["scanner-recent-scans"] });
      queryClient.invalidateQueries({ queryKey: ["check-ins"] });

      // Show appropriate toast message
      if (data.access_granted) {
        toast.success(
          `Access granted: ${data.member?.first_name} ${data.member?.last_name}`,
          { duration: 2000 }
        );
      } else {
        const reason = data.denial_reason || "Access denied";
        toast.error(`Access denied: ${reason.replace("_", " ")}`, { duration: 3000 });
      }
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to process scan");
    },
  });

  return {
    scanMember: scanMemberMutation.mutate,
    scanMemberAsync: scanMemberMutation.mutateAsync,
    isScanning: scanMemberMutation.isPending,
  };
}

export function useRecentScans(limit: number = 10) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["scanner-recent-scans", limit],
    queryFn: async (): Promise<ScannerAccessLog[]> => {
      if (!user) return [];

      try {
        const { data, error } = await (supabase
          .from("scanner_access_logs" as any)
          .select(
            `
            id,
            member_id,
            member_id_text,
            scanned_by,
            access_granted,
            access_denied_reason,
            auto_checked_in,
            check_in_id,
            payment_status,
            scanned_at,
            override_used,
            override_reason,
            device_type,
            notes,
            members:member_id (
              first_name,
              last_name,
              membership_type
            )
          `
          )
          .order("scanned_at", { ascending: false })
          .limit(limit) as any);

        if (error) {
          // Table might not exist yet
          if (error.code === "42P01") {
            console.warn("scanner_access_logs table not found");
            return [];
          }
          throw error;
        }

        return (data || []) as ScannerAccessLog[];
      } catch (error: any) {
        if (error?.code === "42P01") {
          console.warn("scanner_access_logs table not found");
          return [];
        }
        throw error;
      }
    },
    enabled: !!user,
    refetchInterval: 30000, // Refetch every 30 seconds
  });
}

