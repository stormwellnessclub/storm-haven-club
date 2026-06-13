import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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

function formatPhone(raw: string) {
  const d = raw.replace(/\D/g, "").slice(0, 10);
  if (d.length < 4) return d;
  if (d.length < 7) return `(${d.slice(0, 3)}) ${d.slice(3)}`;
  return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`;
}

export function SmsOptInGate() {
  const { user } = useAuth();
  const { profile } = useUserProfile();
  const { isAdmin, hasAnyStaffRole } = useUserRoles();
  const qc = useQueryClient();
  const [saving, setSaving] = useState(false);
  const [phone, setPhone] = useState("");
  const [prefilling, setPrefilling] = useState(true);

  // Try to pre-fill from other records when profiles.phone is empty
  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      if (!user || !profile) return;
      if (profile.phone?.trim()) {
        if (!cancelled) {
          setPhone(formatPhone(profile.phone));
          setPrefilling(false);
        }
        return;
      }
      const email = (user.email || profile.email || "").toLowerCase().trim();
      let found: string | null = null;
      if (email) {
        const { data: m } = await supabase
          .from("members")
          .select("phone")
          .ilike("email", email)
          .not("phone", "is", null)
          .limit(1)
          .maybeSingle();
        if (m?.phone) found = m.phone;
        if (!found) {
          const { data: app } = await supabase
            .from("membership_applications")
            .select("phone")
            .ilike("email", email)
            .not("phone", "is", null)
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle();
          if (app?.phone) found = app.phone;
        }
      }
      if (!cancelled) {
        if (found) setPhone(formatPhone(found));
        setPrefilling(false);
      }
    };
    run();
    return () => {
      cancelled = true;
    };
  }, [user, profile]);

  if (!user || !profile) return null;
  if (isAdmin() || hasAnyStaffRole()) return null;
  if (profile.sms_opt_in === true) return null;

  const optedOutAtRaw = (profile as any).sms_opt_out_at as string | null | undefined;
  if (optedOutAtRaw) {
    const daysSince = (Date.now() - new Date(optedOutAtRaw).getTime()) / (1000 * 60 * 60 * 24);
    if (daysSince < 30) return null;
  }

  const digits = phone.replace(/\D/g, "");
  const phoneValid = digits.length === 10;

  const save = async () => {
    if (!phoneValid) {
      toast.error("Please enter a valid 10-digit mobile number.");
      return;
    }
    setSaving(true);
    const normalized = `+1${digits}`;
    const now = new Date().toISOString();
    const { error } = await (supabase.from("profiles") as any)
      .update({
        phone: normalized,
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
      phone: normalized,
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
            Confirm your mobile number
          </DialogTitle>
          <DialogDescription className="text-center pt-2">
            We text class reminders, waitlist alerts, billing notices, and
            appointment confirmations. Confirm your number to continue using
            the portal.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          <Label htmlFor="sms-gate-phone">Mobile number</Label>
          <Input
            id="sms-gate-phone"
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            placeholder="(555) 555-5555"
            value={phone}
            onChange={(e) => setPhone(formatPhone(e.target.value))}
            disabled={saving || prefilling}
            className="text-base"
          />
          {!profile.phone?.trim() && phone && (
            <p className="text-xs text-muted-foreground">
              We found this number on your account. Edit if it's not correct.
            </p>
          )}
        </div>

        <div className="rounded-md border border-border/60 bg-muted/40 p-3 text-xs leading-relaxed text-muted-foreground">
          {SMS_DISCLOSURE_TEXT}
        </div>

        <DialogFooter className="flex-col gap-2 sm:flex-col">
          <Button
            size="lg"
            className="w-full"
            onClick={save}
            disabled={saving || prefilling || !phoneValid}
          >
            <MessageSquare className="h-4 w-4 mr-2" />
            {saving ? "Saving..." : "Save & Enable SMS"}
          </Button>
          <p className="text-[10px] text-center text-muted-foreground">
            You can reply STOP at any time to unsubscribe.
          </p>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
