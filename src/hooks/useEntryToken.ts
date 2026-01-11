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
  const { session } = useAuth();
  const [data, setData] = useState<EntryTokenData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const refreshIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const fetchToken = useCallback(async () => {
    if (!session?.access_token) {
      setError("Not authenticated");
      setIsLoading(false);
      return;
    }

    try {
      const { data: responseData, error: invokeError } = await supabase.functions.invoke(
        "generate-entry-token",
        {
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
        }
      );

      if (invokeError) {
        console.error("[Entry Token] Fetch error:", invokeError);
        setError(invokeError.message || "Failed to generate entry code");
        return;
      }

      if (!responseData?.success) {
        setError(responseData?.error || "Failed to generate entry code");
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
      setError(err.message || "Failed to generate entry code");
    } finally {
      setIsLoading(false);
    }
  }, [session?.access_token]);

  // Fetch token on mount and set up silent refresh interval
  useEffect(() => {
    if (!session?.access_token) {
      setIsLoading(false);
      return;
    }

    // Initial fetch
    fetchToken();

    // Silent refresh every 4.5 minutes (before 5-minute expiry)
    // Using slightly less than 5 minutes to ensure smooth transition
    refreshIntervalRef.current = setInterval(() => {
      fetchToken();
    }, 4.5 * 60 * 1000);

    return () => {
      if (refreshIntervalRef.current) {
        clearInterval(refreshIntervalRef.current);
      }
    };
  }, [session?.access_token, fetchToken]);

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
