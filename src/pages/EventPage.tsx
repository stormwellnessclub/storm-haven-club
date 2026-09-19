import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { EventDetailView, type EventDetailRecord } from "@/components/events/EventDetailView";
import { RITUAL_EVENT_COLUMNS } from "@/hooks/useRituals";

export default function EventPage() {
  const { slug = "" } = useParams();
  const navigate = useNavigate();

  const { data: event, isLoading } = useQuery({
    queryKey: ["event", slug],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("events")
        .select(RITUAL_EVENT_COLUMNS)
        .eq("slug", slug)
        .maybeSingle();
      if (error) throw error;
      return data as EventDetailRecord | null;
    },
  });

  if (isLoading) {
    return (
      <div className="max-w-3xl mx-auto p-6 space-y-4">
        <Skeleton className="h-64" />
      </div>
    );
  }

  if (!event) {
    return (
      <div className="max-w-3xl mx-auto p-8 text-center">
        <h1 className="text-2xl font-semibold">Event not found</h1>
        <Button variant="outline" className="mt-4" onClick={() => navigate("/events")}>
          Back to events
        </Button>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto p-4 md:p-8">
      <Button variant="ghost" size="sm" className="mb-4" onClick={() => navigate("/events")}>
        ← All events
      </Button>
      <Card>
        <CardContent className="p-5 md:p-8">
          <EventDetailView event={event} />
        </CardContent>
      </Card>
    </div>
  );
}
