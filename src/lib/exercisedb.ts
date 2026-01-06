/**
 * ExerciseDB API Client
 * 
 * This client provides integration with ExerciseDB API via RapidAPI.
 * ExerciseDB provides access to 11,000+ structured exercises with equipment,
 * muscle groups, instructions, and images.
 * 
 * Setup Requirements:
 * 1. Obtain RapidAPI key from https://rapidapi.com/justin-WFnsXH_t6/api/exercisedb
 * 2. Configure environment variable:
 *    - EXERCISEDB_API_KEY (or RAPIDAPI_KEY)
 * 
 * API Documentation: https://edb-docs.up.railway.app
 */

interface ExerciseDBExercise {
  bodyPart: string;
  equipment: string;
  gifUrl: string;
  id: string;
  name: string;
  target: string;
  secondaryMuscles?: string[];
  instructions?: string[];
}

interface ExerciseDBFilters {
  bodyPart?: string;
  target?: string;
  equipment?: string;
}

class ExerciseDBClient {
  private apiKey: string | null;
  private baseUrl: string = "https://exercisedb.p.rapidapi.com";
  private cache: Map<string, { data: any; timestamp: number }> = new Map();
  private cacheTTL: number = 24 * 60 * 60 * 1000; // 24 hours

  constructor() {
    // Try both environment variable names
    this.apiKey = 
      Deno.env.get("EXERCISEDB_API_KEY") || 
      Deno.env.get("RAPIDAPI_KEY") ||
      (typeof window !== "undefined" ? 
        (import.meta.env?.VITE_EXERCISEDB_API_KEY || import.meta.env?.VITE_RAPIDAPI_KEY) : 
        null
      );
  }

  /**
   * Check if ExerciseDB API is configured
   */
  isConfigured(): boolean {
    return !!this.apiKey;
  }

  /**
   * Get cached data if still valid
   */
  private getCached(key: string): any | null {
    const cached = this.cache.get(key);
    if (!cached) return null;
    
    const now = Date.now();
    if (now - cached.timestamp > this.cacheTTL) {
      this.cache.delete(key);
      return null;
    }
    
    return cached.data;
  }

  /**
   * Set cache data
   */
  private setCache(key: string, data: any): void {
    this.cache.set(key, { data, timestamp: Date.now() });
  }

  /**
   * Make API request with error handling
   */
  private async request<T>(endpoint: string, cacheKey?: string): Promise<T> {
    if (!this.apiKey) {
      console.warn("ExerciseDB API key not configured. Returning empty result.");
      return [] as unknown as T;
    }

    // Check cache if cacheKey provided
    if (cacheKey) {
      const cached = this.getCached(cacheKey);
      if (cached) return cached as T;
    }

    try {
      const response = await fetch(`${this.baseUrl}${endpoint}`, {
        method: "GET",
        headers: {
          "X-RapidAPI-Key": this.apiKey,
          "X-RapidAPI-Host": "exercisedb.p.rapidapi.com",
        },
      });

      if (!response.ok) {
        if (response.status === 429) {
          console.warn("ExerciseDB API rate limit exceeded. Using cache if available.");
          if (cacheKey) {
            const cached = this.getCached(cacheKey);
            if (cached) return cached as T;
          }
        }
        throw new Error(`ExerciseDB API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      
      // Cache the response
      if (cacheKey) {
        this.setCache(cacheKey, data);
      }

      return data as T;
    } catch (error) {
      console.error("Error fetching from ExerciseDB API:", error);
      
      // Return cached data if available on error
      if (cacheKey) {
        const cached = this.getCached(cacheKey);
        if (cached) {
          console.log("Returning cached data due to error");
          return cached as T;
        }
      }
      
      return [] as unknown as T;
    }
  }

  /**
   * Get all exercises
   */
  async getAllExercises(): Promise<ExerciseDBExercise[]> {
    return this.request<ExerciseDBExercise[]>("/exercises", "all_exercises");
  }

  /**
   * Get exercise by ID
   */
  async getExerciseById(id: string): Promise<ExerciseDBExercise | null> {
    try {
      const exercises = await this.request<ExerciseDBExercise[]>(`/exercises/exercise/${id}`, `exercise_${id}`);
      return exercises && exercises.length > 0 ? exercises[0] : null;
    } catch (error) {
      console.error(`Error fetching exercise ${id}:`, error);
      return null;
    }
  }

  /**
   * Get exercises by body part
   */
  async getExercisesByBodyPart(bodyPart: string): Promise<ExerciseDBExercise[]> {
    const normalizedBodyPart = bodyPart.toLowerCase().replace(/\s+/g, "");
    return this.request<ExerciseDBExercise[]>(
      `/exercises/bodyPart/${normalizedBodyPart}`,
      `bodyPart_${normalizedBodyPart}`
    );
  }

  /**
   * Get exercises by target muscle
   */
  async getExercisesByTarget(target: string): Promise<ExerciseDBExercise[]> {
    const normalizedTarget = target.toLowerCase().replace(/\s+/g, "");
    return this.request<ExerciseDBExercise[]>(
      `/exercises/target/${normalizedTarget}`,
      `target_${normalizedTarget}`
    );
  }

  /**
   * Get exercises by equipment type
   */
  async getExercisesByEquipment(equipment: string): Promise<ExerciseDBExercise[]> {
    const normalizedEquipment = equipment.toLowerCase().replace(/\s+/g, "");
    return this.request<ExerciseDBExercise[]>(
      `/exercises/equipment/${normalizedEquipment}`,
      `equipment_${normalizedEquipment}`
    );
  }

  /**
   * Get list of all body parts
   */
  async getBodyParts(): Promise<string[]> {
    return this.request<string[]>("/exercises/bodyPartList", "bodyParts");
  }

  /**
   * Get list of all target muscles
   */
  async getTargetMuscles(): Promise<string[]> {
    return this.request<string[]>("/exercises/targetList", "targets");
  }

  /**
   * Get list of all equipment types
   */
  async getEquipmentTypes(): Promise<string[]> {
    return this.request<string[]>("/exercises/equipmentList", "equipment");
  }

  /**
   * Search exercises with multiple filters
   */
  async searchExercises(filters: ExerciseDBFilters, limit: number = 50): Promise<ExerciseDBExercise[]> {
    let exercises: ExerciseDBExercise[] = [];

    // If we have specific filters, use targeted endpoints
    if (filters.equipment) {
      exercises = await this.getExercisesByEquipment(filters.equipment);
    } else if (filters.target) {
      exercises = await this.getExercisesByTarget(filters.target);
    } else if (filters.bodyPart) {
      exercises = await this.getExercisesByBodyPart(filters.bodyPart);
    } else {
      // If no specific filter, get all and filter client-side
      exercises = await this.getAllExercises();
    }

    // Apply additional filters
    if (filters.bodyPart && !filters.equipment && !filters.target) {
      exercises = exercises.filter(
        (ex) => ex.bodyPart.toLowerCase() === filters.bodyPart?.toLowerCase()
      );
    }
    if (filters.target && !filters.equipment && !filters.bodyPart) {
      exercises = exercises.filter(
        (ex) => ex.target.toLowerCase() === filters.target?.toLowerCase()
      );
    }

    // Limit results
    return exercises.slice(0, limit);
  }

  /**
   * Get exercises relevant to user's equipment and goals
   * This is optimized for workout generation
   */
  async getRelevantExercises(options: {
    equipment?: string[];
    targetMuscles?: string[];
    bodyParts?: string[];
    limit?: number;
  }): Promise<ExerciseDBExercise[]> {
    const limit = options.limit || 50;
    const allExercises: ExerciseDBExercise[] = [];
    const seenIds = new Set<string>();

    // Fetch exercises for each equipment type
    if (options.equipment && options.equipment.length > 0) {
      for (const equip of options.equipment.slice(0, 5)) { // Limit to 5 to avoid too many requests
        const exercises = await this.getExercisesByEquipment(equip);
        for (const ex of exercises) {
          if (!seenIds.has(ex.id)) {
            allExercises.push(ex);
            seenIds.add(ex.id);
          }
        }
      }
    }

    // Fetch exercises for target muscles if equipment didn't yield enough
    if (allExercises.length < limit && options.targetMuscles && options.targetMuscles.length > 0) {
      for (const target of options.targetMuscles.slice(0, 3)) {
        const exercises = await this.getExercisesByTarget(target);
        for (const ex of exercises) {
          if (!seenIds.has(ex.id) && allExercises.length < limit * 2) {
            allExercises.push(ex);
            seenIds.add(ex.id);
          }
        }
      }
    }

    // Filter by body parts if specified
    let filtered = allExercises;
    if (options.bodyParts && options.bodyParts.length > 0) {
      filtered = allExercises.filter((ex) =>
        options.bodyParts?.some(
          (bp) => ex.bodyPart.toLowerCase().includes(bp.toLowerCase())
        )
      );
    }

    // Shuffle and limit
    const shuffled = filtered.sort(() => Math.random() - 0.5);
    return shuffled.slice(0, limit);
  }
}

// Export singleton instance
export const exerciseDBClient = new ExerciseDBClient();

// Export types for use in other modules
export type { ExerciseDBExercise, ExerciseDBFilters };

