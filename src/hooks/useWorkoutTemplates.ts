import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

export interface WorkoutExercise {
  exerciseId: string;
  name: string;
  bodyPart: string;
  equipment: string;
  sets: number;
  reps: number;
  weight?: number;
  rest: number; // seconds
}

export interface WorkoutTemplate {
  id: string;
  member_id: string;
  user_id: string;
  template_name: string;
  workout_type: string | null;
  exercises: WorkoutExercise[];
  estimated_duration_minutes: number | null;
  notes: string | null;
  is_favorite: boolean;
  times_used: number;
  created_at: string;
  updated_at: string;
}

export interface CreateTemplateData {
  template_name: string;
  workout_type?: string;
  exercises: WorkoutExercise[];
  estimated_duration_minutes?: number;
  notes?: string;
}

export function useWorkoutTemplates() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["workout-templates", user?.id],
    queryFn: async (): Promise<WorkoutTemplate[]> => {
      if (!user) return [];
      const { data, error } = await (supabase
        .from("workout_templates" as any)
        .select("*")
        .eq("user_id", user.id)
        .order("updated_at", { ascending: false }) as any);
      if (error) throw error;
      return (data || []).map((t: any) => ({
        ...t,
        exercises: t.exercises || [],
      })) as WorkoutTemplate[];
    },
    enabled: !!user,
  });
}

export function useCreateTemplate() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: CreateTemplateData) => {
      if (!user) throw new Error("You must be signed in");
      const { data: member } = await supabase
        .from("members")
        .select("id")
        .eq("user_id", user.id)
        .maybeSingle();
      if (!member) throw new Error("Member not found");

      const { data: template, error } = await (supabase
        .from("workout_templates" as any)
        .insert({
          member_id: member.id,
          user_id: user.id,
          template_name: data.template_name,
          workout_type: data.workout_type || null,
          exercises: data.exercises as any,
          estimated_duration_minutes: data.estimated_duration_minutes || null,
          notes: data.notes || null,
        } as any)
        .select()
        .single() as any);
      if (error) throw error;
      return template;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["workout-templates"] });
      toast.success("Workout template saved");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to save template");
    },
  });
}

export function useUpdateTemplate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<CreateTemplateData> }) => {
      const updateData: any = {};
      if (data.template_name !== undefined) updateData.template_name = data.template_name;
      if (data.workout_type !== undefined) updateData.workout_type = data.workout_type;
      if (data.exercises !== undefined) updateData.exercises = data.exercises;
      if (data.estimated_duration_minutes !== undefined) updateData.estimated_duration_minutes = data.estimated_duration_minutes;
      if (data.notes !== undefined) updateData.notes = data.notes;

      const { data: template, error } = await (supabase
        .from("workout_templates" as any)
        .update(updateData)
        .eq("id", id)
        .select()
        .single() as any);
      if (error) throw error;
      return template;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["workout-templates"] });
      toast.success("Template updated");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to update template");
    },
  });
}

export function useDeleteTemplate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase
        .from("workout_templates" as any)
        .delete()
        .eq("id", id) as any);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["workout-templates"] });
      toast.success("Template deleted");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to delete template");
    },
  });
}

export function useLogFromTemplate() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (template: WorkoutTemplate) => {
      if (!user) throw new Error("You must be signed in");
      const { data: member } = await supabase
        .from("members")
        .select("id")
        .eq("user_id", user.id)
        .maybeSingle();
      if (!member) throw new Error("Member not found");

      // Create workout log with exercises
      const { error: logError } = await (supabase
        .from("workout_logs" as any)
        .insert({
          member_id: member.id,
          user_id: user.id,
          workout_type: template.workout_type || template.template_name,
          duration_minutes: template.estimated_duration_minutes,
          notes: `From template: ${template.template_name}`,
          logged_at: new Date().toISOString(),
          exercises: template.exercises as any,
        } as any) as any);
      if (logError) throw logError;

      // Increment times_used
      await (supabase
        .from("workout_templates" as any)
        .update({ times_used: template.times_used + 1 } as any)
        .eq("id", template.id) as any);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["workout-logs"] });
      queryClient.invalidateQueries({ queryKey: ["workout-templates"] });
      queryClient.invalidateQueries({ queryKey: ["member-activities"] });
      toast.success("Workout logged from template");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to log workout");
    },
  });
}
