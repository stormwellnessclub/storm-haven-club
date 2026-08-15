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
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { SignedMemberPhoto } from "@/components/member/SignedMemberPhoto";

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
    case "guest":
      return "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300";
    default:
      return "bg-muted text-muted-foreground";
  }
};

interface UnifiedCheckIn {
  id: string;
  checked_in_at: string;
  checked_out_at: string | null;
  notes: string | null;
  is_guest: boolean;
  member_id: string | null;
  member?: {
    id: string;
    first_name: string | null;
    last_name: string | null;
    member_id: string | null;
    membership_type: string | null;
    status: string | null;
    photo_url: string | null;
  } | null;
  guest_name?: string | null;
}

export default function AdminCheckInHistory() {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [startDate, setStartDate] = useState<Date>(subDays(new Date(), 7));
  const [endDate, setEndDate] = useState<Date>(new Date());

  const { data: checkIns, isLoading } = useQuery({
    queryKey: ["admin-check-in-history", startDate.toISOString(), endDate.toISOString()],
    queryFn: async () => {
      const startISO = startOfDay(startDate).toISOString();
      const endISO = endOfDay(endDate).toISOString();

      // Fetch member check-ins in batches
      const memberResults: any[] = [];
      const batchSize = 1000;
      let offset = 0;
      let hasMore = true;

      while (hasMore) {
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
          .gte("checked_in_at", startISO)
          .lte("checked_in_at", endISO)
          .order("checked_in_at", { ascending: false })
          .range(offset, offset + batchSize - 1);

        if (error) throw error;

        if (data && data.length > 0) {
          memberResults.push(...data);
          offset += batchSize;
          hasMore = data.length === batchSize;
        } else {
          hasMore = false;
        }
      }

      // Fetch guest check-ins. `exhausted` is the canonical completed state;
      // retain `used` for compatibility with historical records.
      const { data: guestData, error: guestError } = await supabase
        .from("guest_passes")
        .select("id, guest_name, used_at, valid_date, status, guest_email")
        .in("status", ["used", "exhausted"])
        .not("used_at", "is", null)
        .gte("used_at", startISO)
        .lte("used_at", endISO)
        .order("used_at", { ascending: false });

      if (guestError) throw guestError;

      // Unify into one list
      const unified: UnifiedCheckIn[] = memberResults.map((ci: any) => ({
        id: ci.id,
        checked_in_at: ci.checked_in_at,
        checked_out_at: ci.checked_out_at,
        notes: ci.notes,
        is_guest: false,
        member_id: ci.member_id,
        member: ci.members ? {
          id: ci.members.id,
          first_name: ci.members.first_name,
          last_name: ci.members.last_name,
          member_id: ci.members.member_id,
          membership_type: ci.members.membership_type,
          status: ci.members.status,
          photo_url: ci.members.photo_url,
        } : null,
      }));

      for (const g of guestData || []) {
        unified.push({
          id: g.id,
          checked_in_at: g.used_at!,
          checked_out_at: null,
          notes: null,
          is_guest: true,
          member_id: null,
          guest_name: g.guest_name,
        });
      }

      // Sort by check-in time descending
      unified.sort((a, b) => new Date(b.checked_in_at).getTime() - new Date(a.checked_in_at).getTime());

      return unified;
    },
  });

  const filtered = useMemo(() => {
    if (!checkIns) return [];
    if (!search.trim()) return checkIns;
    const q = search.toLowerCase();
    return checkIns.filter((ci) => {
      if (ci.is_guest) {
        return ci.guest_name?.toLowerCase().includes(q) || "guest".includes(q);
      }
      const m = ci.member;
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
    if (!filtered?.length) return { total: 0, unique: 0, avgPerDay: 0, guests: 0 };
    const memberCheckIns = filtered.filter((ci) => !ci.is_guest);
    const guestCheckIns = filtered.filter((ci) => ci.is_guest);
    const uniqueMembers = new Set(memberCheckIns.map((ci) => ci.member_id));
    const daysDiff = Math.max(1, Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1);
    return {
      total: filtered.length,
      unique: uniqueMembers.size + guestCheckIns.length,
      avgPerDay: Math.round((filtered.length / daysDiff) * 10) / 10,
      guests: guestCheckIns.length,
    };
  }, [filtered, startDate, endDate]);

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Check-In History</h1>
          <p className="text-muted-foreground">Browse all member and guest check-in records</p>
        </div>

        {/* Summary Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
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
                <p className="text-xs text-muted-foreground">Unique Visitors</p>
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
          <Card>
            <CardContent className="pt-4 flex items-center gap-3">
              <Users className="h-5 w-5 text-purple-600" />
              <div>
                <p className="text-2xl font-bold">{stats.guests}</p>
                <p className="text-xs text-muted-foreground">Guest Check-Ins</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by name, member ID, type, or 'guest'..."
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
                <TableHead>Visitor</TableHead>
                <TableHead>ID</TableHead>
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
                  if (ci.is_guest) {
                    return (
                      <TableRow key={`guest-${ci.id}`}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Avatar className="h-8 w-8">
                              <AvatarFallback className="text-xs bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300">
                                G
                              </AvatarFallback>
                            </Avatar>
                            <span className="font-medium">{ci.guest_name}</span>
                          </div>
                        </TableCell>
                        <TableCell className="font-mono text-xs text-muted-foreground">—</TableCell>
                        <TableCell>
                          <Badge className="text-xs bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300">
                            Guest Pass
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge className={cn("text-xs", getStatusColor("guest"))}>
                            Guest
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm whitespace-nowrap">
                          {format(new Date(ci.checked_in_at), "MMM d, h:mm a")}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">—</TableCell>
                        <TableCell className="text-sm text-muted-foreground">—</TableCell>
                      </TableRow>
                    );
                  }

                  const m = ci.member;
                  return (
                    <TableRow
                      key={ci.id}
                      className="cursor-pointer"
                      onClick={() => m && navigate(`/admin/members/${m.id}`)}
                    >
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Avatar className="h-8 w-8">
                            <SignedMemberPhoto photoUrl={m?.photo_url} alt={`${m?.first_name || ""} ${m?.last_name || ""}`} />
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
