/**
 * Technogym API Client (stub)
 *
 * SECURITY: This module previously read VITE_TECHNOGYM_API_KEY,
 * VITE_TECHNOGYM_CLIENT_ID, and VITE_TECHNOGYM_CLIENT_SECRET from
 * `import.meta.env`. Any `VITE_`-prefixed variable is bundled into the public
 * browser JavaScript, which would expose the OAuth client secret to anyone
 * who inspects the site. OAuth client secrets must be server-side only.
 *
 * The client-side code paths have been removed. If Technogym integration is
 * needed, implement it inside a Supabase edge function where the secrets live
 * in `Deno.env` (e.g., TECHNOGYM_CLIENT_SECRET) and invoke that function from
 * the client. Any previously deployed VITE_TECHNOGYM_CLIENT_SECRET value
 * must also be rotated with Technogym.
 */

interface TechnogymExercise {
  id: string;
  name: string;
  description?: string;
  equipment_id: string;
  category: string;
  difficulty: "beginner" | "intermediate" | "advanced";
  muscle_groups: string[];
  instructions?: string[];
  video_url?: string;
  image_url?: string;
}

interface TechnogymEquipment {
  id: string;
  name: string;
  model?: string;
  category: string;
  exercises?: TechnogymExercise[];
}

class TechnogymClient {
  /**
   * Always false on the client. Real integration must run server-side in an
   * edge function so credentials never reach the browser bundle.
   */
  isConfigured(): boolean {
    return false;
  }

  async getExercisesForEquipment(_equipmentId: string): Promise<TechnogymExercise[]> {
    console.warn(
      "Technogym client-side calls are disabled. Move integration to a server-side edge function."
    );
    return [];
  }

  async getEquipment(_equipmentId: string): Promise<TechnogymEquipment | null> {
    console.warn(
      "Technogym client-side calls are disabled. Move integration to a server-side edge function."
    );
    return null;
  }

  async searchExercises(_criteria: {
    equipment_id?: string;
    category?: string;
    difficulty?: string;
    muscle_groups?: string[];
  }): Promise<TechnogymExercise[]> {
    console.warn(
      "Technogym client-side calls are disabled. Move integration to a server-side edge function."
    );
    return [];
  }
}

export const technogymClient = new TechnogymClient();
export type { TechnogymExercise, TechnogymEquipment };
