import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, stripe-signature',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const logStep = (step: string, details?: unknown) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[STRIPE-WEBHOOK] ${step}${detailsStr}`);
};

const logError = (error: unknown, context?: string) => {
  const errorMessage = error instanceof Error ? error.message : String(error);
  const errorStack = error instanceof Error ? error.stack : undefined;
  const contextStr = context ? `[${context}] ` : '';
  console.error(`[STRIPE-WEBHOOK] ERROR ${contextStr}${errorMessage}`, errorStack || '');
};

// Credit allocations by tier
const TIER_CREDITS: Record<string, { class: number; red_light: number; dry_cryo: number }> = {
  silver: { class: 0, red_light: 0, dry_cryo: 0 },
  gold: { class: 0, red_light: 4, dry_cryo: 2 },
  platinum: { class: 0, red_light: 6, dry_cryo: 4 },
  diamond: { class: 10, red_light: 10, dry_cryo: 6 },
};

// Class pass details - Updated to match new categories
const CLASS_PASS_CONFIG: Record<string, { category: string; classes: number; validityDays: number }> = {
  'single_pilatesCycling': { category: 'reformer', classes: 1, validityDays: 7 },
  'tenPack_pilatesCycling': { category: 'reformer', classes: 10, validityDays: 60 },
  'single_cycling': { category: 'cycling', classes: 1, validityDays: 7 },
  'tenPack_cycling': { category: 'cycling', classes: 10, validityDays: 60 },
  'single_otherClasses': { category: 'aerobics', classes: 1, validityDays: 7 },
  'tenPack_otherClasses': { category: 'aerobics', classes: 10, validityDays: 60 },
};

// Helper to return success response (HTTP 200)
const successResponse = (data?: unknown) => {
  return new Response(JSON.stringify({ received: true, ...(data ? { data } : {}) }), {
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    status: 200,
  });
};

// Helper to return error response that Stripe will accept (HTTP 200 with error in body)
const errorResponse = (error: unknown, context?: string) => {
  const errorMessage = error instanceof Error ? error.message : String(error);
  logError(error, context);
  return new Response(JSON.stringify({ 
    received: true, 
    error: errorMessage,
    context: context || 'unknown',
    timestamp: new Date().toISOString(),
  }), {
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    status: 200, // Return 200 so Stripe doesn't retry for non-critical errors
  });
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: CORS_HEADERS, status: 204 });
  }

  // Validate environment variables
  const stripeSecretKey = Deno.env.get('STRIPE_SECRET_KEY');
  const webhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET');
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  
  if (!stripeSecretKey) {
    logError("STRIPE_SECRET_KEY is not configured", "CONFIG");
    return new Response(JSON.stringify({ 
      received: false, 
      error: "Configuration error: STRIPE_SECRET_KEY missing",
      critical: true,
    }), { 
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      status: 200, // Return 200 but mark as critical so it's logged
    });
  }

  if (!webhookSecret) {
    logError("STRIPE_WEBHOOK_SECRET is not configured", "CONFIG");
    return new Response(JSON.stringify({ 
      received: false, 
      error: "Configuration error: STRIPE_WEBHOOK_SECRET missing",
      critical: true,
    }), { 
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      status: 200, // Return 200 but mark as critical
    });
  }

  if (!supabaseUrl || !supabaseServiceKey) {
    logError("Supabase environment variables missing", "CONFIG");
    return new Response(JSON.stringify({ 
      received: false, 
      error: "Configuration error: Supabase credentials missing",
      critical: true,
    }), { 
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      status: 200,
    });
  }

  const stripe = new Stripe(stripeSecretKey, { apiVersion: '2025-08-27.basil' });
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    const body = await req.text();
    let event: Stripe.Event;

    // Verify webhook signature (mandatory for security)
    const signature = req.headers.get('stripe-signature');
    if (!signature) {
      logError("Missing stripe-signature header", "SECURITY");
      // Return 400 for security-related failures - Stripe should retry with proper signature
      return new Response(JSON.stringify({ 
        received: false, 
        error: "Missing signature header",
        security: true,
      }), { 
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
        status: 400,
      });
    }
    
    try {
      event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
    } catch (signatureError) {
      logError(signatureError, "SECURITY");
      // Return 401 for invalid signature - security failure
      return new Response(JSON.stringify({ 
        received: false, 
        error: "Invalid signature",
        security: true,
      }), { 
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
        status: 401,
      });
    }

    logStep(`Received event: ${event.type}`, { eventId: event.id });

    // Check for duplicate processing (idempotency check)
    // In a production system, you might want to store processed event IDs
    // For now, we'll rely on database constraints and graceful error handling

    switch (event.type) {
      case 'checkout.session.completed': {
        try {
          const session = event.data.object as Stripe.Checkout.Session;
          const metadata = session.metadata || {};
          
          logStep("Checkout completed", { sessionId: session.id, type: metadata.type });

          if (metadata.type === 'membership_activation') {
            // Handle membership activation
            const memberId = metadata.member_id;
            const userId = metadata.user_id;
            const tier = metadata.tier;
            const gender = metadata.gender;
            const isFoundingMember = metadata.is_founding_member === 'true';
            const startDate = metadata.start_date;

            if (!memberId || !userId) {
              logError("Missing member_id or user_id in metadata", "MEMBERSHIP_ACTIVATION");
              return errorResponse(new Error("Missing required metadata: member_id or user_id"), "MEMBERSHIP_ACTIVATION");
            }

            // Get subscription ID from session
            const subscriptionId = session.subscription as string;
            
            // Update member record with Stripe info and activate
            try {
              const { error: updateError } = await supabase
                .from('members')
                .update({
                  status: 'active',
                  stripe_customer_id: session.customer as string,
                  stripe_subscription_id: subscriptionId,
                  billing_type: isFoundingMember ? 'annual' : 'monthly',
                  is_founding_member: isFoundingMember,
                  gender: gender,
                  activated_at: new Date().toISOString(),
                  membership_start_date: startDate,
                })
                .eq('id', memberId);

              if (updateError) {
                logError(updateError, "MEMBERSHIP_ACTIVATION");
                // Continue anyway - we'll try to create credits but log the error
              } else {
                logStep("Member activated", { memberId, tier, isFoundingMember });
              }
            } catch (dbError) {
              logError(dbError, "MEMBERSHIP_ACTIVATION");
            }

            // Create initial credits based on tier (handle partial failures)
            try {
              const credits = TIER_CREDITS[tier] || TIER_CREDITS.silver;
              const cycleStart = new Date(startDate || new Date());
              const cycleEnd = new Date(cycleStart);
              cycleEnd.setMonth(cycleEnd.getMonth() + 1);
              const expiresAt = new Date(cycleEnd);
              expiresAt.setDate(expiresAt.getDate() + 7); // 7 day grace period

              const creditTypes = ['class', 'red_light', 'dry_cryo'] as const;
              for (const creditType of creditTypes) {
                try {
                  const creditAmount = credits[creditType];
                  if (creditAmount > 0) {
                    const { error: creditError } = await supabase
                      .from('member_credits')
                      .insert({
                        member_id: memberId,
                        user_id: userId,
                        credit_type: creditType,
                        credits_total: creditAmount,
                        credits_remaining: creditAmount,
                        cycle_start: cycleStart.toISOString().split('T')[0],
                        cycle_end: cycleEnd.toISOString().split('T')[0],
                        expires_at: expiresAt.toISOString(),
                      });

                    if (creditError) {
                      logError(creditError, `CREDIT_CREATION_${creditType}`);
                    } else {
                      logStep(`Created ${creditType} credits`, { amount: creditAmount });
                    }
                  }
                } catch (creditError) {
                  logError(creditError, `CREDIT_CREATION_${creditType}`);
                  // Continue with other credit types
                }
              }
            } catch (creditError) {
              logError(creditError, "CREDIT_CREATION");
            }

          } else if (metadata.type === 'class_pass') {
            // Handle class pass purchase
            const userId = metadata.user_id;
            const category = metadata.category;
            const passType = metadata.pass_type;
            const isMember = metadata.is_member === 'true';

            if (!userId || !category || !passType) {
              logError("Missing required metadata for class_pass", "CLASS_PASS");
              return errorResponse(new Error("Missing required metadata: user_id, category, or pass_type"), "CLASS_PASS");
            }

            // Map old category names to new ones for backward compatibility
            let mappedCategory = category;
            if (category === 'pilatesCycling') mappedCategory = 'reformer';
            if (category === 'otherClasses') mappedCategory = 'aerobics';

            const configKey = `${passType}_${category}`;
            const altConfigKey = `${passType}_${mappedCategory}`;
            let config = CLASS_PASS_CONFIG[configKey] || CLASS_PASS_CONFIG[altConfigKey];

            if (!config) {
              // Try to infer from category if exact match not found
              const defaultConfig = {
                'reformer': { category: 'reformer', classes: passType === 'tenPack' ? 10 : 1, validityDays: passType === 'tenPack' ? 60 : 7 },
                'cycling': { category: 'cycling', classes: passType === 'tenPack' ? 10 : 1, validityDays: passType === 'tenPack' ? 60 : 7 },
                'aerobics': { category: 'aerobics', classes: passType === 'tenPack' ? 10 : 1, validityDays: passType === 'tenPack' ? 60 : 7 },
              };
              config = defaultConfig[mappedCategory as keyof typeof defaultConfig] || defaultConfig.aerobics;
            }

            // Get member ID if user is a member
            let memberId: string | null = null;
            if (isMember) {
              try {
                const { data: memberData } = await supabase
                  .from('members')
                  .select('id')
                  .eq('user_id', userId)
                  .eq('status', 'active')
                  .maybeSingle();
                
                memberId = memberData?.id || null;
              } catch (memberError) {
                logError(memberError, "CLASS_PASS_MEMBER_LOOKUP");
                // Continue without member ID
              }
            }

            // Calculate expiry date
            const expiresAt = new Date();
            expiresAt.setDate(expiresAt.getDate() + config.validityDays);

            // Create class pass record
            try {
              const { error: passError } = await supabase
                .from('class_passes')
                .insert({
                  user_id: userId,
                  member_id: memberId,
                  category: config.category,
                  pass_type: passType === 'tenPack' ? '10-pack' : 'single',
                  classes_total: config.classes,
                  classes_remaining: config.classes,
                  price_paid: session.amount_total ? session.amount_total / 100 : 0,
                  is_member_price: isMember,
                  expires_at: expiresAt.toISOString(),
                  status: 'active',
                });

              if (passError) {
                logError(passError, "CLASS_PASS_CREATION");
                return errorResponse(passError, "CLASS_PASS_CREATION");
              }

              logStep("Class pass created", { userId, category, passType, classes: config.classes });
            } catch (passError) {
              logError(passError, "CLASS_PASS_CREATION");
              return errorResponse(passError, "CLASS_PASS_CREATION");
            }

          } else if (metadata.type === 'freeze_fee') {
            // Handle freeze fee payment
            const freezeId = metadata.freeze_id;

            if (!freezeId) {
              logError("Missing freeze_id in metadata", "FREEZE_FEE");
              return errorResponse(new Error("Missing freeze_id in metadata"), "FREEZE_FEE");
            }

            try {
              // Get the freeze request to get member_id
              const { data: freezeData, error: fetchError } = await supabase
                .from('member_freezes')
                .select('member_id, actual_start_date')
                .eq('id', freezeId)
                .single();

              if (fetchError || !freezeData) {
                logError(fetchError || new Error("Freeze not found"), "FREEZE_FEE_FETCH");
                return errorResponse(fetchError || new Error("Freeze not found"), "FREEZE_FEE_FETCH");
              }

              // Update freeze request to paid and active
              const { error: freezeUpdateError } = await supabase
                .from('member_freezes')
                .update({
                  fee_paid: true,
                  stripe_payment_intent_id: session.payment_intent as string,
                  status: 'active',
                  updated_at: new Date().toISOString(),
                })
                .eq('id', freezeId);

              if (freezeUpdateError) {
                logError(freezeUpdateError, "FREEZE_FEE_UPDATE");
                return errorResponse(freezeUpdateError, "FREEZE_FEE_UPDATE");
              }

              // Update member status to frozen (handle partial failure)
              try {
                const { error: memberUpdateError } = await supabase
                  .from('members')
                  .update({
                    status: 'frozen',
                    updated_at: new Date().toISOString(),
                  })
                  .eq('id', freezeData.member_id);

                if (memberUpdateError) {
                  logError(memberUpdateError, "FREEZE_MEMBER_UPDATE");
                }
              } catch (memberError) {
                logError(memberError, "FREEZE_MEMBER_UPDATE");
              }

              logStep("Freeze fee payment processed", { freezeId, memberId: freezeData.member_id });
            } catch (freezeError) {
              logError(freezeError, "FREEZE_FEE");
              return errorResponse(freezeError, "FREEZE_FEE");
            }

          } else if (metadata.type === 'annual_fee_payment') {
            // Handle annual fee payment
            const memberId = metadata.member_id;
            const userId = metadata.user_id;

            if (!memberId) {
              logError("Missing member_id in annual fee metadata", "ANNUAL_FEE");
              return errorResponse(new Error("Missing member_id in annual fee metadata"), "ANNUAL_FEE");
            }

            try {
              // Update member record with annual fee payment date
              const { error: updateError } = await supabase
                .from('members')
                .update({
                  annual_fee_paid_at: new Date().toISOString(),
                  updated_at: new Date().toISOString(),
                })
                .eq('id', memberId);

              if (updateError) {
                logError(updateError, "ANNUAL_FEE_UPDATE");
                return errorResponse(updateError, "ANNUAL_FEE_UPDATE");
              }

              logStep("Annual fee payment processed", { memberId, userId });
            } catch (annualFeeError) {
              logError(annualFeeError, "ANNUAL_FEE");
              return errorResponse(annualFeeError, "ANNUAL_FEE");
            }
          } else {
            logStep("Unknown checkout type", { type: metadata.type, sessionId: session.id });
          }
        } catch (checkoutError) {
          logError(checkoutError, "CHECKOUT_SESSION_COMPLETED");
          return errorResponse(checkoutError, "CHECKOUT_SESSION_COMPLETED");
        }
        break;
      }

      case 'customer.subscription.updated': {
        try {
          const subscription = event.data.object as Stripe.Subscription;
          logStep("Subscription updated", { 
            subscriptionId: subscription.id, 
            status: subscription.status 
          });

          // Update member status based on subscription status
          if (subscription.status === 'past_due' || subscription.status === 'unpaid') {
            try {
              const { error } = await supabase
                .from('members')
                .update({ status: 'past_due' })
                .eq('stripe_subscription_id', subscription.id);

              if (error) {
                logError(error, "SUBSCRIPTION_UPDATE_PAST_DUE");
              }
            } catch (updateError) {
              logError(updateError, "SUBSCRIPTION_UPDATE_PAST_DUE");
            }
          } else if (subscription.status === 'active') {
            try {
              const { error } = await supabase
                .from('members')
                .update({ status: 'active' })
                .eq('stripe_subscription_id', subscription.id);

              if (error) {
                logError(error, "SUBSCRIPTION_UPDATE_ACTIVE");
              }
            } catch (updateError) {
              logError(updateError, "SUBSCRIPTION_UPDATE_ACTIVE");
            }
          }
        } catch (subscriptionError) {
          logError(subscriptionError, "SUBSCRIPTION_UPDATED");
          return errorResponse(subscriptionError, "SUBSCRIPTION_UPDATED");
        }
        break;
      }

      case 'customer.subscription.deleted': {
        try {
          const subscription = event.data.object as Stripe.Subscription;
          logStep("Subscription deleted", { subscriptionId: subscription.id });

          const { error } = await supabase
            .from('members')
            .update({ status: 'cancelled' })
            .eq('stripe_subscription_id', subscription.id);

          if (error) {
            logError(error, "SUBSCRIPTION_DELETED");
          }
        } catch (subscriptionError) {
          logError(subscriptionError, "SUBSCRIPTION_DELETED");
          return errorResponse(subscriptionError, "SUBSCRIPTION_DELETED");
        }
        break;
      }

      case 'invoice.payment_failed': {
        try {
          const invoice = event.data.object as Stripe.Invoice;
          logStep("Payment failed", { invoiceId: invoice.id, customerId: invoice.customer });

          // Optionally update member status or send notification
          // For now, just log - could be enhanced to update status
        } catch (invoiceError) {
          logError(invoiceError, "INVOICE_PAYMENT_FAILED");
        }
        break;
      }

      default:
        logStep(`Unhandled event type: ${event.type}`, { eventId: event.id });
    }

    // Always return 200 for successful webhook receipt (even if processing had issues)
    return successResponse({ eventId: event.id, eventType: event.type });
  } catch (error: unknown) {
    // Catch-all for any unexpected errors
    logError(error, "WEBHOOK_HANDLER");
    // Return 200 so Stripe doesn't retry - error is logged
    return new Response(JSON.stringify({ 
      received: false, 
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString(),
    }), {
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      status: 200, // Return 200 to prevent Stripe retries for unexpected errors
    });
  }
});
