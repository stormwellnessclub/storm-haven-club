import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { format } from "date-fns";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  AlertTriangle,
  RefreshCw,
  Loader2,
  Search,
  ShieldAlert,
  ExternalLink,
} from "lucide-react";
import { toast } from "sonner";
import { useUserRoles } from "@/hooks/useUserRoles";
import {
  useMembershipHealth,
  useSyncMembershipTruth,
  bucketFor,
  type HealthBucket,
  type MembershipHealthRow,
} from "@/hooks/useMembershipHealth";

const BUCKETS: { key: HealthBucket; label: string; tone: string }[] = [
  { key: "paying", label: "Paying & current", tone: "text-emerald-600" },
  { key: "past_due", label: "Past due", tone: "text-destructive" },
  { key: "retrying", label: "Payment failing", tone: "text-orange-600" },
  { key: "paused", label: "Frozen / paused", tone: "text-blue-600" },
  { key: "sponsored", label: "Sponsored / comped", tone: "" },
  { key: "no_subscription", label: "No subscription", tone: "text-amber-600" },
  { key: "pending_activation", label: "Pending activation", tone: "text-muted-foreground" },
  { key: "cancelled", label: "Cancelled", tone: "text-muted-foreground" },
];

const money = (c?: number | null) =>
  typeof c === "number" ? `$${(c / 100).toFixed(2)}` : "—";
const date = (d?: string | null) => (d ? format(new Date(d), "MMM d, yyyy") : "—");
const daysSince = (d?: string | null) =>
  d ? Math.floor((Date.now() - new Date(d).getTime()) / 86400000) : null;

export default function MembershipHealth() {
  const { roles, loading: rolesLoading } = useUserRoles();
  const { data, isLoading } = useMembershipHealth();
  const sync = useSyncMembershipTruth();
  const [bucket, setBucket] = useState<HealthBucket | "all">("all");
  const [search, setSearch] = useState("");

  const isSuperAdmin = roles.includes("super_admin");

  const rows = data ?? [];
  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const r of rows) {
      const b = bucketFor(r);
      c[b] = (c[b] ?? 0) + 1;
    }
    return c;
  }, [rows]);

  const attention = useMemo(
    () => rows.filter((r) => r.anomalies.length > 0 && r.member_status !== "cancelled"),
    [rows],
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows
      .filter((r) => (bucket === "all" ? true : bucketFor(r) === bucket))
      .filter((r) =>
        !q
          ? true
          : `${r.first_name} ${r.last_name} ${r.email ?? ""}`.toLowerCase().includes(q),
      )
      .sort((a, b) => `${a.last_name}`.localeCompare(`${b.last_name}`));
  }, [rows, bucket, search]);

  const lastSynced = useMemo(() => {
    const stamps = rows.map((r) => r.synced_at).filter(Boolean) as string[];
    if (!stamps.length) return null;
    return stamps.sort().at(-1)!;
  }, [rows]);

  const handleSync = async (memberId?: string) => {
    try {
      const r = await sync.mutateAsync(memberId);
      toast.success(
        `Synced ${r.synced} member${r.synced === 1 ? "" : "s"} from Stripe` +
          (r.status_corrections ? ` — ${r.status_corrections} status correction(s)` : ""),
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Sync failed");
    }
  };

  if (rolesLoading) {
    return (
      <AdminLayout>
        <Skeleton className="h-64 w-full" />
      </AdminLayout>
    );
  }

  if (!isSuperAdmin) {
    return (
      <AdminLayout>
        <Card className="max-w-lg">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ShieldAlert className="h-5 w-5 text-destructive" /> Restricted
            </CardTitle>
            <CardDescription>
              Membership billing records are limited to owner-level accounts.
            </CardDescription>
          </CardHeader>
        </Card>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold">Membership Health</h1>
            <p className="text-sm text-muted-foreground">
              Billing truth pulled directly from Stripe.{" "}
              {lastSynced ? (
                <>Last refreshed {format(new Date(lastSynced), "MMM d, yyyy h:mm a")}.</>
              ) : (
                <>Never synced — run a refresh to populate.</>
              )}
            </p>
          </div>
          <Button onClick={() => handleSync()} disabled={sync.isPending}>
            {sync.isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="mr-2 h-4 w-4" />
            )}
            Refresh from Stripe
          </Button>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <button
            onClick={() => setBucket("all")}
            className={`rounded-lg border p-3 text-left transition ${bucket === "all" ? "border-primary ring-1 ring-primary" : "hover:bg-muted/50"}`}
          >
            <div className="text-2xl font-semibold">{rows.length}</div>
            <div className="mt-0.5 text-xs text-muted-foreground">All records</div>
          </button>
          {BUCKETS.map((b) => (
            <button
              key={b.key}
              onClick={() => setBucket(b.key)}
              className={`rounded-lg border p-3 text-left transition ${bucket === b.key ? "border-primary ring-1 ring-primary" : "hover:bg-muted/50"}`}
            >
              <div className={`text-2xl font-semibold ${b.tone}`}>{counts[b.key] ?? 0}</div>
              <div className="mt-0.5 text-xs text-muted-foreground">{b.label}</div>
            </button>
          ))}
        </div>

        {attention.length > 0 && (
          <Card className="border-amber-300">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <AlertTriangle className="h-4 w-4 text-amber-600" />
                Needs attention
                <Badge variant="destructive">{attention.length}</Badge>
              </CardTitle>
              <CardDescription>
                Genuine anomalies detected against Stripe, not local guesses.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {attention.slice(0, 15).map((r) => (
                <div
                  key={r.member_id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-md border p-2 text-sm"
                >
                  <Link
                    to={`/admin/members/${r.member_id}`}
                    className="font-medium hover:underline"
                  >
                    {r.first_name} {r.last_name}
                  </Link>
                  <div className="flex flex-wrap gap-1">
                    {r.anomalies.map((a) => (
                      <Badge key={a} variant="outline" className="text-xs">
                        {a}
                      </Badge>
                    ))}
                  </div>
                </div>
              ))}
              {attention.length > 15 && (
                <p className="text-xs text-muted-foreground">
                  +{attention.length - 15} more shown in the table below.
                </p>
              )}
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader className="pb-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <CardTitle className="text-base">
                {bucket === "all"
                  ? "All members"
                  : BUCKETS.find((b) => b.key === bucket)?.label}{" "}
                <span className="text-muted-foreground">({filtered.length})</span>
              </CardTitle>
              <div className="relative w-64 max-w-full">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search name or email"
                  className="pl-8"
                />
              </div>
            </div>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            {isLoading ? (
              <Skeleton className="h-64 w-full" />
            ) : filtered.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                No members in this group.
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Member</TableHead>
                    <TableHead>Tier</TableHead>
                    <TableHead>Stripe status</TableHead>
                    <TableHead>Last payment</TableHead>
                    <TableHead>Next billing</TableHead>
                    <TableHead>Card</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((r) => (
                    <Row key={r.member_id} r={r} onSync={handleSync} syncing={sync.isPending} />
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}

function Row({
  r,
  onSync,
  syncing,
}: {
  r: MembershipHealthRow;
  onSync: (id: string) => void;
  syncing: boolean;
}) {
  const b = bucketFor(r);
  const days = daysSince(r.last_paid_at);
  return (
    <TableRow>
      <TableCell>
        <Link to={`/admin/members/${r.member_id}`} className="font-medium hover:underline">
          {r.first_name} {r.last_name}
        </Link>
        <p className="text-xs text-muted-foreground">{r.email}</p>
        {r.sync_error && (
          <p className="text-xs text-destructive">Sync error: {r.sync_error}</p>
        )}
      </TableCell>
      <TableCell>
        <Badge variant="outline">{r.membership_type ?? "—"}</Badge>
      </TableCell>
      <TableCell className="text-sm">
        <Badge
          variant={
            b === "past_due" || b === "retrying"
              ? "destructive"
              : b === "paying"
                ? "default"
                : "secondary"
          }
        >
          {r.dues_status ?? r.effective_status ?? r.local_subscription_status ?? "none"}
        </Badge>
        {r.collection_paused && (
          <p className="mt-0.5 text-xs text-muted-foreground">
            Paused{r.resumes_at ? ` — resumes ${date(r.resumes_at)}` : " — no resume date"}
          </p>
        )}
        {r.cancel_at_period_end && (
          <p className="mt-0.5 text-xs text-amber-600">Cancels at period end</p>
        )}
      </TableCell>
      <TableCell className="text-sm">
        {r.last_paid_at ? (
          <>
            <div>{date(r.last_paid_at)}</div>
            <div className="text-xs text-muted-foreground">
              {money(r.last_paid_amount_cents)}
              {days !== null ? ` · ${days}d ago` : ""}
            </div>
          </>
        ) : (
          <span className="text-muted-foreground">Never</span>
        )}
      </TableCell>
      <TableCell className="text-sm">{date(r.next_billing_at)}</TableCell>
      <TableCell className="text-sm">
        {r.card_last4 ? (
          <>
            {r.card_brand} •••• {r.card_last4}
            {r.card_exp_month && r.card_exp_year && (
              <div className="text-xs text-muted-foreground">
                exp {String(r.card_exp_month).padStart(2, "0")}/{String(r.card_exp_year).slice(-2)}
              </div>
            )}
          </>
        ) : (
          <span className="text-muted-foreground">—</span>
        )}
      </TableCell>
      <TableCell className="text-right">
        <div className="flex justify-end gap-1">
          <Button
            variant="outline"
            size="sm"
            onClick={() => onSync(r.member_id)}
            disabled={syncing}
          >
            <RefreshCw className="h-3 w-3" />
          </Button>
          <Button variant="ghost" size="sm" asChild>
            <Link to={`/admin/members/${r.member_id}`}>
              <ExternalLink className="h-3 w-3" />
            </Link>
          </Button>
        </div>
      </TableCell>
    </TableRow>
  );
}
