import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export interface ApplicationStatusHistory {
  id: string;
  application_id: string;
  old_status: string | null;
  new_status: string;
  changed_by: string | null;
  notes: string | null;
  created_at: string;
  changed_by_user?: {
    email: string;
  };
}

export function useApplicationStatusHistory(applicationId: string) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["application-status-history", applicationId],
    queryFn: async (): Promise<ApplicationStatusHistory[]> => {
      if (!user || !applicationId) return [];

      try {
        const { data, error } = await (supabase.from as any)("application_status_history")
          .select("*")
          .eq("application_id", applicationId)
          .order("created_at", { ascending: false });

        if (error) {
          if (error.code === "42P01" || error.message?.includes("does not exist")) {
            console.warn("application_status_history table not found, returning empty array");
            return [];
          }
          throw error;
        }

        return (data || []) as ApplicationStatusHistory[];
      } catch (error: any) {
        if (error?.code === "42P01" || error?.message?.includes("does not exist")) {
          console.warn("application_status_history table not found, returning empty array");
          return [];
        }
        throw error;
      }
    },
    enabled: !!user && !!applicationId,
  });
}

