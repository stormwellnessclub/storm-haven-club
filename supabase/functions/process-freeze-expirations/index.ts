import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { requireTrustedCaller } from "../_shared/requireTrustedCaller.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";

import { completeFreezeBilling, detroitDateISO } from "../_shared/freezeResume.ts";

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

  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  const _auth = await requireTrustedCaller(req);
  if (!_auth.ok) return _auth.response;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);


  try {
    logStep("Starting freeze expiration check");

    const today = detroitDateISO();

    // Find all active freezes where the end date has passed
    const { data: expiredFreezes, error: fetchError } = await supabase
      .from('member_freezes')
      .select('id, member_id, actual_end_date')
      .eq('status', 'active')
      .or(`billing_resume_date.not.is.null,actual_end_date.lte.${today},and(actual_end_date.is.null,requested_end_date.lte.${today})`);

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

    const stripeKey = Deno.env.get('STRIPE_SECRET_KEY');
    const stripe = stripeKey ? new Stripe(stripeKey, { apiVersion: '2025-08-27.basil' }) : null;

    for (const freeze of expiredFreezes) {
      try {
        // Get member details for email and subscription IDs
        const { data: memberData, error: memberFetchError } = await supabase
          .from('members')
          .select('id, email, first_name, last_name, status, stripe_subscription_id, annual_fee_subscription_id')
          .eq('id', freeze.member_id)
          .single();

        if (memberFetchError) {
          errors.push(`Failed to fetch member ${freeze.member_id}: ${memberFetchError.message}`);
          continue;
        }

        if (!stripe) throw new Error('Stripe billing is not configured');
        const result = await completeFreezeBilling(supabase, stripe, freeze.id, false);
        if (!result.completed) continue;

        logStep(`Processed freeze expiration`, { freezeId: freeze.id, memberId: freeze.member_id });
        processedCount++;

        // Send reactivation email to member
        if (memberData?.email && (memberData.first_name || memberData.last_name)) {
          try {
            const memberName = memberData.first_name && memberData.last_name 
              ? `${memberData.first_name} ${memberData.last_name}`
              : memberData.first_name || memberData.last_name || 'Member';

            const { error: emailError } = await supabase.functions.invoke('send-email', {
              body: {
                type: 'freeze_completed',
                to: memberData.email,
                data: {
                  name: memberName,
                  freezeEndDate: result.resumeDate,
                  freezeId: freeze.id,
                  source: 'process-freeze-expirations', // Track where this email was triggered from
                },
              },
            });

            if (emailError) {
              logStep("Failed to send freeze completion email", { 
                memberId: freeze.member_id, 
                error: emailError 
              });
              // Don't fail the process if email fails
            } else {
              logStep("Freeze completion email sent", { 
                memberId: freeze.member_id, 
                email: memberData.email 
              });
            }
          } catch (emailError) {
            logStep("Error sending freeze completion email", { 
              memberId: freeze.member_id, 
              error: emailError 
            });
            // Don't fail the process if email fails
          }
        } else {
          logStep("Skipping freeze completion email - no email or name", { 
            memberId: freeze.member_id 
          });
        }

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
