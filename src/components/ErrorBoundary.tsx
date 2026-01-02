import { Component, ErrorInfo, ReactNode } from "react";
import { AlertTriangle, RefreshCw, LogIn, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { clearAuthStorage } from "@/lib/authStorage";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Log error for debugging (no sensitive data)
    console.error("ErrorBoundary caught an error:", error.message);
    console.error("Component stack:", errorInfo.componentStack);
  }

  handleReload = () => {
    window.location.reload();
  };

  handleGoToSignIn = () => {
    window.location.href = "/auth";
  };

  handleResetSession = async () => {
    try {
      clearAuthStorage();
      // Dynamic import to avoid circular dependencies
      const { supabase } = await import("@/integrations/supabase/client");
      await supabase.auth.signOut();
    } catch {
      // Ignore errors during cleanup
    }
    window.location.href = "/auth";
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-background p-4">
          <div className="max-w-md w-full text-center space-y-6">
            <div className="flex justify-center">
              <div className="w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center">
                <AlertTriangle className="w-8 h-8 text-destructive" />
              </div>
            </div>
            
            <div className="space-y-2">
              <h1 className="text-2xl font-semibold text-foreground">
                Something went wrong
              </h1>
              <p className="text-muted-foreground">
                We encountered an unexpected error. Please try one of the options below.
              </p>
            </div>

            <div className="space-y-3">
              <Button 
                onClick={this.handleReload} 
                className="w-full"
                variant="default"
              >
                <RefreshCw className="w-4 h-4 mr-2" />
                Reload Page
              </Button>
              
              <Button 
                onClick={this.handleGoToSignIn} 
                className="w-full"
                variant="outline"
              >
                <LogIn className="w-4 h-4 mr-2" />
                Go to Sign In
              </Button>
              
              <Button 
                onClick={this.handleResetSession} 
                className="w-full"
                variant="ghost"
              >
                <RotateCcw className="w-4 h-4 mr-2" />
                Reset Session & Sign In
              </Button>
            </div>

            <p className="text-xs text-muted-foreground">
              If this problem persists, please contact support.
            </p>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
