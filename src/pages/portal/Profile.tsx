import { PortalLayout } from "@/components/portal/PortalLayout";
import { useNonMemberProfile } from "@/hooks/useNonMemberProfile";
import { useUserProfile } from "@/hooks/useUserProfile";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useState, useEffect } from "react";

export default function PortalProfile() {
  const { profile: nonMemberProfile, updateProfile, isUpdating } = useNonMemberProfile();
  const { profile: userProfile } = useUserProfile();

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");

  useEffect(() => {
    // Prefer non_member_profiles, fall back to profiles table
    const p = nonMemberProfile;
    const up = userProfile;
    setFirstName(p?.first_name || up?.first_name || "");
    setLastName(p?.last_name || up?.last_name || "");
    setPhone(p?.phone || up?.phone || "");
    setEmail(p?.email || up?.email || "");
  }, [nonMemberProfile, userProfile]);

  const handleSave = () => {
    updateProfile({
      first_name: firstName || null,
      last_name: lastName || null,
      phone: phone || null,
      email: email || null,
    });
  };

  return (
    <PortalLayout title="Profile">
      <div className="max-w-2xl">
        <Card>
          <CardHeader>
            <CardTitle>Personal Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="firstName">First Name</Label>
                <Input
                  id="firstName"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="lastName">Last Name</Label>
                <Input
                  id="lastName"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                />
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
      </div>
    </PortalLayout>
  );
}
