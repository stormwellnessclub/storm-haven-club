import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Ticket } from "lucide-react";

type ExpectedGuest = {
  guest_pass_id: string;
  name: string;
  email: string | null;
  phone: string | null;
  valid_date: string | null;
  notes: string | null;
};

/** Unused guest passes for today (plus undated ones), readable from the PIN kiosk. */
export function ExpectedGuestsCard({
  onCheckIn,
  busy,
  refreshKey,
}: {
  onCheckIn: (guestPassId: string, name: string) => Promise<boolean>;
  busy: boolean;
  refreshKey?: unknown;
}) {
  const [guests, setGuests] = useState<ExpectedGuest[]>([]);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const { data, error } = await (supabase.rpc as any)("kiosk_expected_guests");
    if (error) { setError(error.message); return; }
    setError(null);
    setGuests((data ?? []) as ExpectedGuest[]);
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, 60_000);
    return () => clearInterval(t);
  }, [load, refreshKey]);

  const today = guests.filter((g) => g.valid_date);
  const undated = guests.filter((g) => !g.valid_date);

  const row = (g: ExpectedGuest) => (
    <div key={g.guest_pass_id} className="flex items-center justify-between gap-3 py-2">
      <div className="min-w-0">
        <div className="font-medium truncate">{g.name}</div>
        <div className="text-xs text-muted-foreground truncate">
          {[g.email, g.phone].filter(Boolean).join(" · ") || "Guest pass"}
        </div>
        {g.notes && <div className="text-xs text-muted-foreground italic truncate">{g.notes}</div>}
      </div>
      <Button size="sm" disabled={busy} onClick={async () => { if (await onCheckIn(g.guest_pass_id, g.name)) load(); }}>
        Check in
      </Button>
    </div>
  );

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-lg"><Ticket className="h-5 w-5" /> Expected guests today ({today.length})</CardTitle>
        <CardDescription>Guest passes for today that haven't checked in yet.</CardDescription>
      </CardHeader>
      <CardContent className="text-sm">
        {error && <p className="text-destructive">Couldn't load guests: {error}</p>}
        {!error && !today.length && <p className="text-muted-foreground py-2">No guests expected today.</p>}
        <div className="divide-y">{today.map(row)}</div>
        {undated.length > 0 && (
          <>
            <div className="mt-4 mb-1 text-xs font-medium text-muted-foreground">Unused passes with no date ({undated.length})</div>
            <div className="divide-y">{undated.map(row)}</div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
