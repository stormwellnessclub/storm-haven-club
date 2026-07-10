import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Eye, EyeOff, AlertCircle, UserCheck } from "lucide-react";
import logo from "@/assets/storm-logo.png";
import type { AppRole } from "@/lib/permissions";
import { NoIndex } from "@/components/seo/NoIndex";

const STAFF_ROLES: AppRole[] = [
  "super_admin",
  "admin",
  "manager",
  "front_desk",
  "spa_staff",
  "class_instructor",
  "cafe_staff",
  "childcare_staff",
];

async function fetchRolesForUser(userId: string): Promise<AppRole[]> {
  const { data, error } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId);
  if (error) throw error;
  return (data || [])
    .map((r) => r.role as AppRole)
    .filter((r) => STAFF_ROLES.includes(r));
}

/**
 * Dedicated sign-in for front-desk-only accounts.
 * - Accepts an account whose ONLY staff role is `front_desk`.
 * - Sets sessionStorage.kioskUnlocked to bypass the shared PIN gate.
 * - Sends the user straight to /kiosk/reception.
 * - Rejects (and signs back out) any account that also has admin/manager/etc.
 */
export default function FrontDeskLogin() {
  const { signIn, user, authReady } = useAuth();
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // If already signed in as a front-desk-only account, jump straight in.
  useEffect(() => {
    if (!authReady || !user) return;
    let cancelled = false;
    (async () => {
      try {
        const roles = await fetchRolesForUser(user.id);
        if (cancelled) return;
        if (roles.length === 1 && roles[0] === "front_desk") {
          sessionStorage.setItem("kioskUnlocked", "true");
          navigate("/kiosk/reception", { replace: true });
        }
      } catch {
        /* ignore — user can just sign in again */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [authReady, user, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!email || !password) {
      setError("Enter your email and password.");
      return;
    }

    setLoading(true);
    try {
      const { error: signInError } = await signIn(email.trim(), password);
      if (signInError) {
        setError(signInError.message || "Invalid email or password.");
        setLoading(false);
        return;
      }

      // Grab the user we just signed in as.
      const { data: userData } = await supabase.auth.getUser();
      const uid = userData.user?.id;
      if (!uid) {
        setError("Sign-in failed. Please try again.");
        setLoading(false);
        return;
      }

      let roles: AppRole[] = [];
      try {
        roles = await fetchRolesForUser(uid);
      } catch {
        await supabase.auth.signOut({ scope: "local" });
        setError("Couldn't verify your access. Please try again.");
        setLoading(false);
        return;
      }

      const isFrontDeskOnly =
        roles.length === 1 && roles[0] === "front_desk";
      const hasHigherRole = roles.some(
        (r) => r !== "front_desk"
      );

      if (hasHigherRole) {
        await supabase.auth.signOut();
        setError(
          "This login is for front desk accounts only. Admins sign in at /auth."
        );
        setLoading(false);
        return;
      }

      if (!isFrontDeskOnly) {
        await supabase.auth.signOut();
        setError("Not authorized. This account has no front desk access.");
        setLoading(false);
        return;
      }

      sessionStorage.setItem("kioskUnlocked", "true");
      navigate("/kiosk/reception", { replace: true });
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Sign-in failed. Please try again.";
      setError(message);
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
            Front Desk Sign In
          </div>
          <h1 className="heading-section mb-2">Welcome, team</h1>
          <p className="text-sm text-muted-foreground">
            Sign in to open front desk mode.
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
            <Label htmlFor="fd-email">Email</Label>
            <Input
              id="fd-email"
              type="email"
              autoComplete="username"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="frontdesk@stormwellnessclub.com"
              disabled={loading}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="fd-password">Password</Label>
            <div className="relative">
              <Input
                id="fd-password"
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="pr-10"
                disabled={loading}
              />
              <button
                type="button"
                onClick={() => setShowPassword((s) => !s)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                tabIndex={-1}
              >
                {showPassword ? (
                  <EyeOff className="w-4 h-4" />
                ) : (
                  <Eye className="w-4 h-4" />
                )}
              </button>
            </div>
            <div className="text-right">
              <Link
                to="/reset-password"
                className="text-accent text-xs hover:underline"
              >
                Forgot your password?
              </Link>
            </div>
          </div>

          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Signing in...
              </>
            ) : (
              "Sign In to Front Desk"
            )}
          </Button>
        </form>

        <div className="mt-8 pt-6 border-t border-border text-center space-y-2">
          <p className="text-xs text-muted-foreground">
            Admins and managers:{" "}
            <Link to="/auth" className="text-accent hover:underline">
              use the main sign-in
            </Link>
          </p>
          <p className="text-xs text-muted-foreground">
            Walk-up station without an account?{" "}
            <Link to="/kiosk/reception" className="text-accent hover:underline">
              Use the shared PIN
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
