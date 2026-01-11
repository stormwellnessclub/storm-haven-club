import { AlertCircle, Check, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { ApplicationStep } from "@/components/ApplicationProgress";

interface ApplicationValidationSummaryProps {
  steps: ApplicationStep[];
  onStepClick: (stepId: string) => void;
  isSubmitting: boolean;
}

export function ApplicationValidationSummary({
  steps,
  onStepClick,
  isSubmitting,
}: ApplicationValidationSummaryProps) {
  const incompleteSteps = steps.filter(s => !s.isComplete);
  const requiredIncomplete = incompleteSteps.filter(s => s.isRequired);
  const isReadyToSubmit = incompleteSteps.length === 0;
  const hasRequiredMissing = requiredIncomplete.length > 0;

  // Show payment warning prominently
  const paymentStep = steps.find(s => s.id === "payment");
  const agreementsStep = steps.find(s => s.id === "agreements");

  return (
    <div className={cn(
      "p-6 rounded-lg border-2 mb-6 transition-all",
      isReadyToSubmit && "bg-green-500/10 border-green-500/50",
      hasRequiredMissing && "bg-amber-500/10 border-amber-500/50",
      !isReadyToSubmit && !hasRequiredMissing && "bg-muted border-muted-foreground/30"
    )}>
      {isReadyToSubmit ? (
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-full bg-green-500/20 flex items-center justify-center">
            <Check className="w-6 h-6 text-green-600" />
          </div>
          <div>
            <h3 className="font-semibold text-green-700 dark:text-green-400">
              Ready to Submit!
            </h3>
            <p className="text-sm text-muted-foreground">
              All required sections are complete. Click submit to send your application.
            </p>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex items-start gap-3">
            <AlertCircle className={cn(
              "w-6 h-6 mt-0.5",
              hasRequiredMissing ? "text-amber-600" : "text-muted-foreground"
            )} />
            <div>
              <h3 className={cn(
                "font-semibold",
                hasRequiredMissing ? "text-amber-700 dark:text-amber-400" : "text-foreground"
              )}>
                {hasRequiredMissing
                  ? "Please complete required sections"
                  : "Almost there!"
                }
              </h3>
              <p className="text-sm text-muted-foreground mt-1">
                {incompleteSteps.length} section{incompleteSteps.length !== 1 ? "s" : ""} remaining
              </p>
            </div>
          </div>

          {/* Critical: Payment warning */}
          {paymentStep && !paymentStep.isComplete && (
            <div 
              className="p-4 bg-amber-500/20 border border-amber-500/40 rounded-lg cursor-pointer hover:bg-amber-500/30 transition-colors"
              onClick={() => onStepClick("payment")}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-amber-500 flex items-center justify-center animate-pulse">
                    <AlertCircle className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <p className="font-semibold text-amber-700 dark:text-amber-300">
                      Payment Method Required
                    </p>
                    <p className="text-sm text-amber-600/80 dark:text-amber-400/80">
                      You must save a payment method to submit your application
                    </p>
                  </div>
                </div>
                <ArrowRight className="w-5 h-5 text-amber-600" />
              </div>
            </div>
          )}

          {/* Agreements warning */}
          {agreementsStep && !agreementsStep.isComplete && (
            <div 
              className="p-3 bg-muted rounded-lg cursor-pointer hover:bg-muted/80 transition-colors"
              onClick={() => onStepClick("agreements")}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-full bg-muted-foreground/20 flex items-center justify-center">
                    <AlertCircle className="w-4 h-4 text-muted-foreground" />
                  </div>
                  <span className="text-sm text-muted-foreground">
                    Agreements section incomplete
                  </span>
                </div>
                <ArrowRight className="w-4 h-4 text-muted-foreground" />
              </div>
            </div>
          )}

          {/* Other incomplete steps */}
          {incompleteSteps
            .filter(s => s.id !== "payment" && s.id !== "agreements")
            .length > 0 && (
            <div className="flex flex-wrap gap-2">
              {incompleteSteps
                .filter(s => s.id !== "payment" && s.id !== "agreements")
                .map(step => (
                  <button
                    key={step.id}
                    type="button"
                    onClick={() => onStepClick(step.id)}
                    className="text-xs px-3 py-1.5 rounded-full bg-muted hover:bg-muted/80 text-muted-foreground transition-colors"
                  >
                    {step.label}
                  </button>
                ))}
            </div>
          )}
        </div>
      )}

      {/* Submit button */}
      <div className="mt-6">
        <Button
          type="submit"
          variant="gold"
          size="lg"
          disabled={!isReadyToSubmit || isSubmitting}
          className="w-full"
        >
          {isSubmitting ? (
            "Submitting Application..."
          ) : isReadyToSubmit ? (
            <>
              Submit Application
              <ArrowRight className="ml-2 w-5 h-5" />
            </>
          ) : (
            "Complete All Sections to Submit"
          )}
        </Button>
      </div>
    </div>
  );
}
