import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { startOfWeek, endOfWeek, addWeeks, format } from "date-fns";

export interface ClassSession {
  id: string;
  session_date: string;
  start_time: string;
  end_time: string;
  max_capacity: number;
  current_enrollment: number;
  room: string | null;
  is_cancelled: boolean;
  class_type: {
    id: string;
    name: string;
    category: "reformer" | "cycling" | "aerobics" | "other" | "pilates_cycling";
    description: string | null;
    duration_minutes: number;
    is_heated: boolean;
    image_url: string | null;
  };
  instructor: {
    id: string;
    first_name: string;
    last_name: string;
    photo_url: string | null;
  } | null;
}

interface UseClassSessionsOptions {
  weekOffset?: number;
  category?: "reformer" | "cycling" | "aerobics" | "other" | "pilates_cycling" | "all";
  isHeated?: boolean | "all";
}

export function useClassSessions(options: UseClassSessionsOptions = {}) {
  const { weekOffset = 0, category = "all", isHeated = "all" } = options;

  return useQuery({
    queryKey: ["class-sessions", weekOffset, category, isHeated],
    queryFn: async (): Promise<ClassSession[]> => {
      const today = new Date();
      const targetWeek = addWeeks(today, weekOffset);
      const weekStart = startOfWeek(targetWeek, { weekStartsOn: 0 });
      const weekEnd = endOfWeek(targetWeek, { weekStartsOn: 0 });

      let query = supabase
        .from("class_sessions")
        .select(`
          id,
          session_date,
          start_time,
          end_time,
          max_capacity,
          current_enrollment,
          room,
          is_cancelled,
          class_type:class_types!inner (
            id,
            name,
            category,
            description,
            duration_minutes,
            is_heated,
            image_url
          ),
          instructor:instructors (
            id,
            first_name,
            last_name,
            photo_url
          )
        `)
        .gte("session_date", format(weekStart, "yyyy-MM-dd"))
        .lte("session_date", format(weekEnd, "yyyy-MM-dd"))
        .eq("is_cancelled", false)
        .order("session_date")
        .order("start_time");

      if (category !== "all") {
        query = query.eq("class_types.category", category);
      }

      if (isHeated !== "all") {
        query = query.eq("class_types.is_heated", isHeated);
      }

      const { data, error } = await query;

      if (error) throw error;

      return (data || []).map((session) => ({
        ...session,
        class_type: Array.isArray(session.class_type)
          ? session.class_type[0]
          : session.class_type,
        instructor: Array.isArray(session.instructor)
          ? session.instructor[0]
          : session.instructor,
      })) as ClassSession[];
    },
  });
}

export function useUpcomingSessions(limit = 10) {
  return useQuery({
    queryKey: ["upcoming-sessions", limit],
    queryFn: async (): Promise<ClassSession[]> => {
      const today = format(new Date(), "yyyy-MM-dd");
      
      const { data, error } = await supabase
        .from("class_sessions")
        .select(`
          id,
          session_date,
          start_time,
          end_time,
          max_capacity,
          current_enrollment,
          room,
          is_cancelled,
          class_type:class_types!inner (
            id,
            name,
            category,
            description,
            duration_minutes,
            is_heated,
            image_url
          ),
          instructor:instructors (
            id,
            first_name,
            last_name,
            photo_url
          )
        `)
        .gte("session_date", today)
        .eq("is_cancelled", false)
        .order("session_date")
        .order("start_time")
        .limit(limit);

      if (error) throw error;

      return (data || []).map((session) => ({
        ...session,
        class_type: Array.isArray(session.class_type)
          ? session.class_type[0]
          : session.class_type,
        instructor: Array.isArray(session.instructor)
          ? session.instructor[0]
          : session.instructor,
      })) as ClassSession[];
    },
  });
}
