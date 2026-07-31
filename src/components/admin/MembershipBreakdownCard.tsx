import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Users } from "lucide-react";

interface Breakdown {
  paying: number;
  pastDue: number;
  sponsored: number;
  noSubscription: number;
  frozen: number;
  pendingActivation: number;
  cancelled: number;
  totalActiveStatus: number;
}

export function MembershipBreakdownCard() {
  const { data, isLoading } = useQuery<Breakdown>({
    queryKey: ["admin-membership-breakdown"],
    queryFn: async () => {
      const { data: rows, error } = await supabase
        .from("members")
        .select("status, subscription_status, stripe_subscription_id");
      if (error) throw error;

      const b: Breakdown = {
        paying: 0, pastDue: 0, sponsored: 0, noSubscription: 0,
        frozen: 0, pendingActivation: 0, cancelled: 0, totalActiveStatus: 0,
      };
      for (const r of rows || []) {
        const status = (r as any).status as string;
        const sub = ((r as any).subscription_status as string | null) || null;
        if (status === "frozen") { b.frozen++; continue; }
        if (status === "pending_activation") { b.pendingActivation++; continue; }
        if (status === "cancelled" || status === "canceled") { b.cancelled++; continue; }
        if (status !== "active") continue;
        b.totalActiveStatus++;
        if (sub === "past_due" || status === "past_due") b.pastDue++;
        else if (sub === "sponsored") b.sponsored++;
        else if (sub === "active" || sub === "trialing") b.paying++;
        else b.noSubscription++;
      }
      return b;
    },
    staleTime: 60_000,
  });

  const items = [
    { label: "Paying & current", value: data?.paying ?? 0, tone: "text-emerald-600" },
    { label: "Past due", value: data?.pastDue ?? 0, tone: "text-destructive" },
    { label: "Sponsored / comped", value: data?.sponsored ?? 0, tone: "" },
    { label: "Active, no subscription", value: data?.noSubscription ?? 0, tone: "text-amber-600" },
    { label: "Frozen", value: data?.frozen ?? 0, tone: "text-blue-600" },
    { label: "Pending activation", value: data?.pendingActivation ?? 0, tone: "text-muted-foreground" },
    { label: "Cancelled", value: data?.cancelled ?? 0, tone: "text-muted-foreground" },
  ];

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-semibold flex items-center gap-2">
          <Users className="h-4 w-4" /> Membership breakdown
        </CardTitle>
        <CardDescription>
          The headline &quot;Active Members&quot; number counts everyone with an active record — this shows who is
          actually paying.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Skeleton className="h-32 w-full" />
        ) : (
          <>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {items.map(i => (
                <div key={i.label} className="rounded-lg border p-3">
                  <div className={`text-2xl font-semibold ${i.tone}`}>{i.value}</div>
                  <div className="text-xs text-muted-foreground mt-0.5">{i.label}</div>
                </div>
              ))}
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <Badge variant="outline">
                True paying base: {(data?.paying ?? 0) + (data?.pastDue ?? 0)} (incl. past due)
              </Badge>
              {(data?.pastDue ?? 0) > 0 && (
                <Link to="/admin/billing-arrears" className="underline">
                  Review past-due accounts
                </Link>
              )}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
