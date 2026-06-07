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
import { useUserProfile } from "@/hooks/useUserProfile";
import { useUserRoles } from "@/hooks/useUserRoles";
import { toast } from "sonner";
import { MessageSquare, BellRing } from "lucide-react";
import {
  SMS_DISCLOSURE_TEXT,
  SMS_DISCLOSURE_VERSION,
} from "@/components/SmsConsentCheckbox";
import { useQueryClient } from "@tanstack/react-query";

/**
 * Non-dismissible interstitial that forces members to enable SMS notifications.
 * - Shows for any logged-in member whose profile has sms_opt_in !== true
 * - Respects explicit opt-out within the last 30 days (don't harass)
 * - Suppressed for admins/staff
 * - If no phone on file, CTA routes to /member/profile to add one
 */
export function SmsOptInGate() {
  const { user } = useAuth();
  const { profile } = useUserProfile();
  const { isAdmin, hasAnyStaffRole } = useUserRoles();
  const qc = useQueryClient();
  const [saving, setSaving] = useState(false);

  if (!user || !profile) return null;
  if (isAdmin() || hasAnyStaffRole()) return null;
  if (profile.sms_opt_in === true) return null;

  // Respect a recent explicit opt-out (30 days). Field is in schema even if not typed on hook.
  const optedOutAtRaw = (profile as any).sms_opt_out_at as string | null | undefined;
  if (optedOutAtRaw) {
    const daysSince = (Date.now() - new Date(optedOutAtRaw).getTime()) / (1000 * 60 * 60 * 24);
    if (daysSince < 30) return null;
  }

  const hasPhone = !!profile.phone?.trim();

  const enable = async () => {
    if (!hasPhone) return;
    setSaving(true);
    const now = new Date().toISOString();
    const { error } = await (supabase.from("profiles") as any)
      .update({
        sms_opt_in: true,
        sms_opt_in_at: now,
        sms_opt_in_source: "portal_gate",
      })
      .eq("user_id", user.id);

    if (error) {
      toast.error(`Could not save: ${error.message}`);
      setSaving(false);
      return;
    }

    await (supabase.from("sms_consent_log") as any).insert({
      user_id: user.id,
      phone: profile.phone,
      action: "opt_in",
      source: "portal_gate",
      user_agent: navigator.userAgent,
      disclosure_version: SMS_DISCLOSURE_VERSION,
    });

    toast.success("SMS notifications enabled.");
    qc.invalidateQueries({ queryKey: ["user-profile"] });
    setSaving(false);
  };

  return (
    <Dialog open={true} onOpenChange={() => { /* non-dismissible */ }}>
      <DialogContent
        // Block Esc, overlay, and pointer-down dismissal. Also hide the built-in close button.
        onPointerDownOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
        onInteractOutside={(e) => e.preventDefault()}
        className="max-w-md [&>button]:hidden"
      >
        <DialogHeader>
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
            <BellRing className="h-6 w-6 text-primary" />
          </div>
          <DialogTitle className="text-center text-xl">
            Enable SMS Notifications
          </DialogTitle>
          <DialogDescription className="text-center pt-2">
            We use SMS for class reminders, waitlist promotions, billing notices,
            and time-sensitive updates. This is how we make sure you never miss a
            class or appointment.
          </DialogDescription>
        </DialogHeader>

        <div className="rounded-md border border-border/60 bg-muted/40 p-3 text-xs leading-relaxed text-muted-foreground">
          {SMS_DISCLOSURE_TEXT}
        </div>

        <DialogFooter className="flex-col gap-2 sm:flex-col">
          {hasPhone ? (
            <Button size="lg" className="w-full" onClick={enable} disabled={saving}>
              <MessageSquare className="h-4 w-4 mr-2" />
              {saving ? "Enabling..." : "Enable SMS Alerts"}
            </Button>
          ) : (
            <Button asChild size="lg" className="w-full">
              <Link to="/member/profile">Add phone number to continue</Link>
            </Button>
          )}
          <p className="text-[10px] text-center text-muted-foreground">
            You can reply STOP at any time to unsubscribe.
          </p>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
