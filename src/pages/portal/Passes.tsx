import { PortalLayout } from "@/components/portal/PortalLayout";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Ticket, Calendar, Gift } from "lucide-react";
import { Link, useSearchParams } from "react-router-dom";
import { format, differenceInDays, parseISO } from "date-fns";
import { getCategoryDisplayName } from "@/lib/classCategories";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { ClassPassPurchaseSuccessDialog } from "@/components/class-passes/ClassPassPurchaseSuccessDialog";
import { PromoBanner } from "@/components/marketing/PromoBanner";
import { MyPTPassesSection } from "@/components/portal/MyPTPassesSection";

export default function PortalPasses() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const [successOpen, setSuccessOpen] = useState(false);
  const [successPass, setSuccessPass] = useState<any>(null);

  useEffect(() => {
    const sessionId = searchParams.get("session_id");
    const purchase = searchParams.get("purchase");
    if (sessionId || purchase === "success") {
      queryClient.invalidateQueries({ queryKey: ["portal-passes"] });
      if (sessionId) {
        supabase.functions
          .invoke("class-pass-confirm", { body: { session_id: sessionId } })
          .then(({ data }: any) => {
            if (data?.success && data?.paid) {
              setSuccessPass(data.pass);
              setSuccessOpen(true);
            } else {
              toast.success("Class pass purchased!");
            }
          })
          .catch(() => toast.success("Class pass purchased!"));
      } else {
        toast.success("Class pass purchased!");
      }
      setSearchParams({}, { replace: true });
    }
  }, []);

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

  const { data: guestPasses = [], isLoading: guestPassesLoading } = useQuery({
    queryKey: ["portal-guest-passes", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("guest_passes")
        .select("*")
        .eq("user_id", user!.id)
        .order("purchased_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!user,
  });

  // Hide Kids Care passes — those are managed exclusively in the Kids Care flow,
  // not redeemable as regular class passes.
  const visiblePasses = passes.filter((p) => !p.pass_type?.toLowerCase().startsWith("kids_care"));
  const activePasses = visiblePasses.filter((p) => p.status === "active" && p.classes_remaining > 0);
  const otherPasses = visiblePasses.filter((p) => p.status !== "active" || p.classes_remaining <= 0);

  const activeGuestPasses = guestPasses.filter((p: any) => p.status === "active" && new Date(p.expires_at) > new Date());
  const usedGuestPasses = guestPasses.filter((p: any) => p.status !== "active" || new Date(p.expires_at) <= new Date());

  return (
    <PortalLayout title="My Passes">
      <ClassPassPurchaseSuccessDialog open={successOpen} onOpenChange={setSuccessOpen} pass={successPass} />
      <div className="max-w-3xl space-y-6">
        <MyPTPassesSection />
        <PromoBanner className="rounded-lg" />
        <div className="flex items-center justify-end gap-3">
          <Button variant="outline" asChild>
            <Link to="/schedule"><Calendar className="h-4 w-4 mr-2" />Book a Class</Link>
          </Button>
          <Button asChild>
            <Link to="/class-passes">Buy More Passes</Link>
          </Button>
        </div>

        {/* Active Guest Passes */}
        {!guestPassesLoading && activeGuestPasses.length > 0 && (
          <div>
            <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-3">
              Guest Passes
            </h3>
            <div className="space-y-3">
              {activeGuestPasses.map((pass: any) => {
                const daysLeft = differenceInDays(parseISO(pass.expires_at), new Date());
                return (
                  <Card key={pass.id}>
                    <CardContent className="py-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <Gift className="h-5 w-5 text-accent" />
                          <div>
                            <p className="font-medium">Guest Pass</p>
                            <p className={`text-sm ${daysLeft <= 7 ? "text-destructive" : "text-muted-foreground"}`}>
                              Expires {format(parseISO(pass.expires_at), "MMM d, yyyy")}{daysLeft <= 7 ? ` (${daysLeft} days left)` : ""}
                            </p>
                          </div>
                        </div>
                        <Badge>Active</Badge>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>
        )}

        {/* Active Class Passes */}
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
        {(otherPasses.length > 0 || usedGuestPasses.length > 0) && (
          <div>
            <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-3">
              Past Passes
            </h3>
            <div className="space-y-3">
              {usedGuestPasses.map((pass: any) => (
                <Card key={pass.id} className="opacity-60">
                  <CardContent className="py-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Gift className="h-5 w-5 text-muted-foreground" />
                      <div>
                        <p className="font-medium">Guest Pass</p>
                        <p className="text-sm text-muted-foreground">
                          {(pass.status === "used" || pass.status === "exhausted") ? "Used" : "Expired"} {pass.used_at ? format(parseISO(pass.used_at), "MMM d, yyyy") : ""}
                        </p>
                      </div>
                    </div>
                    <Badge variant="secondary" className="capitalize">{pass.status}</Badge>
                  </CardContent>
                </Card>
              ))}
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
