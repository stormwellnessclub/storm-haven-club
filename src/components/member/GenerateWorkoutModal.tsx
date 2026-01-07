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
import { Slider } from "@/components/ui/slider";
import { cn } from "@/lib/utils";
import {
  Dumbbell,
  Heart,
  Zap,
  Activity,
  Target,
  Timer,
  Flame,
  ChevronRight,
  ChevronLeft,
  Sparkles,
} from "lucide-react";

interface GenerateWorkoutModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onGenerate: (preferences: WorkoutPreferences) => void;
  isGenerating: boolean;
}

export interface WorkoutPreferences {
  workoutType: string;
  targetBodyParts: string[];
  duration: number;
  intensity: string;
}

const WORKOUT_TYPES = [
  { id: "strength", label: "Strength Training", icon: Dumbbell, description: "Build muscle and power" },
  { id: "cardio", label: "Cardio", icon: Heart, description: "Improve endurance" },
  { id: "hiit", label: "HIIT", icon: Zap, description: "High-intensity intervals" },
  { id: "full_body", label: "Full Body", icon: Activity, description: "Complete workout" },
  { id: "upper_body", label: "Upper Body", icon: Target, description: "Chest, back, arms" },
  { id: "lower_body", label: "Lower Body", icon: Target, description: "Legs and glutes" },
  { id: "core", label: "Core & Abs", icon: Flame, description: "Strengthen your core" },
  { id: "flexibility", label: "Flexibility", icon: Activity, description: "Mobility and stretching" },
];

const BODY_PARTS = [
  { id: "chest", label: "Chest" },
  { id: "back", label: "Back" },
  { id: "shoulders", label: "Shoulders" },
  { id: "biceps", label: "Biceps" },
  { id: "triceps", label: "Triceps" },
  { id: "legs", label: "Legs" },
  { id: "glutes", label: "Glutes" },
  { id: "core", label: "Core" },
  { id: "full_body", label: "Full Body" },
];

const INTENSITY_LEVELS = [
  { id: "light", label: "Light", description: "Easy pace, recovery focus" },
  { id: "moderate", label: "Moderate", description: "Challenging but sustainable" },
  { id: "intense", label: "Intense", description: "Push your limits" },
];

const LOADING_MESSAGES = [
  "Designing your personalized workout...",
  "Selecting the perfect exercises...",
  "Calculating optimal sets and reps...",
  "Tailoring to your fitness level...",
  "Almost there! Finalizing your workout...",
];

export function GenerateWorkoutModal({
  open,
  onOpenChange,
  onGenerate,
  isGenerating,
}: GenerateWorkoutModalProps) {
  const [step, setStep] = useState(1);
  const [preferences, setPreferences] = useState<WorkoutPreferences>({
    workoutType: "",
    targetBodyParts: [],
    duration: 35,
    intensity: "moderate",
  });
  const [loadingMessageIndex, setLoadingMessageIndex] = useState(0);

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
        return preferences.workoutType !== "";
      case 2:
        return preferences.targetBodyParts.length > 0;
      case 3:
        return preferences.duration > 0;
      case 4:
        return preferences.intensity !== "";
      default:
        return false;
    }
  };

  const resetAndClose = () => {
    setStep(1);
    setPreferences({
      workoutType: "",
      targetBodyParts: [],
      duration: 35,
      intensity: "moderate",
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={resetAndClose}>
      <DialogContent className="sm:max-w-lg">
        {isGenerating ? (
          <div className="flex flex-col items-center justify-center py-16 px-4">
            <div className="relative mb-6">
              <div className="absolute inset-0 animate-ping">
                <Sparkles className="h-16 w-16 text-primary/30" />
              </div>
              <Sparkles className="h-16 w-16 text-primary animate-pulse" />
            </div>
            <h3 className="text-xl font-semibold text-center mb-2">
              Creating Your Workout
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
              This may take a few seconds
            </p>
          </div>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-primary" />
                Generate Custom Workout
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

            {/* Step 1: Workout Type */}
            {step === 1 && (
              <div className="space-y-3">
                <h3 className="font-medium text-sm text-muted-foreground">
                  What type of workout do you want?
                </h3>
                <div className="grid grid-cols-2 gap-2">
                  {WORKOUT_TYPES.map((type) => {
                    const Icon = type.icon;
                    const isSelected = preferences.workoutType === type.id;
                    return (
                      <button
                        key={type.id}
                        onClick={() =>
                          setPreferences((prev) => ({ ...prev, workoutType: type.id }))
                        }
                        className={cn(
                          "flex flex-col items-start p-3 rounded-lg border transition-all text-left",
                          isSelected
                            ? "border-primary bg-primary/10"
                            : "border-border hover:border-primary/50"
                        )}
                      >
                        <Icon className={cn("h-5 w-5 mb-1", isSelected ? "text-primary" : "text-muted-foreground")} />
                        <span className="font-medium text-sm">{type.label}</span>
                        <span className="text-xs text-muted-foreground">{type.description}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Step 2: Target Body Parts */}
            {step === 2 && (
              <div className="space-y-3">
                <h3 className="font-medium text-sm text-muted-foreground">
                  Which body parts do you want to target?
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
                {preferences.targetBodyParts.length > 0 && (
                  <p className="text-xs text-muted-foreground">
                    Selected: {preferences.targetBodyParts.length} body part(s)
                  </p>
                )}
              </div>
            )}

            {/* Step 3: Duration */}
            {step === 3 && (
              <div className="space-y-6">
                <h3 className="font-medium text-sm text-muted-foreground">
                  How long do you want to workout?
                </h3>
                <div className="space-y-4">
                  <div className="flex items-center justify-center">
                    <Timer className="h-8 w-8 text-primary mr-3" />
                    <span className="text-4xl font-bold">{preferences.duration}</span>
                    <span className="text-lg text-muted-foreground ml-2">minutes</span>
                  </div>
                  <Slider
                    value={[preferences.duration]}
                    onValueChange={(value) =>
                      setPreferences((prev) => ({ ...prev, duration: value[0] }))
                    }
                    min={15}
                    max={90}
                    step={5}
                    className="w-full"
                  />
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>15 min</span>
                    <span>90 min</span>
                  </div>
                </div>
                <div className="flex gap-2 justify-center">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPreferences((prev) => ({ ...prev, duration: 20 }))}
                  >
                    Quick (20)
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPreferences((prev) => ({ ...prev, duration: 35 }))}
                  >
                    Standard (35)
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPreferences((prev) => ({ ...prev, duration: 60 }))}
                  >
                    Extended (60)
                  </Button>
                </div>
              </div>
            )}

            {/* Step 4: Intensity */}
            {step === 4 && (
              <div className="space-y-3">
                <h3 className="font-medium text-sm text-muted-foreground">
                  What intensity level?
                </h3>
                <div className="space-y-2">
                  {INTENSITY_LEVELS.map((level) => {
                    const isSelected = preferences.intensity === level.id;
                    return (
                      <button
                        key={level.id}
                        onClick={() =>
                          setPreferences((prev) => ({ ...prev, intensity: level.id }))
                        }
                        className={cn(
                          "w-full flex items-center justify-between p-4 rounded-lg border transition-all",
                          isSelected
                            ? "border-primary bg-primary/10"
                            : "border-border hover:border-primary/50"
                        )}
                      >
                        <div className="text-left">
                          <span className="font-medium">{level.label}</span>
                          <p className="text-sm text-muted-foreground">{level.description}</p>
                        </div>
                        <div className="flex gap-1">
                          {[1, 2, 3].map((dot) => (
                            <div
                              key={dot}
                              className={cn(
                                "w-2 h-2 rounded-full",
                                dot <= (level.id === "light" ? 1 : level.id === "moderate" ? 2 : 3)
                                  ? "bg-primary"
                                  : "bg-muted"
                              )}
                            />
                          ))}
                        </div>
                      </button>
                    );
                  })}
                </div>
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
                    Generate Workout
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
