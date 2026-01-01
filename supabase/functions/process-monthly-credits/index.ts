import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.89.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Credit allocations by tier
const TIER_CREDIT_ALLOCATIONS: Record<string, { class: number; red_light: number; dry_cryo: number }> = {
  silver: { class: 0, red_light: 0, dry_cryo: 0 },
  gold: { class: 0, red_light: 4, dry_cryo: 2 },
  platinum: { class: 0, red_light: 6, dry_cryo: 4 },
  diamond: { class: 10, red_light: 10, dry_cryo: 6 },
};

function getTierName(membershipType: string): string {
  const normalized = membershipType.toLowerCase().trim();
  if (normalized.includes("diamond")) return "diamond";
  if (normalized.includes("platinum")) return "platinum";
  if (normalized.includes("gold")) return "gold";
  return "silver";
}

function getTierCredits(membershipType: string) {
  return TIER_CREDIT_ALLOCATIONS[getTierName(membershipType)];
}

function addMonths(date: Date, months: number): Date {
  const result = new Date(date);
  result.setMonth(result.getMonth() + months);
  return result;
}

function subDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() - days);
  return result;
}

function endOfDay(date: Date): Date {
  const result = new Date(date);
  result.setHours(23, 59, 59, 999);
  return result;
}

function formatDate(date: Date): string {
  return date.toISOString().split("T")[0];
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const today = new Date();
    const dayOfMonth = today.getDate();

    console.log(`[process-monthly-credits] Running for day ${dayOfMonth} of month`);

    // Find active members whose membership start day matches today's day
    // e.g., if today is the 15th, find members who started on the 15th of their start month
    const { data: members, error: membersError } = await supabase
      .from("members")
      .select("id, user_id, membership_type, membership_start_date")
      .eq("status", "active")
      .not("user_id", "is", null);

    if (membersError) {
      console.error("[process-monthly-credits] Error fetching members:", membersError);
      throw membersError;
    }

    console.log(`[process-monthly-credits] Found ${members?.length || 0} active members`);

    let creditsCreated = 0;
    let skipped = 0;

    for (const member of members || []) {
      // Check if today is this member's billing anniversary
      const startDate = new Date(member.membership_start_date);
      const startDay = startDate.getDate();

      // Handle end-of-month edge cases (e.g., started on 31st, but current month only has 30 days)
      const lastDayOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
      const effectiveStartDay = Math.min(startDay, lastDayOfMonth);

      if (dayOfMonth !== effectiveStartDay) {
        continue; // Not this member's billing day
      }

      console.log(`[process-monthly-credits] Processing member ${member.id} (${member.membership_type})`);

      const tierCredits = getTierCredits(member.membership_type);
      
      // Skip if tier has no credits
      if (tierCredits.class === 0 && tierCredits.red_light === 0 && tierCredits.dry_cryo === 0) {
        console.log(`[process-monthly-credits] Member ${member.id} tier has no credits, skipping`);
        skipped++;
        continue;
      }

      // Calculate new cycle dates
      const cycleStart = today;
      const nextCycleStart = addMonths(cycleStart, 1);
      const cycleEnd = subDays(nextCycleStart, 1);
      const expiresAt = endOfDay(cycleEnd);

      const cycleStartStr = formatDate(cycleStart);
      const cycleEndStr = formatDate(cycleEnd);

      // Check if credits already exist for this cycle
      const { data: existingCredits } = await supabase
        .from("member_credits")
        .select("id, credit_type")
        .eq("user_id", member.user_id)
        .eq("cycle_start", cycleStartStr);

      const existingTypes = new Set(existingCredits?.map((c: any) => c.credit_type) || []);

      const creditsToCreate: any[] = [];

      if (tierCredits.class > 0 && !existingTypes.has("class")) {
        creditsToCreate.push({
          user_id: member.user_id,
          member_id: member.id,
          credit_type: "class",
          credits_total: tierCredits.class,
          credits_remaining: tierCredits.class,
          cycle_start: cycleStartStr,
          cycle_end: cycleEndStr,
          expires_at: expiresAt.toISOString(),
        });
      }

      if (tierCredits.red_light > 0 && !existingTypes.has("red_light")) {
        creditsToCreate.push({
          user_id: member.user_id,
          member_id: member.id,
          credit_type: "red_light",
          credits_total: tierCredits.red_light,
          credits_remaining: tierCredits.red_light,
          cycle_start: cycleStartStr,
          cycle_end: cycleEndStr,
          expires_at: expiresAt.toISOString(),
        });
      }

      if (tierCredits.dry_cryo > 0 && !existingTypes.has("dry_cryo")) {
        creditsToCreate.push({
          user_id: member.user_id,
          member_id: member.id,
          credit_type: "dry_cryo",
          credits_total: tierCredits.dry_cryo,
          credits_remaining: tierCredits.dry_cryo,
          cycle_start: cycleStartStr,
          cycle_end: cycleEndStr,
          expires_at: expiresAt.toISOString(),
        });
      }

      if (creditsToCreate.length > 0) {
        const { error: insertError } = await supabase
          .from("member_credits")
          .insert(creditsToCreate);

        if (insertError) {
          console.error(`[process-monthly-credits] Error creating credits for member ${member.id}:`, insertError);
        } else {
          console.log(`[process-monthly-credits] Created ${creditsToCreate.length} credits for member ${member.id}`);
          creditsCreated += creditsToCreate.length;
        }
      } else {
        console.log(`[process-monthly-credits] Credits already exist for member ${member.id} this cycle`);
        skipped++;
      }
    }

    console.log(`[process-monthly-credits] Complete. Created: ${creditsCreated}, Skipped: ${skipped}`);

    return new Response(
      JSON.stringify({
        success: true,
        creditsCreated,
        skipped,
        processedAt: new Date().toISOString(),
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error: any) {
    console.error("[process-monthly-credits] Error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
