import { useState, useEffect } from "react";
import { FrontDeskShell } from "./FrontDeskShell";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Search, Loader2, UserCircle2, AlertTriangle } from "lucide-react";
import { MemberDetailSheet } from "@/components/admin/MemberDetailSheet";

/**
 * /frontdesk/members — lookup-only member search.
 *
 * Intentionally slim: no cohort counts, no status filters, no billing totals.
 * Front desk types a name/email/member ID, clicks a result, and gets the same
 * MemberDetailSheet admins use. Role-based logic inside the sheet already
 * hides admin-only actions when the viewer is front_desk.
 */
export default function FrontDeskMembersPage() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<any | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setResults([]);
      return;
    }
    let cancelled = false;
    setLoading(true);
    const t = setTimeout(async () => {
      const esc = q.replace(/[%,]/g, "");
      const like = `%${esc}%`;
      const select = `
          id, member_id, first_name, last_name, email, phone,
          membership_type, status, subscription_status,
          membership_start_date, membership_end_date, billing_type,
          gender, is_founding_member, stripe_customer_id, stripe_subscription_id,
          annual_fee_paid_at, annual_fee_subscription_id, created_at,
          card_brand, card_last4, card_exp_month, card_exp_year, user_id
        `;
      let req = supabase
        .from("members")
        .select(select)
        .or(
          `first_name.ilike.${like},last_name.ilike.${like},email.ilike.${like},member_id.ilike.${like},phone.ilike.${like}`
        );

      // Full-name searches ("Mariam Hammoud") match no single column, so split
      // the query into tokens and require first/last name to match each part.
      const parts = esc.split(/\s+/).filter(Boolean);
      if (parts.length > 1) {
        req = supabase
          .from("members")
          .select(select)
          .ilike("first_name", `%${parts[0]}%`)
          .ilike("last_name", `%${parts.slice(1).join(" ")}%`);
      }

      const { data, error } = await req
        .order("last_name", { ascending: true })
        .limit(25);

      if (cancelled) return;
      setResults(error ? [] : data || []);
      setLoading(false);
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [query]);

  const openMember = (m: any) => {
    setSelected({
      ...m,
      waiver_signed: false,
      membership_agreement_signed: false,
    });
    setOpen(true);
  };

  const isBlocked = (m: any) => {
    const s = (m.status || "").toLowerCase();
    const ss = (m.subscription_status || "").toLowerCase();
    return s === "past_due" || ss === "past_due" || s === "frozen" || s === "cancelled" || s === "expired" || s === "suspended";
  };

  const blockReason = (m: any) => {
    const s = (m.status || "").toLowerCase();
    const ss = (m.subscription_status || "").toLowerCase();
    if (s === "past_due" || ss === "past_due") return "Payment past due";
    if (s === "frozen") return "Frozen";
    if (s === "suspended") return "Suspended";
    if (s === "cancelled") return "Cancelled";
    if (s === "expired") return "Expired";
    return "Cannot check in";
  };

  return (
    <FrontDeskShell>
      <div className="p-6 max-w-4xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Member Lookup</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Search by name, email, member ID, or phone. Click a member to view their profile, add notes, or charge them.
          </p>
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search members..."
            className="pl-10 h-12 text-base"
          />
        </div>

        {query.trim().length < 2 ? (
          <div className="text-center py-16 text-muted-foreground text-sm">
            Start typing to find a member.
          </div>
        ) : loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : results.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground text-sm">
            No members match "{query}".
          </div>
        ) : (
          <div className="space-y-2">
            {results.map((m) => (
              <Card
                key={m.id}
                onClick={() => openMember(m)}
                className="p-4 flex items-center gap-4 cursor-pointer hover:bg-accent/50 transition-colors"
              >
                <UserCircle2 className="h-10 w-10 text-muted-foreground shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="font-medium truncate">
                    {m.first_name} {m.last_name}
                  </div>
                  <div className="text-xs text-muted-foreground truncate">
                    {m.member_id ? `#${m.member_id} · ` : ""}{m.email}
                  </div>
                </div>
                {m.membership_type && (
                  <Badge variant="outline" className="hidden sm:inline-flex">
                    {m.membership_type}
                  </Badge>
                )}
                {isBlocked(m) && (
                  <Badge className="bg-red-100 text-red-800 border-red-200 gap-1">
                    <AlertTriangle className="h-3 w-3" />
                    {blockReason(m)}
                  </Badge>
                )}
              </Card>
            ))}
          </div>
        )}

        <MemberDetailSheet
          member={selected}
          open={open}
          onOpenChange={setOpen}
          viewerMode="frontdesk"
        />
      </div>
    </FrontDeskShell>
  );
}
