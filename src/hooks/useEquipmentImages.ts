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

const norm = (s: string) =>
  s.toLowerCase().replace(/\([^)]*\)/g, " ").replace(/[^a-z0-9/ ]+/g, " ").replace(/\s+/g, " ").trim()
    .split(" ").map((w) => (w.length > 3 && w.endsWith("s") ? w.slice(0, -1) : w)).join(" ");

/**
 * Find the photo for an exercise's equipment. Strict on purpose: exact name, or the
 * exercise's equipment text contains the full machine name. Never matches on a shared
 * word ("cable", "leg"), so a different machine is never shown.
 */
export function findEquipmentImage(
  equipmentName: string | undefined,
  imageMap: EquipmentImageMap | undefined
): string | null {
  if (!equipmentName || !imageMap) return null;
  const lower = equipmentName.toLowerCase().trim();
  if (imageMap[lower]) return imageMap[lower];
  const target = norm(equipmentName);
  if (!target) return null;
  let best: { len: number; url: string } | null = null;
  for (const [key, url] of Object.entries(imageMap)) {
    const k = norm(key);
    if (!k) continue;
    if (k === target) return url;
    if (` ${target} `.includes(` ${k} `) && (!best || k.length > best.len)) best = { len: k.length, url };
  }
  return best?.url ?? null;
}
