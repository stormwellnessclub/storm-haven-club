import { useState } from "react";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, Loader2, Pencil, X } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useAllGutResetSessions,
  useGutResetPurchases,
  type GutResetSession,
} from "@/hooks/useGutResetSessions";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

function formatDate(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function SessionForm({
  initial,
  onClose,
}: {
  initial?: GutResetSession;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const [startDate, setStartDate] = useState(initial?.start_date ?? "");
  const [lengthDays, setLengthDays] = useState<string>(String(initial?.length_days ?? "3"));
  const [capacity, setCapacity] = useState<string>(
    initial?.capacity != null ? String(initial.capacity) : ""
  );
  const [status, setStatus] = useState<string>(initial?.status ?? "scheduled");
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!startDate) return toast.error("Pick a start date");
    setSaving(true);
    const payload: any = {
      start_date: startDate,
      length_days: Number(lengthDays),
      capacity: capacity.trim() === "" ? null : Number(capacity),
      status,
      notes: notes.trim() || null,
    };
    const { error } = initial
      ? await supabase.from("gut_reset_sessions").update(payload).eq("id", initial.id)
      : await supabase.from("gut_reset_sessions").insert(payload);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success(initial ? "Session updated" : "Session created");
    qc.invalidateQueries({ queryKey: ["gut-reset-sessions"] });
    onClose();
  };

  return (
    <div className="space-y-4">
      <div>
        <Label>Start date</Label>
        <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label>Length</Label>
          <Select value={lengthDays} onValueChange={setLengthDays}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="3">3 Day</SelectItem>
              <SelectItem value="5">5 Day</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Capacity (blank = unlimited)</Label>
          <Input
            type="number"
            min={0}
            value={capacity}
            onChange={(e) => setCapacity(e.target.value)}
          />
        </div>
      </div>
      <div>
        <Label>Status</Label>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="scheduled">Scheduled</SelectItem>
            <SelectItem value="cancelled">Cancelled</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div>
        <Label>Notes (shown publicly)</Label>
        <Textarea
          rows={3}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Optional details — pickup times, what's new, etc."
        />
      </div>
      <DialogFooter>
        <Button variant="ghost" onClick={onClose}>
          Cancel
        </Button>
        <Button onClick={save} disabled={saving}>
          {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {initial ? "Save changes" : "Create session"}
        </Button>
      </DialogFooter>
    </div>
  );
}

function SessionsTab() {
  const { data: sessions, isLoading } = useAllGutResetSessions();
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<GutResetSession | null>(null);

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Dialog open={creating} onOpenChange={setCreating}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" /> New session
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Schedule a Gut Reset</DialogTitle>
            </DialogHeader>
            <SessionForm onClose={() => setCreating(false)} />
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      ) : !sessions?.length ? (
        <Card className="p-8 text-center text-muted-foreground">No sessions yet.</Card>
      ) : (
        <div className="space-y-2">
          {sessions.map((s) => (
            <Card key={s.id} className="p-4 flex items-center justify-between gap-4 flex-wrap">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-medium">{formatDate(s.start_date)}</span>
                  <Badge variant="outline">{s.length_days}-Day</Badge>
                  <Badge
                    variant={
                      s.status === "scheduled"
                        ? "default"
                        : s.status === "cancelled"
                        ? "destructive"
                        : "secondary"
                    }
                  >
                    {s.status}
                  </Badge>
                </div>
                <div className="text-sm text-muted-foreground mt-1">
                  {s.spots_taken} purchased
                  {s.capacity !== null && ` / ${s.capacity} capacity`}
                  {s.notes && <span className="ml-2 italic">· {s.notes}</span>}
                </div>
              </div>
              <Button variant="outline" size="sm" onClick={() => setEditing(s)}>
                <Pencil className="h-3 w-3 mr-1" /> Edit
              </Button>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit session</DialogTitle>
          </DialogHeader>
          {editing && <SessionForm initial={editing} onClose={() => setEditing(null)} />}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function PurchasesTab() {
  const { data: purchases, isLoading } = useGutResetPurchases();
  const { data: sessions } = useAllGutResetSessions();
  const sessionMap = new Map((sessions ?? []).map((s) => [s.id, s]));

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }
  if (!purchases?.length) {
    return <Card className="p-8 text-center text-muted-foreground">No purchases yet.</Card>;
  }

  return (
    <div className="space-y-2">
      {purchases.map((p) => {
        const s = sessionMap.get(p.session_id);
        return (
          <Card key={p.id} className="p-4">
            <div className="flex justify-between gap-4 flex-wrap">
              <div>
                <div className="font-medium">{p.customer_name}</div>
                <div className="text-sm text-muted-foreground">
                  {p.customer_email}
                  {p.customer_phone && ` · ${p.customer_phone}`}
                </div>
                <div className="text-sm text-muted-foreground mt-1">
                  {p.option === "3day" ? "3-Day" : "5-Day"}
                  {s && <> · starts {formatDate(s.start_date)}</>}
                </div>
              </div>
              <div className="text-right">
                <div className="font-medium">${(p.amount_cents / 100).toFixed(2)}</div>
                <Badge
                  variant={
                    p.status === "paid"
                      ? "default"
                      : p.status === "refunded"
                      ? "destructive"
                      : "secondary"
                  }
                  className="mt-1"
                >
                  {p.status}
                </Badge>
                <div className="text-xs text-muted-foreground mt-1">
                  {new Date(p.created_at).toLocaleDateString()}
                </div>
              </div>
            </div>
          </Card>
        );
      })}
    </div>
  );
}

export default function GutResetAdmin() {
  return (
    <AdminLayout title="Gut Reset">
      <Tabs defaultValue="sessions" className="space-y-4">
        <TabsList>
          <TabsTrigger value="sessions">Sessions</TabsTrigger>
          <TabsTrigger value="purchases">Purchases</TabsTrigger>
        </TabsList>
        <TabsContent value="sessions">
          <SessionsTab />
        </TabsContent>
        <TabsContent value="purchases">
          <PurchasesTab />
        </TabsContent>
      </Tabs>
    </AdminLayout>
  );
}
