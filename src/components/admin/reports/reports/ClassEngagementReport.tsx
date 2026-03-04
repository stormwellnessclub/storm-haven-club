import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Users, Dumbbell, TrendingUp, BarChart3 } from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line, Legend,
} from "recharts";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { startOfWeek, format } from "date-fns";

interface Props {
  dateRange: { start: Date; end: Date };
  filters: Record<string, string | boolean>;
}

export function ClassEngagementReport({ dateRange }: Props) {
  const { data, isLoading } = useQuery({
    queryKey: ["class-engagement-report", dateRange.start.toISOString(), dateRange.end.toISOString()],
    queryFn: async () => {
      const startStr = dateRange.start.toISOString();
      const endStr = dateRange.end.toISOString();

      // Get bookings with session + class type info
      const { data: bookings } = await supabase
        .from("class_bookings")
        .select("id, member_id, session_id, booked_at, status, class_sessions(id, session_date, class_type_id, class_types(name))")
        .gte("booked_at", startStr)
        .lte("booked_at", endStr)
        .in("status", ["confirmed", "completed"])
        .not("member_id", "is", null);

      if (!bookings || bookings.length === 0) return null;

      // Group by member
      const byMember: Record<string, { count: number; classTypes: Record<string, number>; dates: string[] }> = {};
      bookings.forEach(b => {
        const mid = b.member_id!;
        if (!byMember[mid]) byMember[mid] = { count: 0, classTypes: {}, dates: [] };
        byMember[mid].count++;
        const session = b.class_sessions as any;
        const typeName = session?.class_types?.name || "Unknown";
        byMember[mid].classTypes[typeName] = (byMember[mid].classTypes[typeName] || 0) + 1;
        if (session?.session_date) byMember[mid].dates.push(session.session_date);
      });

      const memberIds = Object.keys(byMember);
      const totalMembers = memberIds.length;
      const totalBookings = bookings.length;
      const avgPerMember = totalMembers > 0 ? Math.round((totalBookings / totalMembers) * 10) / 10 : 0;

      // Most popular class
      const classCount: Record<string, number> = {};
      bookings.forEach(b => {
        const session = b.class_sessions as any;
        const name = session?.class_types?.name || "Unknown";
        classCount[name] = (classCount[name] || 0) + 1;
      });
      const mostPopular = Object.entries(classCount).sort((a, b) => b[1] - a[1])[0]?.[0] || "—";

      // Distribution buckets
      const dist = { "1-2": 0, "3-5": 0, "6-10": 0, "10+": 0 };
      Object.values(byMember).forEach(m => {
        if (m.count <= 2) dist["1-2"]++;
        else if (m.count <= 5) dist["3-5"]++;
        else if (m.count <= 10) dist["6-10"]++;
        else dist["10+"]++;
      });
      const distData = Object.entries(dist).map(([name, value]) => ({ name, value }));

      // Weekly trend — unique members per week
      const weeklyMap: Record<string, Set<string>> = {};
      bookings.forEach(b => {
        const session = b.class_sessions as any;
        const date = session?.session_date;
        if (!date || !b.member_id) return;
        const weekStart = format(startOfWeek(new Date(date), { weekStartsOn: 1 }), "MMM d");
        if (!weeklyMap[weekStart]) weeklyMap[weekStart] = new Set();
        weeklyMap[weekStart].add(b.member_id);
      });
      const weeklyData = Object.entries(weeklyMap)
        .map(([week, members]) => ({ week, members: members.size }))
        .sort((a, b) => a.week.localeCompare(b.week));

      // Get member names for top participants
      const { data: members } = await supabase
        .from("members")
        .select("id, first_name, last_name, email")
        .in("id", memberIds.slice(0, 100));

      const memberMap: Record<string, { first_name: string; last_name: string; email: string }> = {};
      members?.forEach(m => { memberMap[m.id] = m; });

      const topParticipants = Object.entries(byMember)
        .map(([id, data]) => {
          const fav = Object.entries(data.classTypes).sort((a, b) => b[1] - a[1])[0]?.[0] || "—";
          const member = memberMap[id];
          return {
            id,
            name: member ? `${member.first_name} ${member.last_name}` : "Unknown",
            email: member?.email || "",
            classCount: data.count,
            favoriteClass: fav,
          };
        })
        .sort((a, b) => b.classCount - a.classCount)
        .slice(0, 15);

      return { totalMembers, avgPerMember, mostPopular, totalBookings, distData, weeklyData, topParticipants };
    },
  });

  if (isLoading) return <Skeleton className="h-96 w-full" />;
  if (!data) return <p className="text-muted-foreground text-center py-8">No class booking data found in this period.</p>;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card variant="flat"><CardContent className="pt-4">
          <div className="flex items-center gap-2 text-muted-foreground text-sm"><Users className="h-4 w-4" />Members in Classes</div>
          <p className="text-2xl font-bold mt-1">{data.totalMembers}</p>
        </CardContent></Card>
        <Card variant="flat"><CardContent className="pt-4">
          <div className="flex items-center gap-2 text-muted-foreground text-sm"><BarChart3 className="h-4 w-4" />Avg Classes/Member</div>
          <p className="text-2xl font-bold mt-1">{data.avgPerMember}</p>
        </CardContent></Card>
        <Card variant="flat"><CardContent className="pt-4">
          <div className="flex items-center gap-2 text-muted-foreground text-sm"><Dumbbell className="h-4 w-4" />Most Popular</div>
          <p className="text-2xl font-bold mt-1 truncate">{data.mostPopular}</p>
        </CardContent></Card>
        <Card variant="flat"><CardContent className="pt-4">
          <div className="flex items-center gap-2 text-muted-foreground text-sm"><TrendingUp className="h-4 w-4" />Total Bookings</div>
          <p className="text-2xl font-bold mt-1">{data.totalBookings}</p>
        </CardContent></Card>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <Card>
          <CardHeader><CardTitle className="text-base">Classes per Member Distribution</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={data.distData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="value" fill="hsl(var(--chart-3))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-base">Weekly Unique Participants</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={data.weeklyData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="week" tick={{ fontSize: 12 }} />
                <YAxis />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="members" stroke="hsl(var(--chart-1))" strokeWidth={2} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Top 15 Most Active Class Participants</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Member</TableHead>
                <TableHead>Email</TableHead>
                <TableHead className="text-right">Classes</TableHead>
                <TableHead>Favorite Class</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.topParticipants.map(p => (
                <TableRow key={p.id}>
                  <TableCell className="font-medium">{p.name}</TableCell>
                  <TableCell className="text-muted-foreground">{p.email}</TableCell>
                  <TableCell className="text-right">{p.classCount}</TableCell>
                  <TableCell>{p.favoriteClass}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
