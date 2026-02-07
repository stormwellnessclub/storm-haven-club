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
  title = "Create an Account to Continue",
  description = "To proceed with your purchase, please create an account or sign in. This helps us ensure a seamless experience.",
  createAccountLabel = "Create Account",
  signInLabel = "Already have an account? Sign In",
}: AccountRequiredSectionProps) {
  const authUrl = `/auth?redirect=${encodeURIComponent(redirectTo)}`;

  return (
    <div className="flex items-center justify-center min-h-[400px] px-6">
      <Card className="max-w-md w-full">
        <CardHeader className="text-center">
          <div className="w-16 h-16 rounded-full bg-accent/10 flex items-center justify-center mx-auto mb-4">
            <UserPlus className="h-8 w-8 text-accent" />
          </div>
          <CardTitle className="text-xl">{title}</CardTitle>
          <CardDescription className="text-base">{description}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button asChild className="w-full" size="lg">
            <Link to={authUrl}>
              <UserPlus className="h-4 w-4 mr-2" />
              {createAccountLabel}
            </Link>
          </Button>
          <div className="text-center">
            <Link 
              to={authUrl} 
              className="text-sm text-muted-foreground hover:text-foreground transition-colors inline-flex items-center gap-1"
            >
              <LogIn className="h-3 w-3" />
              {signInLabel}
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
