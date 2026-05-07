import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Search, Send, CheckCircle2, UserPlus, RefreshCw } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";

type Pack = {
  id: string;
  user_id: string | null;
  member_id: string | null;
  classes_total: number;
  classes_remaining: number;
  price_paid: number;
  is_member_price: boolean;
  status: string;
  expires_at: string;
  created_at: string;
  gift_buyer_name: string | null;
  gift_buyer_email: string | null;
  gift_recipient_name: string | null;
  gift_recipient_email: string | null;
  gift_verification_status: string | null;
  stripe_payment_intent_id: string | null;
};

export default function MothersDayClassPacks() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<string>("all");

  const { data: packs, isLoading } = useQuery({
    queryKey: ["mothers-day-class-packs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("class_passes")
        .select("*")
        .eq("promo_code", "mothers_day_2026")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as Pack[];
    },
    refetchInterval: 30_000,
  });

  const filtered = useMemo(() => {
    if (!packs) return [];
    return packs.filter((p) => {
      const isGift = !!p.gift_recipient_email;
      if (filter === "gift" && !isGift) return false;
      if (filter === "self" && isGift) return false;
      if (filter === "pending" && p.gift_verification_status !== "pending") return false;
      if (filter === "unclaimed" && p.user_id) return false;
      if (filter === "member" && !p.is_member_price) return false;
      if (filter === "nonmember" && p.is_member_price) return false;
      if (search.trim()) {
        const q = search.trim().toLowerCase();
        const hay = [p.gift_buyer_name, p.gift_buyer_email, p.gift_recipient_name, p.gift_recipient_email]
          .filter(Boolean).join(" ").toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [packs, filter, search]);

  const stats = useMemo(() => {
    if (!packs) return null;
    return {
      total: packs.length,
      member: packs.filter((p) => p.is_member_price).length,
      nonMember: packs.filter((p) => !p.is_member_price).length,
      gifts: packs.filter((p) => p.gift_recipient_email).length,
      pending: packs.filter((p) => p.gift_verification_status === "pending").length,
      unclaimed: packs.filter((p) => !p.user_id).length,
      revenue: packs.reduce((s, p) => s + Number(p.price_paid || 0), 0),
    };
  }, [packs]);

  const verifyMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("class_passes")
        .update({ gift_verification_status: "auto" })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Marked as verified");
      qc.invalidateQueries({ queryKey: ["mothers-day-class-packs"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const resendMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.functions.invoke("send-mothers-day-pack-confirmation", {
        body: { pass_id: id },
      });
      if (error) throw error;
    },
    onSuccess: () => toast.success("Confirmation email resent"),
    onError: (e: any) => toast.error(e.message),
  });

  const assignMutation = useMutation({
    mutationFn: async ({ id, email }: { id: string; email: string }) => {
      const e = email.trim().toLowerCase();
      if (!e) throw new Error("Email required");
      // Look up user by email via members table or RPC; fall back to no-op if no account
      const { data: member } = await supabase
        .from("members")
        .select("id, user_id")
        .ilike("email", e)
        .limit(1)
        .maybeSingle();
      if (!member?.user_id) throw new Error("No account found for that email. Ask the recipient to sign up first.");
      const { error } = await supabase
        .from("class_passes")
        .update({ user_id: member.user_id, member_id: member.id, gift_verification_status: "auto" })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Pass assigned");
      qc.invalidateQueries({ queryKey: ["mothers-day-class-packs"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <AdminLayout title="Mother's Day Class Packs">
      <div className="space-y-6">
        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-7 gap-3">
          {stats && (
            <>
              <StatCard label="Total Sold" value={stats.total} />
              <StatCard label="Member Tier" value={stats.member} />
              <StatCard label="Non-Member" value={stats.nonMember} />
              <StatCard label="Gifts" value={stats.gifts} />
              <StatCard label="Pending Verify" value={stats.pending} highlight={stats.pending > 0} />
              <StatCard label="Unclaimed" value={stats.unclaimed} highlight={stats.unclaimed > 0} />
              <StatCard label="Revenue" value={`$${stats.revenue.toFixed(0)}`} />
            </>
          )}
        </div>

        {/* Filters */}
        <Card>
          <CardContent className="pt-6 flex flex-wrap gap-3 items-center">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                className="pl-9"
                placeholder="Search by name or email…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <Select value={filter} onValueChange={setFilter}>
              <SelectTrigger className="w-[200px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All purchases</SelectItem>
                <SelectItem value="self">Self-purchase only</SelectItem>
                <SelectItem value="gift">Gifts only</SelectItem>
                <SelectItem value="pending">Pending verification</SelectItem>
                <SelectItem value="unclaimed">Unclaimed</SelectItem>
                <SelectItem value="member">Member tier</SelectItem>
                <SelectItem value="nonmember">Non-member tier</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" size="sm" onClick={() => qc.invalidateQueries({ queryKey: ["mothers-day-class-packs"] })}>
              <RefreshCw className="w-4 h-4" />
            </Button>
          </CardContent>
        </Card>

        {/* Table */}
        <Card>
          <CardHeader><CardTitle>Purchases ({filtered.length})</CardTitle></CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="py-10 flex justify-center"><Loader2 className="w-6 h-6 animate-spin" /></div>
            ) : filtered.length === 0 ? (
              <p className="text-sm text-muted-foreground py-8 text-center">No packs match these filters.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-left text-xs uppercase text-muted-foreground border-b">
                    <tr>
                      <th className="py-2 pr-3">Purchased</th>
                      <th className="py-2 pr-3">Buyer</th>
                      <th className="py-2 pr-3">Recipient</th>
                      <th className="py-2 pr-3">Tier</th>
                      <th className="py-2 pr-3">Paid</th>
                      <th className="py-2 pr-3">Remaining</th>
                      <th className="py-2 pr-3">Expires</th>
                      <th className="py-2 pr-3">Status</th>
                      <th className="py-2">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((p) => (
                      <PackRow
                        key={p.id}
                        pack={p}
                        onVerify={() => verifyMutation.mutate(p.id)}
                        onResend={() => resendMutation.mutate(p.id)}
                        onAssign={(email) => assignMutation.mutate({ id: p.id, email })}
                      />
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}

function StatCard({ label, value, highlight }: { label: string; value: string | number; highlight?: boolean }) {
  return (
    <Card className={highlight ? "border-amber-500" : ""}>
      <CardContent className="pt-4 pb-3">
        <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
        <div className="text-2xl font-semibold mt-1">{value}</div>
      </CardContent>
    </Card>
  );
}

function PackRow({ pack, onVerify, onResend, onAssign }: {
  pack: Pack;
  onVerify: () => void;
  onResend: () => void;
  onAssign: (email: string) => void;
}) {
  const [assignOpen, setAssignOpen] = useState(false);
  const [assignEmail, setAssignEmail] = useState(pack.gift_recipient_email || "");
  const isGift = !!pack.gift_recipient_email;
  const unclaimed = !pack.user_id;
  const pending = pack.gift_verification_status === "pending";

  return (
    <tr className="border-b hover:bg-muted/30 align-top">
      <td className="py-2 pr-3 whitespace-nowrap text-xs">{format(new Date(pack.created_at), "MMM d, yyyy")}</td>
      <td className="py-2 pr-3">
        <div className="font-medium">{pack.gift_buyer_name || "—"}</div>
        <div className="text-xs text-muted-foreground">{pack.gift_buyer_email}</div>
      </td>
      <td className="py-2 pr-3">
        {isGift ? (
          <>
            <div className="font-medium">{pack.gift_recipient_name}</div>
            <div className="text-xs text-muted-foreground">{pack.gift_recipient_email}</div>
          </>
        ) : <span className="text-muted-foreground text-xs">Self</span>}
      </td>
      <td className="py-2 pr-3">
        <Badge variant={pack.is_member_price ? "default" : "secondary"}>
          {pack.is_member_price ? "Member" : "Non-Member"}
        </Badge>
      </td>
      <td className="py-2 pr-3">${Number(pack.price_paid).toFixed(0)}</td>
      <td className="py-2 pr-3">{pack.classes_remaining}/{pack.classes_total}</td>
      <td className="py-2 pr-3 whitespace-nowrap text-xs">{format(new Date(pack.expires_at), "MMM d, yyyy")}</td>
      <td className="py-2 pr-3">
        <div className="flex flex-col gap-1">
          {pending && <Badge variant="destructive">Pending verify</Badge>}
          {unclaimed && <Badge variant="outline">Unclaimed</Badge>}
          {!pending && !unclaimed && <Badge variant="outline" className="text-green-700 border-green-300">OK</Badge>}
        </div>
      </td>
      <td className="py-2">
        <div className="flex flex-wrap gap-1">
          {pending && (
            <Button size="sm" variant="outline" onClick={onVerify} title="Mark verified">
              <CheckCircle2 className="w-3.5 h-3.5" />
            </Button>
          )}
          <Button size="sm" variant="outline" onClick={onResend} title="Resend email">
            <Send className="w-3.5 h-3.5" />
          </Button>
          {unclaimed && (
            <Button size="sm" variant="outline" onClick={() => setAssignOpen((v) => !v)} title="Assign to user">
              <UserPlus className="w-3.5 h-3.5" />
            </Button>
          )}
        </div>
        {assignOpen && (
          <div className="mt-2 flex gap-1">
            <Input
              className="h-8 text-xs"
              placeholder="Account email"
              value={assignEmail}
              onChange={(e) => setAssignEmail(e.target.value)}
            />
            <Button size="sm" onClick={() => { onAssign(assignEmail); setAssignOpen(false); }}>Assign</Button>
          </div>
        )}
      </td>
    </tr>
  );
}
