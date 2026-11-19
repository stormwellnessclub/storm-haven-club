import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PtFormat, PtPack, buildMemberPriceRows, formatCents, formatExpiration, perSessionPrice } from "@/lib/ptFormat";

/** Public member / non-member price chart for one training format, read live from pt_packs. */
export function PTPriceTable({ format }: { format: PtFormat }) {
  const { data: packs = [], isLoading } = useQuery({
    queryKey: ["pt-packs-public", format],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("pt_packs")
        .select("*")
        .eq("format", format)
        .eq("is_active", true)
        .eq("is_public", true)
        .gt("price_cents", 0)
        .order("display_order");
      if (error) throw error;
      return (data ?? []) as PtPack[];
    },
  });

  if (isLoading) return <p className="py-8 text-sm text-muted-foreground">Loading packages…</p>;
  if (packs.length === 0) return <p className="py-8 text-sm text-muted-foreground">Ask us about packages for this format.</p>;

  const rows = buildMemberPriceRows(packs);
  if (!rows) {
    return (
      <div className="border-t border-border divide-y divide-border">
        {packs.map((p) => (
          <div key={p.id} className="flex items-baseline justify-between gap-4 py-4">
            <div>
              <p className="font-serif text-xl leading-tight">{p.name}</p>
              <p className="text-xs text-muted-foreground mt-1">
                {[perSessionPrice(p), `Use within ${formatExpiration(p.expiration_days)}`].filter(Boolean).join(" · ")}
              </p>
            </div>
            <p className="font-serif text-xl shrink-0">{formatCents(p.price_cents)}</p>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="border-t border-border">
      <div className="grid grid-cols-3 gap-4 py-3 ed-caption text-muted-foreground border-b border-border">
        <span>Sessions</span>
        <span>Member</span>
        <span>Non-member</span>
      </div>
      {rows.map((r) => {
        const exp = r.member?.expiration_days ?? r.nonMember?.expiration_days;
        return (
          <div key={r.sessions} className="grid grid-cols-3 gap-4 py-4 border-b border-border items-start">
            <div>
              <p className="font-serif text-xl leading-tight">{r.sessions} {r.sessions === 1 ? "session" : "sessions"}</p>
              {exp ? <p className="text-xs text-muted-foreground mt-1">Use within {formatExpiration(exp)}</p> : null}
            </div>
            {[r.member, r.nonMember].map((p, i) => (
              <div key={i}>
                {p ? (
                  <>
                    <p className="font-serif text-xl leading-tight">{formatCents(p.price_cents)}</p>
                    {perSessionPrice(p) && <p className="text-xs text-muted-foreground mt-1">{perSessionPrice(p)}</p>}
                  </>
                ) : (
                  <span className="text-muted-foreground">—</span>
                )}
              </div>
            ))}
          </div>
        );
      })}
    </div>
  );
}
