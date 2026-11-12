import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import type { SpaTreatmentZone } from "@/lib/spaZones";

const KEY = ["spa-treatment-zones"];

export function useSpaTreatmentZones() {
  return useQuery({
    queryKey: KEY,
    queryFn: async () => {
      const { data, error } = await supabase.from("spa_treatment_zones").select("*").order("display_order");
      if (error) throw error;
      return (data ?? []) as SpaTreatmentZone[];
    },
  });
}

export function useSaveSpaTreatmentZone() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (row: Partial<SpaTreatmentZone> & { id?: string }) => {
      const { id, ...rest } = row;
      const { error } = id
        ? await supabase.from("spa_treatment_zones").update(rest).eq("id", id)
        : await supabase.from("spa_treatment_zones").insert(rest as Omit<SpaTreatmentZone, "id">);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEY });
      toast.success("Zone saved");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useReorderSpaTreatmentZones() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (pairs: [string, number][]) => {
      for (const [id, display_order] of pairs) {
        const { error } = await supabase.from("spa_treatment_zones").update({ display_order }).eq("id", id);
        if (error) throw error;
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
    onError: (e: Error) => toast.error(e.message),
  });
}
