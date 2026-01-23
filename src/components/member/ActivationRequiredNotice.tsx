import { useState } from "react";
import { X, Clock, CreditCard } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { usePaymentStatus } from "@/hooks/usePaymentStatus";

interface ActivationRequiredNoticeProps {
  memberData: {
    first_name: string;
    activation_deadline: string | null;
    membership_type: string;
  };
}

export function ActivationRequiredNotice({ memberData }: ActivationRequiredNoticeProps) {
  const [isDismissed, setIsDismissed] = useState(false);
  const navigate = useNavigate();
  const { isInitiationFeePaid } = usePaymentStatus();

  if (isDismissed) return null;

  return (
    <Alert 
      className="relative border-2 bg-amber-50 dark:bg-amber-900/20 border-amber-300 dark:border-amber-700"
    >
      <div className="flex items-start gap-3">
        <Clock className="h-5 w-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
        <div className="flex-1 space-y-2">
          <AlertTitle className="text-amber-800 dark:text-amber-200">
            Membership Pending Activation
          </AlertTitle>
          <AlertDescription className="text-amber-700 dark:text-amber-300">
            <p>
              Congratulations on your approval, {memberData.first_name}!
            </p>
            <p className="mt-2">
              {isInitiationFeePaid ? (
                <>Your membership credits and access will be activated once your <strong>membership dues</strong> are processed.</>
              ) : (
                <>Your membership credits and access will be activated once your <strong>membership dues and initiation fee</strong> are paid.</>
              )}
            </p>
            <p className="mt-2 text-sm opacity-80">
              Please ensure your correct card information is on file.
            </p>
          </AlertDescription>
          <div className="flex gap-2 pt-1">
            <Button 
              size="sm" 
              onClick={() => navigate("/member/payment-methods")}
              className="bg-accent hover:bg-accent/90 text-accent-foreground"
            >
              <CreditCard className="h-4 w-4 mr-2" />
              Manage Payment Info
            </Button>
            <Button 
              size="sm" 
              variant="outline" 
              onClick={() => setIsDismissed(true)}
            >
              Dismiss
            </Button>
          </div>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="absolute top-2 right-2 h-6 w-6 opacity-60 hover:opacity-100"
          onClick={() => setIsDismissed(true)}
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
    </Alert>
  );
}
