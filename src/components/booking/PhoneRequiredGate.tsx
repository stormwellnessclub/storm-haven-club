import { useState } from "react";
import { usePhoneOnFile } from "@/hooks/usePhoneOnFile";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Phone } from "lucide-react";
import { toast } from "sonner";

function formatPhone(raw: string) {
  const d = raw.replace(/\D/g, "").slice(0, 10);
  if (d.length < 4) return d;
  if (d.length < 7) return `(${d.slice(0, 3)}) ${d.slice(3)}`;
  return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`;
}

interface Props {
  /** Optional message shown above the input. */
  reason?: string;
  onSaved?: (phone: string) => void;
}

/**
 * Inline "Add your mobile number to continue" panel rendered inside booking
 * flows when the user has no phone on file. Saves to profiles /
 * non_member_profiles / members via usePhoneOnFile.savePhone.
 */
export function PhoneRequiredGate({ reason, onSaved }: Props) {
  const { savePhone, isSaving } = usePhoneOnFile();
  const [value, setValue] = useState("");

  const digits = value.replace(/\D/g, "");
  const valid = digits.length === 10;

  const save = async () => {
    if (!valid) {
      toast.error("Enter a valid 10-digit mobile number");
      return;
    }
    try {
      const normalized = await savePhone(value);
      toast.success("Phone number saved");
      onSaved?.(normalized);
    } catch (e: any) {
      toast.error(e?.message || "Could not save phone number");
    }
  };

  return (
    <div className="rounded-md border border-border/60 bg-muted/40 p-4 space-y-3">
      <div className="flex items-start gap-3">
        <div className="mt-0.5 flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-primary/10">
          <Phone className="h-4 w-4 text-primary" />
        </div>
        <div className="space-y-1 min-w-0">
          <p className="text-sm font-medium">Add your mobile number to continue</p>
          <p className="text-xs text-muted-foreground">
            {reason ||
              "We use it for class reminders, waitlist alerts, and last-minute schedule changes. Required to book."}
          </p>
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="phone-gate-input" className="sr-only">
          Mobile number
        </Label>
        <Input
          id="phone-gate-input"
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          placeholder="(555) 555-5555"
          value={value}
          onChange={(e) => setValue(formatPhone(e.target.value))}
          disabled={isSaving}
        />
        <Button
          type="button"
          className="w-full"
          onClick={save}
          disabled={!valid || isSaving}
        >
          {isSaving ? "Saving..." : "Save and continue"}
        </Button>
      </div>
    </div>
  );
}
