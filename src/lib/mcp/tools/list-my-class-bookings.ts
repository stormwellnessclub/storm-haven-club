import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "list_my_class_bookings",
  title: "List my class bookings",
  description:
    "List the signed-in member's class bookings with session date, time and class name. Defaults to upcoming bookings.",
  inputSchema: {
    include_past: z
      .boolean()
      .optional()
      .describe("Include bookings for sessions that already happened. Defaults to false."),
    limit: z.number().int().optional().describe("Maximum bookings to return. Defaults to 20, max 100."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ include_past, limit }, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    }
    const max = Math.min(Math.max(limit ?? 20, 1), 100);
    const today = new Date().toISOString().slice(0, 10);
    const supabase = supabaseForUser(ctx);

    let query = supabase
      .from("class_bookings")
      .select(
        "id, status, booked_at, cancelled_at, checked_in_at, class_sessions!inner(session_date, start_time, end_time, room, is_cancelled, class_types(name, category))",
      )
      .order("booked_at", { ascending: false })
      .limit(max);

    if (!include_past) query = query.gte("class_sessions.session_date", today);

    const { data, error } = await query;
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };

    const bookings = (data ?? []).map((b: Record<string, unknown>) => {
      const session = b.class_sessions as Record<string, unknown> | null;
      const type = session?.class_types as Record<string, unknown> | null;
      return {
        id: b.id,
        status: b.status,
        checked_in: Boolean(b.checked_in_at),
        class_name: type?.name ?? null,
        category: type?.category ?? null,
        session_date: session?.session_date ?? null,
        start_time: session?.start_time ?? null,
        end_time: session?.end_time ?? null,
        room: session?.room ?? null,
        session_cancelled: session?.is_cancelled ?? false,
      };
    });

    return {
      content: [{ type: "text", text: JSON.stringify(bookings) }],
      structuredContent: { bookings },
    };
  },
});
