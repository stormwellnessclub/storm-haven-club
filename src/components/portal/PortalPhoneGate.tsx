import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Phone } from "lucide-react";
import { toast } from "sonner";
import { useNonMemberProfile } from "@/hooks/useNonMemberProfile";

export function PortalPhoneGate() {
  const { updateProfile, isUpdating } = useNonMemberProfile();
  const [phone, setPhone] = useState("");

  const handleSave = () => {
    const digits = phone.replace(/\D/g, "");
    if (digits.length < 10) {
      toast.error("Please enter a valid phone number (at least 10 digits).");
      return;
    }
    updateProfile({ phone: phone.trim() });
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Phone className="h-5 w-5 text-primary" />
            <CardTitle>Add a phone number</CardTitle>
          </div>
          <CardDescription>
            We need a phone number on file so we can reach you about your bookings,
            waitlist updates, and class changes. This is required to continue.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="gate-phone">Phone number</Label>
            <Input
              id="gate-phone"
              type="tel"
              autoFocus
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="(555) 555-5555"
            />
          </div>
          <Button
            onClick={handleSave}
            disabled={isUpdating || !phone.trim()}
            className="w-full"
          >
            {isUpdating ? "Saving..." : "Save and continue"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
