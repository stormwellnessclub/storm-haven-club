import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Users, TrendingUp, AlertTriangle, Activity } from "lucide-react";
import {
  PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from "recharts";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";

interface Props {
  dateRange: { start: Date; end: Date };
  filters: Record<string, string | boolean>;
}

const TIER_COLORS = ["hsl(var(--chart-1))", "hsl(var(--chart-2))", "hsl(var(--chart-3))", "hsl(var(--chart-4))"];

export function MemberEngagementReport({ dateRange }: Props) {
  const { data, isLoading } = useQuery({
    queryKey: ["member-engagement-report", dateRange.start.toISOString(), dateRange.end.toISOString()],
    queryFn: async () => {
      const startStr = dateRange.start.toISOString();
      const endStr = dateRange.end.toISOString();

      // Get active members
      const { data: members } = await supabase
        .from("members")
        .select("id, first_name, last_name, email, membership_type, status")
        .eq("status", "active");

      if (!members || members.length === 0) return null;

      const memberIds = members.map(m => m.id);

      // Fetch touchpoints in parallel
      const [checkInsRes, workoutsRes, bookingsRes, spaRes, cafeRes] = await Promise.all([
        supabase.from("check_ins").select("member_id").in("member_id", memberIds).gte("checked_in_at", startStr).lte("checked_in_at", endStr),
        supabase.from("workout_logs").select("member_id").in("member_id", memberIds).gte("logged_at", startStr).lte("logged_at", endStr),
        supabase.from("class_bookings").select("member_id").in("member_id", memberIds).gte("booked_at", startStr).lte("booked_at", endStr).eq("status", "confirmed"),
        supabase.from("spa_appointments").select("member_id").in("member_id", memberIds).gte("appointment_date", dateRange.start.toISOString().split("T")[0]).lte("appointment_date", dateRange.end.toISOString().split("T")[0]).in("status", ["confirmed", "completed"]),
        supabase.from("cafe_orders").select("member_id").in("member_id", memberIds).gte("created_at", startStr).lte("created_at", endStr).eq("status", "completed"),
      ]);

      // Count touchpoints per member
      const countMap: Record<string, number> = {};
      memberIds.forEach(id => { countMap[id] = 0; });

      const countEntries = (data: { member_id: string | null }[] | null) => {
        data?.forEach(r => { if (r.member_id && countMap[r.member_id] !== undefined) countMap[r.member_id]++; });
      };

      countEntries(checkInsRes.data);
      countEntries(workoutsRes.data);
      countEntries(bookingsRes.data);
      countEntries(spaRes.data);
      countEntries(cafeRes.data);

      // Assign tiers
      const getTier = (score: number) => {
        if (score >= 5) return "High";
        if (score >= 2) return "Medium";
        if (score >= 1) return "Low";
        return "Inactive";
      };

      const enriched = members.map(m => ({
        ...m,
        score: countMap[m.id] || 0,
        tier: getTier(countMap[m.id] || 0),
      }));

      const tierCounts = { High: 0, Medium: 0, Low: 0, Inactive: 0 };
      enriched.forEach(m => { tierCounts[m.tier as keyof typeof tierCounts]++; });

      const avgScore = enriched.length > 0
        ? Math.round((enriched.reduce((s, m) => s + m.score, 0) / enriched.length) * 10) / 10
        : 0;

      // Engagement by membership tier
      const byMembershipTier: Record<string, { total: number; count: number }> = {};
      enriched.forEach(m => {
        const t = m.membership_type || "Unknown";
        if (!byMembershipTier[t]) byMembershipTier[t] = { total: 0, count: 0 };
        byMembershipTier[t].total += m.score;
        byMembershipTier[t].count++;
      });

      const tierBarData = Object.entries(byMembershipTier).map(([name, v]) => ({
        name,
        avgScore: Math.round((v.total / v.count) * 10) / 10,
      }));

      // Bottom 15 least engaged
      const churnRisk = [...enriched].sort((a, b) => a.score - b.score).slice(0, 15);

      return {
        totalActive: members.length,
        avgScore,
        tierCounts,
        pieData: Object.entries(tierCounts).map(([name, value]) => ({ name, value })),
        tierBarData,
        churnRisk,
      };
    },
  });

  if (isLoading) return <Skeleton className="h-96 w-full" />;
  if (!data) return <p className="text-muted-foreground text-center py-8">No active members found.</p>;

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card variant="flat"><CardContent className="pt-4">
          <div className="flex items-center gap-2 text-muted-foreground text-sm"><Users className="h-4 w-4" />Active Members</div>
          <p className="text-2xl font-bold mt-1">{data.totalActive}</p>
        </CardContent></Card>
        <Card variant="flat"><CardContent className="pt-4">
          <div className="flex items-center gap-2 text-muted-foreground text-sm"><Activity className="h-4 w-4" />Avg Score</div>
          <p className="text-2xl font-bold mt-1">{data.avgScore}</p>
        </CardContent></Card>
        <Card variant="flat"><CardContent className="pt-4">
          <div className="flex items-center gap-2 text-muted-foreground text-sm"><TrendingUp className="h-4 w-4" />High Engagement</div>
          <p className="text-2xl font-bold mt-1">{data.tierCounts.High}</p>
        </CardContent></Card>
        <Card variant="flat"><CardContent className="pt-4">
          <div className="flex items-center gap-2 text-muted-foreground text-sm"><AlertTriangle className="h-4 w-4" />Inactive</div>
          <p className="text-2xl font-bold mt-1">{data.tierCounts.Inactive}</p>
        </CardContent></Card>
      </div>

      {/* Charts */}
      <div className="grid md:grid-cols-2 gap-6">
        <Card>
          <CardHeader><CardTitle className="text-base">Engagement Tier Distribution</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie data={data.pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={100}>
                  {data.pieData.map((_, i) => <Cell key={i} fill={TIER_COLORS[i % TIER_COLORS.length]} />)}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-base">Avg Engagement by Membership Tier</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={data.tierBarData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                <YAxis />
                <Tooltip />
                <Bar dataKey="avgScore" fill="hsl(var(--chart-1))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Churn Risk Table */}
      <Card>
        <CardHeader><CardTitle className="text-base">Churn Risk — Least Engaged Active Members</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Member</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Tier</TableHead>
                <TableHead className="text-right">Touchpoints</TableHead>
                <TableHead>Engagement</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.churnRisk.map(m => (
                <TableRow key={m.id}>
                  <TableCell className="font-medium">{m.first_name} {m.last_name}</TableCell>
                  <TableCell className="text-muted-foreground">{m.email}</TableCell>
                  <TableCell>{m.membership_type}</TableCell>
                  <TableCell className="text-right">{m.score}</TableCell>
                  <TableCell>
                    <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${
                      m.tier === "Inactive" ? "bg-destructive/10 text-destructive" :
                      m.tier === "Low" ? "bg-orange-100 text-orange-700" :
                      "bg-muted text-muted-foreground"
                    }`}>{m.tier}</span>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
