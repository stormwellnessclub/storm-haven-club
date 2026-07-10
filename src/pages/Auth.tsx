import { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate, useLocation, Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useUserProfile } from "@/hooks/useUserProfile";
import { useUserRoles } from "@/hooks/useUserRoles";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Eye, EyeOff, RotateCcw } from "lucide-react";
import { z } from "zod";
import logo from "@/assets/storm-logo.png";
import { clearAuthStorage } from "@/lib/authStorage";
import { supabase } from "@/integrations/supabase/client";
import { WaiverSigningStep } from "@/components/WaiverSigningStep";
import { StaffWelcome } from "@/components/staff/StaffWelcome";
import { getDefaultAdminPage } from "@/lib/permissions";
import { Shield, AlertCircle } from "lucide-react";
import { NoIndex } from "@/components/seo/NoIndex";

const emailSchema = z.string().email("Please enter a valid email address");
const passwordSchema = z.string().min(6, "Password must be at least 6 characters");
const nameSchema = z.string().min(1, "This field is required").max(100, "Maximum 100 characters");
const phoneSchema = z
  .string()
  .refine((v) => v.replace(/\D/g, "").length === 10, {
    message: "Enter a valid 10-digit mobile number",
  });

function formatPhoneInput(raw: string) {
  const d = raw.replace(/\D/g, "").slice(0, 10);
  if (d.length < 4) return d;
  if (d.length < 7) return `(${d.slice(0, 3)}) ${d.slice(3)}`;
  return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`;
}


export default function Auth() {
  const initialMode = new URLSearchParams(window.location.search).get("mode") === "signup";
  const [isSignUp, setIsSignUp] = useState(initialMode);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [showWaiverStep, setShowWaiverStep] = useState(false);
  const [showStaffWelcome, setShowStaffWelcome] = useState(false);
  const [routingError, setRoutingError] = useState<string | null>(null);
  const [handoffStuck, setHandoffStuck] = useState(false);
  const autoRetriedRoleCheckFor = useRef<string | null>(null);

  const { user, authReady, signUp, signIn } = useAuth();
  const { profile, isLoading: profileLoading } = useUserProfile();
  const { roles, loading: rolesLoading, error: rolesError, jwtError: rolesJwtError, resolved: rolesResolved, hasAnyStaffRole, refetch: refetchRoles } = useUserRoles();
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();

  // Detect staff invite mode
  const searchParams = new URLSearchParams(window.location.search);
  const isStaffInvite = searchParams.get('staff_invite') === 'true';

  // Helper to get safe redirect target from query param or state
  const getRedirectTarget = useCallback(() => {
    // Check query parameter first
    const searchParams = new URLSearchParams(window.location.search);
    const fromQuery = searchParams.get("redirect");
    const voucherCode = searchParams.get("voucher");

    // Check router state as fallback
    const fromState = (location.state as { from?: { pathname: string } })?.from?.pathname;

    // If a voucher code is present and no explicit redirect, send them to redeem page
    const voucherTarget = voucherCode ? `/mothers-day/redeem?code=${encodeURIComponent(voucherCode)}` : null;

    const target = fromQuery || voucherTarget || fromState || "/member";

    // Security: only allow internal paths (starts with / but not //)
    if (target.startsWith("/") && !target.startsWith("//")) {
      return target;
    }
    return "/member";
  }, [location.state]);

  // NOTE: Mount-time session cleanup was REMOVED. It was wiping valid sessions
  // during the post-login handoff. Users can still manually reset via the
  // "Reset session" button below if they hit a stuck state.

  // Check staff roles and determine routing after login
  useEffect(() => {
    if (!authReady || !user) return;
    if (rolesLoading) return;

    if (rolesError) {
      console.error("[Auth] Failed to resolve roles during routing:", rolesError);
      setRoutingError("We signed you in, but couldn’t verify where to send this account yet.");
      return;
    }

    if (!rolesResolved) return;

    setRoutingError(null);

    if (hasAnyStaffRole()) {
      setShowWaiverStep(false);

      if (isStaffInvite) {
        setShowStaffWelcome(true);
        return;
      }

      const targetAdminPage = getDefaultAdminPage(roles);
      if (location.pathname !== targetAdminPage) {
        navigate(targetAdminPage, { replace: true });
      }
      return;
    }

    setShowStaffWelcome(false);

    if (profileLoading) return;

    if (profile && !profile.waiver_signed) {
      setShowWaiverStep(true);
      return;
    }

    if (profile?.waiver_signed) {
      navigate(getRedirectTarget(), { replace: true });
    }
  }, [authReady, user, profile, profileLoading, rolesLoading, rolesError, rolesResolved, hasAnyStaffRole, roles, navigate, getRedirectTarget, isStaffInvite, location.pathname]);

  useEffect(() => {
    if (!authReady || !user) {
      autoRetriedRoleCheckFor.current = null;
      return;
    }

    if (!rolesError || autoRetriedRoleCheckFor.current === user.id) return;

    autoRetriedRoleCheckFor.current = user.id;

    const timer = window.setTimeout(() => {
      refetchRoles();
    }, 600);

    return () => window.clearTimeout(timer);
  }, [authReady, user, rolesError, refetchRoles]);

  // Watchdog: if we've been signed in but spinning on role resolution for
  // more than 12s with no error surfaced yet, treat it as a stuck handoff
  // so the user can manually reset rather than stare at a spinner forever.
  useEffect(() => {
    if (!authReady || !user) {
      setHandoffStuck(false);
      return;
    }
    if (rolesResolved || rolesError) {
      setHandoffStuck(false);
      return;
    }
    const t = window.setTimeout(() => setHandoffStuck(true), 12000);
    return () => window.clearTimeout(t);
  }, [authReady, user, rolesResolved, rolesError]);

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    try {
      emailSchema.parse(email);
    } catch (e) {
      if (e instanceof z.ZodError) {
        newErrors.email = e.errors[0].message;
      }
    }

    try {
      passwordSchema.parse(password);
    } catch (e) {
      if (e instanceof z.ZodError) {
        newErrors.password = e.errors[0].message;
      }
    }

    if (isSignUp) {
      try {
        nameSchema.parse(firstName);
      } catch (e) {
        if (e instanceof z.ZodError) {
          newErrors.firstName = e.errors[0].message;
        }
      }

      try {
        nameSchema.parse(lastName);
      } catch (e) {
        if (e instanceof z.ZodError) {
          newErrors.lastName = e.errors[0].message;
        }
      }

      try {
        phoneSchema.parse(phone);
      } catch (e) {
        if (e instanceof z.ZodError) {
          newErrors.phone = e.errors[0].message;
        }
      }
    }


    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Check for duplicate accounts before signup
  const checkForDuplicateAccount = async (emailToCheck: string): Promise<{
    isDuplicate: boolean;
    reason: string;
  }> => {
    try {
      // Check for existing member (case-insensitive)
      const { data: memberData } = await supabase
        .from("members")
        .select("id, status, email")
        .ilike("email", emailToCheck)
        .maybeSingle();

      if (memberData) {
        return {
          isDuplicate: true,
          reason: `An account already exists for this email address (Status: ${memberData.status}).`,
        };
      }

      // Check for pending/approved application (case-insensitive)
      const { data: appData } = await supabase
        .from("membership_applications")
        .select("id, status, email")
        .ilike("email", emailToCheck)
        .neq("status", "rejected")
        .neq("status", "cancelled")
        .maybeSingle();

      if (appData) {
        return {
          isDuplicate: true,
          reason: `An application already exists for this email address (Status: ${appData.status}). Please sign in with this email instead.`,
        };
      }

      return { isDuplicate: false, reason: "" };
    } catch (error) {
      // Log but don't block signup if check fails
      console.warn("[Auth] Duplicate check failed:", error);
      return { isDuplicate: false, reason: "" };
    }
  };

  // Try to link member after auth success (belt-and-suspenders with server trigger)
  const attemptMemberLink = useCallback(async () => {
    try {
      await supabase.rpc("link_member_by_email");
    } catch (e) {
      // Silent fail - server trigger should handle this
      console.log("[Auth] Member link attempt completed");
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) return;

    // Check for duplicates on signup
    if (isSignUp) {
      setIsLoading(true);
      const dupeCheck = await checkForDuplicateAccount(email);
      if (dupeCheck.isDuplicate) {
        toast({
          title: "Account Already Exists",
          description: dupeCheck.reason,
          variant: "destructive",
        });
        setIsLoading(false);
        return;
      }
    }

    setIsLoading(true);

    try {
      // Block check before proceeding with auth
      const { data: isBlocked } = await supabase.rpc('is_email_blocked', { p_email: email.trim().toLowerCase() });
      if (isBlocked) {
        toast({
          title: "Access Denied",
          description: "You are not permitted to access our services. If you believe this is an error, please contact us.",
          variant: "destructive",
        });
        setIsLoading(false);
        return;
      }

      if (isSignUp) {
        const normalizedPhone = `+1${phone.replace(/\D/g, "")}`;
        const { error } = await signUp(email, password, {
          first_name: firstName,
          last_name: lastName,
          phone: normalizedPhone,
        });


        if (error) {
          toast({
            title: "Sign up failed",
            description: error.message,
            variant: "destructive",
          });
        } else {
          // Attempt member link after signup (server trigger does this too)
          await attemptMemberLink();
          toast({
            title: "Welcome to Storm Wellness Club!",
            description: "Your account has been created successfully.",
          });
          // Don't navigate here - let useEffect handle navigation to ensure waiver step is shown
        }
      } else {
        const { error } = await signIn(email, password);

        if (error) {
          if (error.message.includes("Invalid login")) {
            toast({
              title: "Invalid credentials",
              description: "Please check your email and password.",
              variant: "destructive",
            });
          } else {
            toast({
              title: "Sign in failed",
              description: error.message,
              variant: "destructive",
            });
          }
        } else {
          setRoutingError(null);
          // Attempt member link after sign-in
          await attemptMemberLink();
          // Don't navigate here - let useEffect handle navigation to ensure waiver step is shown
        }
      }
    } catch (err) {
      toast({
        title: "Error",
        description: "An unexpected error occurred. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  // CRITICAL state-ordering rule:
  // 1) auth not ready → generic loading
  // 2) signed in + roles errored (and not yet resolved) → recoverable retry UI
  // 3) signed in + roles still loading → "Finishing sign-in..."
  // 4) signed in + non-staff + profile still loading → "Finishing sign-in..."
  // This order MUST put the error state BEFORE the loading state so an admin
  // can never get stranded on a perpetual spinner after a transient hiccup.

  if (!authReady) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-pulse text-muted-foreground">Loading...</div>
      </div>
    );
  }

  // Signed in but role resolution failed — show retry UI BEFORE the loading branch
  // so the user can recover. (`resolved` may be false here.)
  if (user && rolesError && !rolesResolved) {
    const isJwtFailure = rolesJwtError;
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <div className="max-w-md w-full text-center space-y-4">
          <AlertCircle className="mx-auto h-10 w-10 text-destructive" />
          <h1 className="heading-section">
            {isJwtFailure ? "Session needs to be reset" : "Finishing sign-in"}
          </h1>
          <p className="text-sm text-muted-foreground">
            {isJwtFailure
              ? "Your saved sign-in token is invalid in this browser. Reset it once and sign in again — your account is fine."
              : "You're signed in, but we couldn't verify your access yet. This is usually temporary."}
          </p>
          <div className="flex flex-col gap-2">
            {!isJwtFailure && (
              <Button onClick={() => refetchRoles()}>Retry access check</Button>
            )}
            <Button
              variant={isJwtFailure ? "default" : "outline"}
              onClick={async () => {
                clearAuthStorage();
                try { await supabase.auth.signOut({ scope: "local" }); } catch { /* ignore */ }
                window.location.replace("/auth");
              }}
              className="inline-flex items-center justify-center gap-2"
            >
              <RotateCcw className="w-4 h-4" />
              Reset session and sign in again
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // Signed in + roles still loading (no error yet) → handoff spinner.
  // Also handles non-staff member waiting on profile load.
  const waitingForStaffRoles = !!user && !rolesError && (!rolesResolved || rolesLoading);
  const waitingForMemberProfile =
    !!user && rolesResolved && !hasAnyStaffRole() && profileLoading;

  if (waitingForStaffRoles || waitingForMemberProfile) {
    if (handoffStuck) {
      return (
        <div className="min-h-screen bg-background flex items-center justify-center p-6">
          <div className="max-w-md w-full text-center space-y-4">
            <AlertCircle className="mx-auto h-10 w-10 text-destructive" />
            <h1 className="heading-section">Sign-in is taking too long</h1>
            <p className="text-sm text-muted-foreground">
              Your account signed in, but verifying it in this browser is stuck. This is almost always a stale token in local storage.
            </p>
            <div className="flex flex-col gap-2">
              <Button onClick={() => refetchRoles()}>Try again</Button>
              <Button
                variant="outline"
                onClick={async () => {
                  clearAuthStorage();
                  try { await supabase.auth.signOut({ scope: "local" }); } catch { /* ignore */ }
                  window.location.replace("/auth");
                }}
                className="inline-flex items-center justify-center gap-2"
              >
                <RotateCcw className="w-4 h-4" />
                Reset session and sign in again
              </Button>
            </div>
          </div>
        </div>
      );
    }
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-pulse text-muted-foreground">Finishing sign-in...</div>
      </div>
    );
  }

  // Show staff welcome screen for first-time staff login
  if (showStaffWelcome && user && hasAnyStaffRole()) {
    return (
      <StaffWelcome
        roles={roles}
        onContinue={() => setShowStaffWelcome(false)}
      />
    );
  }

  // Show waiver signing step if user is logged in but hasn't signed liability waiver
  if (showWaiverStep && user) {
    // For staff, redirect to admin after waiver
    const waiverRedirect = hasAnyStaffRole()
      ? getDefaultAdminPage(roles)
      : getRedirectTarget();
    return <WaiverSigningStep redirectTo={waiverRedirect} />;
  }

  return (
    <div className="min-h-screen bg-background flex">
      <NoIndex />
      {/* Left side - Form */}
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-md">
          {isStaffInvite && (
            <div className="mb-6 p-4 rounded-lg bg-accent/10 border border-accent/30 flex items-center gap-3">
              <Shield className="h-5 w-5 text-accent flex-shrink-0" />
              <div>
                <p className="font-medium text-sm">Staff Account Setup</p>
                <p className="text-xs text-muted-foreground">Create your account using the email from your invitation to automatically receive your assigned role.</p>
              </div>
            </div>
          )}

          <div className="text-center mb-8">
            <img src={logo} alt="Storm Wellness Club" className="h-16 mx-auto mb-6" />
            <h1 className="heading-section mb-2">
              {isSignUp ? "Create Account" : "Welcome Back"}
            </h1>
            <p className="text-muted-foreground">
              {isSignUp 
                ? "Join Storm Wellness Club to access exclusive classes and amenities." 
                : "Sign in to continue your wellness journey."}
            </p>
          </div>

          {routingError && (
            <div className="mb-6 rounded-lg border border-destructive/30 bg-destructive/10 p-4">
              <div className="flex items-start gap-3">
                <AlertCircle className="mt-0.5 h-5 w-5 text-destructive" />
                <div className="space-y-3">
                  <p className="text-sm text-foreground">{routingError}</p>
                  <Button type="button" variant="outline" size="sm" onClick={() => refetchRoles()}>
                    Retry access check
                  </Button>
                </div>
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {isSignUp && (
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="firstName">First Name</Label>
                  <Input
                    id="firstName"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    placeholder="Jane"
                    className={errors.firstName ? "border-destructive" : ""}
                  />
                  {errors.firstName && (
                    <p className="text-destructive text-xs">{errors.firstName}</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="lastName">Last Name</Label>
                  <Input
                    id="lastName"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    placeholder="Doe"
                    className={errors.lastName ? "border-destructive" : ""}
                  />
                  {errors.lastName && (
                    <p className="text-destructive text-xs">{errors.lastName}</p>
                  )}
                </div>
              </div>
            )}

            {isSignUp && (
              <div className="space-y-2">
                <Label htmlFor="phone">
                  Mobile phone <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="phone"
                  type="tel"
                  inputMode="tel"
                  autoComplete="tel"
                  value={phone}
                  onChange={(e) => setPhone(formatPhoneInput(e.target.value))}
                  placeholder="(555) 555-5555"
                  className={errors.phone ? "border-destructive" : ""}
                />
                {errors.phone ? (
                  <p className="text-destructive text-xs">{errors.phone}</p>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    Required — we use it for class reminders and last-minute schedule changes.
                  </p>
                )}
              </div>
            )}


            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className={errors.email ? "border-destructive" : ""}
              />
              {errors.email && (
                <p className="text-destructive text-xs">{errors.email}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className={errors.password ? "border-destructive pr-10" : "pr-10"}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {errors.password && (
                <p className="text-destructive text-xs">{errors.password}</p>
              )}
              {!isSignUp && (
                <div className="text-right">
                  <Link 
                    to="/reset-password" 
                    className="text-accent text-sm hover:underline"
                  >
                    Forgot your password?
                  </Link>
                </div>
              )}
            </div>

            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {isSignUp ? "Creating Account..." : "Signing In..."}
                </>
              ) : (
                isSignUp ? "Create Account" : "Sign In"
              )}
            </Button>
          </form>

          <div className="mt-6 text-center">
            <p className="text-muted-foreground text-sm">
              {isSignUp ? "Already have an account?" : "Don't have an account?"}{" "}
              <button
                onClick={() => {
                  setIsSignUp(!isSignUp);
                  setErrors({});
                }}
                className="text-accent hover:underline font-medium"
              >
                {isSignUp ? "Sign In" : "Create Account"}
              </button>
            </p>
          </div>

          <div className="mt-6 text-center">
            <button
              type="button"
              onClick={async () => {
                clearAuthStorage();
                await supabase.auth.signOut({ scope: "local" });
                window.location.reload();
              }}
              className="text-muted-foreground text-xs hover:text-foreground transition-colors inline-flex items-center gap-1"
            >
              <RotateCcw className="w-3 h-3" />
              Having trouble signing in? Reset session
            </button>
          </div>

          <div className="mt-6 pt-6 border-t border-border text-center space-y-2">
            <p className="text-muted-foreground text-xs">
              By creating an account, you agree to our Terms of Service and Privacy Policy.
              <br />
              <span className="text-accent">Waivers and membership agreements will be required for booking.</span>
            </p>
            <p className="text-muted-foreground text-xs pt-2">
              Front desk staff?{" "}
              <Link to="/front-desk-login" className="text-accent hover:underline">
                Sign in here
              </Link>
            </p>
          </div>
        </div>
      </div>

      {/* Right side - Image (hidden on mobile) */}
      <div className="hidden lg:block lg:flex-1 bg-primary relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-dark" />
        <div className="absolute inset-0 flex items-center justify-center p-12">
          <div className="text-center text-primary-foreground">
            <h2 className="heading-display mb-4">
              Elevate Your
              <br />
              <span className="text-gold-light">Wellness Journey</span>
            </h2>
            <p className="text-primary-foreground/70 max-w-md mx-auto">
              Access premium classes, spa treatments, and exclusive amenities 
              at Livonia's most distinguished wellness destination.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
