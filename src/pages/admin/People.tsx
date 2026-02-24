import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Search, Users, UserCheck, Ticket, Loader2 } from "lucide-react";

interface PersonResult {
  id: string;
  userId: string | null;
  name: string;
  email: string;
  type: "member" | "non_member" | "pass_holder";
  status: string | null;
  membershipType: string | null;
  passCount: number;
  waiverSigned: boolean;
  createdAt: string;
}

export default function People() {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");

  const { data: results = [], isLoading } = useQuery({
    queryKey: ["admin-people-search", search],
    queryFn: async (): Promise<PersonResult[]> => {
      if (search.length < 2) return [];
      const q = search.trim();

      const [membersRes, nonMembersRes, passesRes] = await Promise.all([
        supabase
          .from("members")
          .select("id, user_id, first_name, last_name, email, status, membership_type, created_at")
          .or(`first_name.ilike.%${q}%,last_name.ilike.%${q}%,email.ilike.%${q}%,member_id.ilike.%${q}%`)
          .limit(50),
        supabase
          .from("non_member_profiles")
          .select("id, user_id, first_name, last_name, email, waiver_signed, created_at")
          .or(`email.ilike.%${q}%,first_name.ilike.%${q}%,last_name.ilike.%${q}%`)
          .limit(50),
        supabase
          .from("class_passes")
          .select("user_id, classes_remaining")
          .eq("status", "active")
          .gt("classes_remaining", 0)
          .gt("expires_at", new Date().toISOString()),
      ]);

      // Build pass count map
      const passMap = new Map<string, number>();
      (passesRes.data || []).forEach((p: any) => {
        if (p.user_id) {
          passMap.set(p.user_id, (passMap.get(p.user_id) || 0) + p.classes_remaining);
        }
      });

      const seen = new Set<string>();
      const out: PersonResult[] = [];

      // Members
      (membersRes.data || []).forEach((m: any) => {
        const key = m.user_id || `member-${m.id}`;
        if (seen.has(key)) return;
        seen.add(key);
        out.push({
          id: m.id,
          userId: m.user_id,
          name: `${m.first_name || ""} ${m.last_name || ""}`.trim() || m.email,
          email: m.email || "",
          type: "member",
          status: m.status,
          membershipType: m.membership_type,
          passCount: m.user_id ? (passMap.get(m.user_id) || 0) : 0,
          waiverSigned: false,
          createdAt: m.created_at,
        });
      });

      // Non-members
      (nonMembersRes.data || []).forEach((nm: any) => {
        if (!nm.user_id || seen.has(nm.user_id)) return;
        seen.add(nm.user_id);
        const pc = passMap.get(nm.user_id) || 0;
        out.push({
          id: nm.id,
          userId: nm.user_id,
          name: `${nm.first_name || ""} ${nm.last_name || ""}`.trim() || nm.email || "Unknown",
          email: nm.email || "",
          type: pc > 0 ? "pass_holder" : "non_member",
          status: null,
          membershipType: null,
          passCount: pc,
          waiverSigned: nm.waiver_signed || false,
          createdAt: nm.created_at,
        });
      });

      return out;
    },
    enabled: search.length >= 2,
  });

  // If no search, load summary counts
  const { data: counts } = useQuery({
    queryKey: ["admin-people-counts"],
    queryFn: async () => {
      const [membersCount, nonMembersCount] = await Promise.all([
        supabase.from("members").select("id", { count: "exact", head: true }),
        supabase.from("non_member_profiles").select("id", { count: "exact", head: true }),
      ]);
      return {
        members: membersCount.count || 0,
        nonMembers: nonMembersCount.count || 0,
      };
    },
  });

  const typeBadge = (type: PersonResult["type"]) => {
    switch (type) {
      case "member":
        return <Badge className="bg-primary/10 text-primary border-primary/20">Member</Badge>;
      case "pass_holder":
        return <Badge variant="outline" className="border-primary/50 text-primary">Pass Holder</Badge>;
      case "non_member":
        return <Badge variant="outline">Non-Member</Badge>;
    }
  };

  const handleRowClick = (person: PersonResult) => {
    if (person.type === "member") {
      navigate(`/admin/members?q=${encodeURIComponent(person.email)}`);
    } else {
      navigate(`/admin/non-member-accounts/${person.userId}`);
    }
  };

  return (
    <AdminLayout title="People">
      <div className="space-y-6">
        {/* Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card>
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
          <Card>
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
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <Users className="h-8 w-8 text-primary/60" />
                <div>
                  <p className="text-2xl font-bold">{(counts?.members ?? 0) + (counts?.nonMembers ?? 0)}</p>
                  <p className="text-sm text-muted-foreground">Total People</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Search */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Search All People</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="relative max-w-lg">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by name, email, or member ID..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10"
              />
            </div>

            {isLoading && search.length >= 2 && (
              <div className="flex items-center gap-2 mt-4 text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Searching...
              </div>
            )}

            {search.length >= 2 && !isLoading && results.length === 0 && (
              <p className="text-sm text-muted-foreground mt-4">No results found for "{search}"</p>
            )}

            {results.length > 0 && (
              <div className="mt-4 border rounded-lg overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Passes</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {results.map((person) => (
                      <TableRow
                        key={person.id}
                        className="cursor-pointer hover:bg-muted/50"
                        onClick={() => handleRowClick(person)}
                      >
                        <TableCell className="font-medium">{person.name}</TableCell>
                        <TableCell className="text-muted-foreground">{person.email}</TableCell>
                        <TableCell>{typeBadge(person.type)}</TableCell>
                        <TableCell>
                          {person.status ? (
                            <Badge variant="outline" className="capitalize">
                              {person.status.replace(/_/g, " ")}
                            </Badge>
                          ) : (
                            <span className="text-muted-foreground text-sm">—</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          {person.passCount > 0 ? (
                            <span className="flex items-center justify-end gap-1 text-sm">
                              <Ticket className="h-3.5 w-3.5" /> {person.passCount}
                            </span>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}
