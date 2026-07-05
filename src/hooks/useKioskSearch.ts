import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export type KioskVisitorType = "member" | "guest_pass" | "class_booking" | "spa_appointment";

export interface KioskSearchResult {
  id: string;
  type: KioskVisitorType;
  name: string;
  subtitle: string;
  photo_url?: string | null;
  status?: string;
  sub_type?: string | null;
  // IDs for check-in actions
  member_uuid?: string;
  member_id_text?: string;
  guest_pass_id?: string;
  booking_id?: string;
  spa_id?: string;
}

export function useKioskSearch() {
  const [results, setResults] = useState<KioskSearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  const search = useCallback(async (query: string) => {
    if (!query.trim()) {
      setResults([]);
      return;
    }
    setIsSearching(true);
    try {
      const { data, error } = await (supabase.rpc as any)("kiosk_search_visitors", {
        p_query: query.trim(),
      });
      if (error) throw error;

      const parsed: KioskSearchResult[] = (data || []).map((r: any) => ({
        id: r.id,
        type: r.type as KioskVisitorType,
        name: r.name,
        subtitle: r.subtitle,
        photo_url: r.photo_url || null,
        status: r.status || null,
        member_uuid: r.member_uuid || null,
        member_id_text: r.member_id_text || null,
        guest_pass_id: r.guest_pass_id || null,
        booking_id: r.booking_id || null,
        spa_id: r.spa_id || null,
      }));

      setResults(parsed);
      if (parsed.length === 0) {
        toast.info("No results found");
      }
    } catch (err) {
      console.error("Kiosk search error:", err);
      toast.error("Search failed");
    } finally {
      setIsSearching(false);
    }
  }, []);

  const clearResults = useCallback(() => setResults([]), []);

  return { results, isSearching, search, clearResults };
}
