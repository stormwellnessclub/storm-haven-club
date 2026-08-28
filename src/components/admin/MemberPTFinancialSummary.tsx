import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { Dumbbell, ExternalLink } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { usePTInvoices, usePTOutstanding } from "@/hooks/pt/usePTBillingCenter";

const money = (cents: number) => `$${((cents ?? 0) / 100).toFixed(2)}`;

/**
 * Personal Training money, surfaced inside the main member profile so staff
 * never have to guess whether a balance lives in dues or in PT.
 */
export function MemberPTFinancialSummary({ memberId }: { memberId: string }) {
  const { data: userId } = useQuery({
    queryKey: ["admin-member-user-id", memberId],
    queryFn: async () => {
      const { data } = await supabase.from("members").select("user_id").eq("id", memberId).maybeSingle();
      return data?.user_id ?? null;
    },
  });

  const { data: outstanding } = usePTOutstanding(userId ?? undefined);
  const { data: invoices = [] } = usePTInvoices(userId ?? undefined);

  const openInvoices = invoices.filter((i) => !["paid", "void"].includes(i.status));
  const total = outstanding?.total_outstanding_cents ?? 0;
  const hasActivity = total > 0 || invoices.length > 0;

  if (!userId || !hasActivity) return null;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Dumbbell className="h-4 w-4" /> Personal Training Balance
            </CardTitle>
            <CardDescription>
              Tracked separately from membership dues — PT charges never appear twice.
            </CardDescription>
          </div>
          <Link
            to={`/admin/pt/clients/${userId}`}
            className="text-sm text-primary hover:underline inline-flex items-center gap-1"
          >
            Open PT record <ExternalLink className="h-3.5 w-3.5" />
          </Link>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-4">
          <Stat label="Open invoices" value={money(outstanding?.open_invoices_cents ?? 0)} />
          <Stat label="Uninvoiced sessions" value={money(outstanding?.uninvoiced_sessions_cents ?? 0)} />
          <Stat label="Package balance" value={money(outstanding?.package_balance_cents ?? 0)} />
          <Stat label="Total PT owed" value={money(total)} highlight={total > 0} />
        </div>

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
    </Card>
  );
}

function Stat({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="rounded-lg border p-3">
      <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className={`text-base font-medium mt-1 ${highlight ? "text-destructive" : ""}`}>{value}</div>
    </div>
  );
}
