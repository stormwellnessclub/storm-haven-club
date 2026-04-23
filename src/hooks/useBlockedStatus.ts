import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export function useBlockedStatus() {
  const { user, authReady } = useAuth();

  return useQuery({
    queryKey: ["blocked-status", user?.email],
    queryFn: async () => {
      if (!user?.email) return false;
      const { data } = await supabase
        .from("blocked_persons")
        .select("id")
        .eq("email", user.email.toLowerCase())
        .maybeSingle();
      return !!data;
    },
    enabled: authReady && !!user?.email,
    staleTime: 1000 * 60 * 5,
  });
}
