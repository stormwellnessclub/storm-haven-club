import { ShieldX, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";

export function AccessRevoked() {
  const { signOut } = useAuth();

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-6">
      <div className="max-w-md w-full text-center space-y-6">
        <div className="mx-auto w-20 h-20 rounded-full bg-destructive/10 flex items-center justify-center">
          <ShieldX className="h-10 w-10 text-destructive" />
        </div>
        <div className="space-y-2">
          <h1 className="text-2xl font-bold text-foreground">Access Revoked</h1>
          <p className="text-muted-foreground">
            Your access to Storm Wellness Club has been revoked. If you believe this is an error, please contact us at{" "}
            <a href="mailto:info@stormwellness.com" className="text-accent underline">
              info@stormwellness.com
            </a>.
          </p>
        </div>
        <Button variant="outline" onClick={() => signOut()} className="gap-2">
          <LogOut className="h-4 w-4" />
          Sign Out
        </Button>
      </div>
    </div>
  );
}
