import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

interface MemberInfo {
  id: string;
  member_id: string;
  first_name: string;
  last_name: string;
  membership_type: string;
  status: string;
  photo_url: string | null;
}

interface EntryTokenData {
  token: string;
  member: MemberInfo;
  expires_at: number;
}

export function useEntryToken() {
  const { session, loading: authLoading } = useAuth();
  const [data, setData] = useState<EntryTokenData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const refreshIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchToken = useCallback(async () => {
    if (!session?.access_token) {
      setError("Please sign in to access your entry code");
      setIsLoading(false);
      return;
    }

    try {
      // Verify session is still valid before making the request
      const { data: { session: currentSession }, error: sessionError } = await supabase.auth.getSession();
      
      if (sessionError || !currentSession) {
        console.error("[Entry Token] Session invalid:", sessionError);
        setError("Your session has expired. Please sign in again.");
        setIsLoading(false);
        return;
      }

      const { data: responseData, error: invokeError } = await supabase.functions.invoke(
        "generate-entry-token",
        {
          headers: {
            Authorization: `Bearer ${currentSession.access_token}`,
          },
        }
      );

      if (invokeError) {
        console.error("[Entry Token] Fetch error:", invokeError);
        // Handle specific error cases
        if (invokeError.message?.includes('401') || invokeError.message?.includes('unauthorized')) {
          setError("Session expired. Please sign in again.");
        } else if (invokeError.message?.includes('404') || invokeError.message?.includes('not found')) {
          setError("Member record not found. Please contact support.");
        } else {
          setError("Unable to load entry code. Please try again.");
        }
        return;
      }

      if (!responseData?.success) {
        setError(responseData?.error || "Unable to generate entry code");
        return;
      }

      setData({
        token: responseData.token,
        member: responseData.member,
        expires_at: responseData.expires_at,
      });
      setError(null);
    } catch (err: any) {
      console.error("[Entry Token] Exception:", err);
      if (err.message?.includes('network') || err.message?.includes('fetch')) {
        setError("Network error. Please check your connection and try again.");
      } else {
        setError("Unable to load entry code. Please try again.");
      }
    } finally {
      setIsLoading(false);
    }
  }, [session?.access_token]);

  // Fetch token on mount and set up silent refresh interval
  useEffect(() => {
    // Wait for auth to finish loading
    if (authLoading) {
      return;
    }

    // Session explicitly null means not authenticated
    if (!session?.access_token) {
      setError("Please sign in to access your entry code");
      setIsLoading(false);
      return;
    }

    // Initial fetch
    setError(null);
    fetchToken();

    // Silent refresh every 4.5 minutes (before 5-minute expiry)
    refreshIntervalRef.current = setInterval(() => {
      fetchToken();
    }, 4.5 * 60 * 1000);

    return () => {
      if (refreshIntervalRef.current) {
        clearInterval(refreshIntervalRef.current);
      }
    };
  }, [authLoading, session?.access_token, fetchToken]);

  // Manual refresh function (for error recovery)
  const refresh = useCallback(() => {
    setIsLoading(true);
    fetchToken();
  }, [fetchToken]);

  return {
    token: data?.token || null,
    member: data?.member || null,
    isLoading,
    error,
    refresh,
  };
}
