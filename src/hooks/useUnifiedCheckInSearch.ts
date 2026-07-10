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

      // Resolve non-member identities for class + spa rows lacking a linked member.
      const allClass: any[] = classRes.data || [];
      const allSpa: any[] = spaRes.data || [];
      const missingUserIds = Array.from(
        new Set(
          [...allClass, ...allSpa]
            .filter((r: any) => !r.member && r.user_id)
            .map((r: any) => r.user_id as string)
        )
      );

      let nmMap = new Map<string, any>();
      let profMap = new Map<string, any>();
      if (missingUserIds.length > 0) {
        const [nmRes2, profRes2] = await Promise.all([
          supabase
            .from("non_member_profiles")
            .select("user_id, first_name, last_name, email")
            .in("user_id", missingUserIds),
          supabase
            .from("profiles")
            .select("user_id, first_name, last_name, email")
            .in("user_id", missingUserIds),
        ]);
        nmMap = new Map((nmRes2.data || []).map((p: any) => [p.user_id, p]));
        profMap = new Map((profRes2.data || []).map((p: any) => [p.user_id, p]));
      }

      const resolveName = (row: any): { name: string; kindLabel: string | null } => {
        if (row.member) return { name: `${row.member.first_name} ${row.member.last_name}`, kindLabel: null };
        if (row.user_id && nmMap.has(row.user_id)) {
          const nm = nmMap.get(row.user_id);
          return {
            name: [nm.first_name, nm.last_name].filter(Boolean).join(" ") || nm.email || "Non-Member",
            kindLabel: "Non-Member",
          };
        }
        if (row.user_id && profMap.has(row.user_id)) {
          const p = profMap.get(row.user_id);
          return {
            name: [p.first_name, p.last_name].filter(Boolean).join(" ") || p.email || "Guest",
            kindLabel: "Guest",
          };
        }
        if (row.walk_in_name) return { name: row.walk_in_name, kindLabel: "Walk-In" };
        return { name: "Walk-In", kindLabel: "Walk-In" };
      };

      // Class bookings - filter by resolved name
      allClass.forEach((cb: any) => {
        const { name: memberName, kindLabel } = resolveName(cb);
        const className = cb.session?.class_type?.name || "Class";

        if (!memberName.toLowerCase().includes(q.toLowerCase())) return;

        const key = `class-${cb.id}`;
        if (seenIds.has(key)) return;
        seenIds.add(key);
        out.push({
          id: key,
          type: "class_booking",
          name: memberName,
          subtitle: `${kindLabel ? kindLabel + " • " : ""}${className} • ${cb.session?.start_time?.slice(0, 5) || ""}`,
          data: { ...cb, className, memberName },
        });
      });

      // Spa appointments - filter by resolved name
      allSpa.forEach((sa: any) => {
        const { name: memberName, kindLabel } = resolveName(sa);
        if (!memberName.toLowerCase().includes(q.toLowerCase())) return;

        const key = `spa-${sa.id}`;
        if (seenIds.has(key)) return;
        seenIds.add(key);
        out.push({
          id: key,
          type: "spa_appointment",
          name: memberName,
          subtitle: `${kindLabel ? kindLabel + " • " : ""}${sa.service_name || "Spa"} • ${sa.appointment_time?.slice(0, 5) || ""}`,
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
