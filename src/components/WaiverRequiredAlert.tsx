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
}

export function WaiverRequiredAlert({ 
  waiverType, 
  serviceName,
  className 
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
        <p className="mb-4">
          To {contextText}, please sign our <strong>{displayName}</strong> first.
        </p>
        <Button asChild>
          <Link to={`/member/waivers?return=${returnUrl}`}>
            Go to Waivers & Agreements
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
