import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Loader2, KeyRound, Trash2, ShieldCheck, Search } from "lucide-react";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { FrontDeskLoginCard } from "@/components/admin/FrontDeskLoginCard";

interface RosterRow {
  user_id: string;
  full_name: string | null;
  email: string | null;
  has_pin: boolean;
  pin_updated_at: string | null;
}

const TRIVIAL_PINS = new Set([
  "0000", "1111", "2222", "3333", "4444", "5555",
  "6666", "7777", "8888", "9999", "1234", "4321",
  "0123", "1230",
]);

function isTrivialPin(pin: string): boolean {
  if (TRIVIAL_PINS.has(pin)) return true;
  // all same digit
  if (/^(\d)\1+$/.test(pin)) return true;
  // strict ascending or descending sequence
  const asc = pin.split("").every((c, i) => i === 0 || Number(c) === Number(pin[i - 1]) + 1);
  const desc = pin.split("").every((c, i) => i === 0 || Number(c) === Number(pin[i - 1]) - 1);
  return asc || desc;
}

export default function StaffPins() {
  const [rows, setRows] = useState<RosterRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const [setDialogFor, setSetDialogFor] = useState<RosterRow | null>(null);
  const [clearDialogFor, setClearDialogFor] = useState<RosterRow | null>(null);
  const [pin, setPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error } = await (supabase.rpc as any)("frontdesk_staff_roster");
      if (error) throw error;
      setRows((data ?? []) as RosterRow[]);
    } catch (e: any) {
      console.error("[StaffPins] load failed:", e);
      setError(e?.message ?? "Failed to load staff roster");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) =>
      [r.full_name, r.email].some((v) => (v ?? "").toLowerCase().includes(q))
    );
  }, [rows, search]);

  const openSet = (row: RosterRow) => {
    setPin("");
    setConfirmPin("");
    setSetDialogFor(row);
  };

  const submitSetPin = async () => {
    if (!setDialogFor) return;
    if (!/^[0-9]{4,8}$/.test(pin)) {
      toast.error("PIN must be 4 to 8 digits");
      return;
    }
    if (pin !== confirmPin) {
      toast.error("PINs don't match");
      return;
    }
    if (isTrivialPin(pin)) {
      const proceed = window.confirm(
        "That PIN is easy to guess (like 1234 or 0000). Use it anyway?"
      );
      if (!proceed) return;
    }
    setSaving(true);
    try {
      const { error } = await (supabase.rpc as any)("admin_set_staff_pin", {
        _staff_user_id: setDialogFor.user_id,
        _pin: pin,
      });
      if (error) throw error;
      toast.success(`PIN set for ${setDialogFor.full_name || setDialogFor.email}`);
      setSetDialogFor(null);
      await load();
    } catch (e: any) {
      console.error("[StaffPins] set failed:", e);
      toast.error(e?.message ?? "Failed to set PIN");
    } finally {
      setSaving(false);
    }
  };

  const submitClearPin = async () => {
    if (!clearDialogFor) return;
    setSaving(true);
    try {
      const { error } = await (supabase.rpc as any)("admin_clear_staff_pin", {
        _staff_user_id: clearDialogFor.user_id,
      });
      if (error) throw error;
      toast.success(`PIN cleared for ${clearDialogFor.full_name || clearDialogFor.email}`);
      setClearDialogFor(null);
      await load();
    } catch (e: any) {
      console.error("[StaffPins] clear failed:", e);
      toast.error(e?.message ?? "Failed to clear PIN");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <KeyRound className="h-6 w-6" />
            Staff PINs
          </h1>
          <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
            Personal 4–8 digit PINs staff use to clock in on the Front Desk shell.
            Each PIN is tied to one staff account and is used to attribute
            check-ins, POS sales, and shift hours.
          </p>
        </div>
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            className="pl-8 w-64"
            placeholder="Search staff…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      <FrontDeskLoginCard />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Eligible staff</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-8 flex justify-center">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : error ? (
            <div className="p-6 text-sm text-destructive">{error}</div>
          ) : filtered.length === 0 ? (
            <div className="p-8 text-center text-sm text-muted-foreground">
              No staff found. Assign a Front Desk, Manager, or Admin role first
              on the Staff Management page.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="text-left px-4 py-2 font-medium">Staff member</th>
                    <th className="text-left px-4 py-2 font-medium">Email</th>
                    <th className="text-left px-4 py-2 font-medium">PIN status</th>
                    <th className="text-left px-4 py-2 font-medium">Last set</th>
                    <th className="text-right px-4 py-2 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((row) => (
                    <tr key={row.user_id} className="border-t hover:bg-muted/30">
                      <td className="px-4 py-2 font-medium">
                        {row.full_name || "—"}
                      </td>
                      <td className="px-4 py-2 text-muted-foreground">
                        {row.email || "—"}
                      </td>
                      <td className="px-4 py-2">
                        {row.has_pin ? (
                          <Badge className="gap-1 bg-emerald-100 text-emerald-900 hover:bg-emerald-100">
                            <ShieldCheck className="h-3 w-3" /> Set
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-muted-foreground">
                            Not set
                          </Badge>
                        )}
                      </td>
                      <td className="px-4 py-2 text-muted-foreground">
                        {row.pin_updated_at
                          ? formatDistanceToNow(new Date(row.pin_updated_at), {
                              addSuffix: true,
                            })
                          : "—"}
                      </td>
                      <td className="px-4 py-2">
                        <div className="flex justify-end gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => openSet(row)}
                          >
                            {row.has_pin ? "Reset PIN" : "Set PIN"}
                          </Button>
                          {row.has_pin && (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="text-destructive hover:text-destructive"
                              onClick={() => setClearDialogFor(row)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Set / Reset PIN dialog */}
      <Dialog
        open={!!setDialogFor}
        onOpenChange={(open) => {
          if (!open) setSetDialogFor(null);
        }}
      >
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>
              {setDialogFor?.has_pin ? "Reset PIN" : "Set PIN"} —{" "}
              {setDialogFor?.full_name || setDialogFor?.email}
            </DialogTitle>
            <DialogDescription>
              Enter a 4–8 digit PIN. Share it with this staffer privately — they'll
              use it to clock in on the Front Desk kiosk.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground">
                New PIN
              </label>
              <Input
                inputMode="numeric"
                autoComplete="off"
                maxLength={8}
                type="password"
                value={pin}
                onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
                placeholder="4–8 digits"
                className="text-center text-xl tracking-[0.3em] mt-1"
                autoFocus
              />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">
                Confirm PIN
              </label>
              <Input
                inputMode="numeric"
                autoComplete="off"
                maxLength={8}
                type="password"
                value={confirmPin}
                onChange={(e) => setConfirmPin(e.target.value.replace(/\D/g, ""))}
                placeholder="Re-enter"
                className="text-center text-xl tracking-[0.3em] mt-1"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setSetDialogFor(null)}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button onClick={submitSetPin} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Save PIN
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Clear PIN confirm */}
      <AlertDialog
        open={!!clearDialogFor}
        onOpenChange={(open) => {
          if (!open) setClearDialogFor(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Clear PIN for {clearDialogFor?.full_name || clearDialogFor?.email}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              They won't be able to clock in on the Front Desk until a new PIN is
              set. Their past shift history is not affected.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={saving}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                submitClearPin();
              }}
              disabled={saving}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Clear PIN
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
