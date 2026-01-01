import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export type ApplicationStatus = 
  | "loading"
  | "active_member"      // Has approved membership
  | "pending_application" // Application submitted, awaiting review
  | "no_application";     // No application on file

export interface ApplicationStatusResult {
  status: ApplicationStatus;
  applicationData?: {
    full_name: string;
    membership_plan: string;
    created_at: string;
    status: string;
  };
  memberData?: {
    member_id: string;
    membership_type: string;
    status: string;
  };
}

export function useApplicationStatus() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["application-status", user?.id, user?.email],
    queryFn: async (): Promise<ApplicationStatusResult> => {
      if (!user?.email) {
        return { status: "no_application" };
      }

      // First check if user has an active membership record
      const { data: memberData, error: memberError } = await supabase
        .from("members")
        .select("member_id, membership_type, status")
        .eq("user_id", user.id)
        .eq("status", "active")
        .maybeSingle();

      if (memberError) {
        console.error("Error checking member status:", memberError);
        throw memberError;
      }

      if (memberData) {
        return {
          status: "active_member",
          memberData: {
            member_id: memberData.member_id,
            membership_type: memberData.membership_type,
            status: memberData.status,
          },
        };
      }

      // If no active membership, check for pending application by email
      const { data: applicationData, error: applicationError } = await supabase
        .from("membership_applications")
        .select("full_name, membership_plan, created_at, status")
        .eq("email", user.email)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (applicationError) {
        console.error("Error checking application status:", applicationError);
        throw applicationError;
      }

      if (applicationData && applicationData.status === "pending") {
        return {
          status: "pending_application",
          applicationData: {
            full_name: applicationData.full_name,
            membership_plan: applicationData.membership_plan,
            created_at: applicationData.created_at,
            status: applicationData.status,
          },
        };
      }

      return { status: "no_application" };
    },
    enabled: !!user,
    staleTime: 1000 * 60 * 5, // Cache for 5 minutes
  });
}
