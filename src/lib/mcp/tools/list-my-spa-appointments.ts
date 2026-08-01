import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "list_my_spa_appointments",
  title: "List my spa appointments",
  description:
    "List the signed-in member's spa and recovery appointments with service, date, time and status. Defaults to upcoming.",
  inputSchema: {
    include_past: z.boolean().optional().describe("Include past appointments. Defaults to false."),
    limit: z.number().int().optional().describe("Maximum appointments to return. Defaults to 20, max 100."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ include_past, limit }, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    }
    const max = Math.min(Math.max(limit ?? 20, 1), 100);
    const supabase = supabaseForUser(ctx);

    let query = supabase
      .from("spa_appointments")
      .select(
        "id, service_name, service_category, appointment_date, appointment_time, duration_minutes, status, member_notes",
      )
      .order("appointment_date", { ascending: true })
      .limit(max);

    if (!include_past) query = query.gte("appointment_date", new Date().toISOString().slice(0, 10));

    const { data, error } = await query;
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    const appointments = data ?? [];
    return {
      content: [{ type: "text", text: JSON.stringify(appointments) }],
      structuredContent: { appointments },
    };
  },
});
