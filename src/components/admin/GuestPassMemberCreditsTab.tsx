import { useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Search, CreditCard, Users, TrendingDown } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { toast } from "sonner";

interface CreditRecord {
  id: string;
  member_id: string;
  credits_remaining: number;
  credits_total: number;
  cycle_start: string;
  cycle_end: string;
  expires_at: string;
  member?: {
    first_name: string;
    last_name: string;
    email: string;
  };
}

export function GuestPassMemberCreditsTab() {
  const [credits, setCredits] = useState<CreditRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [filter, setFilter] = useState("all");

  useEffect(() => {
    fetchCredits();
  }, []);

  const fetchCredits = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await (supabase
        .from("member_credits" as any)
        .select("*, member:members!member_credits_member_id_fkey(first_name, last_name, email)")
        .eq("credit_type", "guest_pass")
        .order("expires_at", { ascending: false }) as any);

      if (error) throw error;
      setCredits((data || []) as CreditRecord[]);
    } catch (error) {
      console.error("Error fetching credits:", error);
      toast.error("Failed to load member credits");
    } finally {
      setIsLoading(false);
    }
  };

  const filtered = useMemo(() => {
    let list = credits;
    if (filter === "has_credits") list = list.filter(c => c.credits_remaining > 0);
    if (filter === "used_all") list = list.filter(c => c.credits_remaining === 0);
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      list = list.filter(c =>
        c.member?.first_name?.toLowerCase().includes(q) ||
        c.member?.last_name?.toLowerCase().includes(q) ||
        c.member?.email?.toLowerCase().includes(q)
      );
    }
    return list;
  }, [credits, filter, searchQuery]);

  const summary = useMemo(() => {
    const now = new Date();
    const active = credits.filter(c => new Date(c.expires_at) > now);
    return {
      totalOutstanding: active.reduce((s, c) => s + c.credits_remaining, 0),
      membersWithCredits: active.filter(c => c.credits_remaining > 0).length,
      usedThisMonth: credits
        .filter(c => {
          const start = new Date(c.cycle_start);
          return start.getMonth() === now.getMonth() && start.getFullYear() === now.getFullYear();
        })
        .reduce((s, c) => s + (c.credits_total - c.credits_remaining), 0),
    };
  }, [credits]);

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-full bg-primary/10">
                <CreditCard className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{summary.totalOutstanding}</p>
                <p className="text-xs text-muted-foreground">Credits Outstanding</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-full bg-accent/10">
                <Users className="h-5 w-5 text-accent" />
              </div>
              <div>
                <p className="text-2xl font-bold">{summary.membersWithCredits}</p>
                <p className="text-xs text-muted-foreground">Members With Credits</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-full bg-green-500/10">
                <TrendingDown className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{summary.usedThisMonth}</p>
                <p className="text-xs text-muted-foreground">Used This Month</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search member name or email..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-9" />
        </div>
        <Select value={filter} onValueChange={setFilter}>
          <SelectTrigger className="w-[160px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Show All</SelectItem>
            <SelectItem value="has_credits">Has Credits</SelectItem>
            <SelectItem value="used_all">Used All</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <Card>
        <CardContent className="pt-6">
          {isLoading ? (
            <div className="text-center py-8"><Loader2 className="h-8 w-8 mx-auto animate-spin text-muted-foreground" /></div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <CreditCard className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>No credit records found</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Member</TableHead>
                  <TableHead>Credits</TableHead>
                  <TableHead className="hidden sm:table-cell">Cycle</TableHead>
                  <TableHead className="hidden md:table-cell">Expires</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((c) => {
                  const isExpired = new Date(c.expires_at) < new Date();
                  return (
                    <TableRow key={c.id}>
                      <TableCell>
                        <div className="font-medium">{c.member?.first_name} {c.member?.last_name}</div>
                        <div className="text-xs text-muted-foreground">{c.member?.email}</div>
                      </TableCell>
                      <TableCell>
                        <span className="font-semibold">{c.credits_remaining}</span>
                        <span className="text-muted-foreground"> / {c.credits_total}</span>
                      </TableCell>
                      <TableCell className="hidden sm:table-cell text-sm text-muted-foreground">
                        {format(new Date(c.cycle_start), "MMM d")} – {format(new Date(c.cycle_end), "MMM d")}
                      </TableCell>
                      <TableCell className="hidden md:table-cell text-sm text-muted-foreground">
                        {format(new Date(c.expires_at), "MMM d, yyyy")}
                      </TableCell>
                      <TableCell>
                        {isExpired ? (
                          <Badge variant="outline" className="text-xs">Expired</Badge>
                        ) : c.credits_remaining > 0 ? (
                          <Badge variant="default" className="text-xs">Active</Badge>
                        ) : (
                          <Badge variant="secondary" className="text-xs">Used</Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
