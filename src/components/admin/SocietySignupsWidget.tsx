import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { BookOpen } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

/** Dashboard card: Higher Self Society (book club) sign-ups. */
export function SocietySignupsWidget() {
  const { data } = useQuery({
    queryKey: ["hss-dashboard"],
    queryFn: async () => {
      const { data, count, error } = await supabase
        .from("higher_self_society_interest")
        .select("id, full_name, created_at", { count: "exact" })
        .order("created_at", { ascending: false })
        .limit(5);
      if (error) throw error;
      return { rows: data ?? [], count: count ?? 0 };
    },
  });

  return (
    <Card>
      <CardContent className="p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-muted">
            <BookOpen className="h-5 w-5 text-primary" />
          </div>
          <div>
            <p className="font-semibold">Book club sign-ups · {data?.count ?? 0}</p>
            <p className="text-sm text-muted-foreground">
              {data?.rows.length
                ? `Newest: ${data.rows.map((r) => r.full_name || "Member").join(", ")}`
                : "No sign-ups yet"}
            </p>
          </div>
        </div>
        <Button variant="outline" asChild>
          <Link to="/events-portal/society">View all sign-ups</Link>
        </Button>
      </CardContent>
    </Card>
  );
}
