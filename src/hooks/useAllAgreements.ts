import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Agreement } from "./useAgreements";

export type AgreementType = 
  | "liability_waiver"
  | "membership_agreement"
  | "kids_care"
  | "class_package"
  | "guest_pass"
  | "private_event"
  | "single_class_pass";

export interface GroupedAgreements {
  liability_waiver: Agreement[];
  membership_agreement: Agreement[];
  kids_care: Agreement[];
  class_package: Agreement[];
  guest_pass: Agreement[];
  private_event: Agreement[];
  single_class_pass: Agreement[];
}

/**
 * Fetches ALL active agreements in a single query and groups them by type.
 * This prevents multiple re-renders and "shaking" UI that occurs when
 * using multiple useAgreements hooks separately.
 */
export function useAllAgreements() {
  return useQuery({
    queryKey: ["all-agreements"],
    queryFn: async (): Promise<GroupedAgreements> => {
      try {
        const { data, error } = await supabase
          .from("agreements")
          .select("*")
          .eq("is_active", true)
          .order("display_order", { ascending: true });

        if (error) {
          if (error.code === "42P01" || error.message?.includes("does not exist")) {
            console.warn("agreements table not found, returning empty groups");
            return emptyGroups();
          }
          throw error;
        }

        // Group agreements by type
        const grouped: GroupedAgreements = emptyGroups();
        
        for (const agreement of (data || []) as Agreement[]) {
          const type = agreement.agreement_type as AgreementType;
          if (type in grouped) {
            grouped[type].push(agreement);
          }
        }

        return grouped;
      } catch (error: any) {
        if (error?.code === "42P01" || error?.message?.includes("does not exist")) {
          console.warn("agreements table not found, returning empty groups");
          return emptyGroups();
        }
        throw error;
      }
    },
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes to prevent refetches
  });
}

function emptyGroups(): GroupedAgreements {
  return {
    liability_waiver: [],
    membership_agreement: [],
    kids_care: [],
    class_package: [],
    guest_pass: [],
    private_event: [],
    single_class_pass: [],
  };
}
