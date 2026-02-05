import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import { Download, DollarSign, Users, TrendingUp, Calendar, Crown } from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  Legend,
} from "recharts";

// Pricing structure
const PRICING = {
  diamond: { monthly: 500, annual: 6000, initiation: 300 },
  platinum: { monthly: 350, annual: 4200, initiation: 300 },
  gold: { monthly: 250, annual: 3000, initiation: 300 },
  silver: { monthly: 200, annual: 2400, initiation: 300 },
};

const TIER_COLORS = {
  diamond: "hsl(var(--chart-1))",
  platinum: "hsl(var(--chart-2))",
  gold: "hsl(var(--chart-3))",
  silver: "hsl(var(--chart-4))",
};

const FOUNDING_COLORS = ["hsl(var(--chart-1))", "hsl(var(--chart-5))"];

// Normalize tier names from database
function normalizeTierName(rawPlan: string): string {
  const plan = rawPlan?.toLowerCase() || "";
  if (plan.includes("diamond")) return "diamond";
  if (plan.includes("platinum")) return "platinum";
  if (plan.includes("gold")) return "gold";
  if (plan.includes("silver")) return "silver";
  return "silver";
}

function formatTierDisplay(tier: string): string {
  return tier.charAt(0).toUpperCase() + tier.slice(1);
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

interface ApplicationData {
  id: string;
  membership_plan: string;
  founding_member: string;
  status: string;
  created_at: string;
}

export default function RevenueAnalytics() {
  const [activeTab, setActiveTab] = useState("overview");

  // Fetch applications (excluding test data after Dec 27, 2025)
  const { data: applications, isLoading } = useQuery({
    queryKey: ["revenue-analytics-applications"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("membership_applications")
        .select("id, membership_plan, founding_member, status, created_at")
        .order("created_at", { ascending: true });

      if (error) throw error;
      return data || [];
    },
  });

  // Calculate all revenue metrics
  const metrics = useMemo(() => {
    if (!applications) return null;

    const tierBreakdown = {
      diamond: { founding: 0, regular: 0 },
      platinum: { founding: 0, regular: 0 },
      gold: { founding: 0, regular: 0 },
      silver: { founding: 0, regular: 0 },
    };

    // Count members by tier and founding status
    applications.forEach((app) => {
      const tier = normalizeTierName(app.membership_plan) as keyof typeof tierBreakdown;
      if (tierBreakdown[tier]) {
        const isFounding = app.founding_member === "yes" || app.founding_member === "true";
        if (isFounding) {
          tierBreakdown[tier].founding++;
        } else {
          tierBreakdown[tier].regular++;
        }
      }
    });

    // Calculate revenues
    let foundingAnnualDues = 0;
    let foundingInitiationFees = 0;
    let regularFirstMonthDues = 0;
    let regularInitiationFees = 0;
    let monthlyRecurringRevenue = 0;

    Object.entries(tierBreakdown).forEach(([tier, counts]) => {
      const pricing = PRICING[tier as keyof typeof PRICING];
      
      // Founding members: annual dues upfront + initiation
      foundingAnnualDues += counts.founding * pricing.annual;
      foundingInitiationFees += counts.founding * pricing.initiation;
      
      // Regular members: first month + initiation
      regularFirstMonthDues += counts.regular * pricing.monthly;
      regularInitiationFees += counts.regular * pricing.initiation;
      
      // MRR from regular members only (founding already paid annual)
      monthlyRecurringRevenue += counts.regular * pricing.monthly;
    });

    const totalFoundingMembers = Object.values(tierBreakdown).reduce(
      (sum, t) => sum + t.founding,
      0
    );
    const totalRegularMembers = Object.values(tierBreakdown).reduce(
      (sum, t) => sum + t.regular,
      0
    );
    const totalMembers = totalFoundingMembers + totalRegularMembers;

    const firstMonthRevenue =
      foundingAnnualDues +
      foundingInitiationFees +
      regularFirstMonthDues +
      regularInitiationFees;

    // Year 1 projection: First month + 11 months of MRR
    const year1Projection = firstMonthRevenue + monthlyRecurringRevenue * 11;

    // 12-month cash flow projection
    const cashFlowProjection = Array.from({ length: 12 }, (_, month) => {
      if (month === 0) {
        return {
          month: "Month 1",
          revenue: firstMonthRevenue,
          foundingDues: foundingAnnualDues,
          regularDues: regularFirstMonthDues,
          initiationFees: foundingInitiationFees + regularInitiationFees,
        };
      }
      return {
        month: `Month ${month + 1}`,
        revenue: monthlyRecurringRevenue,
        foundingDues: 0,
        regularDues: monthlyRecurringRevenue,
        initiationFees: 0,
      };
    });

    // Tier breakdown for charts
    const tierChartData = Object.entries(tierBreakdown).map(([tier, counts]) => ({
      tier: formatTierDisplay(tier),
      founding: counts.founding,
      regular: counts.regular,
      total: counts.founding + counts.regular,
      foundingRevenue: counts.founding * PRICING[tier as keyof typeof PRICING].annual,
      regularRevenue: counts.regular * PRICING[tier as keyof typeof PRICING].monthly * 12,
    }));

    const foundingPieData = [
      { name: "Founding Members", value: totalFoundingMembers },
      { name: "Regular Members", value: totalRegularMembers },
    ];

    return {
      tierBreakdown,
      tierChartData,
      foundingPieData,
      cashFlowProjection,
      totalMembers,
      totalFoundingMembers,
      totalRegularMembers,
      firstMonthRevenue,
      monthlyRecurringRevenue,
      year1Projection,
      foundingAnnualDues,
      foundingInitiationFees,
      regularFirstMonthDues,
      regularInitiationFees,
    };
  }, [applications]);

  const handleExportCSV = () => {
    if (!metrics || !applications) return;

    const rows = [
      ["Revenue Analytics Report"],
      ["Generated", new Date().toLocaleString()],
      [],
      ["Summary"],
      ["Total Members", metrics.totalMembers],
      ["Founding Members", metrics.totalFoundingMembers],
      ["Regular Members", metrics.totalRegularMembers],
      ["First Month Revenue", formatCurrency(metrics.firstMonthRevenue)],
      ["Monthly Recurring Revenue", formatCurrency(metrics.monthlyRecurringRevenue)],
      ["Year 1 Projection", formatCurrency(metrics.year1Projection)],
      [],
      ["Tier Breakdown"],
      ["Tier", "Founding", "Regular", "Total", "Founding Revenue", "Regular Annual Revenue"],
      ...metrics.tierChartData.map((t) => [
        t.tier,
        t.founding,
        t.regular,
        t.total,
        formatCurrency(t.foundingRevenue),
        formatCurrency(t.regularRevenue),
      ]),
      [],
      ["12-Month Cash Flow"],
      ["Month", "Total Revenue", "Founding Dues", "Regular Dues", "Initiation Fees"],
      ...metrics.cashFlowProjection.map((m) => [
        m.month,
        formatCurrency(m.revenue),
        formatCurrency(m.foundingDues),
        formatCurrency(m.regularDues),
        formatCurrency(m.initiationFees),
      ]),
    ];

    const csvContent = rows.map((row) => row.join(",")).join("\n");
    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `revenue-analytics-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <AdminLayout title="Revenue Analytics">
      <div className="space-y-6">
        {/* Header Actions */}
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-2">
            <p className="text-sm text-muted-foreground hidden sm:block">Real-time revenue projections and analytics</p>
            <Badge variant="outline" className="bg-primary/10 text-primary border-primary/30">
              <Crown className="h-3 w-3 mr-1" />
              Super Admin Only
            </Badge>
          </div>
          <Button onClick={handleExportCSV} disabled={isLoading || !metrics}>
            <Download className="h-4 w-4 mr-2" />
            Export CSV
          </Button>
        </div>

        {/* Summary Cards */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Year 1 Projection</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <Skeleton className="h-8 w-32" />
              ) : (
                <div className="text-2xl font-bold text-primary">
                  {formatCurrency(metrics?.year1Projection || 0)}
                </div>
              )}
              <p className="text-xs text-muted-foreground">Based on current applications</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">First Month Revenue</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <Skeleton className="h-8 w-32" />
              ) : (
                <div className="text-2xl font-bold">
                  {formatCurrency(metrics?.firstMonthRevenue || 0)}
                </div>
              )}
              <p className="text-xs text-muted-foreground">All upfront payments + initiation</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Monthly Recurring</CardTitle>
              <Calendar className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <Skeleton className="h-8 w-32" />
              ) : (
                <div className="text-2xl font-bold">
                  {formatCurrency(metrics?.monthlyRecurringRevenue || 0)}
                </div>
              )}
              <p className="text-xs text-muted-foreground">From non-founding members</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Applicants</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <Skeleton className="h-8 w-32" />
              ) : (
                <div className="text-2xl font-bold">{metrics?.totalMembers || 0}</div>
              )}
              <p className="text-xs text-muted-foreground">
                {metrics?.totalFoundingMembers || 0} founding, {metrics?.totalRegularMembers || 0} regular
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="tiers">Tier Breakdown</TabsTrigger>
            <TabsTrigger value="cashflow">Cash Flow</TabsTrigger>
            <TabsTrigger value="founding">Founding Members</TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              {/* Revenue by Tier Bar Chart */}
              <Card>
                <CardHeader>
                  <CardTitle>Members by Tier</CardTitle>
                  <CardDescription>Distribution of members across membership tiers</CardDescription>
                </CardHeader>
                <CardContent>
                  {isLoading ? (
                    <Skeleton className="h-[300px] w-full" />
                  ) : (
                    <ResponsiveContainer width="100%" height={300}>
                      <BarChart data={metrics?.tierChartData}>
                        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                        <XAxis dataKey="tier" className="text-xs" />
                        <YAxis className="text-xs" />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: "hsl(var(--card))",
                            border: "1px solid hsl(var(--border))",
                            borderRadius: "8px",
                          }}
                        />
                        <Legend />
                        <Bar dataKey="founding" name="Founding" fill="hsl(var(--chart-1))" />
                        <Bar dataKey="regular" name="Regular" fill="hsl(var(--chart-5))" />
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </CardContent>
              </Card>

              {/* Founding vs Regular Pie Chart */}
              <Card>
                <CardHeader>
                  <CardTitle>Founding vs Regular</CardTitle>
                  <CardDescription>Member type distribution</CardDescription>
                </CardHeader>
                <CardContent>
                  {isLoading ? (
                    <Skeleton className="h-[300px] w-full" />
                  ) : (
                    <ResponsiveContainer width="100%" height={300}>
                      <PieChart>
                        <Pie
                          data={metrics?.foundingPieData}
                          cx="50%"
                          cy="50%"
                          labelLine={false}
                          label={({ name, percent }) =>
                            `${name}: ${(percent * 100).toFixed(0)}%`
                          }
                          outerRadius={100}
                          fill="#8884d8"
                          dataKey="value"
                        >
                          {metrics?.foundingPieData.map((_, index) => (
                            <Cell key={`cell-${index}`} fill={FOUNDING_COLORS[index % FOUNDING_COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip
                          contentStyle={{
                            backgroundColor: "hsl(var(--card))",
                            border: "1px solid hsl(var(--border))",
                            borderRadius: "8px",
                          }}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* First Month Revenue Breakdown */}
            <Card>
              <CardHeader>
                <CardTitle>First Month Revenue Breakdown</CardTitle>
                <CardDescription>Detailed breakdown of first month expected revenue</CardDescription>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <Skeleton className="h-32 w-full" />
                ) : (
                  <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                    <div className="space-y-1">
                      <p className="text-sm text-muted-foreground">Founding Annual Dues</p>
                      <p className="text-xl font-semibold">
                        {formatCurrency(metrics?.foundingAnnualDues || 0)}
                      </p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-sm text-muted-foreground">Founding Initiation Fees</p>
                      <p className="text-xl font-semibold">
                        {formatCurrency(metrics?.foundingInitiationFees || 0)}
                      </p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-sm text-muted-foreground">Regular First Month Dues</p>
                      <p className="text-xl font-semibold">
                        {formatCurrency(metrics?.regularFirstMonthDues || 0)}
                      </p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-sm text-muted-foreground">Regular Initiation Fees</p>
                      <p className="text-xl font-semibold">
                        {formatCurrency(metrics?.regularInitiationFees || 0)}
                      </p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Tier Breakdown Tab */}
          <TabsContent value="tiers" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Detailed Tier Analysis</CardTitle>
                <CardDescription>Revenue breakdown by membership tier</CardDescription>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <Skeleton className="h-64 w-full" />
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Tier</TableHead>
                        <TableHead className="text-right">Founding</TableHead>
                        <TableHead className="text-right">Regular</TableHead>
                        <TableHead className="text-right">Total</TableHead>
                        <TableHead className="text-right">Monthly Rate</TableHead>
                        <TableHead className="text-right">Annual Rate</TableHead>
                        <TableHead className="text-right">Founding Revenue</TableHead>
                        <TableHead className="text-right">Regular Annual</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {metrics?.tierChartData.map((tier) => {
                        const tierKey = tier.tier.toLowerCase() as keyof typeof PRICING;
                        const pricing = PRICING[tierKey];
                        return (
                          <TableRow key={tier.tier}>
                            <TableCell>
                              <Badge
                                variant="outline"
                                style={{
                                  borderColor: TIER_COLORS[tierKey],
                                  color: TIER_COLORS[tierKey],
                                }}
                              >
                                {tier.tier}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right">{tier.founding}</TableCell>
                            <TableCell className="text-right">{tier.regular}</TableCell>
                            <TableCell className="text-right font-medium">{tier.total}</TableCell>
                            <TableCell className="text-right">{formatCurrency(pricing.monthly)}/mo</TableCell>
                            <TableCell className="text-right">{formatCurrency(pricing.annual)}/yr</TableCell>
                            <TableCell className="text-right font-medium">
                              {formatCurrency(tier.foundingRevenue)}
                            </TableCell>
                            <TableCell className="text-right">
                              {formatCurrency(tier.regularRevenue)}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                      <TableRow className="bg-muted/50 font-bold">
                        <TableCell>Total</TableCell>
                        <TableCell className="text-right">{metrics?.totalFoundingMembers}</TableCell>
                        <TableCell className="text-right">{metrics?.totalRegularMembers}</TableCell>
                        <TableCell className="text-right">{metrics?.totalMembers}</TableCell>
                        <TableCell className="text-right">-</TableCell>
                        <TableCell className="text-right">-</TableCell>
                        <TableCell className="text-right">
                          {formatCurrency(metrics?.foundingAnnualDues || 0)}
                        </TableCell>
                        <TableCell className="text-right">
                          {formatCurrency(
                            metrics?.tierChartData.reduce((sum, t) => sum + t.regularRevenue, 0) || 0
                          )}
                        </TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Cash Flow Tab */}
          <TabsContent value="cashflow" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>12-Month Cash Flow Projection</CardTitle>
                <CardDescription>Expected monthly revenue based on current applications</CardDescription>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <Skeleton className="h-[350px] w-full" />
                ) : (
                  <ResponsiveContainer width="100%" height={350}>
                    <LineChart data={metrics?.cashFlowProjection}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis dataKey="month" className="text-xs" />
                      <YAxis
                        className="text-xs"
                        tickFormatter={(value) => `$${(value / 1000).toFixed(0)}k`}
                      />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "hsl(var(--card))",
                          border: "1px solid hsl(var(--border))",
                          borderRadius: "8px",
                        }}
                        formatter={(value: number) => formatCurrency(value)}
                      />
                      <Legend />
                      <Line
                        type="monotone"
                        dataKey="revenue"
                        name="Total Revenue"
                        stroke="hsl(var(--primary))"
                        strokeWidth={2}
                        dot={{ fill: "hsl(var(--primary))" }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Monthly Breakdown</CardTitle>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <Skeleton className="h-64 w-full" />
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Month</TableHead>
                        <TableHead className="text-right">Total Revenue</TableHead>
                        <TableHead className="text-right">Founding Dues</TableHead>
                        <TableHead className="text-right">Regular Dues</TableHead>
                        <TableHead className="text-right">Initiation Fees</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {metrics?.cashFlowProjection.map((month) => (
                        <TableRow key={month.month}>
                          <TableCell className="font-medium">{month.month}</TableCell>
                          <TableCell className="text-right font-semibold">
                            {formatCurrency(month.revenue)}
                          </TableCell>
                          <TableCell className="text-right">
                            {formatCurrency(month.foundingDues)}
                          </TableCell>
                          <TableCell className="text-right">
                            {formatCurrency(month.regularDues)}
                          </TableCell>
                          <TableCell className="text-right">
                            {formatCurrency(month.initiationFees)}
                          </TableCell>
                        </TableRow>
                      ))}
                      <TableRow className="bg-muted/50 font-bold">
                        <TableCell>Year 1 Total</TableCell>
                        <TableCell className="text-right">
                          {formatCurrency(metrics?.year1Projection || 0)}
                        </TableCell>
                        <TableCell className="text-right">
                          {formatCurrency(metrics?.foundingAnnualDues || 0)}
                        </TableCell>
                        <TableCell className="text-right">
                          {formatCurrency((metrics?.monthlyRecurringRevenue || 0) * 12)}
                        </TableCell>
                        <TableCell className="text-right">
                          {formatCurrency(
                            (metrics?.foundingInitiationFees || 0) + (metrics?.regularInitiationFees || 0)
                          )}
                        </TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Founding Members Tab */}
          <TabsContent value="founding" className="space-y-4">
            <div className="grid gap-4 md:grid-cols-3">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">Founding Members</CardTitle>
                </CardHeader>
                <CardContent>
                  {isLoading ? (
                    <Skeleton className="h-8 w-20" />
                  ) : (
                    <>
                      <div className="text-2xl font-bold">{metrics?.totalFoundingMembers || 0}</div>
                      <p className="text-xs text-muted-foreground">
                        {((metrics?.totalFoundingMembers || 0) / (metrics?.totalMembers || 1) * 100).toFixed(1)}% of total
                      </p>
                    </>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">Founding Upfront Revenue</CardTitle>
                </CardHeader>
                <CardContent>
                  {isLoading ? (
                    <Skeleton className="h-8 w-28" />
                  ) : (
                    <>
                      <div className="text-2xl font-bold">
                        {formatCurrency((metrics?.foundingAnnualDues || 0) + (metrics?.foundingInitiationFees || 0))}
                      </div>
                      <p className="text-xs text-muted-foreground">Annual dues + initiation fees</p>
                    </>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">Avg. Founding Value</CardTitle>
                </CardHeader>
                <CardContent>
                  {isLoading ? (
                    <Skeleton className="h-8 w-24" />
                  ) : (
                    <>
                      <div className="text-2xl font-bold">
                        {formatCurrency(
                          metrics?.totalFoundingMembers
                            ? ((metrics?.foundingAnnualDues || 0) + (metrics?.foundingInitiationFees || 0)) /
                                metrics.totalFoundingMembers
                            : 0
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">Per founding member</p>
                    </>
                  )}
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Founding Members by Tier</CardTitle>
                <CardDescription>Breakdown of founding member revenue by membership tier</CardDescription>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <Skeleton className="h-64 w-full" />
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Tier</TableHead>
                        <TableHead className="text-right">Count</TableHead>
                        <TableHead className="text-right">Annual Rate</TableHead>
                        <TableHead className="text-right">Initiation Fee</TableHead>
                        <TableHead className="text-right">Total Dues</TableHead>
                        <TableHead className="text-right">Total Initiation</TableHead>
                        <TableHead className="text-right">Total Revenue</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {Object.entries(metrics?.tierBreakdown || {}).map(([tier, counts]) => {
                        const pricing = PRICING[tier as keyof typeof PRICING];
                        const totalDues = counts.founding * pricing.annual;
                        const totalInitiation = counts.founding * pricing.initiation;
                        return (
                          <TableRow key={tier}>
                            <TableCell>
                              <Badge
                                variant="outline"
                                style={{
                                  borderColor: TIER_COLORS[tier as keyof typeof TIER_COLORS],
                                  color: TIER_COLORS[tier as keyof typeof TIER_COLORS],
                                }}
                              >
                                {formatTierDisplay(tier)}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right">{counts.founding}</TableCell>
                            <TableCell className="text-right">{formatCurrency(pricing.annual)}</TableCell>
                            <TableCell className="text-right">{formatCurrency(pricing.initiation)}</TableCell>
                            <TableCell className="text-right">{formatCurrency(totalDues)}</TableCell>
                            <TableCell className="text-right">{formatCurrency(totalInitiation)}</TableCell>
                            <TableCell className="text-right font-medium">
                              {formatCurrency(totalDues + totalInitiation)}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                      <TableRow className="bg-muted/50 font-bold">
                        <TableCell>Total</TableCell>
                        <TableCell className="text-right">{metrics?.totalFoundingMembers}</TableCell>
                        <TableCell className="text-right">-</TableCell>
                        <TableCell className="text-right">-</TableCell>
                        <TableCell className="text-right">
                          {formatCurrency(metrics?.foundingAnnualDues || 0)}
                        </TableCell>
                        <TableCell className="text-right">
                          {formatCurrency(metrics?.foundingInitiationFees || 0)}
                        </TableCell>
                        <TableCell className="text-right">
                          {formatCurrency(
                            (metrics?.foundingAnnualDues || 0) + (metrics?.foundingInitiationFees || 0)
                          )}
                        </TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </AdminLayout>
  );
}
