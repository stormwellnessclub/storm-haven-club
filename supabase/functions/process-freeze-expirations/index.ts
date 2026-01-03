import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const logStep = (step: string, details?: unknown) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[PROCESS-FREEZE-EXPIRATIONS] ${step}${detailsStr}`);
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    logStep("Starting freeze expiration check");

    const today = new Date().toISOString().split('T')[0];

    // Find all active freezes where the end date has passed
    const { data: expiredFreezes, error: fetchError } = await supabase
      .from('member_freezes')
      .select('id, member_id, actual_end_date')
      .eq('status', 'active')
      .lte('actual_end_date', today);

    if (fetchError) {
      logStep("Error fetching expired freezes", { error: fetchError });
      throw fetchError;
    }

    if (!expiredFreezes || expiredFreezes.length === 0) {
      logStep("No expired freezes found");
      return new Response(
        JSON.stringify({ processed: 0, message: "No expired freezes to process" }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      );
    }

    logStep(`Found ${expiredFreezes.length} expired freezes to process`);

    let processedCount = 0;
    const errors: string[] = [];

    for (const freeze of expiredFreezes) {
      try {
        // Update freeze status to completed
        const { error: freezeUpdateError } = await supabase
          .from('member_freezes')
          .update({
            status: 'completed',
            updated_at: new Date().toISOString(),
          })
          .eq('id', freeze.id);

        if (freezeUpdateError) {
          errors.push(`Failed to update freeze ${freeze.id}: ${freezeUpdateError.message}`);
          continue;
        }

        // Reactivate the member
        const { error: memberUpdateError } = await supabase
          .from('members')
          .update({
            status: 'active',
            updated_at: new Date().toISOString(),
          })
          .eq('id', freeze.member_id);

        if (memberUpdateError) {
          errors.push(`Failed to reactivate member ${freeze.member_id}: ${memberUpdateError.message}`);
          continue;
        }

        logStep(`Processed freeze expiration`, { freezeId: freeze.id, memberId: freeze.member_id });
        processedCount++;

        // TODO: Send reactivation email to member
        // This would call the send-email function with freeze_completed template

      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        errors.push(`Error processing freeze ${freeze.id}: ${message}`);
      }
    }

    logStep(`Completed processing`, { processed: processedCount, errors: errors.length });

    return new Response(
      JSON.stringify({
        processed: processedCount,
        total: expiredFreezes.length,
        errors: errors.length > 0 ? errors : undefined,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );
  } catch (error: unknown) {
    console.error("Freeze expiration processing error:", error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
