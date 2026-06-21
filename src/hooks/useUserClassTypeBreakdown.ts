import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export interface ClassTypeBreakdownEntry {
  classTypeId: string;
  name: string;
  category: string | null;
  count: number;
}

export function useUserClassTypeBreakdown(userId?: string) {
  const { user } = useAuth();
  const uid = userId || user?.id;

  return useQuery({
    queryKey: ["user-class-type-breakdown", uid],
    enabled: !!uid,
    queryFn: async (): Promise<ClassTypeBreakdownEntry[]> => {
      const { data: member } = await supabase
        .from("members")
        .select("id")
        .eq("user_id", uid!)
        .maybeSingle();

      const orParts = [`user_id.eq.${uid}`];
      if (member?.id) orParts.push(`member_id.eq.${member.id}`);

      const { data, error } = await supabase
        .from("class_bookings")
        .select("id, class_sessions!inner(class_types!inner(id, name, category))")
        .eq("status", "completed")
        .or(orParts.join(","));

      if (error) {
        console.warn("class-type breakdown fetch failed", error);
        return [];
      }

      const map = new Map<string, ClassTypeBreakdownEntry>();
      for (const row of (data || []) as any[]) {
        const ct = row.class_sessions?.class_types;
        if (!ct?.id) continue;
        const existing = map.get(ct.id);
        if (existing) {
          existing.count += 1;
        } else {
          map.set(ct.id, {
            classTypeId: ct.id,
            name: ct.name || "Class",
            category: ct.category ?? null,
            count: 1,
          });
        }
      }

      return Array.from(map.values()).sort((a, b) => b.count - a.count);
    },
  });
}
