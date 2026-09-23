import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Search, X } from "lucide-react";

export type PickedPerson = {
  kind: "member" | "non_member";
  memberId?: string;
  userId?: string | null;
  name: string;
  email: string;
};

/** Search members and non-members by name or email. */
export function GiftCardPersonSearch({
  placeholder,
  picked,
  onPick,
}: {
  placeholder: string;
  picked: PickedPerson | null;
  onPick: (p: PickedPerson | null) => void;
}) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<PickedPerson[]>([]);

  useEffect(() => {
    const term = q.trim().replace(/[%,()]/g, "");
    if (term.length < 2) { setResults([]); return; }
    const t = setTimeout(async () => {
      const like = `%${term}%`;
      const orFilter = `first_name.ilike.${like},last_name.ilike.${like},email.ilike.${like}`;
      const [m, n] = await Promise.all([
        supabase.from("members").select("id, user_id, first_name, last_name, email, status")
          .or(orFilter).neq("status", "cancelled").limit(8),
        supabase.from("non_member_profiles").select("user_id, first_name, last_name, email")
          .or(orFilter).limit(8),
      ]);
      const memberEmails = new Set((m.data ?? []).map((r: any) => (r.email || "").toLowerCase()));
      const out: PickedPerson[] = [
        ...(m.data ?? []).filter((r: any) => r.email).map((r: any) => ({
          kind: "member" as const, memberId: r.id, userId: r.user_id,
          name: `${r.first_name ?? ""} ${r.last_name ?? ""}`.trim() || r.email, email: r.email,
        })),
        ...(n.data ?? []).filter((r: any) => r.email && !memberEmails.has(r.email.toLowerCase())).map((r: any) => ({
          kind: "non_member" as const, userId: r.user_id,
          name: `${r.first_name ?? ""} ${r.last_name ?? ""}`.trim() || r.email, email: r.email,
        })),
      ];
      setResults(out);
    }, 250);
    return () => clearTimeout(t);
  }, [q]);

  if (picked) {
    return (
      <div className="flex items-center justify-between rounded-md border bg-muted/40 px-3 py-2 text-sm">
        <div className="min-w-0">
          <div className="font-medium truncate">{picked.name}</div>
          <div className="text-xs text-muted-foreground truncate">{picked.email}</div>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline">{picked.kind === "member" ? "Member" : "Non-member"}</Badge>
          <button type="button" onClick={() => onPick(null)} aria-label="Clear">
            <X className="h-4 w-4 text-muted-foreground" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="relative">
      <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      <Input className="pl-9" value={q} onChange={(e) => setQ(e.target.value)} placeholder={placeholder} />
      {results.length > 0 && (
        <div className="absolute z-50 mt-1 max-h-60 w-full overflow-y-auto rounded-md border bg-popover shadow-md">
          {results.map((r) => (
            <button
              key={`${r.kind}-${r.memberId ?? r.userId ?? r.email}`}
              type="button"
              className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm hover:bg-muted"
              onClick={() => { onPick(r); setQ(""); setResults([]); }}
            >
              <div className="min-w-0">
                <div className="truncate font-medium">{r.name}</div>
                <div className="truncate text-xs text-muted-foreground">{r.email}</div>
              </div>
              <Badge variant="outline" className="shrink-0">{r.kind === "member" ? "Member" : "Non-member"}</Badge>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
