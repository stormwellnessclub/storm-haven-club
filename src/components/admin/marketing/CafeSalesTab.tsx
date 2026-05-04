import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Coffee,
  Target,
  TrendingUp,
  Users,
  RefreshCw,
  Pencil,
  Check,
  Ticket,
  Loader2,
  Mail,
  MessageSquare,
} from "lucide-react";
import { ComposeEmailDialog } from "./ComposeEmailDialog";
import { ComposeSmsDialog } from "./ComposeSmsDialog";
import { CampaignPlaybooks, type PlaybookConfig } from "./CampaignPlaybooks";
import { GrantCafeVoucherDialog } from "./GrantCafeVoucherDialog";

interface OrderRow {
  id: string;
  user_id: string | null;
  total_amount: number; // cents
  created_at: string;
  status: string;
}

interface MemberLite {
  id: string;
  user_id: string | null;
  email: string;
  first_name: string | null;
  last_name: string | null;
}

const fmtUSD = (cents: number) =>
  (cents / 100).toLocaleString("en-US", { style: "currency", currency: "USD" });

export function CafeSalesTab() {
  const [loading, setLoading] = useState(true);
  const [targetCents, setTargetCents] = useState<number>(800000);
  const [editingTarget, setEditingTarget] = useState(false);
  const [draftTarget, setDraftTarget] = useState("8000");
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [members, setMembers] = useState<MemberLite[]>([]);
  const [composeEmailOpen, setComposeEmailOpen] = useState(false);
  const [composeSmsOpen, setComposeSmsOpen] = useState(false);
  const [activeGoal, setActiveGoal] = useState<string | undefined>();
  const [activePlaybookName, setActivePlaybookName] = useState<string | undefined>();
  const [grantVoucherOpen, setGrantVoucherOpen] = useState(false);

  const fetchAll = async () => {
    setLoading(true);
    try {
      const [settingRes, ordersRes, membersRes] = await Promise.all([
        supabase
          .from("cafe_marketing_settings" as any)
          .select("value")
          .eq("key", "monthly_revenue_target_cents")
          .maybeSingle(),
        supabase
          .from("cafe_orders" as any)
          .select("id, user_id, total_amount, created_at, status")
          .gte("created_at", new Date(Date.now() - 1000 * 60 * 60 * 24 * 90).toISOString())
          .order("created_at", { ascending: false }),
        supabase
          .from("members")
          .select("id, user_id, email, first_name, last_name")
          .eq("status", "active")
          .not("email", "is", null)
          .limit(1000),
      ]);

      const t = (settingRes.data as any)?.value;
      if (typeof t === "number") {
        setTargetCents(t);
        setDraftTarget(String(t / 100));
      }
      setOrders(((ordersRes.data || []) as any[]) as OrderRow[]);
      setMembers(((membersRes.data || []) as any[]) as MemberLite[]);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAll();
  }, []);

  const stats = useMemo(() => {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const completed = orders.filter((o) => o.status === "completed");

    const mtd = completed.filter((o) => new Date(o.created_at) >= monthStart);
    const mtdRevenue = mtd.reduce((s, o) => s + (o.total_amount || 0), 0);

    const buyersAll = new Set(completed.map((o) => o.user_id).filter(Boolean) as string[]);
    const buyers30 = new Set(
      completed.filter((o) => new Date(o.created_at) >= thirtyDaysAgo).map((o) => o.user_id).filter(Boolean) as string[],
    );
    const buyers7 = new Set(
      completed.filter((o) => new Date(o.created_at) >= sevenDaysAgo).map((o) => o.user_id).filter(Boolean) as string[],
    );

    const memberUserIds = new Set(members.map((m) => m.user_id).filter(Boolean) as string[]);
    const orderingMembers = [...buyersAll].filter((u) => memberUserIds.has(u)).length;

    // Repeat: members who placed >1 order in last 30d
    const orderCount30 = new Map<string, number>();
    completed
      .filter((o) => new Date(o.created_at) >= thirtyDaysAgo && o.user_id && memberUserIds.has(o.user_id))
      .forEach((o) => orderCount30.set(o.user_id!, (orderCount30.get(o.user_id!) || 0) + 1));
    const repeats = [...orderCount30.values()].filter((c) => c > 1).length;
    const repeatRate = orderCount30.size ? (repeats / orderCount30.size) * 100 : 0;

    const avgTicket = mtd.length ? mtdRevenue / mtd.length : 0;

    const daysInMonth = monthEnd.getDate();
    const daysElapsed = now.getDate();
    const daysRemaining = Math.max(1, daysInMonth - daysElapsed);
    const gap = Math.max(0, targetCents - mtdRevenue);
    const dailyNeeded = gap / daysRemaining;

    return {
      mtdRevenue,
      gap,
      dailyNeeded,
      pct: targetCents > 0 ? Math.min(100, (mtdRevenue / targetCents) * 100) : 0,
      activeMembers: members.length,
      everOrdered: orderingMembers,
      buyers30: buyers30.size,
      buyers7: buyers7.size,
      avgTicket,
      repeatRate,
    };
  }, [orders, members, targetCents]);

  const lapsedBuyers = useMemo(() => {
    const memberById = new Map(members.map((m) => [m.user_id, m]));
    const lastOrder = new Map<string, string>();
    orders
      .filter((o) => o.status === "completed" && o.user_id)
      .forEach((o) => {
        const prev = lastOrder.get(o.user_id!);
        if (!prev || o.created_at > prev) lastOrder.set(o.user_id!, o.created_at);
      });
    const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    return [...lastOrder.entries()]
      .filter(([_uid, last]) => last < cutoff)
      .map(([uid, last]) => {
        const m = memberById.get(uid);
        return m ? { name: `${m.first_name || ""} ${m.last_name || ""}`.trim() || m.email, email: m.email, last } : null;
      })
      .filter(Boolean)
      .slice(0, 5) as { name: string; email: string; last: string }[];
  }, [orders, members]);

  const saveTarget = async () => {
    const dollars = parseFloat(draftTarget || "0");
    if (!Number.isFinite(dollars) || dollars < 0) {
      toast.error("Enter a valid amount");
      return;
    }
    const cents = Math.round(dollars * 100);
    const { error } = await (supabase
      .from("cafe_marketing_settings" as any)
      .upsert({ key: "monthly_revenue_target_cents", value: cents, updated_at: new Date().toISOString() }) as any);
    if (error) {
      toast.error("Failed to save target");
      return;
    }
    setTargetCents(cents);
    setEditingTarget(false);
    toast.success("Target updated");
  };

  const handleLaunchPlaybook = (p: PlaybookConfig) => {
    setActiveGoal(p.goalType);
    setActivePlaybookName(p.name);
    setComposeEmailOpen(true);
  };
  const handleLaunchSmsPlaybook = (p: PlaybookConfig) => {
    setActiveGoal(p.goalType);
    setActivePlaybookName(p.name);
    setComposeSmsOpen(true);
  };

  return (
    <div className="space-y-6">
      {/* Target vs Actual */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between gap-4">
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                <Target className="h-4 w-4 text-accent" /> Cafe Sales Target — This Month
              </CardTitle>
              <CardDescription>Adjustable monthly goal, MTD revenue, and the daily run-rate to close.</CardDescription>
            </div>
            <Button size="sm" variant="ghost" onClick={fetchAll} disabled={loading}>
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-4">
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground uppercase tracking-wide">Target</p>
              {editingTarget ? (
                <div className="flex items-center gap-1">
                  <span className="text-sm">$</span>
                  <Input
                    autoFocus
                    type="number"
                    inputMode="decimal"
                    value={draftTarget}
                    onChange={(e) => setDraftTarget(e.target.value)}
                    className="h-8 w-24"
                    onKeyDown={(e) => e.key === "Enter" && saveTarget()}
                  />
                  <Button size="icon" variant="ghost" className="h-7 w-7" onClick={saveTarget}>
                    <Check className="h-4 w-4" />
                  </Button>
                </div>
              ) : (
                <button
                  className="text-2xl font-semibold flex items-center gap-1 hover:text-accent"
                  onClick={() => setEditingTarget(true)}
                >
                  {fmtUSD(targetCents)}
                  <Pencil className="h-3 w-3 text-muted-foreground" />
                </button>
              )}
            </div>
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground uppercase tracking-wide">MTD Actual</p>
              <p className="text-2xl font-semibold">{fmtUSD(stats.mtdRevenue)}</p>
            </div>
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground uppercase tracking-wide">Gap to Goal</p>
              <p className={`text-2xl font-semibold ${stats.gap === 0 ? "text-emerald-600" : "text-amber-600"}`}>
                {fmtUSD(stats.gap)}
              </p>
            </div>
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground uppercase tracking-wide">Daily Needed</p>
              <p className="text-2xl font-semibold">{fmtUSD(stats.dailyNeeded)}</p>
            </div>
          </div>
          <div>
            <Progress value={stats.pct} className="h-2" />
            <p className="text-xs text-muted-foreground mt-1">{stats.pct.toFixed(1)}% of monthly target</p>
          </div>
        </CardContent>
      </Card>

      {/* Funnel KPIs */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <p className="text-xs text-muted-foreground uppercase">Active Members</p>
              <Users className="h-4 w-4 text-muted-foreground" />
            </div>
            <p className="text-2xl font-semibold mt-2">{stats.activeMembers}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <p className="text-xs text-muted-foreground uppercase">Ever Ordered</p>
              <Coffee className="h-4 w-4 text-muted-foreground" />
            </div>
            <p className="text-2xl font-semibold mt-2">
              {stats.everOrdered}
              <span className="text-sm text-muted-foreground font-normal ml-1">
                ({stats.activeMembers ? Math.round((stats.everOrdered / stats.activeMembers) * 100) : 0}%)
              </span>
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <p className="text-xs text-muted-foreground uppercase">Last 30d / 7d</p>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </div>
            <p className="text-2xl font-semibold mt-2">
              {stats.buyers30} <span className="text-muted-foreground">/</span> {stats.buyers7}
            </p>
            <p className="text-xs text-muted-foreground">{stats.repeatRate.toFixed(0)}% repeat rate (30d)</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <p className="text-xs text-muted-foreground uppercase">Avg Ticket (MTD)</p>
              <Badge variant="secondary" className="text-[10px]">USD</Badge>
            </div>
            <p className="text-2xl font-semibold mt-2">{fmtUSD(stats.avgTicket)}</p>
          </CardContent>
        </Card>
      </div>

      {/* Voucher CTA */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between gap-4">
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                <Ticket className="h-4 w-4 text-accent" /> Free-Drink Vouchers
              </CardTitle>
              <CardDescription>
                Hand-grant codes that auto-apply at the POS. Pair with playbooks for measurable conversion.
              </CardDescription>
            </div>
            <Button size="sm" onClick={() => setGrantVoucherOpen(true)}>
              Grant Voucher
            </Button>
          </div>
        </CardHeader>
      </Card>

      {/* Playbooks */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Cafe Campaign Playbooks</CardTitle>
          <CardDescription>Goal-driven cafe campaigns with 14-day conversion tracking</CardDescription>
        </CardHeader>
        <CardContent>
          <CampaignPlaybooks
            type="cafe"
            onLaunchPlaybook={handleLaunchPlaybook}
            onLaunchSmsPlaybook={handleLaunchSmsPlaybook}
            onCustomCampaign={() => {
              setActiveGoal(undefined);
              setActivePlaybookName(undefined);
              setComposeEmailOpen(true);
            }}
          />
        </CardContent>
      </Card>

      {/* Lapsed Buyers quick list */}
      {lapsedBuyers.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Top 5 Lapsed Cafe Buyers</CardTitle>
            <CardDescription>Last order &gt; 30 days ago — prime Win-Them-Back targets</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="divide-y border rounded-md">
              {lapsedBuyers.map((b) => (
                <div key={b.email} className="flex items-center justify-between p-3 text-sm">
                  <div>
                    <p className="font-medium">{b.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {b.email} · last {new Date(b.last).toLocaleDateString()}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <ComposeEmailDialog
        open={composeEmailOpen}
        onOpenChange={setComposeEmailOpen}
        recipientType="member"
        goalType={activeGoal}
        playbookName={activePlaybookName}
      />
      <ComposeSmsDialog
        open={composeSmsOpen}
        onOpenChange={setComposeSmsOpen}
        recipientType="member"
        goalType={activeGoal}
        playbookName={activePlaybookName}
      />
      <GrantCafeVoucherDialog
        open={grantVoucherOpen}
        onOpenChange={setGrantVoucherOpen}
        members={members}
        onGranted={fetchAll}
      />
    </div>
  );
}
