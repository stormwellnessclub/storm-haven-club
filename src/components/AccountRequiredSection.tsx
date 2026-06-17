import { Link } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { UserPlus, LogIn, KeyRound } from "lucide-react";

interface AccountRequiredSectionProps {
  redirectTo: string;
  title?: string;
  description?: string;
  createAccountLabel?: string;
  signInLabel?: string;
  /**
   * When true (default), shows messaging targeted at returning guests
   * who may already have an account from a prior class or visit.
   */
  showReturningGuestHint?: boolean;
}

export function AccountRequiredSection({
  redirectTo,
  title = "Sign in or Create an Account",
  description = "If you've taken a class or visited us before, please sign in with that email instead of creating a new account.",
  createAccountLabel = "Create New Account",
  signInLabel = "Sign In",
  showReturningGuestHint = true,
}: AccountRequiredSectionProps) {
  const signInUrl = `/auth?redirect=${encodeURIComponent(redirectTo)}`;
  const signUpUrl = `/auth?mode=signup&redirect=${encodeURIComponent(redirectTo)}`;
  const resetUrl = `/auth?redirect=${encodeURIComponent(redirectTo)}#forgot`;

  return (
    <div className="flex items-center justify-center min-h-[400px] px-6">
      <Card className="max-w-md w-full">
        <CardHeader className="text-center">
          <div className="w-16 h-16 rounded-full bg-accent/10 flex items-center justify-center mx-auto mb-4">
            <LogIn className="h-8 w-8 text-accent" />
          </div>
          <CardTitle className="text-xl">{title}</CardTitle>
          <CardDescription className="text-base">{description}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Button asChild className="w-full" size="lg">
            <Link to={signInUrl}>
              <LogIn className="h-4 w-4 mr-2" />
              {signInLabel}
            </Link>
          </Button>
          <Button asChild variant="outline" className="w-full" size="lg">
            <Link to={signUpUrl}>
              <UserPlus className="h-4 w-4 mr-2" />
              {createAccountLabel}
            </Link>
          </Button>
          {showReturningGuestHint && (
            <div className="text-center pt-2 border-t border-border">
              <p className="text-xs text-muted-foreground mb-2">
                Forgot your password? You may already have an account.
              </p>
              <Link
                to={resetUrl}
                className="text-sm text-accent hover:underline inline-flex items-center gap-1"
              >
                <KeyRound className="h-3 w-3" />
                Reset password
              </Link>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
