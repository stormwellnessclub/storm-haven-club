import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useUserMembership } from "@/hooks/useUserMembership";
import { useAuth } from "@/contexts/AuthContext";
import { format } from "date-fns";


interface EngagementNudgeData {
  shouldShow: boolean;
  className: string | null;
  sessionDate: string | null;
  sessionTime: string | null;
  isLoading: boolean;
}

export function useEngagementNudge(): EngagementNudgeData {
  const { user } = useAuth();
  const { data: membership } = useUserMembership();
  const memberId = membership?.id;

  const { data, isLoading } = useQuery({
    queryKey: ["engagement-nudge", memberId],
    queryFn: async () => {
      if (!memberId || !user) return null;

      // 1. Get latest check-in
      const { data: lastCheckIn } = await supabase
        .from("check_ins")
        .select("checked_in_at")
        .eq("member_id", memberId)
        .order("checked_in_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      // Check if inactive for 14+ days
      if (lastCheckIn) {
        const daysSince = Math.floor(
          (Date.now() - new Date(lastCheckIn.checked_in_at).getTime()) / (1000 * 60 * 60 * 24)
        );
        if (daysSince < 14) return null;
      }
      // If no check-ins at all, also show the nudge (they've never visited)

      // 2. Get most-booked class type
      const { data: bookings } = await supabase
        .from("class_bookings")
        .select("session_id, status, class_sessions!inner(class_type_id, class_type:class_types!inner(name))")
        .eq("user_id", user.id)
        .in("status", ["confirmed", "completed"])
        .eq("class_types.is_active", true);

      if (!bookings || bookings.length === 0) return null;

      // Group by class_type_id and find the most frequent
      const typeCounts: Record<string, number> = {};
      for (const b of bookings) {
        const session = b.class_sessions as unknown as { class_type_id: string };
        const typeId = session?.class_type_id;
        if (typeId) {
          typeCounts[typeId] = (typeCounts[typeId] || 0) + 1;
        }
      }

      const favoriteTypeId = Object.entries(typeCounts).sort((a, b) => b[1] - a[1])[0]?.[0];
      if (!favoriteTypeId) return null;

      // 3. Get next available session for that class type (soft-launch only)
      const today = format(new Date(), "yyyy-MM-dd");
      const { data: nextSession } = await supabase
        .from("class_sessions")
        .select(`
          session_date, start_time, max_capacity, current_enrollment,
          class_type:class_types!inner(name)
        `)
        .eq("class_type_id", favoriteTypeId)
        .in("class_types.name", SOFT_LAUNCH_CLASS_NAMES)
        .gte("session_date", today)
        .eq("is_cancelled", false)
        .order("session_date")
        .order("start_time")
        .limit(10);

      // Find first session with open spots
      const available = nextSession?.find(
        (s) => s.current_enrollment < s.max_capacity
      );

      if (!available) return null;

      const classType = Array.isArray(available.class_type)
        ? available.class_type[0]
        : available.class_type;

      return {
        className: (classType as { name: string })?.name || null,
        sessionDate: available.session_date,
        sessionTime: available.start_time,
      };
    },
    enabled: !!memberId && !!user,
    staleTime: 1000 * 60 * 10, // 10 minutes
  });

  return {
    shouldShow: !!data && !sessionStorage.getItem("nudge_dismissed"),
    className: data?.className ?? null,
    sessionDate: data?.sessionDate ?? null,
    sessionTime: data?.sessionTime ?? null,
    isLoading,
  };
}
