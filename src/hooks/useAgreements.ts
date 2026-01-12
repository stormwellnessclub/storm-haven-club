import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface Agreement {
  id: string;
  agreement_type: string;
  title: string;
  pdf_url: string;
  display_order: number;
  is_required: boolean;
  version: string | null;
  is_active: boolean;
  effective_date: string | null;
  created_at: string;
  updated_at: string;
}

export interface Form {
  id: string;
  form_type: string;
  title: string;
  pdf_url: string | null;
  description: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface CreateAgreementData {
  agreement_type: string;
  title: string;
  pdf_url: string;
  display_order: number;
  is_required: boolean;
  version?: string | null;
  is_active: boolean;
  effective_date?: string | null;
}

export interface UpdateAgreementData extends Partial<CreateAgreementData> {
  id: string;
}

export function useAgreements(agreementType?: string, includeInactive?: boolean) {
  return useQuery({
    queryKey: ["agreements", agreementType, includeInactive],
    queryFn: async (): Promise<Agreement[]> => {
      try {
        let query = (supabase.from as any)("agreements")
          .select("*")
          .order("display_order", { ascending: true });

        // Only filter by is_active if includeInactive is not true
        if (!includeInactive) {
          query = query.eq("is_active", true);
        }

        if (agreementType) {
          query = query.eq("agreement_type", agreementType);
        }

        const { data, error } = await query;

        if (error) {
          if (error.code === "42P01" || error.message?.includes("does not exist")) {
            console.warn("agreements table not found, returning empty array");
            return [];
          }
          throw error;
        }
        return (data || []) as Agreement[];
      } catch (error: any) {
        if (error?.code === "42P01" || error?.message?.includes("does not exist")) {
          console.warn("agreements table not found, returning empty array");
          return [];
        }
        throw error;
      }
    },
  });
}

export function useForms(formType?: string) {
  return useQuery({
    queryKey: ["forms", formType],
    queryFn: async (): Promise<Form[]> => {
      try {
        let query = (supabase.from as any)("forms")
          .select("*")
          .eq("is_active", true);

        if (formType) {
          query = query.eq("form_type", formType);
        }

        const { data, error } = await query;

        if (error) {
          if (error.code === "42P01" || error.message?.includes("does not exist")) {
            console.warn("forms table not found, returning empty array");
            return [];
          }
          throw error;
        }
        return (data || []) as Form[];
      } catch (error: any) {
        if (error?.code === "42P01" || error?.message?.includes("does not exist")) {
          console.warn("forms table not found, returning empty array");
          return [];
        }
        throw error;
      }
    },
  });
}

export function useAgreementsByType(type: string) {
  return useAgreements(type);
}

export function useCreateAgreement() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: CreateAgreementData): Promise<Agreement> => {
      const { data: agreement, error } = await supabase
        .from("agreements")
        .insert([data])
        .select()
        .single();

      if (error) throw error;
      return agreement as Agreement;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["agreements"] });
      toast.success("Agreement created successfully");
    },
    onError: (error: Error) => {
      toast.error(`Failed to create agreement: ${error.message}`);
    },
  });
}

export function useUpdateAgreement() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...data }: UpdateAgreementData): Promise<Agreement> => {
      const { data: agreement, error } = await supabase
        .from("agreements")
        .update(data)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return agreement as Agreement;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["agreements"] });
      toast.success("Agreement updated successfully");
    },
    onError: (error: Error) => {
      toast.error(`Failed to update agreement: ${error.message}`);
    },
  });
}

export function useDeleteAgreement() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string): Promise<void> => {
      // Soft delete by setting is_active to false
      const { error } = await supabase
        .from("agreements")
        .update({ is_active: false })
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["agreements"] });
      toast.success("Agreement deleted successfully");
    },
    onError: (error: Error) => {
      toast.error(`Failed to delete agreement: ${error.message}`);
    },
  });
}
