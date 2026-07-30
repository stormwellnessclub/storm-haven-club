import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer } from "recharts";
import { Users, TrendingUp, Ticket, DollarSign, UserCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { format, startOfWeek, endOfWeek, subWeeks, getDay } from "date-fns";

interface GuestPass {
  id: string;
  guest_name: string;
  guest_email: string | null;
  price_paid: number;
  status: string;
  purchased_at: string;
  expires_at: string;
  used_at: string | null;
  valid_date?: string | null;
  no_show?: boolean | null;
  member_referral?: string | null;
}

interface GuestPassOverviewTabProps {
  passes: GuestPass[];
}

const STATUS_COLORS = ["hsl(var(--primary))", "hsl(142, 76%, 36%)", "hsl(var(--muted-foreground))", "hsl(0, 84%, 60%)"];
const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function GuestPassOverviewTab({ passes }: GuestPassOverviewTabProps) {
  const now = new Date();
  const todayStr = format(now, "yyyy-MM-dd");
  const weekStart = startOfWeek(now, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(now, { weekStartsOn: 1 });

  const kpis = useMemo(() => {
    const todayExpected = passes.filter(p => p.valid_date === todayStr && p.status === 'active' && !p.no_show);
    const todayCheckedIn = passes.filter(p => p.valid_date === todayStr && (p.status === 'exhausted' || p.status === 'used' || p.used_at));
    const todayNoShow = passes.filter(p => p.valid_date === todayStr && p.no_show);
    const weekRevenue = passes
      .filter(p => { const d = new Date(p.purchased_at); return d >= weekStart && d <= weekEnd; })
      .reduce((sum, p) => sum + p.price_paid, 0);
    const activePasses = passes.filter(p => p.status === 'active' && new Date(p.expires_at) > now);
    const totalRevenue = passes.reduce((sum, p) => sum + p.price_paid, 0);

    return {
      todayExpected: todayExpected.length,
      todayCheckedIn: todayCheckedIn.length,
      todayNoShow: todayNoShow.length,
      weekRevenue,
      activePasses: activePasses.length,
      totalRevenue,
    };
  }, [passes, todayStr]);

  // Status distribution for pie chart
  const statusDistribution = useMemo(() => {
    const active = passes.filter(p => p.status === 'active' && !p.no_show).length;
    const checkedIn = passes.filter(p => p.status === 'exhausted' || p.status === 'used' || p.used_at).length;
    const expired = passes.filter(p => p.status === 'expired').length;
    const noShow = passes.filter(p => p.no_show).length;
    return [
      { name: "Active", value: active },
      { name: "Checked In", value: checkedIn },
      { name: "Expired", value: expired },
      { name: "No-Show", value: noShow },
    ].filter(d => d.value > 0);
  }, [passes]);

  // Weekly revenue trend (last 8 weeks)
  const weeklyRevenue = useMemo(() => {
    const weeks: { label: string; revenue: number }[] = [];
    for (let i = 7; i >= 0; i--) {
      const ws = startOfWeek(subWeeks(now, i), { weekStartsOn: 1 });
      const we = endOfWeek(subWeeks(now, i), { weekStartsOn: 1 });
      const rev = passes
        .filter(p => { const d = new Date(p.purchased_at); return d >= ws && d <= we; })
        .reduce((sum, p) => sum + p.price_paid, 0);
      weeks.push({ label: format(ws, "MMM d"), revenue: rev });
    }
    return weeks;
  }, [passes]);

  // Busiest days
  const busiestDays = useMemo(() => {
    const counts = Array(7).fill(0);
    passes.forEach(p => {
      if (p.valid_date) {
        const day = getDay(new Date(p.valid_date + "T12:00:00"));
        counts[day]++;
      }
    });
    return DAY_NAMES.map((name, i) => ({ name, visits: counts[i] }));
  }, [passes]);

  // Conversion rate (guests with email who share email with a member - approximation)
  const conversionRate = useMemo(() => {
    const totalGuests = passes.length;
    const converted = passes.filter(p => p.member_referral === "Complimentary Guest Pass").length;
    return totalGuests > 0 ? ((converted / totalGuests) * 100).toFixed(1) : "0";
  }, [passes]);

  const pieConfig = {
    active: { label: "Active", color: STATUS_COLORS[0] },
    checkedIn: { label: "Checked In", color: STATUS_COLORS[1] },
    expired: { label: "Expired", color: STATUS_COLORS[2] },
    noShow: { label: "No-Show", color: STATUS_COLORS[3] },
  };

  const barConfig = {
    revenue: { label: "Revenue", color: "hsl(var(--primary))" },
  };

  const dayConfig = {
    visits: { label: "Visits", color: "hsl(var(--accent))" },
  };

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-full bg-accent/10">
                <Users className="h-5 w-5 text-accent" />
              </div>
              <div>
                <p className="text-2xl font-bold">{kpis.todayExpected + kpis.todayCheckedIn}</p>
                <p className="text-xs text-muted-foreground">Today's Guests</p>
              </div>
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              {kpis.todayExpected} expected · {kpis.todayCheckedIn} checked in
              {kpis.todayNoShow > 0 && ` · ${kpis.todayNoShow} no-show`}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-full bg-green-500/10">
                <TrendingUp className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">${kpis.weekRevenue.toFixed(0)}</p>
                <p className="text-xs text-muted-foreground">This Week</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-full bg-blue-500/10">
                <Ticket className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{kpis.activePasses}</p>
                <p className="text-xs text-muted-foreground">Active Passes</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-full bg-amber-500/10">
                <DollarSign className="h-5 w-5 text-amber-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">${kpis.totalRevenue.toFixed(0)}</p>
                <p className="text-xs text-muted-foreground">Total Revenue</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Status Distribution Pie */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Pass Status Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            {statusDistribution.length > 0 ? (
              <ChartContainer config={pieConfig} className="h-[250px]">
                <PieChart>
                  <Pie data={statusDistribution} cx="50%" cy="50%" innerRadius={60} outerRadius={90} paddingAngle={4} dataKey="value" nameKey="name">
                    {statusDistribution.map((_, index) => (
                      <Cell key={index} fill={STATUS_COLORS[index % STATUS_COLORS.length]} />
                    ))}
                  </Pie>
                  <ChartTooltip content={<ChartTooltipContent />} />
                </PieChart>
              </ChartContainer>
            ) : (
              <div className="h-[250px] flex items-center justify-center text-muted-foreground text-sm">No data yet</div>
            )}
            <div className="flex flex-wrap gap-3 mt-2 justify-center">
              {statusDistribution.map((d, i) => (
                <div key={d.name} className="flex items-center gap-1.5 text-xs">
                  <div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: STATUS_COLORS[i % STATUS_COLORS.length] }} />
                  <span className="text-muted-foreground">{d.name}</span>
                  <span className="font-medium">{d.value}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Conversion Rate */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Conversion & Performance</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-full bg-primary/10">
                <UserCheck className="h-6 w-6 text-primary" />
              </div>
              <div>
                <p className="text-3xl font-bold">{conversionRate}%</p>
                <p className="text-sm text-muted-foreground">Member-Referred Guests</p>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <p className="text-lg font-semibold">{passes.length}</p>
                <p className="text-xs text-muted-foreground">Total Passes</p>
              </div>
              <div>
                <p className="text-lg font-semibold">{passes.filter(p => p.used_at || p.status === 'exhausted' || p.status === 'used').length}</p>
                <p className="text-xs text-muted-foreground">Used</p>
              </div>
              <div>
                <p className="text-lg font-semibold">{passes.filter(p => p.no_show).length}</p>
                <p className="text-xs text-muted-foreground">No-Shows</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Revenue Trend & Busiest Days */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Weekly Revenue Trend</CardTitle>
          </CardHeader>
          <CardContent>
            <ChartContainer config={barConfig} className="h-[250px]">
              <BarChart data={weeklyRevenue}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border/50" />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} className="fill-muted-foreground" />
                <YAxis tick={{ fontSize: 11 }} className="fill-muted-foreground" tickFormatter={(v) => `$${v}`} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Bar dataKey="revenue" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Busiest Days</CardTitle>
          </CardHeader>
          <CardContent>
            <ChartContainer config={dayConfig} className="h-[250px]">
              <BarChart data={busiestDays}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border/50" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} className="fill-muted-foreground" />
                <YAxis tick={{ fontSize: 11 }} className="fill-muted-foreground" />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Bar dataKey="visits" fill="hsl(var(--accent))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
