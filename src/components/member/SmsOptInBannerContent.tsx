import { useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import {
  SMS_DISCLOSURE_TEXT,
  SMS_DISCLOSURE_VERSION,
} from "@/components/SmsConsentCheckbox";
import { useQueryClient } from "@tanstack/react-query";

interface Props {
  phone: string | null | undefined;
}

/**
 * Inline content for the SMS opt-in notification bar item.
 * Renders disclosure-confirmation dialog and writes consent to profiles.
 */
export function SmsOptInBannerContent({ phone }: Props) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const startOptIn = () => {
    if (!phone?.trim()) {
      toast.error("Please add a phone number to your profile first.");
      return;
    }
    setOpen(true);
  };

  const confirmOptIn = async () => {
    if (!user) return;
    setSaving(true);
    const now = new Date().toISOString();
    const { error } = await (supabase.from("profiles") as any)
      .update({
        sms_opt_in: true,
        sms_opt_in_at: now,
        sms_opt_in_source: "member_banner",
      })
      .eq("user_id", user.id);

    if (error) {
      toast.error(`Could not save: ${error.message}`);
      setSaving(false);
      return;
    }

    await (supabase.from("sms_consent_log") as any).insert({
      user_id: user.id,
      phone: phone || null,
      action: "opt_in",
      source: "member_banner",
      user_agent: navigator.userAgent,
      disclosure_version: SMS_DISCLOSURE_VERSION,
    });

    setSaving(false);
    setOpen(false);
    toast.success("SMS notifications enabled.");
    qc.invalidateQueries({ queryKey: ["user-profile"] });
  };

  return (
    <>
      <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <span>📱 Get text alerts for class reminders, waitlist, and billing.</span>
        {phone?.trim() ? (
          <Button
            size="sm"
            variant="outline"
            className="h-6 px-2 text-xs"
            onClick={startOptIn}
          >
            Enable SMS
          </Button>
        ) : (
          <Button asChild size="sm" variant="outline" className="h-6 px-2 text-xs">
            <Link to="/member/profile">Add phone</Link>
          </Button>
        )}
      </span>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Enable SMS Notifications</DialogTitle>
            <DialogDescription className="text-xs leading-relaxed pt-2">
              {SMS_DISCLOSURE_TEXT}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-2">
            <Button variant="outline" onClick={() => setOpen(false)} disabled={saving}>
              Not now
            </Button>
            <Button onClick={confirmOptIn} disabled={saving}>
              {saving ? "Enabling..." : "I agree, enable SMS"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
