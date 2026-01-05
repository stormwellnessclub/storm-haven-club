import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

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

export function useAgreements(agreementType?: string) {
  return useQuery({
    queryKey: ["agreements", agreementType],
    queryFn: async (): Promise<Agreement[]> => {
      let query = supabase
        .from("agreements")
        .select("*")
        .eq("is_active", true)
        .order("display_order", { ascending: true });

      if (agreementType) {
        query = query.eq("agreement_type", agreementType);
      }

      const { data, error } = await query;

      if (error) throw error;
      return (data || []) as Agreement[];
    },
  });
}

export function useForms(formType?: string) {
  return useQuery({
    queryKey: ["forms", formType],
    queryFn: async (): Promise<Form[]> => {
      let query = supabase
        .from("forms")
        .select("*")
        .eq("is_active", true);

      if (formType) {
        query = query.eq("form_type", formType);
      }

      const { data, error } = await query;

      if (error) throw error;
      return (data || []) as Form[];
    },
  });
}

export function useAgreementsByType(type: string) {
  return useAgreements(type);
}

