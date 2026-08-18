import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Ticket, Phone } from "lucide-react";

export interface PersonResult {
  userId: string | null;
  memberId: string | null;
  name: string;
  email: string;
  phone: string;
  type: "member" | "pass_holder" | "account";
  passCount: number;
}

interface PersonSearchProps {
  search: string;
  onSearchChange: (val: string) => void;
  onSelect: (person: PersonResult) => void;
}

export function PersonSearch({ search, onSearchChange, onSelect }: PersonSearchProps) {
  const { data: results = [] } = useQuery({
    queryKey: ["unified-person-search", search],
    queryFn: async (): Promise<PersonResult[]> => {
      if (search.length < 2) return [];
      const q = search.trim();

      // Parallel queries
      const [membersRes, profilesRes, nonMemberRes, passesRes] = await Promise.all([
        supabase
          .from("members")
          .select("id, user_id, first_name, last_name, email, phone, member_id, status")
          .or(`first_name.ilike.%${q}%,last_name.ilike.%${q}%,email.ilike.%${q}%,member_id.ilike.%${q}%`)
          .in("status", ["active", "frozen", "pending_activation"])
          .limit(10),
        supabase
          .from("profiles")
          .select("user_id, email, first_name, last_name, phone")
          .or(`email.ilike.%${q}%,first_name.ilike.%${q}%,last_name.ilike.%${q}%`)
          .limit(10),
        supabase
          .from("non_member_profiles")
          .select("user_id, first_name, last_name, email, phone")
          .or(`email.ilike.%${q}%,first_name.ilike.%${q}%,last_name.ilike.%${q}%`)
          .limit(10),
        // Get users with active passes
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

      // Members first
      (membersRes.data || []).forEach((m: any) => {
        const key = m.user_id || `member-${m.id}`;
        if (seen.has(key)) return;
        seen.add(key);
        out.push({
          userId: m.user_id,
          memberId: m.id,
          name: `${m.first_name} ${m.last_name}`,
          email: m.email || "",
          phone: m.phone || "",
          type: "member",
          passCount: m.user_id ? (passMap.get(m.user_id) || 0) : 0,
        });
      });

      // Non-member profiles (pass holders)
      (nonMemberRes.data || []).forEach((nm: any) => {
        if (!nm.user_id || seen.has(nm.user_id)) return;
        seen.add(nm.user_id);
        const pc = passMap.get(nm.user_id) || 0;
        const nmName = [nm.first_name, nm.last_name].filter(Boolean).join(" ");
        out.push({
          userId: nm.user_id,
          memberId: null,
          name: nmName || nm.email || "Unknown",
          email: nm.email || "",
          phone: nm.phone || "",
          type: pc > 0 ? "pass_holder" : "account",
          passCount: pc,
        });
      });

      // Generic profiles (catch-all)
      (profilesRes.data || []).forEach((p: any) => {
        if (!p.user_id || seen.has(p.user_id)) return;
        seen.add(p.user_id);
        const pc = passMap.get(p.user_id) || 0;
        out.push({
          userId: p.user_id,
          memberId: null,
          name: [p.first_name, p.last_name].filter(Boolean).join(" ") || p.email || "Unknown",
          email: p.email || "",
          phone: p.phone || "",
          type: pc > 0 ? "pass_holder" : "account",
          passCount: pc,
        });
      });

      return out;
    },
    enabled: search.length >= 2,
  });

  const typeBadge = (type: PersonResult["type"]) => {
    switch (type) {
      case "member":
        return <Badge variant="secondary" className="text-xs">Member</Badge>;
      case "pass_holder":
        return <Badge variant="outline" className="text-xs border-primary/50 text-primary">Pass Holder</Badge>;
      case "account":
        return <Badge variant="outline" className="text-xs">Account</Badge>;
    }
  };

  return (
    <div className="space-y-2">
      <Label>Search by name, email, or member ID</Label>
      <Input
        value={search}
        onChange={(e) => onSearchChange(e.target.value)}
        placeholder="e.g. Jane Smith, jane@email.com, STM-000001"
      />
      {results.length > 0 && (
        <div className="max-h-48 overflow-y-auto border rounded-sm divide-y">
          {results.map((r, i) => (
            <button
              key={r.userId || `idx-${i}`}
              type="button"
              onClick={() => onSelect(r)}
              className="w-full text-left px-3 py-2 hover:bg-muted transition-colors flex items-center justify-between gap-2"
            >
              <div className="min-w-0">
                <p className="text-sm font-medium truncate">{r.name}</p>
                <p className="text-xs text-muted-foreground truncate">
                  {r.email}
                  {r.phone && <span className="ml-2">📱 {r.phone}</span>}
                </p>
              </div>
              <div className="flex items-center gap-1.5 flex-shrink-0">
                {r.passCount > 0 && (
                  <span className="flex items-center gap-0.5 text-xs text-muted-foreground">
                    <Ticket className="h-3 w-3" /> {r.passCount}
                  </span>
                )}
                {typeBadge(r.type)}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
