import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const logStep = (step: string, details?: unknown) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[SYNC-SUBSCRIPTION-STATUS] ${step}${detailsStr}`);
};

const logError = (error: unknown, context?: string) => {
  const errorMessage = error instanceof Error ? error.message : String(error);
  const errorStack = error instanceof Error ? error.stack : undefined;
  const contextStr = context ? `[${context}] ` : '';
  console.error(`[SYNC-SUBSCRIPTION-STATUS] ERROR ${contextStr}${errorMessage}`, errorStack || '');
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: CORS_HEADERS, status: 204 });
  }

  try {
    // Validate environment variables
    const stripeSecretKey = Deno.env.get('STRIPE_SECRET_KEY');
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!stripeSecretKey || !supabaseUrl || !supabaseServiceKey) {
      logError("Missing required environment variables", "CONFIG");
      return new Response(
        JSON.stringify({ error: "Missing required environment variables" }),
        { headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }, status: 500 }
      );
    }

    const stripe = new Stripe(stripeSecretKey, { apiVersion: '2025-08-27.basil' });
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    logStep("Starting subscription status sync");

    // Get all members with Stripe subscriptions
    const { data: members, error: membersError } = await supabase
      .from('members')
      .select('id, stripe_subscription_id, status, email, first_name, last_name')
      .not('stripe_subscription_id', 'is', null)
      .in('status', ['active', 'past_due', 'cancelled']); // Only sync these statuses

    if (membersError) {
      logError(membersError, "MEMBERS_FETCH");
      throw membersError;
    }

    if (!members || members.length === 0) {
      logStep("No members with subscriptions found");
      return new Response(
        JSON.stringify({ 
          synced: 0, 
          discrepancies: 0, 
          errors: 0,
          message: "No members with subscriptions found"
        }),
        { headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }, status: 200 }
      );
    }

    logStep(`Found ${members.length} members with subscriptions`);

    let syncedCount = 0;
    let discrepancyCount = 0;
    let errorCount = 0;
    const discrepancies: Array<{
      member_id: string;
      member_name: string;
      current_status: string;
      stripe_status: string;
      subscription_id: string;
    }> = [];
    const errors: Array<{
      member_id: string;
      subscription_id: string;
      error: string;
    }> = [];

    // Process each member
    for (const member of members) {
      try {
        if (!member.stripe_subscription_id) continue;

        // Fetch subscription from Stripe
        const subscription = await stripe.subscriptions.retrieve(member.stripe_subscription_id);

        // Map Stripe subscription status to member status
        let expectedStatus: string;
        let reason: string;

        if (subscription.status === 'active' || subscription.status === 'trialing') {
          expectedStatus = 'active';
          reason = 'sync_active';
        } else if (subscription.status === 'past_due' || subscription.status === 'unpaid') {
          expectedStatus = 'past_due';
          reason = 'sync_past_due';
        } else if (subscription.status === 'canceled' || subscription.status === 'incomplete_expired') {
          expectedStatus = 'cancelled';
          reason = 'sync_cancelled';
        } else {
          // For other statuses (incomplete, etc.), skip or handle appropriately
          logStep(`Skipping subscription with status: ${subscription.status}`, { 
            subscriptionId: subscription.id,
            memberId: member.id
          });
          continue;
        }

        // Check if status differs
        if (member.status !== expectedStatus) {
          discrepancyCount++;
          const memberName = `${member.first_name} ${member.last_name}`;
          discrepancies.push({
            member_id: member.id,
            member_name: memberName,
            current_status: member.status,
            stripe_status: subscription.status,
            subscription_id: subscription.id
          });

          logStep("Discrepancy found", {
            memberId: member.id,
            memberName,
            currentStatus: member.status,
            stripeStatus: subscription.status,
            expectedStatus
          });

          // Update status with history tracking
          const { error: updateError } = await supabase.rpc('update_subscription_status_with_history', {
            p_member_id: member.id,
            p_stripe_subscription_id: subscription.id,
            p_new_status: expectedStatus,
            p_reason: reason,
            p_stripe_event_id: null, // Manual sync, no event ID
            p_changed_by: 'system_sync',
            p_metadata: {
              sync_timestamp: new Date().toISOString(),
              stripe_status: subscription.status,
              previous_status: member.status
            }
          });

          if (updateError) {
            logError(updateError, "STATUS_UPDATE");
            errors.push({
              member_id: member.id,
              subscription_id: subscription.id,
              error: updateError.message
            });
            errorCount++;
          } else {
            syncedCount++;
            logStep("Status updated", {
              memberId: member.id,
              oldStatus: member.status,
              newStatus: expectedStatus
            });
          }
        } else {
          syncedCount++;
          logStep("Status matches", {
            memberId: member.id,
            status: member.status
          });
        }
      } catch (memberError) {
        errorCount++;
        const errorMessage = memberError instanceof Error ? memberError.message : String(memberError);
        logError(memberError, "MEMBER_SYNC");
        errors.push({
          member_id: member.id,
          subscription_id: member.stripe_subscription_id || 'unknown',
          error: errorMessage
        });

        // If subscription not found in Stripe, mark as cancelled
        if (memberError instanceof Error && memberError.message.includes('No such subscription')) {
          logStep("Subscription not found in Stripe - marking as cancelled", {
            memberId: member.id,
            subscriptionId: member.stripe_subscription_id
          });

          const { error: updateError } = await supabase.rpc('update_subscription_status_with_history', {
            p_member_id: member.id,
            p_stripe_subscription_id: member.stripe_subscription_id || '',
            p_new_status: 'cancelled',
            p_reason: 'subscription_not_found_in_stripe',
            p_stripe_event_id: null,
            p_changed_by: 'system_sync',
            p_metadata: {
              sync_timestamp: new Date().toISOString(),
              error: errorMessage
            }
          });

          if (updateError) {
            logError(updateError, "STATUS_UPDATE_NOT_FOUND");
          }
        }
      }
    }

    logStep("Sync completed", {
      total: members.length,
      synced: syncedCount,
      discrepancies: discrepancyCount,
      errors: errorCount
    });

    return new Response(
      JSON.stringify({
        success: true,
        summary: {
          total_members: members.length,
          synced: syncedCount,
          discrepancies: discrepancyCount,
          errors: errorCount
        },
        discrepancies: discrepancies,
        errors: errors
      }),
      { headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }, status: 200 }
    );
  } catch (error) {
    logError(error, "SYNC_ERROR");
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }),
      { headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
