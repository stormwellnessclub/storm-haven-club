import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import type { SpaTreatmentPackage } from "@/lib/spaPackages";

const KEY = ["spa-treatment-packages"];

export function useSpaTreatmentPackages() {
  return useQuery({
    queryKey: KEY,
    queryFn: async () => {
      const { data, error } = await supabase.from("spa_treatment_packages").select("*").order("display_order");
      if (error) throw error;
      return (data ?? []) as SpaTreatmentPackage[];
    },
  });
}

export function useUpdateSpaTreatmentPackage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<SpaTreatmentPackage> & { id: string }) => {
      const { error } = await supabase.from("spa_treatment_packages").update(updates).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEY });
      toast.success("Package saved");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useCreateSpaTreatmentPackage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (row: Omit<SpaTreatmentPackage, "id">) => {
      const { error } = await supabase.from("spa_treatment_packages").insert(row);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEY });
      toast.success("Package added");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}
