import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });

export const nameKey = (n: string) => n.trim().toLowerCase().replace(/\s+/g, " ");

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  try {
    const url = Deno.env.get("SUPABASE_URL")!;
    const auth = req.headers.get("Authorization") || "";
    const userClient = createClient(url, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: auth } } });
    const { data: u } = await userClient.auth.getUser();
    if (!u?.user) return json({ error: "Please sign in" }, 401);

    const { name, equipment } = await req.json();
    if (!name || typeof name !== "string" || name.length > 160) return json({ error: "Exercise name required" }, 400);
    const key = nameKey(name);
    const admin = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: existing } = await admin.from("exercise_form_guides").select("*").eq("name_key", key).maybeSingle();
    if (existing) return json({ guide: existing });

    const apiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!apiKey) return json({ error: "Guide unavailable" }, 500);
    const r = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: "You are a certified strength coach at a premium wellness club. Write calm, precise, safe exercise form guidance for exactly the named exercise and equipment. Never substitute a different exercise. No hype, no emojis, plain sentences." },
          { role: "user", content: `Exercise: ${name}\nEquipment: ${equipment || "as named"}` },
        ],
        tools: [{ type: "function", function: { name: "guide", parameters: {
          type: "object",
          properties: {
            setup: { type: "string" },
            steps: { type: "array", items: { type: "string" }, minItems: 3, maxItems: 5 },
            breathing: { type: "string" },
            mistakes: { type: "array", items: { type: "string" }, maxItems: 3 },
            easier: { type: "string" },
            harder: { type: "string" },
          },
          required: ["setup", "steps", "breathing", "mistakes", "easier", "harder"],
        } } }],
        tool_choice: { type: "function", function: { name: "guide" } },
      }),
    });
    if (r.status === 429) return json({ error: "Busy right now, try again in a minute" }, 429);
    if (!r.ok) return json({ error: "Guide unavailable" }, 500);
    const out = await r.json();
    const args = JSON.parse(out.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments || "null");
    if (!args?.steps) return json({ error: "Guide unavailable" }, 500);
    const row = { name_key: key, display_name: name.trim(), guide: args };
    await admin.from("exercise_form_guides").upsert(row, { onConflict: "name_key", ignoreDuplicates: true });
    return json({ guide: row });
  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }
});
