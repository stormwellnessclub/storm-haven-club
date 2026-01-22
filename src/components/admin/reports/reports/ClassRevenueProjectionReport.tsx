import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle, TrendingUp, Users, DollarSign, Calendar } from "lucide-react";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Cell } from "recharts";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

// Class pricing constants (from stripeProducts.ts)
const CLASS_PRICING = {
  pilatesCycling: {
    single: { member: 25, nonMember: 40 },
    tenPack: { member: 17, nonMember: 30 }, // Per-class cost
  },
  otherClasses: {
    single: { member: 15, nonMember: 30 },
    tenPack: { member: 15, nonMember: 20 }, // Per-class cost
  },
};

// Default schedule when no sessions are scheduled
const DEFAULT_SCHEDULE = {
  weekdayClasses: 22,
  weekendClasses: 10,
  weekdays: 5,
  weekendDays: 2,
  defaultCapacity: 8,
  pilatesCyclingRatio: 0.73, // ~95 out of 130 are Pilates/Cycling
};

interface ClassRevenueProjectionReportProps {
  dateRange: { start: Date; end: Date };
  filters: Record<string, string | boolean>;
}

export function ClassRevenueProjectionReport({
  dateRange,
}: ClassRevenueProjectionReportProps) {
  const [fillRate, setFillRate] = useState(70);
  const [memberMix, setMemberMix] = useState(80);
  const [tenPackRatio, setTenPackRatio] = useState(70);

  // Fetch actual scheduled sessions
  const { data: sessionsData, isLoading, error } = useQuery({
    queryKey: ["class-sessions-projection", dateRange],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("class_sessions")
        .select(`
          id,
          session_date,
          max_capacity,
          class_type_id,
          class_types!inner(
            id,
            name,
            category,
            max_capacity
          )
        `)
        .gte("session_date", dateRange.start.toISOString().split("T")[0])
        .lte("session_date", dateRange.end.toISOString().split("T")[0])
        .eq("is_cancelled", false);

      if (error) throw error;
      return data || [];
    },
  });

  // Calculate projections
  const projections = useMemo(() => {
    const fillRateDecimal = fillRate / 100;
    const memberMixDecimal = memberMix / 100;
    const tenPackRatioDecimal = tenPackRatio / 100;

    let pilatesCyclingSessions = 0;
    let pilatesCyclingCapacity = 0;
    let otherSessions = 0;
    let otherCapacity = 0;
    let usingFallback = false;

    if (sessionsData && sessionsData.length > 0) {
      // Use actual scheduled data
      sessionsData.forEach((session: any) => {
        const category = session.class_types?.category;
        const capacity = session.max_capacity || session.class_types?.max_capacity || 8;

        if (category === "pilates" || category === "cycling") {
          pilatesCyclingSessions++;
          pilatesCyclingCapacity += capacity;
        } else {
          otherSessions++;
          otherCapacity += capacity;
        }
      });
    } else {
      // Fallback to default schedule (130 classes/week)
      usingFallback = true;
      const weeks = Math.ceil(
        (dateRange.end.getTime() - dateRange.start.getTime()) / (7 * 24 * 60 * 60 * 1000)
      );
      const totalWeeklyClasses =
        DEFAULT_SCHEDULE.weekdayClasses * DEFAULT_SCHEDULE.weekdays +
        DEFAULT_SCHEDULE.weekendClasses * DEFAULT_SCHEDULE.weekendDays;

      pilatesCyclingSessions = Math.round(
        totalWeeklyClasses * DEFAULT_SCHEDULE.pilatesCyclingRatio * weeks
      );
      otherSessions = Math.round(
        totalWeeklyClasses * (1 - DEFAULT_SCHEDULE.pilatesCyclingRatio) * weeks
      );
      pilatesCyclingCapacity = pilatesCyclingSessions * DEFAULT_SCHEDULE.defaultCapacity;
      otherCapacity = otherSessions * DEFAULT_SCHEDULE.defaultCapacity;
    }

    // Calculate attendance
    const pilatesCyclingAttendance = Math.round(pilatesCyclingCapacity * fillRateDecimal);
    const otherAttendance = Math.round(otherCapacity * fillRateDecimal);

    // Split by member status
    const pilatesCyclingMembers = Math.round(pilatesCyclingAttendance * memberMixDecimal);
    const pilatesCyclingNonMembers = pilatesCyclingAttendance - pilatesCyclingMembers;
    const otherMembers = Math.round(otherAttendance * memberMixDecimal);
    const otherNonMembers = otherAttendance - otherMembers;

    // Calculate revenue
    const calculateCategoryRevenue = (
      memberAttendance: number,
      nonMemberAttendance: number,
      pricing: typeof CLASS_PRICING.pilatesCycling
    ) => {
      const memberTenPack = Math.round(memberAttendance * tenPackRatioDecimal);
      const memberSingle = memberAttendance - memberTenPack;
      const nonMemberTenPack = Math.round(nonMemberAttendance * tenPackRatioDecimal);
      const nonMemberSingle = nonMemberAttendance - nonMemberTenPack;

      const memberRevenue =
        memberTenPack * pricing.tenPack.member +
        memberSingle * pricing.single.member;
      const nonMemberRevenue =
        nonMemberTenPack * pricing.tenPack.nonMember +
        nonMemberSingle * pricing.single.nonMember;

      return { memberRevenue, nonMemberRevenue, total: memberRevenue + nonMemberRevenue };
    };

    const pilatesCyclingRevenue = calculateCategoryRevenue(
      pilatesCyclingMembers,
      pilatesCyclingNonMembers,
      CLASS_PRICING.pilatesCycling
    );

    const otherRevenue = calculateCategoryRevenue(
      otherMembers,
      otherNonMembers,
      CLASS_PRICING.otherClasses
    );

    const totalRevenue = pilatesCyclingRevenue.total + otherRevenue.total;

    // Calculate weekly/monthly/annual based on date range
    const daysInRange = Math.ceil(
      (dateRange.end.getTime() - dateRange.start.getTime()) / (24 * 60 * 60 * 1000)
    );
    const weeksInRange = daysInRange / 7;

    const weeklyRevenue = totalRevenue / weeksInRange;
    const monthlyRevenue = weeklyRevenue * 4.33;
    const annualRevenue = weeklyRevenue * 52;

    return {
      usingFallback,
      pilatesCycling: {
        sessions: pilatesCyclingSessions,
        capacity: pilatesCyclingCapacity,
        attendance: pilatesCyclingAttendance,
        memberAttendance: pilatesCyclingMembers,
        nonMemberAttendance: pilatesCyclingNonMembers,
        ...pilatesCyclingRevenue,
      },
      other: {
        sessions: otherSessions,
        capacity: otherCapacity,
        attendance: otherAttendance,
        memberAttendance: otherMembers,
        nonMemberAttendance: otherNonMembers,
        ...otherRevenue,
      },
      totals: {
        sessions: pilatesCyclingSessions + otherSessions,
        capacity: pilatesCyclingCapacity + otherCapacity,
        attendance: pilatesCyclingAttendance + otherAttendance,
        revenue: totalRevenue,
        weeklyRevenue,
        monthlyRevenue,
        annualRevenue,
      },
    };
  }, [sessionsData, fillRate, memberMix, tenPackRatio, dateRange]);

  // Scenario comparison
  const scenarios = useMemo(() => {
    const calculateScenario = (scenarioFillRate: number) => {
      const fillRateDecimal = scenarioFillRate / 100;
      const memberMixDecimal = memberMix / 100;
      const tenPackRatioDecimal = tenPackRatio / 100;

      const totalCapacity = projections.totals.capacity;
      const attendance = Math.round(totalCapacity * fillRateDecimal);

      const memberAttendance = Math.round(attendance * memberMixDecimal);
      const nonMemberAttendance = attendance - memberAttendance;

      // Simplified calculation for scenarios
      const avgMemberPrice =
        (CLASS_PRICING.pilatesCycling.tenPack.member * tenPackRatioDecimal +
          CLASS_PRICING.pilatesCycling.single.member * (1 - tenPackRatioDecimal)) *
          0.73 +
        (CLASS_PRICING.otherClasses.tenPack.member * tenPackRatioDecimal +
          CLASS_PRICING.otherClasses.single.member * (1 - tenPackRatioDecimal)) *
          0.27;

      const avgNonMemberPrice =
        (CLASS_PRICING.pilatesCycling.tenPack.nonMember * tenPackRatioDecimal +
          CLASS_PRICING.pilatesCycling.single.nonMember * (1 - tenPackRatioDecimal)) *
          0.73 +
        (CLASS_PRICING.otherClasses.tenPack.nonMember * tenPackRatioDecimal +
          CLASS_PRICING.otherClasses.single.nonMember * (1 - tenPackRatioDecimal)) *
          0.27;

      const revenue =
        memberAttendance * avgMemberPrice + nonMemberAttendance * avgNonMemberPrice;

      const daysInRange = Math.ceil(
        (dateRange.end.getTime() - dateRange.start.getTime()) / (24 * 60 * 60 * 1000)
      );
      const weeksInRange = daysInRange / 7;

      return {
        fillRate: scenarioFillRate,
        attendance,
        weeklyRevenue: revenue / weeksInRange,
        monthlyRevenue: (revenue / weeksInRange) * 4.33,
        annualRevenue: (revenue / weeksInRange) * 52,
      };
    };

    return [
      { label: "Conservative", ...calculateScenario(50) },
      { label: "Target", ...calculateScenario(70) },
      { label: "Optimistic", ...calculateScenario(85) },
    ];
  }, [projections, memberMix, tenPackRatio, dateRange]);

  // Chart data
  const chartData = useMemo(
    () => [
      {
        category: "Pilates/Cycling",
        revenue: projections.pilatesCycling.total,
        memberRevenue: projections.pilatesCycling.memberRevenue,
        nonMemberRevenue: projections.pilatesCycling.nonMemberRevenue,
      },
      {
        category: "Other Classes",
        revenue: projections.other.total,
        memberRevenue: projections.other.memberRevenue,
        nonMemberRevenue: projections.other.nonMemberRevenue,
      },
    ],
    [projections]
  );

  const chartConfig = {
    revenue: {
      label: "Total Revenue",
      color: "hsl(var(--primary))",
    },
    memberRevenue: {
      label: "Member Revenue",
      color: "hsl(var(--chart-1))",
    },
    nonMemberRevenue: {
      label: "Non-Member Revenue",
      color: "hsl(var(--chart-2))",
    },
  };

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          Failed to load class session data. Please try again.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-6">
      {/* Fallback Notice */}
      {projections.usingFallback && (
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            No scheduled sessions found for this date range. Using default schedule
            (130 classes/week: 22/day weekdays, 10/day weekends).
          </AlertDescription>
        </Alert>
      )}

      {/* Slider Controls */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Projection Parameters</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-6 md:grid-cols-3">
            <div className="space-y-3">
              <div className="flex justify-between">
                <Label>Fill Rate</Label>
                <span className="text-sm font-medium text-primary">{fillRate}%</span>
              </div>
              <Slider
                value={[fillRate]}
                onValueChange={([value]) => setFillRate(value)}
                min={0}
                max={100}
                step={5}
                className="w-full"
              />
              <p className="text-xs text-muted-foreground">
                Percentage of available spots filled
              </p>
            </div>

            <div className="space-y-3">
              <div className="flex justify-between">
                <Label>Member Mix</Label>
                <span className="text-sm font-medium text-primary">{memberMix}%</span>
              </div>
              <Slider
                value={[memberMix]}
                onValueChange={([value]) => setMemberMix(value)}
                min={0}
                max={100}
                step={5}
                className="w-full"
              />
              <p className="text-xs text-muted-foreground">
                Percentage of attendees who are members
              </p>
            </div>

            <div className="space-y-3">
              <div className="flex justify-between">
                <Label>10-Pack Ratio</Label>
                <span className="text-sm font-medium text-primary">{tenPackRatio}%</span>
              </div>
              <Slider
                value={[tenPackRatio]}
                onValueChange={([value]) => setTenPackRatio(value)}
                min={0}
                max={100}
                step={5}
                className="w-full"
              />
              <p className="text-xs text-muted-foreground">
                Percentage purchasing 10-packs vs single classes
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Weekly Revenue</span>
            </div>
            <p className="mt-2 text-2xl font-bold">
              {formatCurrency(projections.totals.weeklyRevenue)}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Monthly Revenue</span>
            </div>
            <p className="mt-2 text-2xl font-bold">
              {formatCurrency(projections.totals.monthlyRevenue)}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Annual Revenue</span>
            </div>
            <p className="mt-2 text-2xl font-bold">
              {formatCurrency(projections.totals.annualRevenue)}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Weekly Attendance</span>
            </div>
            <p className="mt-2 text-2xl font-bold">
              {Math.round(projections.totals.attendance / 4.33).toLocaleString()}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Revenue Chart */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Revenue by Class Category</CardTitle>
        </CardHeader>
        <CardContent>
          <ChartContainer config={chartConfig} className="h-[250px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} layout="vertical">
                <XAxis type="number" tickFormatter={(value) => `$${value.toLocaleString()}`} />
                <YAxis type="category" dataKey="category" width={120} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Bar dataKey="memberRevenue" stackId="revenue" name="Member Revenue">
                  {chartData.map((_, index) => (
                    <Cell key={index} fill="hsl(var(--chart-1))" />
                  ))}
                </Bar>
                <Bar dataKey="nonMemberRevenue" stackId="revenue" name="Non-Member Revenue">
                  {chartData.map((_, index) => (
                    <Cell key={index} fill="hsl(var(--chart-2))" />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </ChartContainer>
        </CardContent>
      </Card>

      {/* Scenario Comparison */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Scenario Comparison</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Scenario</TableHead>
                <TableHead className="text-right">Fill Rate</TableHead>
                <TableHead className="text-right">Weekly</TableHead>
                <TableHead className="text-right">Monthly</TableHead>
                <TableHead className="text-right">Annual</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {scenarios.map((scenario) => (
                <TableRow
                  key={scenario.label}
                  className={scenario.label === "Target" ? "bg-primary/5" : ""}
                >
                  <TableCell className="font-medium">{scenario.label}</TableCell>
                  <TableCell className="text-right">{scenario.fillRate}%</TableCell>
                  <TableCell className="text-right">
                    {formatCurrency(scenario.weeklyRevenue)}
                  </TableCell>
                  <TableCell className="text-right">
                    {formatCurrency(scenario.monthlyRevenue)}
                  </TableCell>
                  <TableCell className="text-right font-medium">
                    {formatCurrency(scenario.annualRevenue)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Detailed Breakdown */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Detailed Breakdown</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Category</TableHead>
                <TableHead className="text-right">Sessions</TableHead>
                <TableHead className="text-right">Capacity</TableHead>
                <TableHead className="text-right">Proj. Attendance</TableHead>
                <TableHead className="text-right">Member Revenue</TableHead>
                <TableHead className="text-right">Non-Member Revenue</TableHead>
                <TableHead className="text-right">Total Revenue</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow>
                <TableCell className="font-medium">Pilates/Cycling</TableCell>
                <TableCell className="text-right">
                  {projections.pilatesCycling.sessions.toLocaleString()}
                </TableCell>
                <TableCell className="text-right">
                  {projections.pilatesCycling.capacity.toLocaleString()}
                </TableCell>
                <TableCell className="text-right">
                  {projections.pilatesCycling.attendance.toLocaleString()}
                </TableCell>
                <TableCell className="text-right">
                  {formatCurrency(projections.pilatesCycling.memberRevenue)}
                </TableCell>
                <TableCell className="text-right">
                  {formatCurrency(projections.pilatesCycling.nonMemberRevenue)}
                </TableCell>
                <TableCell className="text-right font-medium">
                  {formatCurrency(projections.pilatesCycling.total)}
                </TableCell>
              </TableRow>
              <TableRow>
                <TableCell className="font-medium">Other Classes</TableCell>
                <TableCell className="text-right">
                  {projections.other.sessions.toLocaleString()}
                </TableCell>
                <TableCell className="text-right">
                  {projections.other.capacity.toLocaleString()}
                </TableCell>
                <TableCell className="text-right">
                  {projections.other.attendance.toLocaleString()}
                </TableCell>
                <TableCell className="text-right">
                  {formatCurrency(projections.other.memberRevenue)}
                </TableCell>
                <TableCell className="text-right">
                  {formatCurrency(projections.other.nonMemberRevenue)}
                </TableCell>
                <TableCell className="text-right font-medium">
                  {formatCurrency(projections.other.total)}
                </TableCell>
              </TableRow>
              <TableRow className="bg-muted/50 font-medium">
                <TableCell>Total</TableCell>
                <TableCell className="text-right">
                  {projections.totals.sessions.toLocaleString()}
                </TableCell>
                <TableCell className="text-right">
                  {projections.totals.capacity.toLocaleString()}
                </TableCell>
                <TableCell className="text-right">
                  {projections.totals.attendance.toLocaleString()}
                </TableCell>
                <TableCell className="text-right">
                  {formatCurrency(
                    projections.pilatesCycling.memberRevenue + projections.other.memberRevenue
                  )}
                </TableCell>
                <TableCell className="text-right">
                  {formatCurrency(
                    projections.pilatesCycling.nonMemberRevenue + projections.other.nonMemberRevenue
                  )}
                </TableCell>
                <TableCell className="text-right">
                  {formatCurrency(projections.totals.revenue)}
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Pricing Reference */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Pricing Reference</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <h4 className="mb-2 font-medium">Pilates/Cycling</h4>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead></TableHead>
                    <TableHead className="text-right">Single</TableHead>
                    <TableHead className="text-right">10-Pack (per class)</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableRow>
                    <TableCell>Member</TableCell>
                    <TableCell className="text-right">$25</TableCell>
                    <TableCell className="text-right">$17</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell>Non-Member</TableCell>
                    <TableCell className="text-right">$40</TableCell>
                    <TableCell className="text-right">$30</TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>
            <div>
              <h4 className="mb-2 font-medium">Other Classes</h4>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead></TableHead>
                    <TableHead className="text-right">Single</TableHead>
                    <TableHead className="text-right">10-Pack (per class)</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableRow>
                    <TableCell>Member</TableCell>
                    <TableCell className="text-right">$15</TableCell>
                    <TableCell className="text-right">$15</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell>Non-Member</TableCell>
                    <TableCell className="text-right">$30</TableCell>
                    <TableCell className="text-right">$20</TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
