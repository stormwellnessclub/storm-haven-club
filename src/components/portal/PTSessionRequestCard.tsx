import { useQuery } from "@tanstack/react-query";
import { Link, useLocation } from "react-router-dom";
import { CalendarPlus, ChevronRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent } from "@/components/ui/card";

/**
 * Dashboard shortcut to the one approved PT request flow on the Personal Training page
 * (service → trainer → open times). Shown only when requests are open for this client.
 */
export function PTSessionRequestCard() {
  const { user } = useAuth();
  const { pathname } = useLocation();
  const { data } = useQuery({
    queryKey: ["pt-client-request-options", user?.id],
    enabled: !!user?.id,
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await (supabase.rpc as any)("pt_client_request_options");
      if (error) throw error;
      return data as { open: boolean; services: unknown[] };
    },
  });
  if (!data?.open || !data.services?.length) return null;
  const base = pathname.startsWith("/portal") ? "/portal" : "/member";
  return (
    <Card className="mb-4">
      <Link to={`${base}/personal-training?tab=request`} className="block">
        <CardContent className="flex items-center gap-3 py-4">
          <CalendarPlus className="h-5 w-5 text-muted-foreground" />
          <div className="flex-1"><p className="text-sm font-medium">Request a PT Session</p>
            <p className="text-xs text-muted-foreground">Pick your trainer and one of their open times.</p></div>
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
        </CardContent>
      </Link>
    </Card>
  );
}
