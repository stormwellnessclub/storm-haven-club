import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export type ApplicationStatus = 
  | "loading"
  | "active_member"           // Has approved membership and activated
  | "pending_activation"      // Approved but needs to choose start date
  | "pending_application"     // Application submitted, awaiting review
  | "unlinked_member"         // Member exists with matching email but not linked
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
    gender?: string | null;
    is_founding_member?: boolean | null;
    annual_fee_paid_at?: string | null;
    locked_start_date?: string | null;
  };
  unlinkedMemberData?: {
    id: string;
    email: string;
    status: string;
    first_name: string;
    last_name: string;
  };
}

// Helper function to delay execution
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Helper function to attempt member linking with retries
async function attemptMemberLink(maxRetries: number = 3): Promise<{
  success: boolean;
  linkedMember?: any;
  error?: any;
}> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    console.log(`[useApplicationStatus] Link attempt ${attempt}/${maxRetries}`);
    
    const { data: linkedResult, error: linkError } = await supabase
      .rpc("link_member_by_email");

    if (!linkError && linkedResult && linkedResult.length > 0) {
      console.log("[useApplicationStatus] Successfully linked member:", linkedResult[0].email);
      return { success: true, linkedMember: linkedResult[0] };
    }

    if (linkError) {
      console.warn(`[useApplicationStatus] Link attempt ${attempt} failed:`, linkError.message);
      
      // If it's an auth error, try refreshing the session
      if (linkError.message?.includes("jwt") || linkError.code === "PGRST301") {
        console.log("[useApplicationStatus] Auth error detected, refreshing session...");
        const { error: refreshError } = await supabase.auth.refreshSession();
        if (refreshError) {
          console.error("[useApplicationStatus] Session refresh failed:", refreshError);
        }
      }
    }

    // Wait before retrying (except on last attempt)
    if (attempt < maxRetries) {
      await delay(500 * attempt); // Exponential backoff: 500ms, 1000ms, 1500ms
    }
  }

  return { success: false, error: "All link attempts failed" };
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
        console.error("[useApplicationStatus] Error fetching member data:", memberError);
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

      // No member found by user_id - try to auto-link using secure RPC function with retry
      if (!memberData && user.email) {
        console.log("[useApplicationStatus] No linked member found, attempting auto-link for:", user.email);
        
        const linkResult = await attemptMemberLink(3);
        
        if (linkResult.success && linkResult.linkedMember) {
          const linkedMember = linkResult.linkedMember;
          
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
        } else {
          console.warn("[useApplicationStatus] Auto-link failed after retries, checking for unlinked member by email...");
          
          // Check if there's a member record with matching email that just hasn't been linked yet
          // IMPORTANT: Validate exact email match to prevent security issues
          if (user.email) {
            const { data: unlinkedMember } = await supabase
              .from("members")
              .select("id, email, status, first_name, last_name")
              .ilike("email", user.email)
              .is("user_id", null)
              .maybeSingle();
            
            // Verify exact email match (case-insensitive) before returning unlinked member
            if (unlinkedMember && 
                unlinkedMember.email?.toLowerCase() === user.email.toLowerCase() &&
                ['pending_activation', 'active'].includes(unlinkedMember.status)) {
              console.warn("[useApplicationStatus] Found unlinked member record:", unlinkedMember.email);
              // Return special status so UI can prompt user to fix
              return {
                status: "unlinked_member",
                unlinkedMemberData: unlinkedMember,
              };
            }
          }
        }
      }

      // Check for pending application by email (with exact match validation)
      if (user.email) {
        const { data: applicationData, error: appError } = await supabase
          .from("membership_applications")
          .select("*")
          .ilike("email", user.email)
          .eq("status", "pending")
          .maybeSingle();

        if (appError) {
          console.error("[useApplicationStatus] Error fetching application:", appError);
        }

        // Validate that application email exactly matches user email (case-insensitive)
        if (applicationData && applicationData.email?.toLowerCase() === user.email.toLowerCase()) {
          return {
            status: "pending_application",
            applicationData,
          };
        }
      }

      // No member record or pending application found
      return { status: "no_application" };
    },
    enabled: !!user,
    staleTime: 1000 * 60 * 5, // Cache for 5 minutes
    retry: 2,
  });
}
