import { Link } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { UserPlus, LogIn } from "lucide-react";

interface AccountRequiredSectionProps {
  redirectTo: string;
  title?: string;
  description?: string;
  createAccountLabel?: string;
  signInLabel?: string;
}

export function AccountRequiredSection({
  redirectTo,
  title = "Sign in or Create an Account",
  description = "Sign in to your account, or create a free one to continue.",
  createAccountLabel = "Create Account",
  signInLabel = "Sign In",
}: AccountRequiredSectionProps) {
  const signInUrl = `/auth?redirect=${encodeURIComponent(redirectTo)}`;
  const signUpUrl = `/auth?mode=signup&redirect=${encodeURIComponent(redirectTo)}`;

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
        </CardContent>
      </Card>
    </div>
  );
}
