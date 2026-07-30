import { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, AlertCircle, UserCheck, Lock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { setKioskPin } from "@/lib/kiosk";
import { clearAuthStorage } from "@/lib/authStorage";
import logo from "@/assets/storm-logo.png";
import { NoIndex } from "@/components/seo/NoIndex";


/**
 * Dedicated front-desk unlock screen.
 *
 * This intentionally does NOT sign into the shared browser auth session.
 * Front desk mode is a tab-local device workspace unlocked by the kiosk PIN,
 * so opening /admin in another tab still requires the real admin login and
 * logging out of admin does not close the front-desk tab.
 */
export default function FrontDeskLogin() {
  const navigate = useNavigate();
  const [pin, setPin] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Front desk mode is PIN-only. If a stale/expired Supabase JWT is sitting on
  // this device (e.g. from an old admin login on the same tab), it will
  // eventually raise "session expired" errors that block re-entry. Wipe it on
  // mount so the front desk tab is always a clean, PIN-gated device.
  useEffect(() => {
    try {
      clearAuthStorage();
      supabase.auth.signOut({ scope: "local" }).catch(() => {});
    } catch { /* ignore */ }
  }, []);


  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedPin = pin.trim();
    if (!trimmedPin) {
      setError("Enter the front desk PIN.");
      return;
    }

    setError(null);
    setLoading(true);
    try {
      const { data, error: verifyError } = await supabase.rpc("verify_kiosk_pin", {
        p_pin: trimmedPin,
      });
      if (verifyError) throw verifyError;

      if (data !== true) {
        setError("Invalid PIN.");
        setPin("");
        return;
      }

      sessionStorage.setItem("kioskUnlocked", "true");
      setKioskPin(trimmedPin);
      navigate("/frontdesk", { replace: true });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unlock failed. Please try again.";
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <NoIndex />
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <img
            src={logo}
            alt="Storm Wellness Club"
            className="h-14 mx-auto mb-6"
          />
          <div className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-xs text-muted-foreground mb-4">
            <UserCheck className="h-3.5 w-3.5" />
            Front Desk Mode
          </div>
          <h1 className="heading-section mb-2">Open front desk</h1>
          <p className="text-sm text-muted-foreground">
            Unlock this tab with the front desk PIN.
          </p>
        </div>

        {error && (
          <div className="mb-4 rounded-lg border border-destructive/30 bg-destructive/10 p-3 flex items-start gap-2">
            <AlertCircle className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
            <p className="text-sm text-foreground">{error}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="fd-pin">Front Desk PIN</Label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                id="fd-pin"
                type="password"
                inputMode="numeric"
                autoComplete="off"
                value={pin}
                onChange={(e) => setPin(e.target.value)}
                placeholder="Enter PIN"
                className="pl-10 text-center text-2xl tracking-[0.5em] h-14"
                maxLength={8}
                autoFocus
                disabled={loading}
              />
            </div>
          </div>

          <Button type="submit" className="w-full h-12" disabled={loading || !pin.trim()}>
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Unlocking...
              </>
            ) : (
              "Open Front Desk"
            )}
          </Button>
        </form>

        <div className="mt-8 pt-6 border-t border-border text-center space-y-2">
          <p className="text-xs text-muted-foreground">
            Admins and managers: {" "}
            <Link to="/auth" className="text-accent hover:underline">
              use admin sign-in
            </Link>
          </p>
          <p className="text-xs text-muted-foreground">
            This unlock only applies to this tab.
          </p>
        </div>
      </div>
    </div>
  );
}