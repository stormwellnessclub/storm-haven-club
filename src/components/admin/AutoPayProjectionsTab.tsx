import { useMemo } from "react";
import { format, addMonths } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, TrendingUp, AlertTriangle, PieChart } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { extractTier, normalizeGender, getMonthlyPrice, getAnnualPrice, type MembershipTier } from "@/lib/membershipPricing";

interface ProjectionMember {
  id: string;
  membership_type: string;
  gender: string | null;
  is_founding_member: boolean;
  membership_start_date: string;
  annual_fee_paid_at: string | null;
  card_last4: string | null;
  card_exp_month: number | null;
  card_exp_year: number | null;
  risk_level: "high" | "medium" | "low";
}

function useProjectionMembers() {
  return useQuery({
    queryKey: ["projection-members"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("members")
        .select("id, membership_type, gender, is_founding_member, membership_start_date, annual_fee_paid_at, card_last4, card_exp_month, card_exp_year")
        .not("stripe_subscription_id", "is", null)
        .eq("status", "active");

      if (error) throw error;

      const now = new Date();
      return (data || []).map((m): ProjectionMember => {
        let riskLevel: "high" | "medium" | "low" = "low";
        if (m.card_exp_year && m.card_exp_month) {
          const cardExpiry = new Date(m.card_exp_year, m.card_exp_month - 1);
          if (cardExpiry < now) riskLevel = "high";
          else if (cardExpiry < addMonths(now, 3)) riskLevel = "medium";
        } else if (!m.card_last4) {
          riskLevel = "high";
        }
        return { ...m, risk_level: riskLevel } as ProjectionMember;
      });
    },
  });
}

export function AutoPayProjectionsTab() {
  const { data: members, isLoading } = useProjectionMembers();

  const projections = useMemo(() => {
    if (!members) return null;

    const now = new Date();
    const monthlyData: { month: string; expected: number; atRisk: number }[] = [];
    const tierBreakdown: Record<string, { count: number; monthlyRevenue: number }> = {};
    const riskSummary = { low: 0, medium: 0, high: 0, lowAmount: 0, mediumAmount: 0, highAmount: 0 };
    const foundingRenewals: { id: string; renewalDate: Date; amount: number; tier: string }[] = [];

    // Process each member
    for (const member of members) {
      const tier = extractTier(member.membership_type);
      const gender = normalizeGender(member.gender);
      const isFounding = member.is_founding_member || false;
      const monthlyPrice = isFounding ? 0 : getMonthlyPrice(tier, gender);

      // Tier breakdown (non-founding only)
      if (!isFounding) {
        if (!tierBreakdown[tier]) tierBreakdown[tier] = { count: 0, monthlyRevenue: 0 };
        tierBreakdown[tier].count++;
        tierBreakdown[tier].monthlyRevenue += monthlyPrice;
      }

      // Risk summary
      riskSummary[member.risk_level]++;
      if (!isFounding) {
        if (member.risk_level === "low") riskSummary.lowAmount += monthlyPrice;
        else if (member.risk_level === "medium") riskSummary.mediumAmount += monthlyPrice;
        else riskSummary.highAmount += monthlyPrice;
      }

      // Founding member renewal
      if (isFounding && member.annual_fee_paid_at) {
        const paidAt = new Date(member.annual_fee_paid_at);
        const renewalDate = addMonths(paidAt, 12);
        if (renewalDate > now) {
          foundingRenewals.push({
            id: member.id,
            renewalDate,
            amount: getAnnualPrice(tier, gender),
            tier,
          });
        }
      }
    }

    // Monthly projections (next 6 months)
    for (let i = 0; i < 6; i++) {
      const monthDate = addMonths(now, i);
      let expected = 0;
      let atRisk = 0;

      for (const member of members) {
        if (member.is_founding_member) continue;
        const tier = extractTier(member.membership_type);
        const gender = normalizeGender(member.gender);
        const price = getMonthlyPrice(tier, gender);
        expected += price;
        if (member.risk_level !== "low") atRisk += price;
      }

      monthlyData.push({
        month: format(monthDate, "MMM yyyy"),
        expected,
        atRisk,
      });
    }

    return { monthlyData, tierBreakdown, riskSummary, foundingRenewals: foundingRenewals.sort((a, b) => a.renewalDate.getTime() - b.renewalDate.getTime()) };
  }, [members]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!projections) return null;

  const tierColors: Record<string, string> = {
    silver: "#94a3b8",
    gold: "#eab308",
    platinum: "#a78bfa",
    diamond: "#22d3ee",
  };

  const totalMonthlyExpected = Object.values(projections.tierBreakdown).reduce((s, t) => s + t.monthlyRevenue, 0);

  return (
    <div className="space-y-6">
      {/* Top summary */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Monthly Auto-Pay Revenue</p>
            <p className="text-2xl font-bold text-green-600">${totalMonthlyExpected.toLocaleString()}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Secure (Valid Cards)</p>
            <p className="text-2xl font-bold" style={{ color: 'hsl(var(--primary))' }}>${projections.riskSummary.lowAmount.toLocaleString()}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">At Risk (Expiring)</p>
            <p className="text-2xl font-bold text-amber-600">${projections.riskSummary.mediumAmount.toLocaleString()}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">High Risk (No/Expired Card)</p>
            <p className="text-2xl font-bold text-destructive">${projections.riskSummary.highAmount.toLocaleString()}</p>
          </CardContent>
        </Card>
      </div>

      {/* Monthly Projection Chart */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-primary" />
            6-Month Auto-Pay Projection
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={projections.monthlyData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="month" className="text-xs" />
                <YAxis tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} className="text-xs" />
                <Tooltip
                  formatter={(value: number, name: string) => [`$${value.toLocaleString()}`, name === "expected" ? "Expected" : "At Risk"]}
                />
                <Bar dataKey="expected" fill="hsl(142, 71%, 45%)" radius={[4, 4, 0, 0]} name="Expected" />
                <Bar dataKey="atRisk" fill="hsl(38, 92%, 50%)" radius={[4, 4, 0, 0]} name="At Risk" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Tier Breakdown */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <PieChart className="h-5 w-5 text-primary" />
              Revenue by Tier
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {Object.entries(projections.tierBreakdown).map(([tier, data]) => {
                const pct = totalMonthlyExpected > 0 ? Math.round((data.monthlyRevenue / totalMonthlyExpected) * 100) : 0;
                return (
                  <div key={tier} className="space-y-1">
                    <div className="flex items-center justify-between text-sm">
                      <span className="flex items-center gap-2 capitalize">
                        <span className="w-3 h-3 rounded-full" style={{ backgroundColor: tierColors[tier] || "#64748b" }} />
                        {tier}
                        <Badge variant="secondary" className="text-xs">{data.count} members</Badge>
                      </span>
                      <span className="font-medium">${data.monthlyRevenue.toLocaleString()}/mo ({pct}%)</span>
                    </div>
                    <div className="h-2 bg-muted rounded-full overflow-hidden">
                      <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: tierColors[tier] || "#64748b" }} />
                    </div>
                  </div>
                );
              })}
              {Object.keys(projections.tierBreakdown).length === 0 && (
                <p className="text-sm text-muted-foreground">No active non-founding subscriptions</p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Risk Breakdown */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              Card Risk Breakdown
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full bg-green-500" /> Valid Cards
                </span>
                <span className="font-medium">{projections.riskSummary.low} members</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full bg-amber-500" /> Expiring Soon
                </span>
                <span className="font-medium">{projections.riskSummary.medium} members</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full bg-destructive" /> Expired / No Card
                </span>
                <span className="font-medium">{projections.riskSummary.high} members</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Founding Member Renewals */}
      {projections.foundingRenewals.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Founding Member Renewal Dates</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {projections.foundingRenewals.slice(0, 20).map((r) => (
                <div key={r.id} className="flex items-center justify-between text-sm border-b border-border py-2 last:border-0">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="capitalize">{r.tier}</Badge>
                    <span>Renewal: {format(r.renewalDate, "MMM d, yyyy")}</span>
                  </div>
                  <span className="font-medium">${r.amount.toLocaleString()}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
