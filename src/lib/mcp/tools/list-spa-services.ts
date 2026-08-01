import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "list_spa_services",
  title: "List spa services",
  description:
    "List active Storm Wellness Club spa and recovery services with duration, standard price and member price.",
  inputSchema: {
    category: z.string().optional().describe("Optional category filter, e.g. massage or recovery."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ category }, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    }
    const supabase = supabaseForUser(ctx);
    const { data, error } = await supabase
      .from("spa_services")
      .select("id, name, category, description, duration_minutes, price, member_price, popular")
      .eq("is_active", true)
      .order("display_order", { ascending: true })
      .limit(200);

    if (error) return { content: [{ type: "text", text: error.message }], isError: true };

    let services = data ?? [];
    if (category) {
      const needle = category.trim().toLowerCase();
      services = services.filter((s) => String(s.category ?? "").toLowerCase().includes(needle));
    }

    return {
      content: [{ type: "text", text: JSON.stringify(services) }],
      structuredContent: { services },
    };
  },
});
