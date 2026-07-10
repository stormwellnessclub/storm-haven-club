import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Loader2, Delete, LogOut } from "lucide-react";
import { toast } from "sonner";

interface ClockOutPromptProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  staffName: string;
  onClockedOut: () => void;
}

export function ClockOutPrompt({ open, onOpenChange, staffName, onClockedOut }: ClockOutPromptProps) {
  const [pin, setPin] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const deviceLabel =
    typeof window !== "undefined"
      ? localStorage.getItem("frontdeskDeviceLabel") || "unknown"
      : "unknown";

  useEffect(() => {
    if (!open) {
      setPin("");
      setSubmitting(false);
    }
  }, [open]);

  const push = (digit: string) => {
    if (submitting) return;
    setPin((p) => (p.length >= 12 ? p : p + digit));
  };
  const back = () => setPin((p) => p.slice(0, -1));

  const submit = async () => {
    if (pin.length < 4) {
      toast.error("Enter your PIN");
      return;
    }
    setSubmitting(true);
    try {
      const { data, error } = await (supabase.rpc as any)("frontdesk_clock_out", {
        _pin: pin,
        _device_label: deviceLabel,
      });
      if (error) throw error;
      const row = Array.isArray(data) ? data[0] : data;
      const minutes = row?.minutes_worked ?? 0;
      const hours = Math.floor(minutes / 60);
      const mins = minutes % 60;
      toast.success(
        `${row?.staff_name || staffName} clocked out. Shift: ${hours}h ${mins}m`
      );
      onClockedOut();
      onOpenChange(false);
    } catch (err: any) {
      console.error("[ClockOutPrompt]", err);
      toast.error(err?.message || "Clock-out failed");
      setPin("");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>End shift for {staffName}?</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Enter your personal PIN to confirm clock-out.
          </p>
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
                className="h-12 text-lg"
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
              className="h-12"
              onClick={() => setPin("")}
              disabled={submitting}
            >
              Clear
            </Button>
            <Button
              type="button"
              variant="outline"
              size="lg"
              className="h-12 text-lg"
              onClick={() => push("0")}
              disabled={submitting}
            >
              0
            </Button>
            <Button
              type="button"
              variant="outline"
              size="lg"
              className="h-12"
              onClick={back}
              disabled={submitting}
            >
              <Delete className="h-4 w-4" />
            </Button>
          </div>
          <Button
            type="button"
            size="lg"
            variant="destructive"
            className="w-full h-12"
            onClick={submit}
            disabled={submitting || pin.length < 4}
          >
            {submitting ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <>
                <LogOut className="h-4 w-4 mr-2" />
                End Shift
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
