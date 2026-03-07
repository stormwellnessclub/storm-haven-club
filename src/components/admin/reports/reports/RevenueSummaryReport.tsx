import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent } from "@/components/ui/card";
import { DollarSign, TrendingUp, Users, Trophy } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { 
  extractTier, 
  normalizeGender, 
  getMonthlyPrice, 
  getAnnualPrice,
  INITIATION_FEE,
  type MembershipTier
} from "@/lib/membershipPricing";

interface Props {
  dateRange: { start: Date; end: Date };
  filters: Record<string, string | boolean>;
}

export function RevenueSummaryReport({ dateRange, filters }: Props) {
  const { data, isLoading } = useQuery({
    queryKey: ['report-revenue-summary', dateRange, filters],
    queryFn: async () => {
      const { data: members, error } = await supabase
        .from('members')
        .select('membership_type, status, is_founding_member, gender, created_at, subscription_status, stripe_subscription_id, billing_type')
        .in('status', ['active']);

      if (error) throw error;

      const tierFilter = filters.tier as string;
      const allActive = tierFilter && tierFilter !== 'all' 
        ? members?.filter(m => m.membership_type?.toLowerCase().includes(tierFilter.toLowerCase()))
        : members;

      // Only count paying members
      const filtered = (allActive || []).filter(m => {
        if (m.is_founding_member) return true; // founding = paid upfront
        if ((m as any).billing_type === 'cash') return true; // cash-billing
        return m.subscription_status === 'active' && !!m.stripe_subscription_id;
      });

      const nonPayingCount = (allActive || []).length - filtered.length;

      // Separate founding and regular members
      const foundingMembers = filtered.filter(m => m.is_founding_member);
      const regularMembers = filtered.filter(m => !m.is_founding_member);

      // Calculate revenue by tier with proper founding vs regular logic
      const tierData: Record<string, {
        tier: string;
        foundingCount: number;
        regularCount: number;
        foundingAnnual: number;
        regularMonthly: number;
      }> = {};

      // Process founding members - they pay annual upfront
      foundingMembers.forEach(member => {
        const tier = extractTier(member.membership_type);
        const gender = normalizeGender(member.gender);
        
        if (!tierData[tier]) {
          tierData[tier] = { tier, foundingCount: 0, regularCount: 0, foundingAnnual: 0, regularMonthly: 0 };
        }
        
        tierData[tier].foundingCount += 1;
        tierData[tier].foundingAnnual += getAnnualPrice(tier, gender);
      });

      // Filter regular members to only those actually paying
      const payingRegular = regularMembers.filter(m => 
        m.subscription_status === 'active' && true
      );
      const notPayingCount = regularMembers.length - payingRegular.length;

      // Process regular members - they pay monthly
      payingRegular.forEach(member => {
        const tier = extractTier(member.membership_type);
        const gender = normalizeGender(member.gender);
        
        if (!tierData[tier]) {
          tierData[tier] = { tier, foundingCount: 0, regularCount: 0, foundingAnnual: 0, regularMonthly: 0 };
        }
        
        tierData[tier].regularCount += 1;
        tierData[tier].regularMonthly += getMonthlyPrice(tier, gender);
      });

      const tierRevenue = Object.values(tierData);

      const chartData = tierRevenue.map(t => ({
        name: t.tier.charAt(0).toUpperCase() + t.tier.slice(1),
        'Founding Annual': t.foundingAnnual,
        'Regular Monthly': t.regularMonthly,
      }));

      const totals = tierRevenue.reduce((acc, t) => ({
        foundingCount: acc.foundingCount + t.foundingCount,
        regularCount: acc.regularCount + t.regularCount,
        foundingAnnual: acc.foundingAnnual + t.foundingAnnual,
        regularMonthly: acc.regularMonthly + t.regularMonthly,
      }), { foundingCount: 0, regularCount: 0, foundingAnnual: 0, regularMonthly: 0 });

      return { tierRevenue, chartData, totals, totalMembers: (filtered || []).length, notPayingCount };
    },
  });

  if (isLoading) {
    return <Skeleton className="h-96 w-full" />;
  }

  const formatCurrency = (value: number) => 
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(value);

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-full bg-primary/10">
                <Users className="h-6 w-6 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Active Members</p>
                <p className="text-2xl font-bold">{data?.totalMembers || 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-full bg-yellow-500/10">
                <Trophy className="h-6 w-6 text-yellow-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Founding Annual</p>
                <p className="text-2xl font-bold">{formatCurrency(data?.totals.foundingAnnual || 0)}</p>
                <p className="text-xs text-muted-foreground">{data?.totals.foundingCount || 0} members (paid upfront)</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-full bg-green-500/10">
                <DollarSign className="h-6 w-6 text-green-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Monthly Recurring</p>
                <p className="text-2xl font-bold">{formatCurrency(data?.totals.regularMonthly || 0)}</p>
                <p className="text-xs text-muted-foreground">{data?.totals.regularCount || 0} regular members</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-full bg-blue-500/10">
                <TrendingUp className="h-6 w-6 text-blue-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Annual Run Rate</p>
                <p className="text-2xl font-bold">
                  {formatCurrency((data?.totals.regularMonthly || 0) * 12 + (data?.totals.foundingAnnual || 0))}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Chart */}
      {data?.chartData && data.chartData.length > 0 && (
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data.chartData}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis dataKey="name" className="text-xs" />
              <YAxis tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} className="text-xs" />
              <Tooltip formatter={(value: number) => formatCurrency(value)} />
              <Legend />
              <Bar dataKey="Founding Annual" fill="hsl(45, 93%, 47%)" radius={[4, 4, 0, 0]} />
              <Bar dataKey="Regular Monthly" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Table */}
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Tier</TableHead>
            <TableHead className="text-right">Founding</TableHead>
            <TableHead className="text-right">Annual Revenue</TableHead>
            <TableHead className="text-right">Regular</TableHead>
            <TableHead className="text-right">Monthly Revenue</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {data?.tierRevenue.map((row) => (
            <TableRow key={row.tier}>
              <TableCell className="font-medium capitalize">
                <Badge variant="outline">{row.tier}</Badge>
              </TableCell>
              <TableCell className="text-right">{row.foundingCount}</TableCell>
              <TableCell className="text-right">{formatCurrency(row.foundingAnnual)}</TableCell>
              <TableCell className="text-right">{row.regularCount}</TableCell>
              <TableCell className="text-right">{formatCurrency(row.regularMonthly)}</TableCell>
            </TableRow>
          ))}
          {data?.tierRevenue && data.tierRevenue.length > 0 && (
            <TableRow className="font-semibold bg-muted/50">
              <TableCell>Total</TableCell>
              <TableCell className="text-right">{data.totals.foundingCount}</TableCell>
              <TableCell className="text-right">{formatCurrency(data.totals.foundingAnnual)}</TableCell>
              <TableCell className="text-right">{data.totals.regularCount}</TableCell>
              <TableCell className="text-right">{formatCurrency(data.totals.regularMonthly)}</TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}
