import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Eye, EyeOff, CheckCircle, AlertCircle } from "lucide-react";
import logo from "@/assets/storm-logo.png";
import { NoIndex } from "@/components/seo/NoIndex";

export default function UpdatePassword() {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isValidSession, setIsValidSession] = useState<boolean | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  
  const navigate = useNavigate();
  const { toast } = useToast();

  // Check if user has a valid recovery session with multi-retry
  useEffect(() => {
    let cancelled = false;
    const timeouts: ReturnType<typeof setTimeout>[] = [];

    const setValid = () => {
      if (!cancelled) {
        console.info("[UpdatePassword] Valid recovery session found");
        setIsValidSession(true);
        cancelled = true; // Stop further retries
      }
    };

    // 1. Listen for auth state changes (recovery link fires PASSWORD_RECOVERY)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      console.info("[UpdatePassword] Auth event:", event);
      if (session) {
        setValid();
      }
    });

    // 2. Check for hash fragment in URL (indicates recovery redirect)
    const hasHashToken = window.location.hash.includes("access_token") || 
                         window.location.hash.includes("type=recovery");
    if (hasHashToken) {
      console.info("[UpdatePassword] Recovery hash fragment detected in URL");
    }

    // 3. Multi-retry session checks at 0s, 1s, 2s, 4s
    const retryDelays = [0, 1000, 2000, 4000];
    
    retryDelays.forEach((delay) => {
      const t = setTimeout(async () => {
        if (cancelled) return;
        
        try {
          const { data: { session } } = await supabase.auth.getSession();
          if (session) {
            setValid();
          } else if (delay === retryDelays[retryDelays.length - 1]) {
            // Last retry — declare invalid
            if (!cancelled) {
              console.warn("[UpdatePassword] No session found after all retries");
              setIsValidSession(false);
            }
          }
        } catch (err) {
          console.error("[UpdatePassword] Session check error:", err);
          if (delay === retryDelays[retryDelays.length - 1] && !cancelled) {
            setIsValidSession(false);
          }
        }
      }, delay);
      timeouts.push(t);
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
      timeouts.forEach(clearTimeout);
    };
  }, []);

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (password.length < 6) {
      newErrors.password = "Password must be at least 6 characters";
    }

    if (password !== confirmPassword) {
      newErrors.confirmPassword = "Passwords do not match";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) return;

    setIsLoading(true);

    try {
      const { error } = await supabase.auth.updateUser({ password });

      if (error) {
        toast({
          title: "Error",
          description: error.message || "Failed to update password. Please try again.",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Password Updated",
          description: "Your password has been updated successfully. Please sign in.",
        });
        
        // Sign out and redirect to login
        await supabase.auth.signOut({ scope: "local" });
        navigate("/auth");
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

  // Loading state while checking session
  if (isValidSession === null) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-pulse text-muted-foreground">Verifying reset link...</div>
      </div>
    );
  }

  // Invalid or expired session
  if (!isValidSession) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-8">
        <div className="w-full max-w-md text-center">
          <img src={logo} alt="Storm Wellness Club" className="h-16 mx-auto mb-6" />
          
          <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-6 mb-6">
            <AlertCircle className="w-12 h-12 text-destructive mx-auto mb-4" />
            <h2 className="font-semibold text-lg mb-2">Invalid or Expired Link</h2>
            <p className="text-muted-foreground text-sm">
              This password reset link is invalid or has expired. 
              Please request a new reset link.
            </p>
          </div>
          
          <Button onClick={() => navigate("/reset-password")} className="w-full">
            Request New Reset Link
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex">
      <NoIndex />
      {/* Left side - Form */}
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <img src={logo} alt="Storm Wellness Club" className="h-16 mx-auto mb-6" />
            <h1 className="heading-section mb-2">Set New Password</h1>
            <p className="text-muted-foreground">
              Enter your new password below.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="password">New Password</Label>
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
              <p className="text-muted-foreground text-xs">
                Must be at least 6 characters
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirm New Password</Label>
              <div className="relative">
                <Input
                  id="confirmPassword"
                  type={showConfirmPassword ? "text" : "password"}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="••••••••"
                  className={errors.confirmPassword ? "border-destructive pr-10" : "pr-10"}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                >
                  {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {errors.confirmPassword && (
                <p className="text-destructive text-xs">{errors.confirmPassword}</p>
              )}
            </div>

            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Updating Password...
                </>
              ) : (
                <>
                  <CheckCircle className="mr-2 h-4 w-4" />
                  Update Password
                </>
              )}
            </Button>
          </form>
        </div>
      </div>

      {/* Right side - Image (hidden on mobile) */}
      <div className="hidden lg:block lg:flex-1 bg-primary relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-dark" />
        <div className="absolute inset-0 flex items-center justify-center p-12">
          <div className="text-center text-primary-foreground">
            <h2 className="heading-display mb-4">
              Almost There
              <br />
              <span className="text-gold-light">Stay Secure</span>
            </h2>
            <p className="text-primary-foreground/70 max-w-md mx-auto">
              Create a strong password to keep your account secure 
              and continue your wellness journey.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
