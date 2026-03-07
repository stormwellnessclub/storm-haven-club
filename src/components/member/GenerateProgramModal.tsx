import { useState, useEffect } from "react";
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
  customSplit?: { day: number; muscles: string[] }[];
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
  { id: "custom", label: "Custom Split", description: "Pick muscles for each day yourself" },
];

const MUSCLE_GROUPS = [
  { id: "glutes", label: "Glutes" },
  { id: "quads", label: "Quads" },
  { id: "hamstrings", label: "Hamstrings" },
  { id: "calves", label: "Calves" },
  { id: "back", label: "Back" },
  { id: "chest", label: "Chest" },
  { id: "shoulders", label: "Shoulders" },
  { id: "arms", label: "Arms" },
  { id: "core", label: "Core/Abs" },
];

const BODY_PARTS = [
  { id: "chest", label: "Chest" },
  { id: "back", label: "Back" },
  { id: "shoulders", label: "Shoulders" },
  { id: "arms", label: "Arms" },
  { id: "legs", label: "Legs" },
  { id: "glutes", label: "Glutes" },
  { id: "core", label: "Core" },
];

const LOADING_MESSAGES = [
  "Designing your personalized program...",
  "Analyzing your goals and preferences...",
  "Selecting the perfect exercises for you...",
  "Crafting your path to success...",
  "Building progressive overload patterns...",
  "Almost there! Putting the finishing touches...",
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
    customSplit: [],
  });
  const [loadingMessageIndex, setLoadingMessageIndex] = useState(0);

  const isCustomSplit = preferences.splitType === "custom" || preferences.splitType === "bro_split";

  // Initialize customSplit when daysPerWeek or splitType changes
  useEffect(() => {
    if (isCustomSplit) {
      setPreferences((prev) => ({
        ...prev,
        customSplit: Array.from({ length: prev.daysPerWeek }, (_, i) => ({
          day: i + 1,
          muscles: prev.customSplit?.[i]?.muscles || [],
        })),
      }));
    }
  }, [preferences.daysPerWeek, isCustomSplit]);

  // Cycle through loading messages
  useEffect(() => {
    if (!isGenerating) {
      setLoadingMessageIndex(0);
      return;
    }
    const interval = setInterval(() => {
      setLoadingMessageIndex((prev) => (prev + 1) % LOADING_MESSAGES.length);
    }, 2500);
    return () => clearInterval(interval);
  }, [isGenerating]);

  // Dynamic steps: 1-Type, 2-Days, 3-Split, 4-CustomSplit or Emphasis
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

  const toggleMuscleForDay = (dayIndex: number, muscleId: string) => {
    setPreferences((prev) => {
      const newSplit = [...(prev.customSplit || [])];
      const dayEntry = newSplit[dayIndex] || { day: dayIndex + 1, muscles: [] };
      const muscles = dayEntry.muscles.includes(muscleId)
        ? dayEntry.muscles.filter((m) => m !== muscleId)
        : [...dayEntry.muscles, muscleId];
      newSplit[dayIndex] = { ...dayEntry, muscles };
      return { ...prev, customSplit: newSplit };
    });
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
        if (isCustomSplit) {
          // At least one muscle assigned to each day
          return (preferences.customSplit || []).every((d) => d.muscles.length > 0);
        }
        return true; // Body parts are optional for predefined splits
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
      customSplit: [],
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={resetAndClose}>
      <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
        {isGenerating ? (
          <div className="flex flex-col items-center justify-center py-16 px-4">
            <div className="relative mb-6">
              <div className="absolute inset-0 animate-ping">
                <Sparkles className="h-16 w-16 text-primary/30" />
              </div>
              <Sparkles className="h-16 w-16 text-primary animate-pulse" />
            </div>
            <h3 className="text-xl font-semibold text-center mb-2">
              Creating Your Program
            </h3>
            <p className="text-muted-foreground text-center animate-pulse min-h-[24px]">
              {LOADING_MESSAGES[loadingMessageIndex]}
            </p>
            <div className="flex gap-1.5 mt-6">
              {[0, 1, 2].map((i) => (
                <div
                  key={i}
                  className="w-2 h-2 rounded-full bg-primary animate-bounce"
                  style={{ animationDelay: `${i * 0.15}s` }}
                />
              ))}
            </div>
            <p className="text-xs text-muted-foreground mt-6">
              This may take up to 30 seconds
            </p>
          </div>
        ) : (
          <>
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

            {/* Step 4: Custom Split OR Emphasis */}
            {step === 4 && isCustomSplit && (
              <div className="space-y-4">
                <h3 className="font-medium text-sm text-muted-foreground">
                  Assign muscle groups to each training day
                </h3>
                <div className="space-y-3">
                  {(preferences.customSplit || []).map((dayEntry, dayIndex) => (
                    <div key={dayIndex} className="rounded-lg border border-border p-3">
                      <p className="text-sm font-semibold mb-2">Day {dayEntry.day}</p>
                      <div className="flex flex-wrap gap-1.5">
                        {MUSCLE_GROUPS.map((muscle) => {
                          const isSelected = dayEntry.muscles.includes(muscle.id);
                          return (
                            <Badge
                              key={muscle.id}
                              variant={isSelected ? "default" : "outline"}
                              className={cn(
                                "cursor-pointer py-1 px-2.5 text-xs transition-all",
                                isSelected ? "bg-primary hover:bg-primary/90" : "hover:border-primary"
                              )}
                              onClick={() => toggleMuscleForDay(dayIndex, muscle.id)}
                            >
                              {muscle.label}
                            </Badge>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
                <div className="bg-muted/50 rounded-lg p-3">
                  <p className="text-xs font-medium text-muted-foreground mb-1">Your Split</p>
                  {(preferences.customSplit || []).map((d) => (
                    <p key={d.day} className="text-xs text-foreground">
                      <span className="font-medium">Day {d.day}:</span>{" "}
                      {d.muscles.length > 0
                        ? d.muscles.map(m => MUSCLE_GROUPS.find(mg => mg.id === m)?.label || m).join(", ")
                        : <span className="text-muted-foreground italic">Pick muscles above</span>}
                    </p>
                  ))}
                </div>
              </div>
            )}

            {step === 4 && !isCustomSplit && (
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
                disabled={step === 1}
              >
                <ChevronLeft className="h-4 w-4 mr-1" />
                Back
              </Button>
              <Button
                onClick={handleNext}
                disabled={!canProceed()}
              >
                {step === totalSteps ? (
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
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
