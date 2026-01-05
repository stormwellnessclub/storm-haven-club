import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { MemberLayout } from "@/components/member/MemberLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { useFitnessProfile, useCreateFitnessProfile, useUpdateFitnessProfile } from "@/hooks/useFitnessProfile";
import { useAllEquipment } from "@/hooks/useEquipment";
import { Activity, Save, Loader2, AlertCircle } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { cn } from "@/lib/utils";

const FITNESS_LEVELS = [
  { value: "beginner", label: "Beginner" },
  { value: "intermediate", label: "Intermediate" },
  { value: "advanced", label: "Advanced" },
];

const PRIMARY_GOALS = [
  "Weight Loss",
  "Muscle Gain",
  "Endurance",
  "Flexibility",
  "Strength",
  "General Fitness",
  "Athletic Performance",
  "Rehabilitation",
  "Stress Relief",
  "Other",
];

const SECONDARY_GOAL_OPTIONS = [
  "Weight Loss",
  "Muscle Gain",
  "Cardio Fitness",
  "Strength",
  "Flexibility",
  "Balance",
  "Mobility",
  "Power",
  "Rehabilitation",
  "Athletic Performance",
];

const fitnessProfileSchema = z.object({
  fitness_level: z.enum(["beginner", "intermediate", "advanced"]).optional().nullable(),
  primary_goal: z.string().optional().nullable(),
  secondary_goals: z.array(z.string()).default([]),
  available_equipment: z.array(z.string()).default([]), // Keep for backward compatibility
  equipment_ids: z.array(z.string().uuid()).default([]), // New: equipment IDs
  available_time_minutes: z.number().min(10).max(300).default(30),
  workout_preferences: z.object({
    frequency: z.string().optional(),
    preferred_times: z.array(z.string()).optional(),
    intensity: z.string().optional(),
  }).optional(),
  injuries_limitations: z.array(z.string()).default([]),
});

type FitnessProfileFormData = z.infer<typeof fitnessProfileSchema>;

export default function FitnessProfile() {
  const { data: profile, isLoading } = useFitnessProfile();
  const { data: allEquipment, isLoading: equipmentLoading } = useAllEquipment();
  const createProfile = useCreateFitnessProfile();
  const updateProfile = useUpdateFitnessProfile();

  const form = useForm<FitnessProfileFormData>({
    resolver: zodResolver(fitnessProfileSchema),
    defaultValues: {
      fitness_level: null,
      primary_goal: "",
      secondary_goals: [],
      available_equipment: [],
      available_time_minutes: 30,
      workout_preferences: {
        frequency: "",
        preferred_times: [],
        intensity: "",
      },
      injuries_limitations: [],
    },
  });

  const [injuriesInput, setInjuriesInput] = useState("");

  useEffect(() => {
    if (profile) {
      form.reset({
        fitness_level: profile.fitness_level || null,
        primary_goal: profile.primary_goal || "",
        secondary_goals: profile.secondary_goals || [],
        available_equipment: profile.available_equipment || [],
        equipment_ids: (profile as any).equipment_ids || [],
        available_time_minutes: profile.available_time_minutes || 30,
        workout_preferences: profile.workout_preferences || {
          frequency: "",
          preferred_times: [],
          intensity: "",
        },
        injuries_limitations: profile.injuries_limitations || [],
      });
      setInjuriesInput(profile.injuries_limitations?.join(", ") || "");
    }
  }, [profile, form]);

  const onSubmit = async (data: FitnessProfileFormData) => {
    try {
      // Convert equipment_ids to array of UUIDs if needed
      const submitData = {
        ...data,
        equipment_ids: data.equipment_ids || [],
      };
      
      if (profile) {
        await updateProfile.mutateAsync({ data: submitData });
      } else {
        await createProfile.mutateAsync(submitData);
      }
    } catch (error) {
      // Error handled by hook
    }
  };

  const handleInjuriesChange = (value: string) => {
    setInjuriesInput(value);
    const injuries = value
      .split(",")
      .map((item) => item.trim())
      .filter((item) => item.length > 0);
    form.setValue("injuries_limitations", injuries);
  };

  const toggleArrayItem = (field: "secondary_goals" | "available_equipment" | "equipment_ids", value: string) => {
    const current = form.getValues(field) || [];
    const updated = current.includes(value)
      ? current.filter((item) => item !== value)
      : [...current, value];
    form.setValue(field, updated);
  };

  if (isLoading) {
    return (
      <MemberLayout title="Fitness Profile">
        <div className="space-y-6">
          <Skeleton className="h-64 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      </MemberLayout>
    );
  }

  const isUpdating = createProfile.isPending || updateProfile.isPending;

  return (
    <MemberLayout title="Fitness Profile">
      <div className="max-w-4xl space-y-6">
        {/* Header */}
        <div>
          <h2 className="heading-section flex items-center gap-2">
            <Activity className="h-6 w-6" />
            Fitness Profile
          </h2>
          <p className="text-muted-foreground mt-1">
            Set up your fitness profile to get personalized AI workout recommendations
          </p>
        </div>

        {!profile && (
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Profile Required</AlertTitle>
            <AlertDescription>
              Create your fitness profile to unlock AI-powered workout generation and personalized recommendations.
            </AlertDescription>
          </Alert>
        )}

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            {/* Fitness Level */}
            <Card>
              <CardHeader>
                <CardTitle>Fitness Level</CardTitle>
                <CardDescription>
                  Select your current fitness level to help us tailor workouts to your abilities
                </CardDescription>
              </CardHeader>
              <CardContent>
                <FormField
                  control={form.control}
                  name="fitness_level"
                  render={({ field }) => (
                    <FormItem>
                      <FormControl>
                        <RadioGroup
                          value={field.value || ""}
                          onValueChange={(value) => field.onChange(value || null)}
                          className="grid grid-cols-1 md:grid-cols-3 gap-4"
                        >
                          {FITNESS_LEVELS.map((level) => (
                            <div key={level.value} className="flex items-center space-x-2">
                              <RadioGroupItem value={level.value} id={level.value} />
                              <Label htmlFor={level.value} className="cursor-pointer font-normal">
                                {level.label}
                              </Label>
                            </div>
                          ))}
                        </RadioGroup>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </CardContent>
            </Card>

            {/* Goals */}
            <Card>
              <CardHeader>
                <CardTitle>Goals</CardTitle>
                <CardDescription>
                  Tell us what you want to achieve with your fitness journey
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <FormField
                  control={form.control}
                  name="primary_goal"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Primary Goal</FormLabel>
                      <Select value={field.value || ""} onValueChange={field.onChange}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select your primary goal" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {PRIMARY_GOALS.map((goal) => (
                            <SelectItem key={goal} value={goal}>
                              {goal}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormDescription>
                        Your main fitness objective
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div>
                  <Label className="text-base">Secondary Goals</Label>
                  <FormDescription className="mb-3">
                    Select all that apply (optional)
                  </FormDescription>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    {SECONDARY_GOAL_OPTIONS.map((goal) => {
                      const checked = form.watch("secondary_goals")?.includes(goal) || false;
                      return (
                        <div key={goal} className="flex items-center space-x-2">
                          <Checkbox
                            id={`secondary-${goal}`}
                            checked={checked}
                            onCheckedChange={() => toggleArrayItem("secondary_goals", goal)}
                          />
                          <Label htmlFor={`secondary-${goal}`} className="cursor-pointer font-normal text-sm">
                            {goal}
                          </Label>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Equipment & Time */}
            <Card>
              <CardHeader>
                <CardTitle>Equipment & Time</CardTitle>
                <CardDescription>
                  What equipment do you have access to and how much time can you dedicate?
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div>
                  <Label className="text-base">Available Equipment</Label>
                  <FormDescription className="mb-3">
                    Select all equipment you have access to. Images help identify equipment.
                  </FormDescription>
                  {equipmentLoading ? (
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 mt-4">
                      {[1, 2, 3, 4, 5, 6].map((i) => (
                        <Skeleton key={i} className="h-24 w-full" />
                      ))}
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 mt-4">
                      {allEquipment?.map((equipment) => {
                        const checked = form.watch("equipment_ids")?.includes(equipment.id) || false;
                        return (
                          <div
                            key={equipment.id}
                            className={cn(
                              "relative border-2 rounded-lg p-3 cursor-pointer transition-all",
                              checked
                                ? "border-accent bg-accent/10"
                                : "border-border hover:border-accent/50"
                            )}
                            onClick={() => toggleArrayItem("equipment_ids", equipment.id)}
                          >
                            {equipment.image_url && (
                              <div className="aspect-square mb-2 rounded overflow-hidden bg-muted">
                                <img
                                  src={equipment.image_url}
                                  alt={equipment.name}
                                  className="w-full h-full object-cover"
                                />
                              </div>
                            )}
                            <div className="flex items-center space-x-2">
                              <Checkbox
                                id={`equipment-${equipment.id}`}
                                checked={checked}
                                onCheckedChange={() => toggleArrayItem("equipment_ids", equipment.id)}
                              />
                              <Label
                                htmlFor={`equipment-${equipment.id}`}
                                className="cursor-pointer font-normal text-sm flex-1"
                              >
                                {equipment.name}
                              </Label>
                            </div>
                            {equipment.description && (
                              <p className="text-xs text-muted-foreground mt-1">{equipment.description}</p>
                            )}
                          </div>
                        );
                      })}
                      {(!allEquipment || allEquipment.length === 0) && (
                        <p className="text-sm text-muted-foreground col-span-full">
                          No equipment available. Please contact support.
                        </p>
                      )}
                    </div>
                  )}
                </div>

                <FormField
                  control={form.control}
                  name="available_time_minutes"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Available Time (minutes per session)</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min="10"
                          max="300"
                          value={field.value}
                          onChange={(e) => field.onChange(parseInt(e.target.value) || 30)}
                        />
                      </FormControl>
                      <FormDescription>
                        How many minutes can you typically dedicate to a single workout session?
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </CardContent>
            </Card>

            {/* Workout Preferences */}
            <Card>
              <CardHeader>
                <CardTitle>Workout Preferences</CardTitle>
                <CardDescription>
                  Help us understand your workout preferences
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <FormField
                  control={form.control}
                  name="workout_preferences.frequency"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Workout Frequency</FormLabel>
                      <Select
                        value={field.value || ""}
                        onValueChange={(value) =>
                          form.setValue("workout_preferences", {
                            ...form.getValues("workout_preferences"),
                            frequency: value,
                          })
                        }
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select frequency" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="daily">Daily</SelectItem>
                          <SelectItem value="5-6_per_week">5-6 times per week</SelectItem>
                          <SelectItem value="3-4_per_week">3-4 times per week</SelectItem>
                          <SelectItem value="1-2_per_week">1-2 times per week</SelectItem>
                          <SelectItem value="occasional">Occasional</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="workout_preferences.intensity"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Preferred Intensity</FormLabel>
                      <Select
                        value={field.value || ""}
                        onValueChange={(value) =>
                          form.setValue("workout_preferences", {
                            ...form.getValues("workout_preferences"),
                            intensity: value,
                          })
                        }
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select intensity" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="low">Low</SelectItem>
                          <SelectItem value="moderate">Moderate</SelectItem>
                          <SelectItem value="high">High</SelectItem>
                          <SelectItem value="very_high">Very High</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </CardContent>
            </Card>

            {/* Injuries & Limitations */}
            <Card>
              <CardHeader>
                <CardTitle>Injuries & Limitations</CardTitle>
                <CardDescription>
                  Important: List any injuries, medical conditions, or physical limitations we should be aware of
                </CardDescription>
              </CardHeader>
              <CardContent>
                <FormField
                  control={form.control}
                  name="injuries_limitations"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Injuries, Limitations, or Restrictions</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="e.g., Lower back pain, Knee injury, Shoulder mobility issues (separate with commas)"
                          value={injuriesInput}
                          onChange={(e) => handleInjuriesChange(e.target.value)}
                          rows={3}
                        />
                      </FormControl>
                      <FormDescription>
                        Separate multiple items with commas. This helps us customize workouts for your safety.
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </CardContent>
            </Card>

            {/* Submit Button */}
            <div className="flex justify-end gap-4">
              <Button
                type="submit"
                disabled={isUpdating}
                size="lg"
              >
                {isUpdating ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4 mr-2" />
                    {profile ? "Update Profile" : "Create Profile"}
                  </>
                )}
              </Button>
            </div>
          </form>
        </Form>
      </div>
    </MemberLayout>
  );
}

