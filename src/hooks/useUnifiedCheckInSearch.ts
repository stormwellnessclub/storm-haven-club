import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export type VisitorType = "member" | "guest_pass" | "class_booking" | "spa_appointment";

export interface UnifiedSearchResult {
  id: string;
  type: VisitorType;
  name: string;
  subtitle: string;
  // Original row data for the detail panel
  data: any;
}

export function useUnifiedCheckInSearch() {
  const [results, setResults] = useState<UnifiedSearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  const search = useCallback(async (query: string) => {
    if (!query.trim()) {
      setResults([]);
      return;
    }

    setIsSearching(true);
    const q = query.trim();
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayStr = today.toISOString().split("T")[0];

    try {
      const [membersRes, guestsRes, classRes, spaRes] = await Promise.all([
        // 1. Members
        supabase
          .from("members")
          .select("*")
          .or(`first_name.ilike.%${q}%,last_name.ilike.%${q}%,member_id.ilike.%${q}%,email.ilike.%${q}%,phone.ilike.%${q}%`)
          .limit(10),

        // 2. Guest passes (today, active/purchased)
        supabase
          .from("guest_passes")
          .select("*")
          .or(`guest_name.ilike.%${q}%,guest_email.ilike.%${q}%`)
          .eq("valid_date", todayStr)
          .in("status", ["active", "purchased"])
          .limit(10),

        // 3. Class bookings (today, confirmed) - join session + class type
        supabase
          .from("class_bookings")
          .select(`
            *,
            session:class_sessions!inner(
              session_date,
              start_time,
              end_time,
              class_type:class_types(name)
            ),
            member:members(first_name, last_name, email, member_id)
          `)
          .eq("session.session_date", todayStr)
          .eq("status", "confirmed")
          .limit(20),

        // 4. Spa appointments (today, confirmed)
        (supabase.from as any)("spa_appointments")
          .select(`
            *,
            member:members(first_name, last_name, email, member_id)
          `)
          .eq("appointment_date", todayStr)
          .in("status", ["confirmed", "pending"])
          .limit(10),
      ]);

      const out: UnifiedSearchResult[] = [];
      const seenIds = new Set<string>();

      // Members
      (membersRes.data || []).forEach((m: any) => {
        const key = `member-${m.id}`;
        if (seenIds.has(key)) return;
        seenIds.add(key);
        out.push({
          id: key,
          type: "member",
          name: `${m.first_name} ${m.last_name}`,
          subtitle: `${m.member_id} • ${m.membership_type}`,
          data: m,
        });
      });

      // Guest passes
      (guestsRes.data || []).forEach((g: any) => {
        const key = `guest-${g.id}`;
        if (seenIds.has(key)) return;
        seenIds.add(key);
        out.push({
          id: key,
          type: "guest_pass",
          name: g.guest_name,
          subtitle: `Guest Pass • ${g.guest_email || "No email"}`,
          data: g,
        });
      });

      // Class bookings - filter by name match since we can't do OR on joined fields
      (classRes.data || []).forEach((cb: any) => {
        const memberName = cb.member
          ? `${cb.member.first_name} ${cb.member.last_name}`
          : cb.walk_in_name || "Unknown";
        const className = cb.session?.class_type?.name || "Class";

        if (!memberName.toLowerCase().includes(q.toLowerCase())) return;

        const key = `class-${cb.id}`;
        if (seenIds.has(key)) return;
        seenIds.add(key);
        out.push({
          id: key,
          type: "class_booking",
          name: memberName,
          subtitle: `${className} • ${cb.session?.start_time?.slice(0, 5) || ""}`,
          data: { ...cb, className, memberName },
        });
      });

      // Spa appointments - filter by name match
      (spaRes.data || []).forEach((sa: any) => {
        const memberName = sa.member
          ? `${sa.member.first_name} ${sa.member.last_name}`
          : "Unknown";
        if (!memberName.toLowerCase().includes(q.toLowerCase())) return;

        const key = `spa-${sa.id}`;
        if (seenIds.has(key)) return;
        seenIds.add(key);
        out.push({
          id: key,
          type: "spa_appointment",
          name: memberName,
          subtitle: `${sa.service_name || "Spa"} • ${sa.appointment_time?.slice(0, 5) || ""}`,
          data: { ...sa, memberName },
        });
      });

      setResults(out);
      if (out.length === 0) {
        toast.info("No results found");
      }
    } catch (err) {
      console.error("Unified search error:", err);
      toast.error("Search failed");
    } finally {
      setIsSearching(false);
    }
  }, []);

  const clearResults = useCallback(() => setResults([]), []);

  return { results, isSearching, search, clearResults };
}
