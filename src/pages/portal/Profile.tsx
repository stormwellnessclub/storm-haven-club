import { PortalLayout } from "@/components/portal/PortalLayout";
import { useNonMemberProfile } from "@/hooks/useNonMemberProfile";
import { useUserProfile } from "@/hooks/useUserProfile";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useState, useEffect } from "react";
import { SmsToggleCard } from "@/components/SmsToggleCard";
import { toast } from "sonner";

export default function PortalProfile() {
  const { profile: nonMemberProfile, updateProfile, isUpdating } = useNonMemberProfile();
  const { profile: userProfile } = useUserProfile();

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");

  useEffect(() => {
    const p = nonMemberProfile;
    const up = userProfile;
    setFirstName(p?.first_name || up?.first_name || "");
    setLastName(p?.last_name || up?.last_name || "");
    setPhone(p?.phone || up?.phone || "");
    setEmail(p?.email || up?.email || "");
  }, [nonMemberProfile, userProfile]);

  const handleSave = () => {
    const digits = (phone || "").replace(/\D/g, "");
    if (digits.length < 10) {
      toast.error("A valid phone number is required (at least 10 digits).");
      return;
    }
    updateProfile({
      first_name: firstName || null,
      last_name: lastName || null,
      phone: phone || null,
      email: email || null,
    });
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

        <SmsToggleCard
          table="non_member_profiles"
          phone={phone}
          source="portal_toggle"
        />
      </div>
    </PortalLayout>
  );
}
