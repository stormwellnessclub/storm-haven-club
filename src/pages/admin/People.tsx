import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Search, Users, UserCheck, Ticket, Loader2, UserX } from "lucide-react";
import { format } from "date-fns";

// ─── Members Tab ────────────────────────────────────────────
function MembersTab({ search }: { search: string }) {
  const navigate = useNavigate();

  const { data: members = [], isLoading } = useQuery({
    queryKey: ["directory-members"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("members")
        .select("id, user_id, first_name, last_name, email, phone, status, membership_type, member_id, is_founding_member, created_at")
        .order("created_at", { ascending: false })
        .limit(500);
      if (error) throw error;
      return data || [];
    },
  });

  const filtered = useMemo(() => {
    if (!search) return members;
    const q = search.toLowerCase();
    return members.filter(
      (m: any) =>
        (m.first_name || "").toLowerCase().includes(q) ||
        (m.last_name || "").toLowerCase().includes(q) ||
        (m.email || "").toLowerCase().includes(q) ||
        (m.phone || "").toLowerCase().includes(q) ||
        (m.member_id || "").toLowerCase().includes(q)
    );
  }, [members, search]);

  const statusBadge = (status: string) => {
    const map: Record<string, string> = {
      active: "bg-primary/10 text-primary border-primary/20",
      pending_activation: "bg-accent/10 text-accent-foreground border-accent/20",
      frozen: "bg-blue-500/10 text-blue-700 border-blue-500/20 dark:text-blue-400",
      suspended: "bg-destructive/10 text-destructive border-destructive/20",
      cancelled: "bg-muted text-muted-foreground",
    };
    return (
      <Badge className={map[status] || "bg-muted text-muted-foreground"} variant="outline">
        {status.replace(/_/g, " ")}
      </Badge>
    );
  };

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 py-8 justify-center text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading members...
      </div>
    );
  }

  return (
    <div className="border rounded-lg overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Member ID</TableHead>
            <TableHead>Name</TableHead>
            <TableHead>Email</TableHead>
            <TableHead>Phone</TableHead>
            <TableHead>Tier</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Joined</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {filtered.length === 0 ? (
            <TableRow>
              <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                {search ? `No members found for "${search}"` : "No members yet"}
              </TableCell>
            </TableRow>
          ) : (
            filtered.map((m: any) => (
              <TableRow
                key={m.id}
                className="cursor-pointer hover:bg-muted/50"
                onClick={() => navigate(`/admin/members?q=${encodeURIComponent(m.email)}`)}
              >
                <TableCell className="font-mono text-sm text-muted-foreground">{m.member_id || "—"}</TableCell>
                <TableCell className="font-medium">
                  {`${m.first_name || ""} ${m.last_name || ""}`.trim() || "—"}
                  {m.is_founding_member && (
                    <Badge className="ml-2 bg-accent/20 text-accent-foreground text-xs" variant="outline">Founder</Badge>
                  )}
                </TableCell>
                <TableCell className="text-muted-foreground">{m.email}</TableCell>
                <TableCell className="text-muted-foreground">{m.phone || "—"}</TableCell>
                <TableCell>{m.membership_type || "—"}</TableCell>
                <TableCell>{statusBadge(m.status)}</TableCell>
                <TableCell className="text-muted-foreground">{m.created_at ? format(new Date(m.created_at), "MMM d, yyyy") : "—"}</TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
      {filtered.length > 0 && (
        <div className="px-4 py-2 border-t bg-muted/30 text-xs text-muted-foreground">
          Showing {filtered.length} member{filtered.length !== 1 ? "s" : ""}
        </div>
      )}
    </div>
  );
}

// ─── Class Attendees Tab (pass holders / class bookers) ─────
function ClassAttendeesTab({ search }: { search: string }) {
  const navigate = useNavigate();

  const { data: attendees = [], isLoading } = useQuery({
    queryKey: ["directory-class-attendees"],
    queryFn: async () => {
      // Get non-members with active passes
      const { data: passes, error: passErr } = await supabase
        .from("class_passes")
        .select("user_id, classes_remaining, classes_total, category, pass_type, status, expires_at, member_id")
        .eq("status", "active")
        .gt("classes_remaining", 0)
        .gt("expires_at", new Date().toISOString());
      if (passErr) throw passErr;

      // Group by user_id
      const userPassMap = new Map<string, { total: number; remaining: number; categories: Set<string> }>();
      (passes || []).forEach((p: any) => {
        const uid = p.user_id;
        if (!uid) return;
        const existing = userPassMap.get(uid) || { total: 0, remaining: 0, categories: new Set<string>() };
        existing.total += p.classes_total;
        existing.remaining += p.classes_remaining;
        if (p.category) existing.categories.add(p.category);
        userPassMap.set(uid, existing);
      });

      if (userPassMap.size === 0) return [];

      // Get profiles for these users
      const userIds = Array.from(userPassMap.keys());
      const { data: profiles, error: profErr } = await supabase
        .from("non_member_profiles")
        .select("id, user_id, first_name, last_name, email, phone, waiver_signed, created_at")
        .in("user_id", userIds);
      if (profErr) throw profErr;

      return (profiles || []).map((p: any) => {
        const passInfo = userPassMap.get(p.user_id) || { total: 0, remaining: 0, categories: new Set() };
        return {
          id: p.id,
          userId: p.user_id,
          name: `${p.first_name || ""} ${p.last_name || ""}`.trim() || p.email || "Unknown",
          email: p.email || "",
          phone: p.phone || "",
          waiverSigned: p.waiver_signed || false,
          classesRemaining: passInfo.remaining,
          classesTotal: passInfo.total,
          categories: Array.from(passInfo.categories),
          createdAt: p.created_at,
        };
      });
    },
  });

  const filtered = useMemo(() => {
    if (!search) return attendees;
    const q = search.toLowerCase();
    return attendees.filter(
      (a: any) =>
        a.name.toLowerCase().includes(q) ||
        a.email.toLowerCase().includes(q) ||
        a.phone.toLowerCase().includes(q)
    );
  }, [attendees, search]);

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 py-8 justify-center text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading class attendees...
      </div>
    );
  }

  return (
    <div className="border rounded-lg overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Email</TableHead>
            <TableHead>Phone</TableHead>
            <TableHead>Classes Left</TableHead>
            <TableHead>Categories</TableHead>
            <TableHead>Waiver</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {filtered.length === 0 ? (
            <TableRow>
              <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                {search ? `No class attendees found for "${search}"` : "No active class attendees"}
              </TableCell>
            </TableRow>
          ) : (
            filtered.map((a: any) => (
              <TableRow
                key={a.id}
                className="cursor-pointer hover:bg-muted/50"
                onClick={() => navigate(`/admin/non-member-accounts/${a.userId}`)}
              >
                <TableCell className="font-medium">{a.name}</TableCell>
                <TableCell className="text-muted-foreground">{a.email}</TableCell>
                <TableCell className="text-muted-foreground">{a.phone || "—"}</TableCell>
                <TableCell>
                  <span className="flex items-center gap-1">
                    <Ticket className="h-3.5 w-3.5 text-primary" />
                    <span className="font-medium">{a.classesRemaining}</span>
                    <span className="text-muted-foreground">/ {a.classesTotal}</span>
                  </span>
                </TableCell>
                <TableCell>
                  <div className="flex flex-wrap gap-1">
                    {a.categories.map((c: string) => (
                      <Badge key={c} variant="outline" className="text-xs capitalize">{c.replace(/_/g, " ")}</Badge>
                    ))}
                  </div>
                </TableCell>
                <TableCell>
                  {a.waiverSigned ? (
                    <Badge className="bg-primary/10 text-primary border-primary/20" variant="outline">Signed</Badge>
                  ) : (
                    <Badge variant="outline" className="text-muted-foreground">Not signed</Badge>
                  )}
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
      {filtered.length > 0 && (
        <div className="px-4 py-2 border-t bg-muted/30 text-xs text-muted-foreground">
          Showing {filtered.length} class attendee{filtered.length !== 1 ? "s" : ""}
        </div>
      )}
    </div>
  );
}

// ─── Non-Members Tab ────────────────────────────────────────
function NonMembersTab({ search }: { search: string }) {
  const navigate = useNavigate();

  const { data: nonMembers = [], isLoading } = useQuery({
    queryKey: ["directory-non-members"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("non_member_profiles")
        .select("id, user_id, first_name, last_name, email, phone, waiver_signed, created_at")
        .order("created_at", { ascending: false })
        .limit(500);
      if (error) throw error;
      return data || [];
    },
  });

  const filtered = useMemo(() => {
    if (!search) return nonMembers;
    const q = search.toLowerCase();
    return nonMembers.filter(
      (nm: any) =>
        (nm.first_name || "").toLowerCase().includes(q) ||
        (nm.last_name || "").toLowerCase().includes(q) ||
        (nm.email || "").toLowerCase().includes(q) ||
        (nm.phone || "").toLowerCase().includes(q)
    );
  }, [nonMembers, search]);

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 py-8 justify-center text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading non-members...
      </div>
    );
  }

  return (
    <div className="border rounded-lg overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Email</TableHead>
            <TableHead>Phone</TableHead>
            <TableHead>Waiver</TableHead>
            <TableHead>Created</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {filtered.length === 0 ? (
            <TableRow>
              <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                {search ? `No non-members found for "${search}"` : "No non-member profiles yet"}
              </TableCell>
            </TableRow>
          ) : (
            filtered.map((nm: any) => (
              <TableRow
                key={nm.id}
                className="cursor-pointer hover:bg-muted/50"
                onClick={() => nm.user_id && navigate(`/admin/non-member-accounts/${nm.user_id}`)}
              >
                <TableCell className="font-medium">
                  {`${nm.first_name || ""} ${nm.last_name || ""}`.trim() || "Unknown"}
                </TableCell>
                <TableCell className="text-muted-foreground">{nm.email || "—"}</TableCell>
                <TableCell className="text-muted-foreground">{nm.phone || "—"}</TableCell>
                <TableCell>
                  {nm.waiver_signed ? (
                    <Badge className="bg-primary/10 text-primary border-primary/20" variant="outline">Signed</Badge>
                  ) : (
                    <Badge variant="outline" className="text-muted-foreground">Not signed</Badge>
                  )}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {nm.created_at ? format(new Date(nm.created_at), "MMM d, yyyy") : "—"}
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
      {filtered.length > 0 && (
        <div className="px-4 py-2 border-t bg-muted/30 text-xs text-muted-foreground">
          Showing {filtered.length} non-member{filtered.length !== 1 ? "s" : ""}
        </div>
      )}
    </div>
  );
}

// ─── Main Directory Page ────────────────────────────────────
export default function People() {
  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState("members");

  // Summary counts
  const { data: counts } = useQuery({
    queryKey: ["directory-counts"],
    queryFn: async () => {
      const [membersCount, nonMembersCount, activePassesCount] = await Promise.all([
        supabase.from("members").select("id", { count: "exact", head: true }),
        supabase.from("non_member_profiles").select("id", { count: "exact", head: true }),
        supabase
          .from("class_passes")
          .select("user_id", { count: "exact", head: true })
          .eq("status", "active")
          .gt("classes_remaining", 0)
          .gt("expires_at", new Date().toISOString()),
      ]);
      return {
        members: membersCount.count || 0,
        nonMembers: nonMembersCount.count || 0,
        classAttendees: activePassesCount.count || 0,
      };
    },
  });

  return (
    <AdminLayout title="Directory">
      <div className="space-y-6">
        {/* Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card className="cursor-pointer hover:border-primary/40 transition-colors" onClick={() => setActiveTab("members")}>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <UserCheck className="h-8 w-8 text-primary" />
                <div>
                  <p className="text-2xl font-bold">{counts?.members ?? "—"}</p>
                  <p className="text-sm text-muted-foreground">Members</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="cursor-pointer hover:border-primary/40 transition-colors" onClick={() => setActiveTab("class-attendees")}>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <Ticket className="h-8 w-8 text-primary" />
                <div>
                  <p className="text-2xl font-bold">{counts?.classAttendees ?? "—"}</p>
                  <p className="text-sm text-muted-foreground">Active Class Passes</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="cursor-pointer hover:border-primary/40 transition-colors" onClick={() => setActiveTab("non-members")}>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <Users className="h-8 w-8 text-muted-foreground" />
                <div>
                  <p className="text-2xl font-bold">{counts?.nonMembers ?? "—"}</p>
                  <p className="text-sm text-muted-foreground">Non-Members</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Search */}
        <div className="relative max-w-lg">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Filter by name, email, phone, or member ID..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>

        {/* Tabbed Directory */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="members" className="gap-1.5">
              <UserCheck className="h-4 w-4" />
              Members
            </TabsTrigger>
            <TabsTrigger value="class-attendees" className="gap-1.5">
              <Ticket className="h-4 w-4" />
              Class Attendees
            </TabsTrigger>
            <TabsTrigger value="non-members" className="gap-1.5">
              <Users className="h-4 w-4" />
              Non-Members
            </TabsTrigger>
          </TabsList>

          <TabsContent value="members" className="mt-4">
            <MembersTab search={search} />
          </TabsContent>
          <TabsContent value="class-attendees" className="mt-4">
            <ClassAttendeesTab search={search} />
          </TabsContent>
          <TabsContent value="non-members" className="mt-4">
            <NonMembersTab search={search} />
          </TabsContent>
        </Tabs>
      </div>
    </AdminLayout>
  );
}
