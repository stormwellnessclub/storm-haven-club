import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Delete, LogIn } from "lucide-react";
import { toast } from "sonner";
import stormLogo from "@/assets/storm-logo-gold.png";

export const FRONTDESK_BYPASS_SHIFT_ID = "bypass";

interface ClockInGateProps {
  onClockedIn: (payload: {
    shiftId: string;
    staffUserId: string;
    staffName: string;
    clockInAt: string;
  }) => void;
}

/**
 * Clock-in gate for the /frontdesk shell.
 *
 * Staffer enters their personal PIN → frontdesk_clock_in RPC → shift opens.
 * The device may not have an authenticated Supabase session (the shared kiosk
 * flow signs everyone in as anon), so the RPC is granted to `anon` too.
 */
export function ClockInGate({ onClockedIn }: ClockInGateProps) {
  const [pin, setPin] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const deviceLabel =
    typeof window !== "undefined"
      ? (localStorage.getItem("frontdeskDeviceLabel") ||
         (() => {
           const id = `desk-${Math.random().toString(36).slice(2, 8)}`;
           localStorage.setItem("frontdeskDeviceLabel", id);
           return id;
         })())
      : "unknown";

  const push = (digit: string) => {
    if (submitting) return;
    setPin((p) => (p.length >= 12 ? p : p + digit));
  };
  const back = () => setPin((p) => p.slice(0, -1));
  const clear = () => setPin("");

  const submit = async () => {
    if (pin.length < 4) {
      toast.error("PIN must be at least 4 digits");
      return;
    }
    setSubmitting(true);
    try {
      const { data, error } = await (supabase.rpc as any)("frontdesk_clock_in", {
        _pin: pin,
        _device_label: deviceLabel,
      });
      if (error) throw error;
      const row = Array.isArray(data) ? data[0] : data;
      if (!row?.shift_id) throw new Error("Clock-in failed");
      toast.success(`Welcome, ${row.staff_name}. Shift started.`);
      onClockedIn({
        shiftId: row.shift_id,
        staffUserId: row.staff_user_id,
        staffName: row.staff_name,
        clockInAt: row.clock_in_at,
      });
    } catch (err: any) {
      console.error("[ClockInGate]", err);
      toast.error(err?.message || "Clock-in failed");
      setPin("");
    } finally {
      setSubmitting(false);
    }
  };

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key >= "0" && e.key <= "9") push(e.key);
      else if (e.key === "Backspace") back();
      else if (e.key === "Enter") submit();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pin, submitting]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-sm shadow-xl">
        <CardHeader className="text-center">
          <img src={stormLogo} alt="Storm" className="h-14 w-14 mx-auto object-contain mb-2" />
          <CardTitle className="text-xl">Clock In</CardTitle>
          <p className="text-sm text-muted-foreground">
            Enter your personal PIN to start your shift
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <Input
            value={"•".repeat(pin.length)}
            readOnly
            placeholder="• • • •"
            className="text-center text-2xl tracking-[0.5em] h-14"
          />
          <div className="grid grid-cols-3 gap-2">
            {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((d) => (
              <Button
                key={d}
                type="button"
                variant="outline"
                size="lg"
                className="h-14 text-xl"
                onClick={() => push(d)}
                disabled={submitting}
              >
                {d}
              </Button>
            ))}
            <Button
              type="button"
              variant="outline"
              size="lg"
              className="h-14"
              onClick={clear}
              disabled={submitting}
            >
              Clear
            </Button>
            <Button
              type="button"
              variant="outline"
              size="lg"
              className="h-14 text-xl"
              onClick={() => push("0")}
              disabled={submitting}
            >
              0
            </Button>
            <Button
              type="button"
              variant="outline"
              size="lg"
              className="h-14"
              onClick={back}
              disabled={submitting}
            >
              <Delete className="h-5 w-5" />
            </Button>
          </div>
          <Button
            type="button"
            size="lg"
            className="w-full h-12"
            onClick={submit}
            disabled={submitting || pin.length < 4}
          >
            {submitting ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <>
                <LogIn className="h-4 w-4 mr-2" />
                Start Shift
              </>
            )}
          </Button>
          <p className="text-[11px] text-center text-muted-foreground">
            Every check-in, sale, and charge is tagged to the clocked-in staffer.
            After 30 minutes of inactivity you'll be asked to clock in again.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
