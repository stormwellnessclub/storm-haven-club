import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface EquipmentImageMap {
  [equipmentName: string]: string; // name -> image_url
}

export function useEquipmentImages() {
  return useQuery({
    queryKey: ["equipment-images"],
    queryFn: async (): Promise<EquipmentImageMap> => {
      try {
        const { data, error } = await (supabase.from as any)("equipment")
          .select("name, image_url")
          .eq("is_active", true)
          .not("image_url", "is", null);

        if (error) {
          if (error.code === "42P01" || error.message?.includes("does not exist")) {
            return {};
          }
          throw error;
        }

        const map: EquipmentImageMap = {};
        for (const item of data || []) {
          if (item.name && item.image_url) {
            map[item.name.toLowerCase()] = item.image_url;
          }
        }
        return map;
      } catch (error: any) {
        if (error?.code === "42P01" || error?.message?.includes("does not exist")) {
          return {};
        }
        throw error;
      }
    },
    staleTime: 10 * 60 * 1000, // Cache for 10 minutes
  });
}

/**
 * Find the best matching equipment image for a given equipment name.
 * Does fuzzy matching by checking if the equipment name contains any known equipment key.
 */
export function findEquipmentImage(
  equipmentName: string | undefined,
  imageMap: EquipmentImageMap | undefined
): string | null {
  if (!equipmentName || !imageMap) return null;

  const lower = equipmentName.toLowerCase();

  // Exact match first
  if (imageMap[lower]) return imageMap[lower];

  // Partial match: check if any equipment name is contained in the exercise equipment field
  for (const [key, url] of Object.entries(imageMap)) {
    if (lower.includes(key) || key.includes(lower)) {
      return url;
    }
  }

  return null;
}
