import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

export interface ScannerSettings {
  id: string;
  location_name: string;
  auto_check_in_enabled: boolean;
  require_staff_confirmation: boolean;
  allow_override: boolean;
  audio_feedback_enabled: boolean;
  created_at: string;
  updated_at: string;
}

export function useScannerSettings(locationName: string = "front_desk") {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["scanner-settings", locationName],
    queryFn: async (): Promise<ScannerSettings | null> => {
      if (!user) return null;

      try {
        const { data, error } = await (supabase
          .from("scanner_settings" as any)
          .select("*")
          .eq("location_name", locationName)
          .maybeSingle() as any);

        if (error) {
          // Table might not exist yet
          if (error.code === "42P01") {
            console.warn("scanner_settings table not found");
            return null;
          }
          throw error;
        }

        return data as ScannerSettings | null;
      } catch (error: any) {
        if (error?.code === "42P01") {
          console.warn("scanner_settings table not found");
          return null;
        }
        throw error;
      }
    },
    enabled: !!user,
    staleTime: 60000, // Cache for 1 minute
  });
}

export function useUpdateScannerSettings() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      locationName,
      updates,
    }: {
      locationName: string;
      updates: Partial<Omit<ScannerSettings, "id" | "created_at" | "updated_at" | "location_name">>;
    }): Promise<ScannerSettings> => {
      if (!user) {
        throw new Error("You must be signed in to update settings");
      }

      const { data, error } = await (supabase
        .from("scanner_settings" as any)
        .update({
          ...updates,
          updated_at: new Date().toISOString(),
        })
        .eq("location_name", locationName)
        .select()
        .single() as any);

      if (error) {
        if (error.code === "42P01") {
          throw new Error("Scanner settings table not found");
        }
        throw error;
      }

      return data as ScannerSettings;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["scanner-settings", variables.locationName] });
      toast.success("Scanner settings updated");
    },
    onError: (error: Error) => {
      toast.error("Failed to update settings: " + error.message);
    },
  });
}

