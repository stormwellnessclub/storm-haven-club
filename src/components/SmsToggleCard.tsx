import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { SMS_DISCLOSURE_TEXT, SMS_DISCLOSURE_VERSION } from "@/components/SmsConsentCheckbox";
import { MessageSquare } from "lucide-react";

interface Props {
  /**
   * Which table to write opt-in state to.
   * - "profiles" for logged-in members (/member/profile)
   * - "non_member_profiles" for class-pass / non-member portal (/portal/profile)
   */
  table: "profiles" | "non_member_profiles";
  /** Phone currently shown in the form. If empty, opt-in is blocked. */
  phone: string | null | undefined;
  /** Source label written to consent log. */
  source: string;
}

export function SmsToggleCard({ table, phone, source }: Props) {
  const { user } = useAuth();
  const [optIn, setOptIn] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Load current state
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      const { data } = await (supabase.from(table) as any)
        .select("sms_opt_in")
        .eq("user_id", user.id)
        .maybeSingle();
      if (!cancelled) {
        setOptIn(Boolean(data?.sms_opt_in));
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user, table]);

  const handleToggle = async (next: boolean) => {
    if (!user) return;
    if (next && !phone?.trim()) {
      toast.error("Please add a phone number to your profile first.");
      return;
    }
    setSaving(true);
    const now = new Date().toISOString();
    const updates: any = next
      ? { sms_opt_in: true, sms_opt_in_at: now, sms_opt_in_source: source }
      : { sms_opt_in: false, sms_opt_out_at: now, sms_opt_out_source: source };

    const { error } = await (supabase.from(table) as any)
      .update(updates)
      .eq("user_id", user.id);

    if (error) {
      toast.error(`Could not save: ${error.message}`);
      setSaving(false);
      return;
    }

    await (supabase.from("sms_consent_log") as any).insert({
      user_id: user.id,
      phone: phone || null,
      action: next ? "opt_in" : "opt_out",
      source,
      user_agent: navigator.userAgent,
      disclosure_version: SMS_DISCLOSURE_VERSION,
    });

    setOptIn(next);
    setSaving(false);
    toast.success(next ? "SMS notifications enabled." : "SMS notifications disabled.");
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MessageSquare className="h-5 w-5" />
          SMS Notifications
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-start justify-between gap-4">
          <div className="text-xs text-muted-foreground leading-relaxed flex-1">
            {SMS_DISCLOSURE_TEXT}
          </div>
          <Switch
            checked={optIn}
            onCheckedChange={handleToggle}
            disabled={loading || saving}
          />
        </div>
      </CardContent>
    </Card>
  );
}
