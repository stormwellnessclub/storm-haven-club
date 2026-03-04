import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Users, Repeat, DollarSign, TrendingUp } from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { format } from "date-fns";
import { Badge } from "@/components/ui/badge";

interface Props {
  dateRange: { start: Date; end: Date };
  filters: Record<string, string | boolean>;
}

export function GuestReturnsReport({ dateRange }: Props) {
  const { data, isLoading } = useQuery({
    queryKey: ["guest-returns-report", dateRange.start.toISOString(), dateRange.end.toISOString()],
    queryFn: async () => {
      const { data: passes } = await supabase
        .from("guest_passes")
        .select("id, guest_email, guest_name, price_paid, created_at, used_at, status")
        .not("guest_email", "is", null)
        .neq("guest_email", "")
        .gte("created_at", dateRange.start.toISOString())
        .lte("created_at", dateRange.end.toISOString());

      if (!passes || passes.length === 0) return null;

      // Group by email
      const byEmail: Record<string, { name: string; email: string; count: number; totalSpend: number; lastVisit: string }> = {};
      passes.forEach(p => {
        const email = (p.guest_email || "").toLowerCase().trim();
        if (!email) return;
        if (!byEmail[email]) {
          byEmail[email] = { name: p.guest_name, email, count: 0, totalSpend: 0, lastVisit: p.created_at || "" };
        }
        byEmail[email].count++;
        byEmail[email].totalSpend += p.price_paid || 0;
        if ((p.created_at || "") > byEmail[email].lastVisit) {
          byEmail[email].lastVisit = p.created_at || "";
          byEmail[email].name = p.guest_name;
        }
      });

      const guests = Object.values(byEmail);
      const totalUnique = guests.length;
      const repeatGuests = guests.filter(g => g.count >= 2);
      const returnRate = totalUnique > 0 ? Math.round((repeatGuests.length / totalUnique) * 100) : 0;
      const repeatRevenue = repeatGuests.reduce((s, g) => s + g.totalSpend, 0);

      // Distribution
      const dist = { "1 visit": 0, "2 visits": 0, "3+ visits": 0 };
      guests.forEach(g => {
        if (g.count === 1) dist["1 visit"]++;
        else if (g.count === 2) dist["2 visits"]++;
        else dist["3+ visits"]++;
      });
      const distData = Object.entries(dist).map(([name, value]) => ({ name, value }));

      // Check conversion — get member emails
      const repeatEmails = repeatGuests.map(g => g.email);
      let convertedEmails: Set<string> = new Set();
      if (repeatEmails.length > 0) {
        const { data: members } = await supabase
          .from("members")
          .select("email")
          .in("email", repeatEmails);
        members?.forEach(m => { if (m.email) convertedEmails.add(m.email.toLowerCase().trim()); });
      }

      // Top returning guests
      const topReturning = [...repeatGuests]
        .sort((a, b) => b.count - a.count)
        .slice(0, 20)
        .map(g => ({ ...g, converted: convertedEmails.has(g.email) }));

      return { totalUnique, repeatCount: repeatGuests.length, returnRate, repeatRevenue, distData, topReturning };
    },
  });

  if (isLoading) return <Skeleton className="h-96 w-full" />;
  if (!data) return <p className="text-muted-foreground text-center py-8">No guest pass data with emails found in this period.</p>;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card variant="flat"><CardContent className="pt-4">
          <div className="flex items-center gap-2 text-muted-foreground text-sm"><Users className="h-4 w-4" />Unique Guests</div>
          <p className="text-2xl font-bold mt-1">{data.totalUnique}</p>
        </CardContent></Card>
        <Card variant="flat"><CardContent className="pt-4">
          <div className="flex items-center gap-2 text-muted-foreground text-sm"><Repeat className="h-4 w-4" />Repeat Guests</div>
          <p className="text-2xl font-bold mt-1">{data.repeatCount}</p>
        </CardContent></Card>
        <Card variant="flat"><CardContent className="pt-4">
          <div className="flex items-center gap-2 text-muted-foreground text-sm"><TrendingUp className="h-4 w-4" />Return Rate</div>
          <p className="text-2xl font-bold mt-1">{data.returnRate}%</p>
        </CardContent></Card>
        <Card variant="flat"><CardContent className="pt-4">
          <div className="flex items-center gap-2 text-muted-foreground text-sm"><DollarSign className="h-4 w-4" />Repeat Revenue</div>
          <p className="text-2xl font-bold mt-1">${data.repeatRevenue.toFixed(2)}</p>
        </CardContent></Card>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Visit Count Distribution</CardTitle></CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={data.distData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip />
              <Bar dataKey="value" fill="hsl(var(--chart-2))" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Top Returning Guests</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Guest</TableHead>
                <TableHead>Email</TableHead>
                <TableHead className="text-right">Visits</TableHead>
                <TableHead className="text-right">Total Spend</TableHead>
                <TableHead>Last Visit</TableHead>
                <TableHead>Converted</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.topReturning.map((g, i) => (
                <TableRow key={i}>
                  <TableCell className="font-medium">{g.name}</TableCell>
                  <TableCell className="text-muted-foreground">{g.email}</TableCell>
                  <TableCell className="text-right">{g.count}</TableCell>
                  <TableCell className="text-right">${g.totalSpend.toFixed(2)}</TableCell>
                  <TableCell>{g.lastVisit ? format(new Date(g.lastVisit), "MMM d, yyyy") : "—"}</TableCell>
                  <TableCell>
                    {g.converted ? <Badge variant="default">Member</Badge> : <Badge variant="outline">Guest</Badge>}
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
