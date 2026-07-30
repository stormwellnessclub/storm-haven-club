import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { format, parseISO } from "date-fns";
import { Phone, Mail, Clock } from "lucide-react";

interface SpaRequest {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  preferred_time: string | null;
  service_name: string;
  service_category: string | null;
  message: string | null;
  created_at: string;
}

function useSpaServiceRequests() {
  return useQuery({
    queryKey: ["spa-service-requests"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("spa_service_requests")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(300);
      if (error) throw error;
      return (data || []) as unknown as SpaRequest[];
    },
    staleTime: 0,
  });
}

export function SpaRequestsTab() {
  const { data, isLoading } = useSpaServiceRequests();

  if (isLoading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-24 w-full" />
      </div>
    );
  }

  if (!data?.length) {
    return (
      <Card>
        <CardContent className="py-10 text-center text-muted-foreground">
          No service requests yet.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      {data.map((req) => {
        const isOzone = /ozone/i.test(req.service_name || "");
        return (
          <Card key={req.id}>
            <CardHeader className="pb-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <CardTitle className="text-base">
                    {req.service_name}
                    {isOzone && (
                      <Badge variant="outline" className="ml-2">Call required · 30 min + 15 min cleanup</Badge>
                    )}
                  </CardTitle>
                  <CardDescription>
                    {req.name} · {format(parseISO(req.created_at), "MMM d, yyyy h:mm a")}
                  </CardDescription>
                </div>
                {req.service_category && <Badge variant="secondary">{req.service_category}</Badge>}
              </div>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="flex flex-wrap gap-4">
                {req.phone && (
                  <a href={`tel:${req.phone}`} className="flex items-center gap-1.5 text-accent">
                    <Phone className="h-3.5 w-3.5" /> {req.phone}
                  </a>
                )}
                <a href={`mailto:${req.email}`} className="flex items-center gap-1.5 text-muted-foreground">
                  <Mail className="h-3.5 w-3.5" /> {req.email}
                </a>
                {req.preferred_time && (
                  <span className="flex items-center gap-1.5 text-muted-foreground">
                    <Clock className="h-3.5 w-3.5" /> Prefers: {req.preferred_time}
                  </span>
                )}
              </div>
              {req.message && <p className="text-muted-foreground">{req.message}</p>}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
