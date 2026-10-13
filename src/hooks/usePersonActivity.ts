import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { PersonActivity } from "@/lib/audience";

/** Loads every person's activity summary, paging past the 1,000-row cap. */
export function usePersonActivity(enabled = true) {
  return useQuery({
    queryKey: ["person-activity"],
    enabled,
    staleTime: 60_000,
    queryFn: async () => {
      const out: PersonActivity[] = [];
      for (let from = 0; ; from += 1000) {
        const { data, error } = await (supabase.rpc as any)("admin_person_activity").range(from, from + 999);
        if (error) throw error;
        out.push(...((data ?? []) as PersonActivity[]));
        if (!data || data.length < 1000) break;
      }
      return out;
    },
  });
}
