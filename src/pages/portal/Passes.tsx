import { PortalLayout } from "@/components/portal/PortalLayout";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Ticket } from "lucide-react";
import { Link } from "react-router-dom";
import { format } from "date-fns";

export default function PortalPasses() {
  const { user } = useAuth();

  const { data: passes = [], isLoading } = useQuery({
    queryKey: ["portal-passes", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("class_passes")
        .select("*")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data || [];
    },
    enabled: !!user,
  });

  const activePasses = passes.filter((p) => p.status === "active" && p.classes_remaining > 0);
  const otherPasses = passes.filter((p) => p.status !== "active" || p.classes_remaining <= 0);

  return (
    <PortalLayout title="My Passes">
      <div className="max-w-3xl space-y-6">
        {/* Active Passes */}
        <div>
          <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-3">
            Active Passes
          </h3>
          {activePasses.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center">
                <Ticket className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                <p className="text-muted-foreground mb-3">No active passes</p>
                <Button asChild>
                  <Link to="/class-passes">Buy a Pass</Link>
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {activePasses.map((pass) => (
                <Card key={pass.id}>
                  <CardContent className="py-4 flex items-center justify-between">
                    <div>
                      <p className="font-medium capitalize">
                        {pass.category.replace("_", " ")} — {pass.pass_type.replace("_", " ")}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {pass.classes_remaining} of {pass.classes_total} classes remaining
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Expires {format(new Date(pass.expires_at), "MMM d, yyyy")}
                      </p>
                    </div>
                    <Badge>Active</Badge>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>

        {/* Past Passes */}
        {otherPasses.length > 0 && (
          <div>
            <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-3">
              Past Passes
            </h3>
            <div className="space-y-3">
              {otherPasses.map((pass) => (
                <Card key={pass.id} className="opacity-60">
                  <CardContent className="py-4 flex items-center justify-between">
                    <div>
                      <p className="font-medium capitalize">
                        {pass.category.replace("_", " ")} — {pass.pass_type.replace("_", " ")}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {pass.classes_remaining} of {pass.classes_total} remaining
                      </p>
                    </div>
                    <Badge variant="secondary" className="capitalize">{pass.status}</Badge>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}
      </div>
    </PortalLayout>
  );
}
