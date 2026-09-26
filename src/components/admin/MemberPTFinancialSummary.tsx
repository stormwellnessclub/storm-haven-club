import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { Dumbbell, ExternalLink, Plus } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { usePTInvoices } from "@/hooks/pt/usePTBillingCenter";
import { PTBalanceBreakdown } from "@/components/admin/pt/PTBalanceBreakdown";
import { SellPTDialog } from "@/components/admin/SellPTDialog";

const money = (cents: number) => `$${((cents ?? 0) / 100).toFixed(2)}`;

/**
 * Personal Training inside the main member account. Reads the SAME PT records
 * (keyed by the member's user_id) used by the PT portal — nothing is copied
 * into the membership record, and the membership card is never touched.
 */
export function MemberPTFinancialSummary({ memberId }: { memberId: string }) {
  const [sellOpen, setSellOpen] = useState(false);

  const { data: member } = useQuery({
    queryKey: ["admin-member-user-id", memberId],
    queryFn: async () => {
      const { data } = await supabase
        .from("members").select("user_id, first_name, last_name, email").eq("id", memberId).maybeSingle();
      return data ?? null;
    },
  });
  const userId = member?.user_id ?? null;

  const { data: passes = [] } = useQuery({
    queryKey: ["member-pt-passes", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("pt_passes").select("id, pack_name, sessions_remaining, sessions_total, status, expires_at")
        .eq("user_id", userId).order("created_at", { ascending: false });
      return (data ?? []) as any[];
    },
  });
  const { data: invoices = [] } = usePTInvoices(userId ?? undefined);
  const openInvoices = invoices.filter((i) => !["paid", "void"].includes(i.status));
  const activePasses = passes.filter((p) => p.status === "active");
  const hasPT = passes.length > 0 || invoices.length > 0;

  if (!member) return null;
  const name = [member.first_name, member.last_name].filter(Boolean).join(" ") || member.email;

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Dumbbell className="h-4 w-4" /> Personal Training
              {hasPT && <Badge variant="secondary">{activePasses.length ? "PT Active" : "PT History"}</Badge>}
            </CardTitle>
            <CardDescription>
              Separate from membership dues and the membership card — same records as the PT portal.
            </CardDescription>
          </div>
          <div className="flex flex-wrap gap-2">
            {userId ? (
              <>
                <Button size="sm" onClick={() => setSellOpen(true)}>
                  <Plus className="h-3.5 w-3.5 mr-1" /> Sell PT Package
                </Button>
                {hasPT && (
                  <>
                    <Button size="sm" variant="outline" asChild>
                      <Link to={`/admin/pt/clients/${userId}`}>PT Profile <ExternalLink className="h-3.5 w-3.5 ml-1" /></Link>
                    </Button>
                    <Button size="sm" variant="outline" asChild>
                      <Link to={`/admin/pt/clients/${userId}/billing`}>PT Billing <ExternalLink className="h-3.5 w-3.5 ml-1" /></Link>
                    </Button>
                  </>
                )}
              </>
            ) : (
              <span className="text-sm text-muted-foreground">Link this member to a login to sell PT.</span>
            )}
          </div>
        </div>
      </CardHeader>
      {userId && hasPT && (
        <CardContent className="space-y-4">
          {activePasses.length > 0 && (
            <div className="rounded-lg border divide-y">
              {activePasses.map((p) => (
                <div key={p.id} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
                  <span className="font-medium">{p.pack_name ?? "PT package"}</span>
                  <span>{p.sessions_remaining} of {p.sessions_total} left</span>
                  <span className="text-muted-foreground">
                    {p.expires_at ? `Expires ${format(new Date(p.expires_at), "MMM d, yyyy")}` : ""}
                  </span>
                </div>
              ))}
            </div>
          )}
          <PTBalanceBreakdown userId={userId} variant="admin" />
          {openInvoices.length > 0 && (
            <div className="rounded-lg border divide-y">
              {openInvoices.slice(0, 5).map((i) => (
                <div key={i.id} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
                  <span className="font-medium">{i.invoice_number}</span>
                  <span className="text-muted-foreground">
                    {format(new Date(`${i.issue_date}T12:00:00`), "MMM d, yyyy")}
                  </span>
                  <Badge variant={i.status === "past_due" ? "destructive" : "secondary"}>
                    {i.status.replace(/_/g, " ")}
                  </Badge>
                  <span className="font-medium">{money(i.amount_due_cents)}</span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      )}
      {userId && (
        <SellPTDialog open={sellOpen} onOpenChange={setSellOpen} presetUserId={userId} presetUserName={name} />
      )}
    </Card>
  );
}
