import { useState } from "react";
import { RefreshCw, LogIn, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { clearAuthStorage } from "@/lib/authStorage";
import { supabase } from "@/integrations/supabase/client";

interface SessionRepairProps {
  onRetry: () => void;
}

export function SessionRepair({ onRetry }: SessionRepairProps) {
  const [isResetting, setIsResetting] = useState(false);
  const [isRetrying, setIsRetrying] = useState(false);

  const handleResetSession = async () => {
    setIsResetting(true);
    try {
      clearAuthStorage();
      await supabase.auth.signOut();
    } catch {
      // Ignore errors during cleanup
    }
    window.location.href = "/auth";
  };

  const handleRetry = async () => {
    setIsRetrying(true);
    try {
      await onRetry();
    } finally {
      setIsRetrying(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="max-w-md w-full text-center space-y-6">
        <div className="flex justify-center">
          <div className="w-16 h-16 rounded-full bg-amber-500/10 flex items-center justify-center">
            <AlertCircle className="w-8 h-8 text-amber-500" />
          </div>
        </div>
        
        <div className="space-y-2">
          <h1 className="text-2xl font-semibold text-foreground">
            Session Needs Refresh
          </h1>
          <p className="text-muted-foreground">
            Your sign-in session has expired or needs to be refreshed. 
            Please sign in again to continue.
          </p>
        </div>

        <div className="space-y-3">
          <Button 
            onClick={handleResetSession} 
            className="w-full"
            variant="default"
            disabled={isResetting}
          >
            {isResetting ? (
              <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <LogIn className="w-4 h-4 mr-2" />
            )}
            {isResetting ? "Resetting..." : "Reset Session & Sign In"}
          </Button>
          
          <Button 
            onClick={handleRetry} 
            className="w-full"
            variant="outline"
            disabled={isRetrying}
          >
            {isRetrying ? (
              <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <RefreshCw className="w-4 h-4 mr-2" />
            )}
            {isRetrying ? "Checking..." : "Try Again"}
          </Button>
        </div>

        <p className="text-xs text-muted-foreground">
          This usually happens when your browser session has been inactive for a while.
        </p>
      </div>
    </div>
  );
}
