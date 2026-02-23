import { PortalLayout } from "@/components/portal/PortalLayout";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Ticket, Calendar } from "lucide-react";
import { Link } from "react-router-dom";
import { format, differenceInDays, parseISO } from "date-fns";
import { getCategoryDisplayName } from "@/lib/classCategories";

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
        <div className="flex items-center justify-end gap-3">
          <Button variant="outline" asChild>
            <Link to="/schedule"><Calendar className="h-4 w-4 mr-2" />Book a Class</Link>
          </Button>
          <Button asChild>
            <Link to="/class-passes">Buy More Passes</Link>
          </Button>
        </div>

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
              {activePasses.map((pass) => {
                const daysLeft = differenceInDays(parseISO(pass.expires_at), new Date());
                const progressPct = pass.classes_total > 0 ? (pass.classes_remaining / pass.classes_total) * 100 : 0;
                return (
                  <Card key={pass.id}>
                    <CardContent className="py-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium">
                            {getCategoryDisplayName(pass.category)} — {pass.pass_type.replace("_", " ")}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            {pass.classes_remaining} of {pass.classes_total} classes remaining
                          </p>
                        </div>
                        <Badge>Active</Badge>
                      </div>
                      <Progress value={progressPct} className="h-2" />
                      <div className="flex items-center justify-between">
                        <p className={`text-xs ${daysLeft <= 14 ? "text-destructive font-medium" : "text-muted-foreground"}`}>
                          Expires {format(parseISO(pass.expires_at), "MMM d, yyyy")}{daysLeft <= 14 ? ` (${daysLeft} days left)` : ""}
                        </p>
                        <Button variant="outline" size="sm" asChild>
                          <Link to="/schedule">Book a Class</Link>
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
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
                      <p className="font-medium">
                        {getCategoryDisplayName(pass.category)} — {pass.pass_type.replace("_", " ")}
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
