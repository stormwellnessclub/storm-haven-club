import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Link } from "react-router-dom";

export const SMS_DISCLOSURE_VERSION = "v1";

export const SMS_DISCLOSURE_TEXT = (
  <>
    I agree to receive recurring informational and transactional text messages from{" "}
    <strong>Storm Wellness Club</strong> at the mobile number provided, including class
    reminders, waitlist alerts, billing notices, appointment confirmations, café and
    Kids Care updates, and account messages. Message frequency varies. Message and
    data rates may apply. Reply <strong>STOP</strong> to unsubscribe or{" "}
    <strong>HELP</strong> for help. Consent is not a condition of purchase. See our{" "}
    <Link to="/sms-terms" className="underline" target="_blank" rel="noopener noreferrer">
      SMS Terms
    </Link>{" "}
    and{" "}
    <Link to="/privacy" className="underline" target="_blank" rel="noopener noreferrer">
      Privacy Policy
    </Link>
    .
  </>
);

interface Props {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  id?: string;
  disabled?: boolean;
}

export function SmsConsentCheckbox({ checked, onCheckedChange, id = "sms-consent", disabled }: Props) {
  return (
    <div className="flex items-start gap-2 rounded-md border border-border/60 bg-muted/30 p-3">
      <Checkbox
        id={id}
        checked={checked}
        onCheckedChange={(v) => onCheckedChange(v === true)}
        disabled={disabled}
        className="mt-0.5"
      />
      <Label htmlFor={id} className="text-xs leading-relaxed font-normal cursor-pointer">
        {SMS_DISCLOSURE_TEXT}
      </Label>
    </div>
  );
}
