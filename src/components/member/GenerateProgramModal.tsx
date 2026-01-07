import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  Dumbbell,
  Heart,
  Zap,
  Activity,
  Calendar,
  ChevronRight,
  ChevronLeft,
  Loader2,
  Sparkles,
} from "lucide-react";

interface GenerateProgramModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onGenerate: (preferences: ProgramPreferences) => void;
  isGenerating: boolean;
}

export interface ProgramPreferences {
  programType: string;
  daysPerWeek: number;
  durationWeeks: number;
  splitType: string;
  targetBodyParts: string[];
}

const PROGRAM_TYPES = [
  { id: "strength", label: "Strength", icon: Dumbbell, description: "Build muscle & power" },
  { id: "hypertrophy", label: "Hypertrophy", icon: Activity, description: "Muscle growth focus" },
  { id: "fat_loss", label: "Fat Loss", icon: Zap, description: "Burn fat & tone" },
  { id: "endurance", label: "Endurance", icon: Heart, description: "Cardio & stamina" },
];

const DAYS_OPTIONS = [
  { value: 3, label: "3 Days", description: "Great for beginners" },
  { value: 4, label: "4 Days", description: "Balanced approach" },
  { value: 5, label: "5 Days", description: "Intermediate+" },
  { value: 6, label: "6 Days", description: "Advanced" },
];

const SPLIT_TYPES = [
  { id: "push_pull_legs", label: "Push/Pull/Legs", description: "Classic 3-way split" },
  { id: "upper_lower", label: "Upper/Lower", description: "Simple 2-way split" },
  { id: "full_body", label: "Full Body", description: "Each session targets all" },
  { id: "bro_split", label: "Body Part Split", description: "One muscle group per day" },
];

const BODY_PARTS = [
  { id: "chest", label: "Chest" },
  { id: "back", label: "Back" },
  { id: "shoulders", label: "Shoulders" },
  { id: "arms", label: "Arms" },
  { id: "legs", label: "Legs" },
  { id: "core", label: "Core" },
];

export function GenerateProgramModal({
  open,
  onOpenChange,
  onGenerate,
  isGenerating,
}: GenerateProgramModalProps) {
  const [step, setStep] = useState(1);
  const [preferences, setPreferences] = useState<ProgramPreferences>({
    programType: "",
    daysPerWeek: 4,
    durationWeeks: 4,
    splitType: "",
    targetBodyParts: [],
  });

  const totalSteps = 4;

  const handleNext = () => {
    if (step < totalSteps) {
      setStep(step + 1);
    } else {
      onGenerate(preferences);
    }
  };

  const handleBack = () => {
    if (step > 1) {
      setStep(step - 1);
    }
  };

  const toggleBodyPart = (partId: string) => {
    setPreferences((prev) => ({
      ...prev,
      targetBodyParts: prev.targetBodyParts.includes(partId)
        ? prev.targetBodyParts.filter((p) => p !== partId)
        : [...prev.targetBodyParts, partId],
    }));
  };

  const canProceed = () => {
    switch (step) {
      case 1:
        return preferences.programType !== "";
      case 2:
        return preferences.daysPerWeek > 0;
      case 3:
        return preferences.splitType !== "";
      case 4:
        return true; // Body parts are optional
      default:
        return false;
    }
  };

  const resetAndClose = () => {
    setStep(1);
    setPreferences({
      programType: "",
      daysPerWeek: 4,
      durationWeeks: 4,
      splitType: "",
      targetBodyParts: [],
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={resetAndClose}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5 text-primary" />
            Generate 4-Week Program
          </DialogTitle>
          <DialogDescription>
            Step {step} of {totalSteps}
          </DialogDescription>
        </DialogHeader>

        {/* Progress indicator */}
        <div className="flex gap-1 mb-4">
          {Array.from({ length: totalSteps }).map((_, i) => (
            <div
              key={i}
              className={cn(
                "h-1 flex-1 rounded-full transition-colors",
                i < step ? "bg-primary" : "bg-muted"
              )}
            />
          ))}
        </div>

        {/* Step 1: Program Type */}
        {step === 1 && (
          <div className="space-y-3">
            <h3 className="font-medium text-sm text-muted-foreground">
              What's your primary goal?
            </h3>
            <div className="grid grid-cols-2 gap-2">
              {PROGRAM_TYPES.map((type) => {
                const Icon = type.icon;
                const isSelected = preferences.programType === type.id;
                return (
                  <button
                    key={type.id}
                    onClick={() =>
                      setPreferences((prev) => ({ ...prev, programType: type.id }))
                    }
                    className={cn(
                      "flex flex-col items-start p-4 rounded-lg border transition-all text-left",
                      isSelected
                        ? "border-primary bg-primary/10"
                        : "border-border hover:border-primary/50"
                    )}
                  >
                    <Icon className={cn("h-6 w-6 mb-2", isSelected ? "text-primary" : "text-muted-foreground")} />
                    <span className="font-medium">{type.label}</span>
                    <span className="text-xs text-muted-foreground">{type.description}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Step 2: Days per Week */}
        {step === 2 && (
          <div className="space-y-3">
            <h3 className="font-medium text-sm text-muted-foreground">
              How many days can you train per week?
            </h3>
            <div className="grid grid-cols-2 gap-2">
              {DAYS_OPTIONS.map((option) => {
                const isSelected = preferences.daysPerWeek === option.value;
                return (
                  <button
                    key={option.value}
                    onClick={() =>
                      setPreferences((prev) => ({ ...prev, daysPerWeek: option.value }))
                    }
                    className={cn(
                      "flex flex-col items-center p-4 rounded-lg border transition-all",
                      isSelected
                        ? "border-primary bg-primary/10"
                        : "border-border hover:border-primary/50"
                    )}
                  >
                    <span className="text-2xl font-bold">{option.value}</span>
                    <span className="text-sm font-medium">{option.label}</span>
                    <span className="text-xs text-muted-foreground">{option.description}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Step 3: Split Type */}
        {step === 3 && (
          <div className="space-y-3">
            <h3 className="font-medium text-sm text-muted-foreground">
              Choose your training split
            </h3>
            <div className="space-y-2">
              {SPLIT_TYPES.map((split) => {
                const isSelected = preferences.splitType === split.id;
                return (
                  <button
                    key={split.id}
                    onClick={() =>
                      setPreferences((prev) => ({ ...prev, splitType: split.id }))
                    }
                    className={cn(
                      "w-full flex items-center justify-between p-4 rounded-lg border transition-all text-left",
                      isSelected
                        ? "border-primary bg-primary/10"
                        : "border-border hover:border-primary/50"
                    )}
                  >
                    <div>
                      <span className="font-medium">{split.label}</span>
                      <p className="text-sm text-muted-foreground">{split.description}</p>
                    </div>
                    {isSelected && (
                      <div className="h-4 w-4 rounded-full bg-primary" />
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Step 4: Focus Areas (Optional) */}
        {step === 4 && (
          <div className="space-y-3">
            <h3 className="font-medium text-sm text-muted-foreground">
              Any areas you want to emphasize? (Optional)
            </h3>
            <div className="flex flex-wrap gap-2">
              {BODY_PARTS.map((part) => {
                const isSelected = preferences.targetBodyParts.includes(part.id);
                return (
                  <Badge
                    key={part.id}
                    variant={isSelected ? "default" : "outline"}
                    className={cn(
                      "cursor-pointer py-2 px-4 text-sm transition-all",
                      isSelected ? "bg-primary hover:bg-primary/90" : "hover:border-primary"
                    )}
                    onClick={() => toggleBodyPart(part.id)}
                  >
                    {part.label}
                  </Badge>
                );
              })}
            </div>
            <p className="text-xs text-muted-foreground">
              {preferences.targetBodyParts.length > 0 
                ? `Emphasizing: ${preferences.targetBodyParts.join(", ")}`
                : "Leave empty for balanced training"}
            </p>
          </div>
        )}

        {/* Navigation buttons */}
        <div className="flex justify-between pt-4">
          <Button
            variant="ghost"
            onClick={handleBack}
            disabled={step === 1 || isGenerating}
          >
            <ChevronLeft className="h-4 w-4 mr-1" />
            Back
          </Button>
          <Button
            onClick={handleNext}
            disabled={!canProceed() || isGenerating}
          >
            {isGenerating ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Generating Program...
              </>
            ) : step === totalSteps ? (
              <>
                <Sparkles className="h-4 w-4 mr-2" />
                Generate Program
              </>
            ) : (
              <>
                Next
                <ChevronRight className="h-4 w-4 ml-1" />
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
