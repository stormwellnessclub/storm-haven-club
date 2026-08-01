import { defineTool } from "@lovable.dev/mcp-js";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "list_my_credits",
  title: "List my credits",
  description:
    "List the signed-in member's remaining wellness and class credits for the current billing cycle, with expiry dates.",
  inputSchema: {},
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async (_input, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    }
    const supabase = supabaseForUser(ctx);
    const { data, error } = await supabase
      .from("member_credits")
      .select("credit_type, credits_remaining, credits_total, cycle_start, cycle_end, expires_at")
      .gte("expires_at", new Date().toISOString())
      .order("expires_at", { ascending: true })
      .limit(50);

    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    const credits = data ?? [];
    return {
      content: [{ type: "text", text: JSON.stringify(credits) }],
      structuredContent: { credits },
    };
  },
});
