import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Lock, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { setKioskPin, startKioskSession } from "@/lib/kiosk";
import stormLogo from "@/assets/storm-logo-gold.png";

interface KioskPinGateProps {
  onUnlock: () => void;
}

export function KioskPinGate({ onUnlock }: KioskPinGateProps) {
  const [pin, setPin] = useState("");
  const [isVerifying, setIsVerifying] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pin.trim()) return;
    setIsVerifying(true);

    try {
      const { data, error } = await supabase.rpc("verify_kiosk_pin", { p_pin: pin });
      if (error) throw error;
      if (data === true) {
        sessionStorage.setItem("kioskUnlocked", "true");
        setKioskPin(pin);
        // Sign the device into the restricted front desk account so member
        // lookup, credits, cafe orders and charges pass RLS.
        const ok = await startKioskSession(pin);
        if (!ok) toast.error("Unlocked, but staff data access failed. Try again.");
        window.dispatchEvent(new Event("station:kiosk-auth-changed"));
        onUnlock();
      } else {
        toast.error("Invalid PIN");
        setPin("");
      }
    } catch (err: any) {
      toast.error("Verification failed");
      console.error(err);
    } finally {
      setIsVerifying(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center space-y-4">
          <div className="flex justify-center">
            <img src={stormLogo} alt="Storm Wellness" className="h-16 w-16 object-contain" />
          </div>
          <CardTitle className="text-2xl">Front Desk</CardTitle>
          <CardDescription>Enter the kiosk PIN to unlock</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                type="password"
                inputMode="numeric"
                placeholder="Enter PIN"
                value={pin}
                onChange={(e) => setPin(e.target.value)}
                className="pl-10 text-center text-2xl tracking-[0.5em] h-14"
                autoFocus
                maxLength={8}
              />
            </div>
            <Button type="submit" className="w-full h-12 text-lg" disabled={isVerifying || !pin.trim()}>
              {isVerifying ? <Loader2 className="h-5 w-5 animate-spin mr-2" /> : null}
              Unlock
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
