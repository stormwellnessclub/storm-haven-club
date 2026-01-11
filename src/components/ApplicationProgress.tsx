import { Check, Lock, User, Target, History, Heart, Sparkles, CreditCard, FileText } from "lucide-react";
import { cn } from "@/lib/utils";

export interface ApplicationStep {
  id: string;
  label: string;
  shortLabel: string;
  icon: React.ElementType;
  isComplete: boolean;
  isRequired?: boolean;
}

interface ApplicationProgressProps {
  steps: ApplicationStep[];
  currentStepId: string;
  onStepClick: (stepId: string) => void;
}

export const APPLICATION_STEPS = [
  { id: "personal", label: "Personal Info", shortLabel: "Personal", icon: User },
  { id: "membership", label: "Membership Plan", shortLabel: "Plan", icon: Sparkles },
  { id: "goals", label: "Wellness Goals", shortLabel: "Goals", icon: Target },
  { id: "background", label: "Background", shortLabel: "Background", icon: History },
  { id: "motivation", label: "Motivation", shortLabel: "Motivation", icon: Heart },
  { id: "lifestyle", label: "Lifestyle", shortLabel: "Lifestyle", icon: Sparkles },
  { id: "payment", label: "Payment", shortLabel: "Payment", icon: CreditCard, isRequired: true },
  { id: "agreements", label: "Agreements", shortLabel: "Agree", icon: FileText, isRequired: true },
];

export function ApplicationProgress({ steps, currentStepId, onStepClick }: ApplicationProgressProps) {
  const currentIndex = steps.findIndex(s => s.id === currentStepId);

  return (
    <div className="sticky top-20 z-40 bg-background/95 backdrop-blur-sm border-b py-4 mb-8">
      <div className="container mx-auto px-6 max-w-3xl">
        {/* Desktop view */}
        <div className="hidden md:flex items-center justify-between gap-1">
          {steps.map((step, index) => {
            const Icon = step.icon;
            const isCurrent = step.id === currentStepId;
            const isPast = index < currentIndex;
            const isPayment = step.id === "payment";
            
            return (
              <div key={step.id} className="flex-1 flex items-center">
                <button
                  type="button"
                  onClick={() => onStepClick(step.id)}
                  className={cn(
                    "flex flex-col items-center gap-1.5 w-full group transition-all",
                    isCurrent && "scale-105",
                    !step.isComplete && !isCurrent && "opacity-60"
                  )}
                >
                  <div
                    className={cn(
                      "w-10 h-10 rounded-full flex items-center justify-center transition-all border-2",
                      step.isComplete && "bg-green-500/20 border-green-500 text-green-600",
                      isCurrent && !step.isComplete && "bg-accent/20 border-accent text-accent animate-pulse",
                      !step.isComplete && !isCurrent && "bg-muted border-muted-foreground/30 text-muted-foreground",
                      isPayment && !step.isComplete && "border-amber-500 bg-amber-500/10 text-amber-600"
                    )}
                  >
                    {step.isComplete ? (
                      <Check className="w-5 h-5" />
                    ) : isPayment && !step.isComplete ? (
                      <Lock className="w-4 h-4" />
                    ) : (
                      <Icon className="w-4 h-4" />
                    )}
                  </div>
                  <span
                    className={cn(
                      "text-xs font-medium text-center leading-tight",
                      isCurrent && "text-accent",
                      step.isComplete && "text-green-600",
                      !step.isComplete && !isCurrent && "text-muted-foreground",
                      isPayment && !step.isComplete && "text-amber-600 font-semibold"
                    )}
                  >
                    {step.shortLabel}
                    {step.isRequired && !step.isComplete && " *"}
                  </span>
                </button>
                {index < steps.length - 1 && (
                  <div
                    className={cn(
                      "h-0.5 flex-1 mx-1 transition-colors",
                      index < currentIndex ? "bg-green-500/50" : "bg-muted-foreground/20"
                    )}
                  />
                )}
              </div>
            );
          })}
        </div>

        {/* Mobile view */}
        <div className="md:hidden">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium">
              Step {currentIndex + 1} of {steps.length}
            </span>
            <span className="text-sm text-accent font-medium">
              {steps.find(s => s.id === currentStepId)?.label}
            </span>
          </div>
          <div className="flex gap-1">
            {steps.map((step, index) => (
              <button
                key={step.id}
                type="button"
                onClick={() => onStepClick(step.id)}
                className={cn(
                  "h-2 flex-1 rounded-full transition-all",
                  step.isComplete && "bg-green-500",
                  step.id === currentStepId && !step.isComplete && "bg-accent",
                  !step.isComplete && step.id !== currentStepId && "bg-muted-foreground/30",
                  step.id === "payment" && !step.isComplete && "bg-amber-500 animate-pulse"
                )}
              />
            ))}
          </div>
        </div>

        {/* Progress summary */}
        <div className="mt-3 flex items-center justify-center gap-4 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <div className="w-2 h-2 rounded-full bg-green-500" />
            {steps.filter(s => s.isComplete).length} complete
          </span>
          <span className="flex items-center gap-1">
            <div className="w-2 h-2 rounded-full bg-amber-500" />
            {steps.filter(s => s.isRequired && !s.isComplete).length} required
          </span>
        </div>
      </div>
    </div>
  );
}

// Helper to calculate step completion status
export function getStepCompletion(
  formData: {
    firstName: string;
    lastName: string;
    dateOfBirth: string;
    gender: string;
    address: string;
    city: string;
    state: string;
    zipCode: string;
    email: string;
    phone: string;
    membershipPlan: string;
    wellnessGoals: string[];
    servicesInterested: string[];
    previousMember: string;
    motivations: string[];
    lifestyleIntegration: string;
    holisticWellness: string;
    referredByMember: string;
    foundingMember: string;
    creditCardAuth: boolean;
    paymentAcknowledged: boolean;
    membershipAgreementSigned: boolean;
    oneYearCommitment: boolean;
    authAcknowledgment: boolean;
    submissionConfirmation: boolean;
  },
  stripeCustomerId: string | null
): ApplicationStep[] {
  return APPLICATION_STEPS.map(step => {
    let isComplete = false;
    
    switch (step.id) {
      case "personal":
        isComplete = !!(
          formData.firstName &&
          formData.lastName &&
          formData.dateOfBirth &&
          formData.gender &&
          formData.address &&
          formData.city &&
          formData.state &&
          formData.zipCode &&
          formData.email &&
          formData.phone
        );
        break;
      case "membership":
        isComplete = !!formData.membershipPlan;
        break;
      case "goals":
        isComplete = formData.wellnessGoals.length > 0 && formData.servicesInterested.length > 0;
        break;
      case "background":
        isComplete = !!formData.previousMember;
        break;
      case "motivation":
        isComplete = formData.motivations.length > 0 || !!formData.referredByMember;
        break;
      case "lifestyle":
        isComplete = !!formData.foundingMember;
        break;
      case "payment":
        isComplete = !!(stripeCustomerId && formData.creditCardAuth && formData.paymentAcknowledged);
        break;
      case "agreements":
        isComplete = !!(
          formData.membershipAgreementSigned &&
          formData.oneYearCommitment &&
          formData.authAcknowledgment &&
          formData.submissionConfirmation
        );
        break;
    }
    
    return { ...step, isComplete };
  });
}
