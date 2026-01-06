import { useQuery } from "@tanstack/react-query";
import { exerciseDBClient, ExerciseDBExercise, ExerciseDBFilters } from "@/lib/exercisedb";

/**
 * Hook to fetch all exercises from ExerciseDB
 */
export function useAllExercises() {
  return useQuery({
    queryKey: ["exercisedb", "all"],
    queryFn: () => exerciseDBClient.getAllExercises(),
    enabled: exerciseDBClient.isConfigured(),
    staleTime: 24 * 60 * 60 * 1000, // 24 hours
  });
}

/**
 * Hook to fetch exercise by ID
 */
export function useExerciseById(id: string | null) {
  return useQuery({
    queryKey: ["exercisedb", "exercise", id],
    queryFn: () => exerciseDBClient.getExerciseById(id!),
    enabled: !!id && exerciseDBClient.isConfigured(),
    staleTime: 24 * 60 * 60 * 1000,
  });
}

/**
 * Hook to fetch exercises by body part
 */
export function useExercisesByBodyPart(bodyPart: string | null) {
  return useQuery({
    queryKey: ["exercisedb", "bodyPart", bodyPart],
    queryFn: () => exerciseDBClient.getExercisesByBodyPart(bodyPart!),
    enabled: !!bodyPart && exerciseDBClient.isConfigured(),
    staleTime: 24 * 60 * 60 * 1000,
  });
}

/**
 * Hook to fetch exercises by target muscle
 */
export function useExercisesByTarget(target: string | null) {
  return useQuery({
    queryKey: ["exercisedb", "target", target],
    queryFn: () => exerciseDBClient.getExercisesByTarget(target!),
    enabled: !!target && exerciseDBClient.isConfigured(),
    staleTime: 24 * 60 * 60 * 1000,
  });
}

/**
 * Hook to fetch exercises by equipment type
 */
export function useExercisesByEquipment(equipment: string | null) {
  return useQuery({
    queryKey: ["exercisedb", "equipment", equipment],
    queryFn: () => exerciseDBClient.getExercisesByEquipment(equipment!),
    enabled: !!equipment && exerciseDBClient.isConfigured(),
    staleTime: 24 * 60 * 60 * 1000,
  });
}

/**
 * Hook to search exercises with filters
 */
export function useExercises(filters: ExerciseDBFilters, limit?: number) {
  return useQuery({
    queryKey: ["exercisedb", "search", filters, limit],
    queryFn: () => exerciseDBClient.searchExercises(filters, limit),
    enabled: exerciseDBClient.isConfigured(),
    staleTime: 24 * 60 * 60 * 1000,
  });
}

/**
 * Hook to get relevant exercises based on user's equipment and goals
 */
export function useRelevantExercises(options: {
  equipment?: string[];
  targetMuscles?: string[];
  bodyParts?: string[];
  limit?: number;
}) {
  return useQuery({
    queryKey: ["exercisedb", "relevant", options],
    queryFn: () => exerciseDBClient.getRelevantExercises(options),
    enabled: exerciseDBClient.isConfigured() && (
      (options.equipment && options.equipment.length > 0) ||
      (options.targetMuscles && options.targetMuscles.length > 0) ||
      (options.bodyParts && options.bodyParts.length > 0)
    ),
    staleTime: 24 * 60 * 60 * 1000,
  });
}

/**
 * Hook to get list of all body parts
 */
export function useBodyParts() {
  return useQuery({
    queryKey: ["exercisedb", "bodyParts"],
    queryFn: () => exerciseDBClient.getBodyParts(),
    enabled: exerciseDBClient.isConfigured(),
    staleTime: 24 * 60 * 60 * 1000,
  });
}

/**
 * Hook to get list of all target muscles
 */
export function useTargetMuscles() {
  return useQuery({
    queryKey: ["exercisedb", "targets"],
    queryFn: () => exerciseDBClient.getTargetMuscles(),
    enabled: exerciseDBClient.isConfigured(),
    staleTime: 24 * 60 * 60 * 1000,
  });
}

/**
 * Hook to get list of all equipment types
 */
export function useEquipmentTypes() {
  return useQuery({
    queryKey: ["exercisedb", "equipment"],
    queryFn: () => exerciseDBClient.getEquipmentTypes(),
    enabled: exerciseDBClient.isConfigured(),
    staleTime: 24 * 60 * 60 * 1000,
  });
}

// Export types
export type { ExerciseDBExercise, ExerciseDBFilters };

