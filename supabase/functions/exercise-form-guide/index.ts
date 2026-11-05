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
    const str = { type: "string" };
    const schema = {
      type: "object", additionalProperties: false,
      required: ["setup", "steps", "breathing", "mistakes", "easier", "harder"],
      properties: { setup: str, steps: { type: "array", items: str }, breathing: str,
        mistakes: { type: "array", items: str }, easier: str, harder: str },
    };
    const r = await fetch("https://ai.gateway.lovable.dev/v1/responses", {
      method: "POST",
      headers: { "Lovable-API-Key": apiKey, Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json", "X-Lovable-AIG-SDK": "fetch" },
      body: JSON.stringify({
        model: "openai/gpt-6-astra",
        stream: true,
        store: false,
        reasoning: { effort: "low" },
        instructions: "You are a certified strength coach at a premium wellness club. Write calm, precise, safe form guidance for exactly the named exercise on the named equipment. Never substitute a different exercise. 3-5 short steps, up to 3 common mistakes. No hype, no emojis, plain sentences.",
        input: `Exercise: ${name}\nEquipment: ${equipment || "as named"}`,
        text: { format: { type: "json_schema", name: "guide", strict: true, schema } },
      }),
    });
    if (r.status === 429) return json({ error: "Busy right now, try again in a minute" }, 429);
    if (!r.ok || !r.body) return json({ error: "Guide unavailable" }, 500);
    let text = "", buf = "";
    const reader = r.body.pipeThrough(new TextDecoderStream()).getReader();
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      buf += value;
      const lines = buf.split("\n"); buf = lines.pop() || "";
      for (const l of lines) {
        if (!l.startsWith("data:")) continue;
        try { const ev = JSON.parse(l.slice(5)); if (ev.type === "response.output_text.delta") text += ev.delta; } catch { /* skip */ }
      }
    }
    let args: any = null;
    try { args = JSON.parse(text); } catch { /* invalid */ }
    if (!args?.steps?.length) return json({ error: "Guide unavailable" }, 500);
    const row = { name_key: key, display_name: name.trim(), guide: args };
    await admin.from("exercise_form_guides").upsert(row, { onConflict: "name_key", ignoreDuplicates: true });
    return json({ guide: row });
  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }
});
