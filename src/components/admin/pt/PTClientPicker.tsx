import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { X } from "lucide-react";
import { PTRelationship, relationshipMap } from "@/lib/ptIdentity";

export interface PTClientOption {
  id: string;
  email: string;
  name: string;
  kind: PTRelationship;
}

/**
 * Finds an EXISTING Storm identity. It never creates an account — Phase 2B
 * workflows must attach to the person already in the system.
 */
export function PTClientPicker({
  value, label, onChange,
}: {
  value?: string;
  label?: string;
  onChange: (client: PTClientOption | null) => void;
}) {
  const [query, setQuery] = useState("");

  const { data: results = [] } = useQuery({
    queryKey: ["pt-client-picker", query],
    enabled: !value && query.trim().length >= 2,
    queryFn: async (): Promise<PTClientOption[]> => {
      const q = query.trim();
      const f = `email.ilike.%${q}%,first_name.ilike.%${q}%,last_name.ilike.%${q}%`;
      const [members, nonMembers, profiles] = await Promise.all([
        supabase.from("members").select("user_id, email, first_name, last_name").or(f).neq("status", "cancelled").limit(8),
        supabase.from("non_member_profiles").select("user_id, email, first_name, last_name").or(f).limit(8),
        supabase.from("profiles").select("user_id, email, first_name, last_name").or(f).limit(8),
      ]);
      const rows = [...(profiles.data ?? []), ...(nonMembers.data ?? []), ...(members.data ?? [])] as any[];
      const ids = Array.from(new Set(rows.map((r) => r.user_id).filter(Boolean)));
      const { data: memRows } = ids.length
        ? await supabase.from("members").select("user_id, status").in("user_id", ids)
        : { data: [] as any[] };
      const rel = relationshipMap((memRows ?? []) as any[]);
      const map = new Map<string, PTClientOption>();
      rows.forEach((r) => {
        if (!r.user_id) return;
        const name = [r.first_name, r.last_name].filter(Boolean).join(" ").trim() || r.email;
        const prev = map.get(r.user_id);
        if (prev && prev.name !== prev.email) return;
        map.set(r.user_id, { id: r.user_id, email: r.email, name, kind: rel[r.user_id] ?? "Non-member" });
      });
      return Array.from(map.values());
    },
  });

  if (value) {
    return (
      <div className="flex items-center justify-between rounded-lg border border-pt-line bg-pt-cream/40 px-3 py-2">
        <span className="text-sm text-pt-ink truncate">{label ?? value}</span>
        <button
          type="button"
          aria-label="Choose a different client"
          className="text-pt-muted hover:text-pt-ink"
          onClick={() => { onChange(null); setQuery(""); }}
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <Input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search an existing client by name or email…"
        className="border-pt-line bg-white"
      />
      {results.length > 0 && (
        <div className="max-h-44 overflow-y-auto rounded-lg border border-pt-line">
          {results.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => { onChange(c); setQuery(""); }}
              className="w-full border-b border-pt-line/60 px-3 py-2 text-left last:border-0 hover:bg-pt-beige/40"
            >
              <div className="text-[13px] font-medium text-pt-ink">{c.name}</div>
              <div className="text-xs text-pt-muted">{c.email} · {c.kind}</div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
