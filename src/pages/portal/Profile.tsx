import { PortalLayout } from "@/components/portal/PortalLayout";
import { useNonMemberProfile } from "@/hooks/useNonMemberProfile";
import { useUserProfile } from "@/hooks/useUserProfile";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { SMS_DISCLOSURE_TEXT, SMS_DISCLOSURE_VERSION } from "@/components/SmsConsentCheckbox";

export default function PortalProfile() {
  const { profile: nonMemberProfile, updateProfile, isUpdating } = useNonMemberProfile();
  const { profile: userProfile } = useUserProfile();
  const { user } = useAuth();

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [smsOptIn, setSmsOptIn] = useState(false);
  const [smsSaving, setSmsSaving] = useState(false);

  useEffect(() => {
    const p = nonMemberProfile;
    const up = userProfile;
    setFirstName(p?.first_name || up?.first_name || "");
    setLastName(p?.last_name || up?.last_name || "");
    setPhone(p?.phone || up?.phone || "");
    setEmail(p?.email || up?.email || "");
    setSmsOptIn((p as any)?.sms_opt_in ?? (up as any)?.sms_opt_in ?? false);
  }, [nonMemberProfile, userProfile]);

  const handleSave = () => {
    updateProfile({
      first_name: firstName || null,
      last_name: lastName || null,
      phone: phone || null,
      email: email || null,
    });
  };

  const handleSmsToggle = async (next: boolean) => {
    if (!user) return;
    if (next && !phone) {
      toast.error("Please add a phone number first.");
      return;
    }
    setSmsSaving(true);
    const now = new Date().toISOString();
    const updates: any = next
      ? { sms_opt_in: true, sms_opt_in_at: now, sms_opt_in_source: 'portal_toggle' }
      : { sms_opt_in: false, sms_opt_out_at: now, sms_opt_out_source: 'portal_toggle' };

    const { error: nmErr } = await (supabase.from('non_member_profiles') as any)
      .update(updates).eq('user_id', user.id);
    if (nmErr) console.warn(nmErr);

    await (supabase.from('sms_consent_log') as any).insert({
      user_id: user.id,
      phone,
      action: next ? 'opt_in' : 'opt_out',
      source: 'portal_toggle',
      user_agent: navigator.userAgent,
      disclosure_version: SMS_DISCLOSURE_VERSION,
    });

    setSmsOptIn(next);
    setSmsSaving(false);
    toast.success(next ? "SMS notifications enabled." : "SMS notifications disabled.");
  };

  return (
    <PortalLayout title="Profile">
      <div className="max-w-2xl space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Personal Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="firstName">First Name</Label>
                <Input id="firstName" value={firstName} onChange={(e) => setFirstName(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="lastName">Last Name</Label>
                <Input id="lastName" value={lastName} onChange={(e) => setLastName(e.target.value)} />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">Phone</Label>
              <Input id="phone" value={phone} onChange={(e) => setPhone(e.target.value)} />
            </div>
            <Button onClick={handleSave} disabled={isUpdating}>
              {isUpdating ? "Saving..." : "Save Changes"}
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>SMS Notifications</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-start justify-between gap-4">
              <div className="text-xs text-muted-foreground leading-relaxed">
                {SMS_DISCLOSURE_TEXT}
              </div>
              <Switch checked={smsOptIn} onCheckedChange={handleSmsToggle} disabled={smsSaving} />
            </div>
          </CardContent>
        </Card>
      </div>
    </PortalLayout>
  );
}
