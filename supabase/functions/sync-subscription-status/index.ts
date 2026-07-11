import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { requireStaff } from "../_shared/requireStaff.ts";

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
    let options: {
      syncSubscriptions: boolean;
      syncPaymentMethods: boolean;
      syncCustomerIds: boolean;
      dryRun: boolean;
      member_id?: string;
    } = {
      syncSubscriptions: true,
      syncPaymentMethods: true,
      syncCustomerIds: true,
      dryRun: false,
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

    // Get members to process. If member_id provided, sync only that one;
    // otherwise sync all active/past_due/pending_activation/frozen members.
    const baseQuery = supabase
      .from('members')
      .select('id, stripe_customer_id, stripe_subscription_id, subscription_status, status, email, first_name, last_name, card_last4, card_brand, card_exp_month, card_exp_year');

    const { data: members, error: membersError } = options.member_id
      ? await baseQuery.eq('id', options.member_id)
      : await baseQuery.in('status', ['active', 'past_due', 'pending_activation', 'frozen']);

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
            let shouldClearSubscription = false;
            
            // Always sync the subscription_status column to match Stripe
            const memberAny = member as typeof member & { subscription_status?: string };
            if (memberAny.subscription_status !== subscription.status) {
              logStep("Syncing subscription_status", { 
                memberId: member.id, 
                old: memberAny.subscription_status, 
                new: subscription.status 
              });
              
              if (!options.dryRun) {
                await supabase
                  .from('members')
                  .update({ 
                    subscription_status: subscription.status,
                    updated_at: new Date().toISOString()
                  })
                  .eq('id', member.id);
              }
            }
            
            if (subscription.status === 'active' || subscription.status === 'trialing') {
              expectedStatus = 'active';
            } else if (subscription.status === 'past_due' || subscription.status === 'unpaid') {
              expectedStatus = 'past_due';
            } else if (subscription.status === 'canceled' || subscription.status === 'incomplete_expired') {
              // POLICY: Stripe subscription cancellation must NOT auto-cancel the membership.
              // Membership lifecycle "cancelled" is owned exclusively by the Application Portal
              // (for pending_activation members) or the dedicated activated-member cancellation
              // protocol. Here we only clear the dead subscription pointer and leave member.status
              // alone so it stays visible as a billing issue, not a lifecycle terminal state.
              expectedStatus = member.status; // no lifecycle change
              shouldClearSubscription = true;
            } else if (subscription.status === 'incomplete') {
              // Payment failed on initial subscription - keep subscription ID but mark status as incomplete
              issueCount++;
              logStep("Incomplete subscription found - payment failed before starting", { 
                memberId: member.id, 
                subscriptionId: member.stripe_subscription_id 
              });
              
              if (!options.dryRun) {
                await supabase
                  .from('members')
                  .update({ 
                    subscription_status: 'incomplete',
                    updated_at: new Date().toISOString()
                  })
                  .eq('id', member.id);
                fixedCount++;
              }
              
              results.push({
                member_id: member.id,
                member_name: memberName,
                issue_type: 'incomplete_subscription',
                details: `Subscription payment failed before starting - status set to 'incomplete'. Member benefits frozen until payment succeeds.`,
                fixed: !options.dryRun
              });
              
              continue; // Move to next member after handling incomplete
            } else {
              continue; // Skip other unknown statuses
            }

            // Clear dead subscription IDs for canceled/expired subscriptions
            // Only clear if the subscription being synced matches the stored one
            if (shouldClearSubscription) {
              if (member.stripe_subscription_id === subscription.id) {
                issueCount++;
                logStep("Dead subscription found - clearing subscription ID", { 
                  memberId: member.id, 
                  subscriptionId: member.stripe_subscription_id,
                  stripeStatus: subscription.status
                });
                
                if (!options.dryRun) {
                  await supabase
                    .from('members')
                    .update({ 
                      stripe_subscription_id: null,
                      subscription_status: 'none',
                      updated_at: new Date().toISOString()
                    })
                    .eq('id', member.id);
                  fixedCount++;
                }
                
                results.push({
                  member_id: member.id,
                  member_name: memberName,
                  issue_type: 'dead_subscription_cleared',
                  details: `Subscription ${member.stripe_subscription_id} is ${subscription.status} - ID cleared from database`,
                  fixed: !options.dryRun
                });
              } else {
                logStep("Canceled subscription does not match stored subscription - skipping clear", {
                  memberId: member.id,
                  canceledSubId: subscription.id,
                  storedSubId: member.stripe_subscription_id
                });
              }
              
              continue;
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
              
              // Clear the orphaned subscription ID
              if (!options.dryRun) {
                await supabase
                  .from('members')
                  .update({ 
                    stripe_subscription_id: null,
                    updated_at: new Date().toISOString()
                  })
                  .eq('id', member.id);
                fixedCount++;
              }
              
              results.push({
                member_id: member.id,
                member_name: memberName,
                issue_type: 'orphaned_subscription_id',
                details: `Subscription ${member.stripe_subscription_id} not found in Stripe - ID cleared`,
                fixed: !options.dryRun
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