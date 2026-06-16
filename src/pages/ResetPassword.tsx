import { useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Loader2, ArrowLeft, Mail, CheckCircle } from "lucide-react";
import { z } from "zod";
import logo from "@/assets/storm-logo.png";
import { NoIndex } from "@/components/seo/NoIndex";

const emailSchema = z.string().email("Please enter a valid email address");

export default function ResetPassword() {
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [emailSent, setEmailSent] = useState(false);
  const [error, setError] = useState("");
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    // Validate email
    try {
      emailSchema.parse(email);
    } catch (err) {
      if (err instanceof z.ZodError) {
        setError(err.errors[0].message);
        return;
      }
    }

    setIsLoading(true);

    try {
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/update-password`,
      });

      if (resetError) {
        toast({
          title: "Error",
          description: "Failed to send reset email. Please try again.",
          variant: "destructive",
        });
      } else {
        setEmailSent(true);
        toast({
          title: "Email sent",
          description: "Check your inbox for the password reset link.",
        });
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

  return (
    <div className="min-h-screen bg-background flex">
      <NoIndex />
      {/* Left side - Form */}
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <img src={logo} alt="Storm Wellness Club" className="h-16 mx-auto mb-6" />
            <h1 className="heading-section mb-2">Reset Password</h1>
            <p className="text-muted-foreground">
              {emailSent 
                ? "Check your email for the reset link." 
                : "Enter your email to receive a password reset link."}
            </p>
          </div>

          {emailSent ? (
            <div className="space-y-6">
              <div className="bg-primary/10 border border-primary/20 rounded-lg p-6 text-center">
                <CheckCircle className="w-12 h-12 text-primary mx-auto mb-4" />
                <h2 className="font-semibold text-lg mb-2">Email Sent!</h2>
                <p className="text-muted-foreground text-sm">
                  We've sent a password reset link to <strong>{email}</strong>. 
                  Please check your inbox and spam folder.
                </p>
              </div>
              
              <div className="text-center space-y-4">
                <p className="text-muted-foreground text-sm">
                  Didn't receive the email?
                </p>
                <Button
                  variant="outline"
                  onClick={() => {
                    setEmailSent(false);
                    setEmail("");
                  }}
                >
                  Try again
                </Button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email Address</Label>
                <div className="relative">
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    className={error ? "border-destructive" : ""}
                  />
                </div>
                {error && (
                  <p className="text-destructive text-xs">{error}</p>
                )}
              </div>

              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Sending...
                  </>
                ) : (
                  <>
                    <Mail className="mr-2 h-4 w-4" />
                    Send Reset Link
                  </>
                )}
              </Button>
            </form>
          )}

          <div className="mt-6 text-center">
            <Link 
              to="/auth" 
              className="text-accent hover:underline text-sm inline-flex items-center gap-1"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to Sign In
            </Link>
          </div>
        </div>
      </div>

      {/* Right side - Image (hidden on mobile) */}
      <div className="hidden lg:block lg:flex-1 bg-primary relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-dark" />
        <div className="absolute inset-0 flex items-center justify-center p-12">
          <div className="text-center text-primary-foreground">
            <h2 className="heading-display mb-4">
              Secure Account
              <br />
              <span className="text-gold-light">Recovery</span>
            </h2>
            <p className="text-primary-foreground/70 max-w-md mx-auto">
              We'll send you a secure link to reset your password 
              and get you back to your wellness journey.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
