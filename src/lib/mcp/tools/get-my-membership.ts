import { defineTool } from "@lovable.dev/mcp-js";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "get_my_membership",
  title: "Get my membership",
  description:
    "Get the signed-in member's Storm Wellness Club membership status, tier, billing dates and past-due flag.",
  inputSchema: {},
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async (_input, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    }
    const supabase = supabaseForUser(ctx);
    const { data, error } = await supabase
      .from("members")
      .select(
        "member_id, first_name, last_name, email, membership_type, status, membership_start_date, membership_end_date, next_billing_date, payment_past_due, payment_past_due_since",
      )
      .limit(1)
      .maybeSingle();

    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    if (!data) {
      return {
        content: [{ type: "text", text: "No membership record is linked to this account." }],
        structuredContent: { membership: null },
      };
    }
    return {
      content: [{ type: "text", text: JSON.stringify(data) }],
      structuredContent: { membership: data },
    };
  },
});
