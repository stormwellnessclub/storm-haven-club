import { useState } from "react";
import { format, addDays, startOfDay } from "date-fns";
import { X, Clock, AlertTriangle, CreditCard } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";

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

  if (isDismissed) return null;

  const deadlineDate = memberData.activation_deadline 
    ? new Date(memberData.activation_deadline) 
    : addDays(new Date(), 7);
  
  const today = startOfDay(new Date());
  const daysRemaining = Math.max(0, Math.ceil((deadlineDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)));
  const isUrgent = daysRemaining <= 3;

  return (
    <Alert 
      className={`relative border-2 ${
        isUrgent 
          ? "bg-destructive/10 border-destructive/50" 
          : "bg-amber-50 dark:bg-amber-900/20 border-amber-300 dark:border-amber-700"
      }`}
    >
      <div className="flex items-start gap-3">
        {isUrgent ? (
          <AlertTriangle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
        ) : (
          <Clock className="h-5 w-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
        )}
        <div className="flex-1 space-y-2">
          <AlertTitle className={isUrgent ? "text-destructive" : "text-amber-800 dark:text-amber-200"}>
            Membership Activation Required
          </AlertTitle>
          <AlertDescription className={isUrgent ? "text-destructive/80" : "text-amber-700 dark:text-amber-300"}>
            <p>
              Congratulations on your approval, {memberData.first_name}! Complete your activation to unlock all member benefits.
              {daysRemaining > 0 && (
                <span className="font-medium"> {daysRemaining} day{daysRemaining !== 1 ? 's' : ''} remaining until deadline.</span>
              )}
            </p>
            <p className="mt-2 text-sm opacity-80">
              Until activated, your member credits, class discounts, spa discounts, and amenity access are frozen.
            </p>
          </AlertDescription>
          <div className="flex gap-2 pt-1">
            <Button 
              size="sm" 
              onClick={() => navigate("/member/membership")}
              className="bg-accent hover:bg-accent/90 text-accent-foreground"
            >
              <CreditCard className="h-4 w-4 mr-2" />
              Activate Now
            </Button>
            <Button 
              size="sm" 
              variant="outline" 
              onClick={() => setIsDismissed(true)}
            >
              Remind Me Later
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
