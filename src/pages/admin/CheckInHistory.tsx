import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format, subDays, startOfDay, endOfDay } from "date-fns";
import { useNavigate } from "react-router-dom";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { CalendarIcon, Search, Users, Clock, TrendingUp, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

const getStatusColor = (status: string) => {
  switch (status?.toLowerCase()) {
    case "active":
      return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300";
    case "pending_activation":
      return "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-300";
    case "frozen":
      return "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300";
    case "past_due":
      return "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300";
    default:
      return "bg-muted text-muted-foreground";
  }
};

export default function AdminCheckInHistory() {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [startDate, setStartDate] = useState<Date>(subDays(new Date(), 7));
  const [endDate, setEndDate] = useState<Date>(new Date());

  const { data: checkIns, isLoading } = useQuery({
    queryKey: ["admin-check-in-history", startDate.toISOString(), endDate.toISOString()],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("check_ins")
        .select(`
          id,
          member_id,
          checked_in_at,
          checked_out_at,
          checked_in_by,
          notes,
          members!check_ins_member_id_fkey (
            id,
            first_name,
            last_name,
            member_id,
            membership_type,
            status,
            photo_url
          )
        `)
        .gte("checked_in_at", startOfDay(startDate).toISOString())
        .lte("checked_in_at", endOfDay(endDate).toISOString())
        .order("checked_in_at", { ascending: false })
        .limit(500);

      if (error) throw error;
      return data as any[];
    },
  });

  const filtered = useMemo(() => {
    if (!checkIns) return [];
    if (!search.trim()) return checkIns;
    const q = search.toLowerCase();
    return checkIns.filter((ci) => {
      const m = ci.members;
      if (!m) return false;
      return (
        m.first_name?.toLowerCase().includes(q) ||
        m.last_name?.toLowerCase().includes(q) ||
        m.member_id?.toLowerCase().includes(q) ||
        m.membership_type?.toLowerCase().includes(q)
      );
    });
  }, [checkIns, search]);

  const stats = useMemo(() => {
    if (!filtered?.length) return { total: 0, unique: 0, avgPerDay: 0 };
    const uniqueMembers = new Set(filtered.map((ci) => ci.member_id));
    const daysDiff = Math.max(1, Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1);
    return {
      total: filtered.length,
      unique: uniqueMembers.size,
      avgPerDay: Math.round((filtered.length / daysDiff) * 10) / 10,
    };
  }, [filtered, startDate, endDate]);

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Check-In History</h1>
          <p className="text-muted-foreground">Browse all member check-in records</p>
        </div>

        {/* Summary Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card>
            <CardContent className="pt-4 flex items-center gap-3">
              <Clock className="h-5 w-5 text-primary" />
              <div>
                <p className="text-2xl font-bold">{stats.total}</p>
                <p className="text-xs text-muted-foreground">Total Check-Ins</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 flex items-center gap-3">
              <Users className="h-5 w-5 text-primary" />
              <div>
                <p className="text-2xl font-bold">{stats.unique}</p>
                <p className="text-xs text-muted-foreground">Unique Members</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 flex items-center gap-3">
              <TrendingUp className="h-5 w-5 text-primary" />
              <div>
                <p className="text-2xl font-bold">{stats.avgPerDay}</p>
                <p className="text-xs text-muted-foreground">Avg / Day</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by name, member ID, or type..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className="justify-start text-left font-normal min-w-[200px]">
                <CalendarIcon className="mr-2 h-4 w-4" />
                {format(startDate, "MMM d")} – {format(endDate, "MMM d, yyyy")}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="end">
              <Calendar
                mode="range"
                selected={{ from: startDate, to: endDate }}
                onSelect={(range) => {
                  if (range?.from) setStartDate(range.from);
                  if (range?.to) setEndDate(range.to);
                }}
                numberOfMonths={2}
                className={cn("p-3 pointer-events-auto")}
              />
            </PopoverContent>
          </Popover>
        </div>

        {/* Table */}
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Member</TableHead>
                <TableHead>Member ID</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Check-In</TableHead>
                <TableHead>Check-Out</TableHead>
                <TableHead>Notes</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                    No check-ins found for this period.
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((ci) => {
                  const m = ci.members;
                  return (
                    <TableRow
                      key={ci.id}
                      className="cursor-pointer"
                      onClick={() => m && navigate(`/admin/members/${m.id}`)}
                    >
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Avatar className="h-8 w-8">
                            <AvatarImage src={m?.photo_url} />
                            <AvatarFallback className="text-xs">
                              {m?.first_name?.[0]}{m?.last_name?.[0]}
                            </AvatarFallback>
                          </Avatar>
                          <span className="font-medium">
                            {m?.first_name} {m?.last_name}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="font-mono text-xs">{m?.member_id}</TableCell>
                      <TableCell className="text-sm">{m?.membership_type}</TableCell>
                      <TableCell>
                        <Badge className={cn("text-xs", getStatusColor(m?.status || ""))}>
                          {m?.status?.replace(/_/g, " ").replace(/\b\w/g, (l: string) => l.toUpperCase())}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm whitespace-nowrap">
                        {format(new Date(ci.checked_in_at), "MMM d, h:mm a")}
                      </TableCell>
                      <TableCell className="text-sm whitespace-nowrap text-muted-foreground">
                        {ci.checked_out_at
                          ? format(new Date(ci.checked_out_at), "h:mm a")
                          : "—"}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground max-w-[200px] truncate">
                        {ci.notes || "—"}
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        )}
      </div>
    </AdminLayout>
  );
}
