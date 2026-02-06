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

interface SyncResult {
  member_id: string;
  member_name: string;
  issue_type: string;
  details: string;
  fixed: boolean;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: CORS_HEADERS, status: 204 });
  }

  try {
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

    // Parse request body for options
    let options = { 
      syncSubscriptions: true, 
      syncPaymentMethods: true,
      syncCustomerIds: true,
      dryRun: false 
    };
    
    try {
      const body = await req.json();
      options = { ...options, ...body };
    } catch {
      // Use defaults if no body
    }

    logStep("Starting comprehensive sync", options);

    const results: SyncResult[] = [];
    let fixedCount = 0;
    let issueCount = 0;

    // Get all active/past_due members
    const { data: members, error: membersError } = await supabase
      .from('members')
      .select('id, stripe_customer_id, stripe_subscription_id, status, email, first_name, last_name, card_last4, card_brand, card_exp_month, card_exp_year')
      .in('status', ['active', 'past_due', 'pending_activation', 'frozen']);

    if (membersError) {
      logError(membersError, "MEMBERS_FETCH");
      throw membersError;
    }

    if (!members || members.length === 0) {
      logStep("No members found to sync");
      return new Response(
        JSON.stringify({ success: true, message: "No members to sync", results: [] }),
        { headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }, status: 200 }
      );
    }

    logStep(`Found ${members.length} members to process`);

    for (const member of members) {
      const memberName = `${member.first_name} ${member.last_name}`;
      
      try {
        // === SYNC CUSTOMER IDs ===
        if (options.syncCustomerIds && !member.stripe_customer_id && member.email) {
          logStep("Member missing Stripe customer ID, searching by email", { memberId: member.id, email: member.email });
          
          const customers = await stripe.customers.list({ email: member.email, limit: 1 });
          
          if (customers.data.length > 0) {
            const customerId = customers.data[0].id;
            issueCount++;
            
            if (!options.dryRun) {
              await supabase
                .from('members')
                .update({ stripe_customer_id: customerId, updated_at: new Date().toISOString() })
                .eq('id', member.id);
              fixedCount++;
            }
            
            results.push({
              member_id: member.id,
              member_name: memberName,
              issue_type: 'missing_customer_id',
              details: `Found customer ${customerId} by email lookup`,
              fixed: !options.dryRun
            });
            
            // Update local reference for subsequent checks
            member.stripe_customer_id = customerId;
          }
        }

        // === SYNC PAYMENT METHODS ===
        if (options.syncPaymentMethods && member.stripe_customer_id) {
          const paymentMethods = await stripe.paymentMethods.list({
            customer: member.stripe_customer_id,
            type: 'card',
            limit: 1
          });

          if (paymentMethods.data.length > 0) {
            const pm = paymentMethods.data[0];
            const card = pm.card;
            
            if (card) {
              const dbCard = {
                last4: member.card_last4,
                brand: member.card_brand,
                exp_month: member.card_exp_month,
                exp_year: member.card_exp_year
              };
              
              const stripeCard = {
                last4: card.last4,
                brand: card.brand,
                exp_month: card.exp_month,
                exp_year: card.exp_year
              };
              
              // Check for mismatches
              const hasMismatch = 
                dbCard.last4 !== stripeCard.last4 ||
                dbCard.brand !== stripeCard.brand ||
                dbCard.exp_month !== stripeCard.exp_month ||
                dbCard.exp_year !== stripeCard.exp_year;
              
              if (hasMismatch) {
                issueCount++;
                logStep("Payment method mismatch", { memberId: member.id, db: dbCard, stripe: stripeCard });
                
                if (!options.dryRun) {
                  await supabase
                    .from('members')
                    .update({
                      card_last4: stripeCard.last4,
                      card_brand: stripeCard.brand,
                      card_exp_month: stripeCard.exp_month,
                      card_exp_year: stripeCard.exp_year,
                      updated_at: new Date().toISOString()
                    })
                    .eq('id', member.id);
                  fixedCount++;
                }
                
                results.push({
                  member_id: member.id,
                  member_name: memberName,
                  issue_type: 'payment_method_mismatch',
                  details: `DB: ${dbCard.brand || 'none'} ****${dbCard.last4 || 'none'} → Stripe: ${stripeCard.brand} ****${stripeCard.last4}`,
                  fixed: !options.dryRun
                });
              }
            }
          } else if (member.card_last4) {
            // Member has card data but no payment method in Stripe
            issueCount++;
            results.push({
              member_id: member.id,
              member_name: memberName,
              issue_type: 'orphaned_card_data',
              details: `DB has card ****${member.card_last4} but no payment method in Stripe`,
              fixed: false
            });
          }
        }

        // === SYNC SUBSCRIPTION STATUS ===
        if (options.syncSubscriptions && member.stripe_subscription_id) {
          try {
            const subscription = await stripe.subscriptions.retrieve(member.stripe_subscription_id);
            
            let expectedStatus: string;
            if (subscription.status === 'active' || subscription.status === 'trialing') {
              expectedStatus = 'active';
            } else if (subscription.status === 'past_due' || subscription.status === 'unpaid') {
              expectedStatus = 'past_due';
            } else if (subscription.status === 'canceled' || subscription.status === 'incomplete_expired') {
              expectedStatus = 'cancelled';
            } else {
              continue; // Skip incomplete, etc.
            }

            if (member.status !== expectedStatus && member.status !== 'frozen') {
              issueCount++;
              logStep("Status mismatch", { memberId: member.id, db: member.status, expected: expectedStatus });
              
              if (!options.dryRun) {
                await supabase.rpc('update_subscription_status_with_history', {
                  p_member_id: member.id,
                  p_new_status: expectedStatus,
                  p_change_reason: `sync_from_stripe_${subscription.status}`,
                  p_changed_by: 'system_sync'
                });
                fixedCount++;
              }
              
              results.push({
                member_id: member.id,
                member_name: memberName,
                issue_type: 'status_mismatch',
                details: `DB: ${member.status} → Stripe subscription: ${subscription.status} (expected: ${expectedStatus})`,
                fixed: !options.dryRun
              });
            }
          } catch (subError) {
            if (subError instanceof Error && subError.message.includes('No such subscription')) {
              issueCount++;
              results.push({
                member_id: member.id,
                member_name: memberName,
                issue_type: 'orphaned_subscription_id',
                details: `Subscription ${member.stripe_subscription_id} not found in Stripe`,
                fixed: false
              });
            }
          }
        }
      } catch (memberError) {
        const errorMessage = memberError instanceof Error ? memberError.message : String(memberError);
        logError(memberError, `MEMBER_${member.id}`);
        results.push({
          member_id: member.id,
          member_name: memberName,
          issue_type: 'error',
          details: errorMessage,
          fixed: false
        });
      }
    }

    logStep("Sync completed", { total: members.length, issues: issueCount, fixed: fixedCount });

    return new Response(
      JSON.stringify({
        success: true,
        summary: {
          total_members: members.length,
          issues_found: issueCount,
          issues_fixed: fixedCount,
          dry_run: options.dryRun
        },
        results
      }),
      { headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }, status: 200 }
    );
  } catch (error) {
    logError(error, "SYNC_ERROR");
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : 'Unknown error' }),
      { headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});