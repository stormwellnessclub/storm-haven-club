import { AdminLayout } from "@/components/admin/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Building, Bell, Shield, CreditCard, Users, Loader2, Monitor, KeyRound } from "lucide-react";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export default function Settings() {
  const [kioskPin, setKioskPin] = useState("");
  const [isSavingPin, setIsSavingPin] = useState(false);
  const [stripeStatus, setStripeStatus] = useState<"loading" | "connected" | "disconnected">("loading");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isSavingPassword, setIsSavingPassword] = useState(false);

  const handleChangePassword = async () => {
    if (newPassword.length < 8) {
      toast.error("Password must be at least 8 characters");
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error("Passwords do not match");
      return;
    }
    setIsSavingPassword(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      toast.success("Password updated successfully");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err: any) {
      toast.error(err?.message || "Failed to update password");
    } finally {
      setIsSavingPassword(false);
    }
  };

  useEffect(() => {
    supabase.functions.invoke("stripe-config").then(({ data, error }) => {
      if (error || !data?.publishableKey?.startsWith("pk_")) {
        setStripeStatus("disconnected");
      } else {
        setStripeStatus("connected");
      }
    });
  }, []);

  return (
    <AdminLayout title="Settings">
      <div className="max-w-4xl space-y-6">
        {/* Business Information */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building className="h-5 w-5" />
              Business Information
            </CardTitle>
            <CardDescription>
              Manage your club's basic information
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="businessName">Business Name</Label>
                <Input id="businessName" defaultValue="Storm Wellness Club" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">Phone Number</Label>
                <Input id="phone" defaultValue="(555) 123-4567" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Contact Email</Label>
                <Input id="email" type="email" defaultValue="info@stormwellness.com" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="website">Website</Label>
                <Input id="website" defaultValue="https://stormwellnessclub.com" />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="address">Address</Label>
              <Input id="address" defaultValue="123 Wellness Ave, Suite 100, Beverly Hills, CA 90210" />
            </div>
            <Button>Save Changes</Button>
          </CardContent>
        </Card>

        {/* Notification Settings */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Bell className="h-5 w-5" />
              Notifications
            </CardTitle>
            <CardDescription>
              Configure how you receive notifications
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">New Application Alerts</p>
                <p className="text-sm text-muted-foreground">
                  Get notified when someone submits a membership application
                </p>
              </div>
              <Switch defaultChecked />
            </div>
            <Separator />
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">Failed Payment Alerts</p>
                <p className="text-sm text-muted-foreground">
                  Get notified when a payment fails
                </p>
              </div>
              <Switch defaultChecked />
            </div>
            <Separator />
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">Daily Summary</p>
                <p className="text-sm text-muted-foreground">
                  Receive a daily summary of check-ins and appointments
                </p>
              </div>
              <Switch />
            </div>
            <Separator />
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">Email Notifications</p>
                <p className="text-sm text-muted-foreground">
                  Send notifications to your email
                </p>
              </div>
              <Switch defaultChecked />
            </div>
          </CardContent>
        </Card>

        {/* Staff Management */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Staff & Permissions
            </CardTitle>
            <CardDescription>
              Manage staff accounts and access levels
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between p-4 border rounded-lg">
              <div>
                <p className="font-medium">Admin Users</p>
                <p className="text-sm text-muted-foreground">2 active admins</p>
              </div>
              <Button variant="outline">Manage</Button>
            </div>
            <div className="flex items-center justify-between p-4 border rounded-lg">
              <div>
                <p className="font-medium">Staff Users</p>
                <p className="text-sm text-muted-foreground">8 active staff members</p>
              </div>
              <Button variant="outline">Manage</Button>
            </div>
            <Button>
              <Users className="h-4 w-4 mr-2" />
              Invite Staff Member
            </Button>
          </CardContent>
        </Card>

        {/* Change Password */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <KeyRound className="h-5 w-5" />
              Change Password
            </CardTitle>
            <CardDescription>
              Update the password for your admin account
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 max-w-sm">
            <div className="space-y-2">
              <Label htmlFor="newPassword">New Password</Label>
              <Input
                id="newPassword"
                type="password"
                autoComplete="new-password"
                placeholder="At least 8 characters"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirm New Password</Label>
              <Input
                id="confirmPassword"
                type="password"
                autoComplete="new-password"
                placeholder="Re-enter password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
              />
            </div>
            <Button
              disabled={isSavingPassword || !newPassword || !confirmPassword}
              onClick={handleChangePassword}
            >
              {isSavingPassword ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Update Password
            </Button>
          </CardContent>
        </Card>

        {/* Security */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              Security
            </CardTitle>
            <CardDescription>
              Manage security settings and QR code options
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">Dynamic QR Codes</p>
                <p className="text-sm text-muted-foreground">
                  QR codes rotate every 15 minutes to prevent sharing
                </p>
              </div>
              <Switch defaultChecked />
            </div>
            <Separator />
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">Two-Factor Authentication</p>
                <p className="text-sm text-muted-foreground">
                  Require 2FA for admin accounts
                </p>
              </div>
              <Switch defaultChecked />
            </div>
            <Separator />
            <div className="space-y-2">
              <Label>Session Timeout</Label>
              <div className="flex gap-2 items-center">
                <Input type="number" defaultValue="30" className="w-24" />
                <span className="text-sm text-muted-foreground">minutes</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Kiosk PIN */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Monitor className="h-5 w-5" />
              Front Desk Kiosk PIN
            </CardTitle>
            <CardDescription>
              Set the PIN that staff enter to unlock the front desk kiosk at /front-desk
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-3 items-end max-w-sm">
              <div className="space-y-2 flex-1">
                <Label htmlFor="kioskPin">New PIN</Label>
                <Input
                  id="kioskPin"
                  type="password"
                  inputMode="numeric"
                  placeholder="Enter 4-8 digit PIN"
                  value={kioskPin}
                  onChange={(e) => setKioskPin(e.target.value)}
                  maxLength={8}
                />
              </div>
              <Button
                disabled={isSavingPin || kioskPin.length < 4}
                onClick={async () => {
                  setIsSavingPin(true);
                  try {
                    const { error } = await supabase.rpc("set_kiosk_pin", { p_pin: kioskPin });
                    if (error) throw error;
                    toast.success("Kiosk PIN updated");
                    setKioskPin("");
                  } catch (err: any) {
                    toast.error(err?.message || "Failed to set PIN");
                  } finally {
                    setIsSavingPin(false);
                  }
                }}
              >
                {isSavingPin ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Save PIN
              </Button>
            </div>
            <p className="text-sm text-muted-foreground">
              Staff will enter this PIN to unlock the front desk check-in kiosk. Use at least 4 digits.
            </p>
          </CardContent>
        </Card>

        {/* Payment Settings — live Stripe status */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CreditCard className="h-5 w-5" />
              Payment Settings
            </CardTitle>
            <CardDescription>
              Payment processing configuration
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between p-4 border rounded-lg">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 bg-purple-100 rounded-lg flex items-center justify-center">
                  <CreditCard className="h-5 w-5 text-purple-600" />
                </div>
                <div>
                  <p className="font-medium">Stripe</p>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    {stripeStatus === "loading" ? (
                      <>
                        <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
                        <p className="text-sm text-muted-foreground">Checking…</p>
                      </>
                    ) : stripeStatus === "connected" ? (
                      <>
                        <span className="h-2 w-2 rounded-full bg-green-500 inline-block" />
                        <p className="text-sm text-green-600 font-medium">Connected</p>
                      </>
                    ) : (
                      <>
                        <span className="h-2 w-2 rounded-full bg-amber-500 inline-block" />
                        <p className="text-sm text-amber-600 font-medium">Not Connected</p>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </div>
            <p className="text-sm text-muted-foreground">
              {stripeStatus === "connected"
                ? "Stripe is active and processing recurring membership payments. Keys are managed securely via backend configuration."
                : stripeStatus === "disconnected"
                ? "Stripe publishable key is missing or invalid. Please verify your backend secrets are configured correctly."
                : "Verifying Stripe connection…"}
            </p>
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}
