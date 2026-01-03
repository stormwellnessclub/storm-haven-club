import { useState } from "react";
import { Loader2, AlertCircle, RefreshCw, CheckCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import stormLogo from "@/assets/storm-logo-gold.png";

interface UnlinkedMemberData {
  id: string;
  email: string;
  status: string;
  first_name: string;
  last_name: string;
}

interface UnlinkedMemberFixProps {
  memberData: UnlinkedMemberData;
  onSuccess: () => void;
}

export function UnlinkedMemberFix({ memberData, onSuccess }: UnlinkedMemberFixProps) {
  const [isFixing, setIsFixing] = useState(false);
  const [fixed, setFixed] = useState(false);

  const handleFix = async () => {
    setIsFixing(true);

    try {
      // Try to link the member
      const { data, error } = await supabase.rpc("link_member_by_email");

      if (error) {
        console.error("[UnlinkedMemberFix] Link error:", error);
        toast.error("Failed to link membership. Please contact support.");
        return;
      }

      if (data && data.length > 0) {
        setFixed(true);
        toast.success("Membership linked successfully!");
        // Give user time to see success before reload
        setTimeout(() => {
          onSuccess();
        }, 1500);
      } else {
        toast.error("Could not link membership. Please contact support.");
      }
    } catch (err) {
      console.error("[UnlinkedMemberFix] Error:", err);
      toast.error("An error occurred. Please try again.");
    } finally {
      setIsFixing(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center space-y-4">
          <div className="mx-auto">
            <img src={stormLogo} alt="Storm Wellness Club" className="h-16 mx-auto" />
          </div>
          <div>
            {fixed ? (
              <div className="flex flex-col items-center gap-4">
                <CheckCircle className="w-12 h-12 text-green-500" />
                <CardTitle className="text-xl font-serif">Membership Linked!</CardTitle>
                <CardDescription>Redirecting to your portal...</CardDescription>
              </div>
            ) : (
              <>
                <div className="mx-auto w-12 h-12 bg-amber-500/10 rounded-full flex items-center justify-center mb-4">
                  <AlertCircle className="w-6 h-6 text-amber-500" />
                </div>
                <CardTitle className="text-xl font-serif">
                  Membership Found, {memberData.first_name}!
                </CardTitle>
                <CardDescription className="mt-2">
                  We found an approved membership for your email but it wasn't linked to your account automatically.
                </CardDescription>
              </>
            )}
          </div>
        </CardHeader>

        {!fixed && (
          <CardContent className="space-y-6">
            <div className="bg-secondary/50 rounded-lg p-4 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Email</span>
                <span className="font-medium">{memberData.email}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Status</span>
                <span className="font-medium capitalize">{memberData.status.replace('_', ' ')}</span>
              </div>
            </div>

            <Button
              className="w-full"
              size="lg"
              onClick={handleFix}
              disabled={isFixing}
            >
              {isFixing ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Linking Membership...
                </>
              ) : (
                <>
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Link My Membership
                </>
              )}
            </Button>

            <p className="text-xs text-center text-muted-foreground">
              If this issue persists, please contact our support team for assistance.
            </p>
          </CardContent>
        )}
      </Card>
    </div>
  );
}