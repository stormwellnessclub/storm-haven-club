import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export type ApplicationStatus = 
  | "loading"
  | "active_member"           // Has approved membership and activated
  | "pending_activation"      // Approved but needs to choose start date
  | "pending_application"     // Application submitted, awaiting review
  | "no_application";         // No application on file

export interface ApplicationStatusResult {
  status: ApplicationStatus;
  applicationData?: {
    full_name: string;
    membership_plan: string;
    created_at: string;
    status: string;
  };
  memberData?: {
    id: string;
    member_id: string;
    membership_type: string;
    status: string;
    approved_at: string | null;
    activation_deadline: string | null;
    activated_at: string | null;
    first_name: string;
    last_name: string;
    email: string;
  };
}

export function useApplicationStatus() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["application-status", user?.id],
    queryFn: async (): Promise<ApplicationStatusResult> => {
      if (!user) {
        return { status: "no_application" };
      }

      // First check if user is already an active member (linked by user_id)
      const { data: memberData, error: memberError } = await supabase
        .from("members")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();

      if (memberError) {
        console.error("Error fetching member data:", memberError);
        throw memberError;
      }

      // If member found and linked, check their status
      if (memberData) {
        if (memberData.status === "active") {
          return {
            status: "active_member",
            memberData,
          };
        }
        
        if (memberData.status === "pending_activation") {
          return {
            status: "pending_activation",
            memberData,
          };
        }
      }

      // No member found by user_id - try to auto-link using secure RPC function
      if (!memberData && user.email) {
        console.log("No linked member found, attempting auto-link via RPC for:", user.email);
        
        const { data: linkedResult, error: linkError } = await supabase
          .rpc("link_member_by_email");

        if (linkError) {
          console.error("Error calling link_member_by_email RPC:", linkError);
          // Continue to check for pending application
        } else if (linkedResult && linkedResult.length > 0) {
          const linkedMember = linkedResult[0];
          console.log("Successfully linked member via RPC:", linkedMember.email, "status:", linkedMember.status);
          
          if (linkedMember.status === "active") {
            return {
              status: "active_member",
              memberData: linkedMember,
            };
          }
          
          if (linkedMember.status === "pending_activation") {
            return {
              status: "pending_activation",
              memberData: linkedMember,
            };
          }
        }
      }

      // Check for pending application by email
      const { data: applicationData, error: appError } = await supabase
        .from("membership_applications")
        .select("*")
        .ilike("email", user.email || "")
        .eq("status", "pending")
        .maybeSingle();

      if (appError) {
        console.error("Error fetching application:", appError);
      }

      if (applicationData) {
        return {
          status: "pending_application",
          applicationData,
        };
      }

      // No member record or pending application found
      return { status: "no_application" };
    },
    enabled: !!user,
    staleTime: 1000 * 60 * 5, // Cache for 5 minutes
    retry: 2,
  });
}
