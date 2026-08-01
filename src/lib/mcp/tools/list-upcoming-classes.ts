import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "list_upcoming_classes",
  title: "List upcoming classes",
  description:
    "List upcoming Storm Wellness Club class sessions with date, time, class name and remaining spots. Booking opens 4 weeks out.",
  inputSchema: {
    days_ahead: z.number().int().optional().describe("How many days ahead to look. Defaults to 14, max 28."),
    category: z.string().optional().describe("Optional class category filter, e.g. pilates or cycling."),
    only_available: z.boolean().optional().describe("Only return sessions with open spots. Defaults to false."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ days_ahead, category, only_available }, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    }
    const days = Math.min(Math.max(days_ahead ?? 14, 1), 28);
    const start = new Date();
    const end = new Date(start.getTime() + days * 24 * 60 * 60 * 1000);
    const supabase = supabaseForUser(ctx);

    const { data, error } = await supabase
      .from("class_sessions")
      .select(
        "id, session_date, start_time, end_time, room, max_capacity, current_enrollment, is_signature:class_types(name, category, is_signature)",
      )
      .eq("is_cancelled", false)
      .eq("is_hidden", false)
      .gte("session_date", start.toISOString().slice(0, 10))
      .lte("session_date", end.toISOString().slice(0, 10))
      .order("session_date", { ascending: true })
      .order("start_time", { ascending: true })
      .limit(200);

    if (error) return { content: [{ type: "text", text: error.message }], isError: true };

    let sessions = (data ?? []).map((s: Record<string, unknown>) => {
      const type = s.is_signature as Record<string, unknown> | null;
      const capacity = Number(s.max_capacity ?? 0);
      const enrolled = Number(s.current_enrollment ?? 0);
      return {
        id: s.id,
        class_name: type?.name ?? null,
        category: type?.category ?? null,
        signature: Boolean(type?.is_signature),
        session_date: s.session_date,
        start_time: s.start_time,
        end_time: s.end_time,
        room: s.room,
        spots_left: Math.max(capacity - enrolled, 0),
        max_capacity: capacity,
      };
    });

    if (category) {
      const needle = category.trim().toLowerCase();
      sessions = sessions.filter(
        (s) =>
          String(s.category ?? "").toLowerCase().includes(needle) ||
          String(s.class_name ?? "").toLowerCase().includes(needle),
      );
    }
    if (only_available) sessions = sessions.filter((s) => s.spots_left > 0);

    return {
      content: [{ type: "text", text: JSON.stringify(sessions) }],
      structuredContent: { sessions },
    };
  },
});
