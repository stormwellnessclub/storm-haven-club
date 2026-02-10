import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { AlertCircle, ArrowRight } from "lucide-react";
import { Link, useLocation } from "react-router-dom";

const WAIVER_DISPLAY_NAMES: Record<string, string> = {
  liability: "Liability Waiver",
  guest_pass: "Guest Pass Agreement",
  single_class_pass: "Single Class Pass Agreement",
  kids_care: "Kids Care Agreement",
  membership: "Membership Agreement",
  class_package: "Class Package Agreement",
  private_event: "Private Event Agreement",
};

const WAIVER_SERVICE_CONTEXT: Record<string, string> = {
  liability: "access club facilities",
  guest_pass: "purchase a Guest Pass",
  single_class_pass: "purchase single class passes",
  kids_care: "book Kids Care services",
  membership: "activate your membership",
  class_package: "purchase class packages",
  private_event: "book private events",
};

interface WaiverRequiredAlertProps {
  waiverType: string;
  serviceName?: string;
  className?: string;
  isLoggedIn?: boolean;
}

export function WaiverRequiredAlert({ 
  waiverType, 
  serviceName,
  className,
  isLoggedIn = false,
}: WaiverRequiredAlertProps) {
  const location = useLocation();
  const returnUrl = encodeURIComponent(location.pathname + location.search);
  
  const displayName = WAIVER_DISPLAY_NAMES[waiverType] || waiverType;
  const contextText = serviceName || WAIVER_SERVICE_CONTEXT[waiverType] || "continue";

  return (
    <Alert className={`border-accent/50 bg-accent/5 ${className || ""}`}>
      <AlertCircle className="h-4 w-4 text-accent" />
      <AlertTitle>Agreement Required</AlertTitle>
      <AlertDescription className="mt-2">
        <p className="mb-3">
          To {contextText}, you'll need to sign our <strong>{displayName}</strong>.
        </p>
        <div className="mb-4 p-3 bg-muted/50 rounded-md text-sm space-y-1">
          <p className="font-medium">Here's how:</p>
          <ol className="list-decimal list-inside space-y-1 text-muted-foreground">
            {!isLoggedIn && <li>Create an account or sign in</li>}
            <li>Go to the <strong className="text-foreground">Waivers</strong> tab in your portal</li>
            <li>Sign the {displayName}</li>
          </ol>
        </div>
        <Button asChild>
          <Link to={`/member/waivers?return=${returnUrl}`}>
            {isLoggedIn ? "Go to Waivers" : "Sign In & Go to Waivers"}
            <ArrowRight className="ml-2 h-4 w-4" />
          </Link>
        </Button>
        <p className="text-xs text-muted-foreground mt-3">
          This only needs to be done once.
        </p>
      </AlertDescription>
    </Alert>
  );
}
