import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

export const AMENITY_TYPES = [
  { value: "sauna", label: "Sauna", icon: "🔥" },
  { value: "salt_room", label: "Salt Room (Halotherapy)", icon: "🧂" },
  { value: "cold_plunge", label: "Cold Plunge", icon: "🧊" },
  { value: "steam_room", label: "Steam Room", icon: "♨️" },
  { value: "zero_body_cryo", label: "Zero Body Cryo Bed", icon: "❄️" },
  { value: "red_light_therapy", label: "Red Light Therapy", icon: "🔴" },
] as const;

export type AmenityType = typeof AMENITY_TYPES[number]["value"];

export interface AmenityUsageLog {
  id: string;
  member_id: string;
  user_id: string;
  amenity_type: AmenityType;
  used_at: string;
  duration_minutes: number | null;
  notes: string | null;
  check_in_id: string | null;
  created_at: string;
}

export interface CreateAmenityUsageData {
  amenity_type: AmenityType;
  duration_minutes?: number;
  notes?: string;
  check_in_id?: string;
  used_at?: string;
}

export function useAmenityUsage(memberId?: string, limit?: number) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["amenity-usage", memberId || user?.id, limit],
    queryFn: async (): Promise<AmenityUsageLog[]> => {
      if (!user) return [];

      let targetMemberId = memberId;
      if (!targetMemberId) {
        const { data: member } = await supabase
          .from("members")
          .select("id")
          .eq("user_id", user.id)
          .maybeSingle();
        if (!member) return [];
        targetMemberId = member.id;
      }

      let query = (supabase
        .from("amenity_usage_logs" as any)
        .select("*")
        .eq("member_id", targetMemberId)
        .order("used_at", { ascending: false }) as any);

      if (limit) query = query.limit(limit);

      const { data, error } = await query;
      if (error) throw error;
      return (data || []) as AmenityUsageLog[];
    },
    enabled: !!user,
  });
}

export function useCreateAmenityUsage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: CreateAmenityUsageData) => {
      if (!user) throw new Error("You must be signed in");

      const { data: member } = await supabase
        .from("members")
        .select("id")
        .eq("user_id", user.id)
        .maybeSingle();

      if (!member) throw new Error("Member not found");

      const { data: log, error } = await (supabase
        .from("amenity_usage_logs" as any)
        .insert({
          member_id: member.id,
          user_id: user.id,
          amenity_type: data.amenity_type,
          duration_minutes: data.duration_minutes || null,
          notes: data.notes || null,
          check_in_id: data.check_in_id || null,
          used_at: data.used_at || new Date().toISOString(),
        } as any)
        .select()
        .single() as any);

      if (error) throw error;
      return log as AmenityUsageLog;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["amenity-usage"] });
      queryClient.invalidateQueries({ queryKey: ["member-activities"] });
      queryClient.invalidateQueries({ queryKey: ["health-score"] });
      queryClient.invalidateQueries({ queryKey: ["member-achievements"] });
      toast.success("Amenity usage logged!");

      // Auto-check achievements
      (async () => {
        try {
          if (!user) return;
          const { data: member } = await supabase
            .from("members")
            .select("id")
            .eq("user_id", user.id)
            .maybeSingle();
          if (member) {
            await (supabase.rpc as any)("check_and_award_achievements", { _member_id: member.id });
            queryClient.invalidateQueries({ queryKey: ["member-achievements"] });
          }
        } catch (e) {
          console.warn("Auto achievement check failed:", e);
        }
      })();
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to log amenity usage");
    },
  });
}

export function useDeleteAmenityUsage() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase
        .from("amenity_usage_logs" as any)
        .delete()
        .eq("id", id) as any);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["amenity-usage"] });
      toast.success("Amenity log deleted");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to delete amenity log");
    },
  });
}
