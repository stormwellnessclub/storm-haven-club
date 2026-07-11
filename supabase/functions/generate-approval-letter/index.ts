import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { requireStaff } from "../_shared/requireStaff.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface ApplicantData {
  name: string;
  tier: string;
  wellness_goals?: string[];
  services_interested?: string[];
  holistic_wellness?: string;
  lifestyle_integration?: string;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const authCheck = await requireStaff(req);
  if (!authCheck.ok) return authCheck.response;

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const { applicant }: { applicant: ApplicantData } = await req.json();

    if (!applicant || !applicant.name || !applicant.tier) {
      throw new Error("Missing required applicant data (name and tier)");
    }

    // Build a rich context from application data
    const wellnessGoalsText = applicant.wellness_goals?.length 
      ? applicant.wellness_goals.join(", ") 
      : "general wellness";
    
    const servicesText = applicant.services_interested?.length
      ? applicant.services_interested.join(", ")
      : "our full range of services";
    
    const holisticText = applicant.holistic_wellness || "";
    const lifestyleText = applicant.lifestyle_integration || "";

    const systemPrompt = `You are writing a personalized membership approval letter for Storm Wellness Club, a luxury wellness facility located at 18340 Middlebelt Rd, Livonia, Michigan, focused on holistic health, fitness, and recovery.

The letter should feel warm, personal, and elegant. You are writing on behalf of the Storm Wellness Club team.

IMPORTANT: The club name is "Storm Wellness Club" -- never abbreviate it to just "Storm" or refer to it as a person. It is a club, not an individual.

Guidelines:
1. Open with congratulations on their approval
2. Reference something specific from their application that resonated with our philosophy
3. Connect their stated goals to what Storm Wellness Club offers
4. Confirm their membership tier
5. Mention they'll receive their account activation details shortly, and their member portal will guide them through any remaining steps (don't include any links or buttons)
6. Close warmly, signed by "The Storm Wellness Club Team"

Keep the tone elegant, personal, and concise (under 200 words for the body).
Do not include any links, buttons, or calls-to-action.
Do not use emojis.
Return ONLY the letter body text - no subject line, no HTML, just plain text paragraphs.`;

    const userPrompt = `Write a personalized approval letter for this applicant:

Name: ${applicant.name}
Membership Tier: ${applicant.tier}
Wellness Goals: ${wellnessGoalsText}
Services Interested In: ${servicesText}
${holisticText ? `Their perspective on holistic wellness: "${holisticText}"` : ""}
${lifestyleText ? `Their lifestyle: "${lifestyleText}"` : ""}

Remember: Keep it elegant, warm, and under 200 words. Return only the letter body text.`;

    console.log("Generating approval letter for:", applicant.name);

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        temperature: 0.7,
        max_tokens: 500,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded. Please try again in a moment." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "AI service credits exhausted. Please add funds." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      throw new Error("Failed to generate letter");
    }

    const data = await response.json();
    const letterBody = data.choices?.[0]?.message?.content?.trim();

    if (!letterBody) {
      throw new Error("No content generated");
    }

    console.log("Letter generated successfully for:", applicant.name);

    return new Response(
      JSON.stringify({
        success: true,
        subject: `Welcome to Storm Wellness Club - Application Approved!`,
        body: letterBody,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Error in generate-approval-letter:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Failed to generate letter" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
