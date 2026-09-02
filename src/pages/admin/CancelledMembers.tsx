import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { toast } from "sonner";
import { format } from "date-fns";
import { Search, UserMinus, Undo2, Info } from "lucide-react";

interface CancelledRow {
  id: string;
  member_id: string | null;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  phone: string | null;
  membership_type: string | null;
  status: string | null;
  records_cancelled_at: string | null;
  records_cancelled_reason: string | null;
  records_collection_status: string | null;
  owed_cents: number;
}

const money = (cents: number) =>
  (cents / 100).toLocaleString("en-US", { style: "currency", currency: "USD" });

export default function CancelledMembers() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [addOpen, setAddOpen] = useState(false);
  const [addSearch, setAddSearch] = useState("");
  const [selected, setSelected] = useState<{ id: string; label: string } | null>(null);
  const [reason, setReason] = useState("");

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["admin-cancelled-members"],
    queryFn: async (): Promise<CancelledRow[]> => {
      const { data, error } = await supabase
        .from("members")
        .select(
          "id, member_id, first_name, last_name, email, phone, membership_type, status, records_cancelled_at, records_cancelled_reason, records_collection_status"
        )
        .not("records_cancelled_at", "is", null)
        .order("records_cancelled_at", { ascending: false });
      if (error) throw error;

      const ids = (data || []).map((m) => m.id);
      const owedByMember = new Map<string, number>();
      if (ids.length) {
        const { data: arrears } = await supabase
          .from("billing_arrears")
          .select("member_id, amount_due_cents, amount_paid_cents, status")
          .in("member_id", ids)
          .in("status", ["unpaid", "partial"]);
        for (const a of arrears || []) {
          const due = (a.amount_due_cents || 0) - (a.amount_paid_cents || 0);
          if (due > 0) owedByMember.set(a.member_id, (owedByMember.get(a.member_id) || 0) + due);
        }
      }

      return (data || []).map((m) => ({ ...m, owed_cents: owedByMember.get(m.id) || 0 }));
    },
  });

  // Members eligible to move onto the list (not already on it)
  const { data: candidates = [] } = useQuery({
    queryKey: ["admin-cancelled-candidates", addSearch],
    enabled: addOpen && addSearch.trim().length >= 2,
    queryFn: async () => {
      const q = addSearch.trim();
      const { data, error } = await supabase
        .from("members")
        .select("id, member_id, first_name, last_name, email, status")
        .is("records_cancelled_at", null)
        .or(
          `first_name.ilike.%${q}%,last_name.ilike.%${q}%,email.ilike.%${q}%,member_id.ilike.%${q}%`
        )
        .limit(20);
      if (error) throw error;
      return data || [];
    },
  });

  const addMutation = useMutation({
    mutationFn: async ({ memberId, note }: { memberId: string; note: string }) => {
      const { data: auth } = await supabase.auth.getUser();
      const { error } = await supabase
        .from("members")
        .update({
          records_cancelled_at: new Date().toISOString(),
          records_cancelled_by: auth.user?.id ?? null,
          records_cancelled_reason: note || null,
        })
        .eq("id", memberId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Moved to cancelled list — no email was sent");
      setAddOpen(false);
      setSelected(null);
      setReason("");
      setAddSearch("");
      queryClient.invalidateQueries({ queryKey: ["admin-cancelled-members"] });
      queryClient.invalidateQueries({ queryKey: ["admin-members"] });
    },
    onError: (e: any) => toast.error(e.message || "Could not update member"),
  });

  const restoreMutation = useMutation({
    mutationFn: async (memberId: string) => {
      const { error } = await supabase
        .from("members")
        .update({
          records_cancelled_at: null,
          records_cancelled_by: null,
          records_cancelled_reason: null,
          records_collection_status: null,
        })
        .eq("id", memberId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Removed from cancelled list");
      queryClient.invalidateQueries({ queryKey: ["admin-cancelled-members"] });
      queryClient.invalidateQueries({ queryKey: ["admin-members"] });
    },
    onError: (e: any) => toast.error(e.message || "Could not update member"),
  });

  const settledMutation = useMutation({
    mutationFn: async ({ memberId, value }: { memberId: string; value: string | null }) => {
      const { error } = await supabase
        .from("members")
        .update({ records_collection_status: value })
        .eq("id", memberId);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin-cancelled-members"] }),
    onError: (e: any) => toast.error(e.message || "Could not update member"),
  });

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) =>
      [r.first_name, r.last_name, r.email, r.member_id]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(q))
    );
  }, [rows, search]);

  const owing = filtered.filter(
    (r) => r.records_collection_status !== "settled" && r.owed_cents > 0
  );
  const settled = filtered.filter(
    (r) => r.records_collection_status === "settled" || r.owed_cents <= 0
  );
  const totalOwed = owing.reduce((s, r) => s + r.owed_cents, 0);

  const renderTable = (list: CancelledRow[], showOwed: boolean) => (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Member</TableHead>
          <TableHead>Tier</TableHead>
          <TableHead>Cancelled</TableHead>
          {showOwed && <TableHead className="text-right">Owed</TableHead>}
          <TableHead>Note</TableHead>
          <TableHead className="text-right">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {list.length === 0 && (
          <TableRow>
            <TableCell colSpan={showOwed ? 6 : 5} className="text-center text-muted-foreground py-8">
              No members in this list.
            </TableCell>
          </TableRow>
        )}
        {list.map((r) => (
          <TableRow key={r.id}>
            <TableCell>
              <Link to={`/admin/members/${r.id}`} className="font-medium hover:underline">
                {`${r.first_name ?? ""} ${r.last_name ?? ""}`.trim() || "—"}
              </Link>
              <div className="text-xs text-muted-foreground">{r.email}</div>
            </TableCell>
            <TableCell className="text-sm">{r.membership_type || "—"}</TableCell>
            <TableCell className="text-sm text-muted-foreground">
              {r.records_cancelled_at
                ? format(new Date(r.records_cancelled_at), "MMM d, yyyy")
                : "—"}
            </TableCell>
            {showOwed && (
              <TableCell className="text-right font-semibold text-destructive">
                {money(r.owed_cents)}
              </TableCell>
            )}
            <TableCell className="text-sm text-muted-foreground max-w-[240px] truncate">
              {r.records_cancelled_reason || "—"}
            </TableCell>
            <TableCell className="text-right space-x-2 whitespace-nowrap">
              {showOwed ? (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => settledMutation.mutate({ memberId: r.id, value: "settled" })}
                >
                  Mark settled
                </Button>
              ) : (
                r.records_collection_status === "settled" && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => settledMutation.mutate({ memberId: r.id, value: null })}
                  >
                    Unmark settled
                  </Button>
                )
              )}
              <Button size="sm" variant="ghost" onClick={() => restoreMutation.mutate(r.id)}>
                <Undo2 className="h-3.5 w-3.5 mr-1" />
                Restore
              </Button>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold">Cancelled Members</h1>
            <p className="text-sm text-muted-foreground">
              Internal records list — moving someone here never sends an email.
            </p>
          </div>
          <Button onClick={() => setAddOpen(true)}>
            <UserMinus className="h-4 w-4 mr-2" />
            Add to cancelled list
          </Button>
        </div>

        <Alert>
          <Info className="h-4 w-4" />
          <AlertDescription>
            Members on this list are excluded from your active member count and are blocked from
            check-in and booking. Their Stripe billing is left untouched so outstanding balances can
            still be collected.
          </AlertDescription>
        </Alert>

        <div className="grid gap-4 sm:grid-cols-3">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-muted-foreground">On cancelled list</CardTitle>
            </CardHeader>
            <CardContent className="text-2xl font-semibold">{rows.length}</CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-muted-foreground">Still owing</CardTitle>
            </CardHeader>
            <CardContent className="text-2xl font-semibold">{owing.length}</CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-muted-foreground">Outstanding balance</CardTitle>
            </CardHeader>
            <CardContent className="text-2xl font-semibold text-destructive">
              {money(totalOwed)}
            </CardContent>
          </Card>
        </div>

        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Search cancelled members..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <Tabs defaultValue="owing">
          <TabsList>
            <TabsTrigger value="owing">
              Cancelled – Owing <Badge variant="secondary" className="ml-2">{owing.length}</Badge>
            </TabsTrigger>
            <TabsTrigger value="cancelled">
              Cancelled <Badge variant="secondary" className="ml-2">{settled.length}</Badge>
            </TabsTrigger>
          </TabsList>
          <TabsContent value="owing">
            <Card>
              <CardContent className="p-0">
                {isLoading ? (
                  <div className="p-8 text-center text-muted-foreground">Loading…</div>
                ) : (
                  renderTable(owing, true)
                )}
              </CardContent>
            </Card>
          </TabsContent>
          <TabsContent value="cancelled">
            <Card>
              <CardContent className="p-0">
                {isLoading ? (
                  <div className="p-8 text-center text-muted-foreground">Loading…</div>
                ) : (
                  renderTable(settled, false)
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add member to cancelled list</DialogTitle>
            <DialogDescription>
              Records only — no email is sent and Stripe billing is not changed.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <Input
              placeholder="Search members by name, email or ID..."
              value={addSearch}
              onChange={(e) => {
                setAddSearch(e.target.value);
                setSelected(null);
              }}
            />
            {!selected && addSearch.trim().length >= 2 && (
              <div className="max-h-56 overflow-y-auto rounded-md border divide-y">
                {candidates.length === 0 && (
                  <div className="p-3 text-sm text-muted-foreground">No matches</div>
                )}
                {candidates.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    className="w-full text-left p-3 hover:bg-muted"
                    onClick={() =>
                      setSelected({
                        id: c.id,
                        label: `${c.first_name ?? ""} ${c.last_name ?? ""}`.trim() || c.email || "",
                      })
                    }
                  >
                    <div className="text-sm font-medium">
                      {`${c.first_name ?? ""} ${c.last_name ?? ""}`.trim() || "—"}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {c.email} · {c.status}
                    </div>
                  </button>
                ))}
              </div>
            )}
            {selected && (
              <div className="rounded-md border p-3 text-sm">
                Selected: <span className="font-medium">{selected.label}</span>
              </div>
            )}
            <Textarea
              placeholder="Internal note (optional) — e.g. stopped paying, moved away"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setAddOpen(false)}>
              Cancel
            </Button>
            <Button
              disabled={!selected || addMutation.isPending}
              onClick={() => selected && addMutation.mutate({ memberId: selected.id, note: reason })}
            >
              Add to list
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}
