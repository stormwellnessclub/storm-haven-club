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
      // CRITICAL: Use constructEventAsync for Deno's async-only SubtleCrypto environment
      event = await stripe.webhooks.constructEventAsync(body, signature, webhookSecret);
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
    try {
      const { data: existingEvent, error: checkError } = await supabase
        .from('processed_webhook_events')
        .select('id, processed_at, processing_result')
        .eq('event_id', event.id)
        .maybeSingle();

      if (checkError && checkError.code !== 'PGRST116') { // PGRST116 is "not found" which is OK
        logError(checkError, "IDEMPOTENCY_CHECK");
        // Continue processing if check fails (log error but don't block)
      } else if (existingEvent) {
        logStep(`Event already processed: ${event.id}`, { 
          processedAt: existingEvent.processed_at,
          result: existingEvent.processing_result
        });
        // Return success - event already processed
        return successResponse({ 
          eventId: event.id, 
          eventType: event.type,
          alreadyProcessed: true,
          processedAt: existingEvent.processed_at
        });
      }
    } catch (idempotencyError) {
      logError(idempotencyError, "IDEMPOTENCY_CHECK");
      // Continue processing if idempotency check fails (log error but don't block)
    }

    // Store event ID immediately to prevent duplicate processing (race condition protection)
    try {
      const { error: insertError } = await supabase
        .from('processed_webhook_events')
        .insert({
          event_id: event.id,
          event_type: event.type,
          processed_at: new Date().toISOString(),
          processing_result: 'success',
          metadata: { received_at: new Date().toISOString() }
        });

      if (insertError) {
        // If insert fails (e.g., duplicate), event was already processed
        if (insertError.code === '23505') { // Unique violation
          logStep(`Event already processed (race condition): ${event.id}`);
          return successResponse({ 
            eventId: event.id, 
            eventType: event.type,
            alreadyProcessed: true
          });
        }
        logError(insertError, "IDEMPOTENCY_STORE");
        // Continue processing even if storing fails
      }
    } catch (storeError) {
      logError(storeError, "IDEMPOTENCY_STORE");
      // Continue processing even if storing fails
    }

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
            const annualFeeSkipped = metadata.annual_fee_skipped === 'true';
            const annualFeePriceId = metadata.annual_fee_price_id;
            
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
                  annual_fee_paid_at: annualFeeSkipped ? null : new Date().toISOString(), // Set initial payment date
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

            // Create annual fee subscription (separate recurring subscription) if not skipped
            if (!annualFeeSkipped && annualFeePriceId) {
              try {
                logStep("Creating annual fee subscription", { memberId, annualFeePriceId });
                
                // Get the subscription to use its default payment method
                const membershipSubscription = await stripe.subscriptions.retrieve(subscriptionId);
                const defaultPaymentMethodId = membershipSubscription.default_payment_method as string | null;
                
                if (!defaultPaymentMethodId) {
                  logError("No default payment method on membership subscription", "ANNUAL_FEE_SUBSCRIPTION");
                  // Continue - annual fee subscription creation will fail, but member is activated
                } else {
                  // Calculate annual fee billing anchor (1 year from start date)
                  const startDateObj = new Date(startDate);
                  const annualFeeAnchor = Math.floor(startDateObj.getTime() / 1000);
                  
                  // Create annual fee subscription (yearly recurring)
                  const annualFeeSubscription = await stripe.subscriptions.create({
                    customer: session.customer as string,
                    items: [{ price: annualFeePriceId }],
                    default_payment_method: defaultPaymentMethodId,
                    billing_cycle_anchor: annualFeeAnchor,
                    proration_behavior: 'none',
                    metadata: {
                      member_id: memberId,
                      user_id: userId,
                      type: 'annual_fee',
                    },
                  });

                  // Update member record with annual fee subscription ID
                  const { error: annualFeeUpdateError } = await supabase
                    .from('members')
                    .update({
                      annual_fee_subscription_id: annualFeeSubscription.id,
                    })
                    .eq('id', memberId);

                  if (annualFeeUpdateError) {
                    logError(annualFeeUpdateError, "ANNUAL_FEE_SUBSCRIPTION_UPDATE");
                  } else {
                    logStep("Annual fee subscription created", { 
                      memberId, 
                      annualFeeSubscriptionId: annualFeeSubscription.id 
                    });
                  }
                }
              } catch (annualFeeError) {
                logError(annualFeeError, "ANNUAL_FEE_SUBSCRIPTION_CREATION");
                // Don't fail the webhook - member is already activated
                // Annual fee subscription creation can be retried manually if needed
              }
            } else {
              logStep("Skipping annual fee subscription", { 
                memberId, 
                skipped: annualFeeSkipped, 
                hasPriceId: !!annualFeePriceId 
              });
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

          } else if (metadata.type === 'guest_pass') {
            // Handle guest pass purchase
            const userId = metadata.user_id; // Admin user who sold the pass
            const guestName = metadata.guest_name;
            const guestEmail = metadata.guest_email || null;

            if (!userId || !guestName) {
              logError("Missing required metadata for guest_pass", "GUEST_PASS");
              return errorResponse(new Error("Missing required metadata: user_id or guest_name"), "GUEST_PASS");
            }

            // Guest pass expires 1 day from purchase
            const expiresAt = new Date();
            expiresAt.setDate(expiresAt.getDate() + 1); // 1 day

            // Create guest pass record
            try {
              const { error: passError } = await supabase
                .from('guest_passes')
                .insert({
                  guest_name: guestName,
                  guest_email: guestEmail,
                  user_id: userId, // Admin user who sold the pass
                  price_paid: session.amount_total ? session.amount_total / 100 : 60.00,
                  status: 'active',
                  expires_at: expiresAt.toISOString(),
                  stripe_payment_intent_id: session.payment_intent as string,
                  stripe_session_id: session.id,
                  purchased_by: userId,
                });

              if (passError) {
                logError(passError, "GUEST_PASS_CREATION");
                return errorResponse(passError, "GUEST_PASS_CREATION");
              }

              logStep("Guest pass created", { userId, guestName, expiresAt: expiresAt.toISOString() });
            } catch (passError) {
              logError(passError, "GUEST_PASS_CREATION");
              return errorResponse(passError, "GUEST_PASS_CREATION");
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

          } else if (metadata.type === 'annual_fee_payment' || metadata.type === 'annual_fee_subscription') {
            // Handle annual fee payment (both one-time legacy and subscription)
            const memberId = metadata.member_id;
            const userId = metadata.user_id;

            if (!memberId) {
              logError("Missing member_id in annual fee metadata", "ANNUAL_FEE");
              return errorResponse(new Error("Missing member_id in annual fee metadata"), "ANNUAL_FEE");
            }

            try {
              // Build update object
              const updateData: Record<string, any> = {
                annual_fee_paid_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
              };

              // If this is a subscription checkout, store the subscription ID
              if (session.subscription) {
                updateData.annual_fee_subscription_id = session.subscription as string;
                logStep("Storing annual fee subscription ID", { subscriptionId: session.subscription });
              }

              // Update member record with annual fee payment date and subscription ID
              const { error: updateError } = await supabase
                .from('members')
                .update(updateData)
                .eq('id', memberId);

              if (updateError) {
                logError(updateError, "ANNUAL_FEE_UPDATE");
                return errorResponse(updateError, "ANNUAL_FEE_UPDATE");
              }

              logStep("Annual fee payment processed", { 
                memberId, 
                userId, 
                subscriptionId: session.subscription || 'one-time' 
              });
            } catch (annualFeeError) {
              logError(annualFeeError, "ANNUAL_FEE");
              return errorResponse(annualFeeError, "ANNUAL_FEE");
            }
          } else if (metadata.type === 'membership_dues') {
            // Handle self-service dues subscription checkout
            const memberId = metadata.member_id;
            const userId = metadata.user_id;
            const tier = metadata.tier;
            const billingType = metadata.billing_type;

            if (!memberId) {
              logError("Missing member_id in membership_dues metadata", "MEMBERSHIP_DUES");
              return errorResponse(new Error("Missing member_id in metadata"), "MEMBERSHIP_DUES");
            }

            // Get subscription ID from session
            const subscriptionId = session.subscription as string;

            if (!subscriptionId) {
              logError("No subscription ID in membership_dues session", "MEMBERSHIP_DUES");
              return errorResponse(new Error("No subscription ID in session"), "MEMBERSHIP_DUES");
            }

            try {
              // Update member record with subscription ID
              const updateData: Record<string, any> = {
                stripe_subscription_id: subscriptionId,
                stripe_customer_id: session.customer as string,
                updated_at: new Date().toISOString(),
              };

              // If billing_type was set, update it
              if (billingType) {
                updateData.billing_type = billingType;
              }

              const { error: updateError } = await supabase
                .from('members')
                .update(updateData)
                .eq('id', memberId);

              if (updateError) {
                logError(updateError, "MEMBERSHIP_DUES_UPDATE");
                return errorResponse(updateError, "MEMBERSHIP_DUES_UPDATE");
              }

              logStep("Membership dues subscription linked", { 
                memberId, 
                subscriptionId,
                tier,
                billingType
              });

              // Try to update card metadata from the subscription's default payment method
              try {
                const duesSubscription = await stripe.subscriptions.retrieve(subscriptionId);
                const defaultPMId = duesSubscription.default_payment_method as string | null;
                
                if (defaultPMId) {
                  const pm = await stripe.paymentMethods.retrieve(defaultPMId);
                  if (pm.card) {
                    await supabase
                      .from('members')
                      .update({
                        card_brand: pm.card.brand,
                        card_last4: pm.card.last4,
                        card_exp_month: pm.card.exp_month,
                        card_exp_year: pm.card.exp_year,
                      })
                      .eq('id', memberId);
                    logStep("Card metadata synced for dues", { last4: pm.card.last4 });
                  }
                }
              } catch (cardError) {
                logError(cardError, "MEMBERSHIP_DUES_CARD_SYNC");
                // Don't fail the webhook for card sync issues
              }

            } catch (duesError) {
              logError(duesError, "MEMBERSHIP_DUES");
              return errorResponse(duesError, "MEMBERSHIP_DUES");
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

          // Find member by subscription ID
          const { data: memberData, error: memberError } = await supabase
            .from('members')
            .select('id, status')
            .eq('stripe_subscription_id', subscription.id)
            .maybeSingle();

          if (memberError) {
            logError(memberError, "SUBSCRIPTION_UPDATE_MEMBER_LOOKUP");
          } else if (memberData) {
            // Map Stripe subscription status to member status
            let newStatus: string;
            let reason: string;

            if (subscription.status === 'past_due' || subscription.status === 'unpaid') {
              newStatus = 'past_due';
              reason = subscription.status === 'past_due' ? 'payment_past_due' : 'payment_unpaid';
            } else if (subscription.status === 'active') {
              newStatus = 'active';
              reason = 'subscription_active';
            } else if (subscription.status === 'canceled' || subscription.status === 'unpaid') {
              newStatus = 'cancelled';
              reason = subscription.status === 'canceled' ? 'subscription_canceled' : 'subscription_unpaid';
            } else {
              // For other statuses (trialing, incomplete, etc.), keep current status or handle appropriately
              logStep("Subscription status not mapped", { status: subscription.status });
              break;
            }

            // Update status with history tracking
            const { error: updateError } = await supabase.rpc('update_subscription_status_with_history', {
              p_member_id: memberData.id,
              p_stripe_subscription_id: subscription.id,
              p_new_status: newStatus,
              p_reason: reason,
              p_stripe_event_id: event.id,
              p_changed_by: 'stripe',
              p_metadata: { subscription_status: subscription.status }
            });

            if (updateError) {
              logError(updateError, "SUBSCRIPTION_UPDATE_STATUS");
            } else {
              logStep("Subscription status updated", { memberId: memberData.id, newStatus, reason });
            }
          } else {
            logStep("Member not found for subscription", { subscriptionId: subscription.id });
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

          // Find member by subscription ID
          const { data: memberData, error: memberError } = await supabase
            .from('members')
            .select('id')
            .eq('stripe_subscription_id', subscription.id)
            .maybeSingle();

          if (memberError) {
            logError(memberError, "SUBSCRIPTION_DELETED_MEMBER_LOOKUP");
          } else if (memberData) {
            // Update status with history tracking
            const { error: updateError } = await supabase.rpc('update_subscription_status_with_history', {
              p_member_id: memberData.id,
              p_stripe_subscription_id: subscription.id,
              p_new_status: 'cancelled',
              p_reason: 'subscription_deleted',
              p_stripe_event_id: event.id,
              p_changed_by: 'stripe',
              p_metadata: {}
            });

            if (updateError) {
              logError(updateError, "SUBSCRIPTION_DELETED");
            } else {
              logStep("Subscription deleted - member status updated", { memberId: memberData.id });
            }
          } else {
            logStep("Member not found for deleted subscription", { subscriptionId: subscription.id });
          }
        } catch (subscriptionError) {
          logError(subscriptionError, "SUBSCRIPTION_DELETED");
          return errorResponse(subscriptionError, "SUBSCRIPTION_DELETED");
        }
        break;
      }

      case 'invoice.payment_succeeded': {
        try {
          const invoice = event.data.object as Stripe.Invoice;
          logStep("Payment succeeded", { 
            invoiceId: invoice.id, 
            customerId: invoice.customer,
            subscriptionId: invoice.subscription
          });

          // Only process subscription invoices (skip one-time payments)
          if (!invoice.subscription) {
            logStep("Skipping non-subscription invoice", { invoiceId: invoice.id });
            break;
          }

          // Check if this is an annual fee subscription or membership subscription
          // Annual fee subscriptions: price_1SlA2BLyZrsSqLhs8VX17F0C (women), price_1SlA2RLyZrsSqLhsK3XQuANN (men)
          const annualFeePriceIds = ['price_1SlA2BLyZrsSqLhs8VX17F0C', 'price_1SlA2RLyZrsSqLhsK3XQuANN'];
          const isAnnualFeeInvoice = invoice.lines?.data?.some((line: Stripe.InvoiceLineItem) => 
            line.price && annualFeePriceIds.includes(line.price.id as string)
          ) || false;

          // Find member by subscription ID (check both membership and annual fee subscriptions)
          let memberData: { id: string; status: string } | null = null;
          let memberError: unknown = null;

          if (isAnnualFeeInvoice) {
            // Find member by annual fee subscription ID
            const { data, error } = await supabase
              .from('members')
              .select('id, status')
              .eq('annual_fee_subscription_id', invoice.subscription as string)
              .maybeSingle();
            memberData = data;
            memberError = error;
          } else {
            // Find member by membership subscription ID
            const { data, error } = await supabase
              .from('members')
              .select('id, status')
              .eq('stripe_subscription_id', invoice.subscription as string)
              .maybeSingle();
            memberData = data;
            memberError = error;
          }

          if (memberError) {
            logError(memberError, "INVOICE_PAYMENT_SUCCEEDED_MEMBER_LOOKUP");
          } else if (memberData) {
            // Get payment intent and charge details
            const paymentIntent = invoice.payment_intent as Stripe.PaymentIntent | string | null;
            const charge = invoice.charge as Stripe.Charge | string | null;
            
            let paymentIntentId: string | null = null;
            let chargeId: string | null = null;
            let paymentMethodId: string | null = null;
            let paymentMethodType: string | null = null;
            let cardBrand: string | null = null;
            let cardLast4: string | null = null;

            if (typeof paymentIntent === 'object' && paymentIntent) {
              paymentIntentId = paymentIntent.id;
              paymentMethodId = paymentIntent.payment_method as string | null;
              
              if (typeof charge === 'object' && charge && charge.payment_method_details) {
                chargeId = charge.id;
                if (charge.payment_method_details.type === 'card' && charge.payment_method_details.card) {
                  paymentMethodType = 'card';
                  cardBrand = charge.payment_method_details.card.brand || null;
                  cardLast4 = charge.payment_method_details.card.last4 || null;
                }
              }
            } else if (typeof paymentIntent === 'string') {
              paymentIntentId = paymentIntent;
            }

            if (typeof charge === 'string') {
              chargeId = charge;
            }

            // Log successful payment attempt
            const { error: logAttemptError } = await supabase.rpc('log_payment_attempt', {
              p_member_id: memberData.id,
              p_stripe_invoice_id: invoice.id,
              p_stripe_payment_intent_id: paymentIntentId,
              p_stripe_charge_id: chargeId,
              p_stripe_subscription_id: invoice.subscription as string,
              p_invoice_number: invoice.number || null,
              p_amount: invoice.amount_paid / 100, // Convert from cents
              p_currency: invoice.currency || 'usd',
              p_status: 'succeeded',
              p_attempt_number: invoice.attempt_count || 1,
              p_payment_method_id: paymentMethodId,
              p_payment_method_type: paymentMethodType,
              p_succeeded_at: new Date().toISOString(),
              p_metadata: {
                billing_reason: invoice.billing_reason,
                period_start: invoice.period_start,
                period_end: invoice.period_end,
                card_brand: cardBrand,
                card_last4: cardLast4
              }
            });

            if (logAttemptError) {
              logError(logAttemptError, "INVOICE_PAYMENT_SUCCEEDED_LOG");
            }

            // Handle annual fee subscription renewals
            if (isAnnualFeeInvoice) {
              // Update annual_fee_paid_at on annual fee subscription renewal
              const { error: annualFeeUpdateError } = await supabase
                .from('members')
                .update({
                  annual_fee_paid_at: new Date().toISOString(),
                })
                .eq('id', memberData.id);

              if (annualFeeUpdateError) {
                logError(annualFeeUpdateError, "ANNUAL_FEE_RENEWAL_UPDATE");
              } else {
                logStep("Annual fee renewal recorded", { memberId: memberData.id });
              }
            } else {
              // Update member status to active if it was past_due (membership subscription)
              if (memberData.status === 'past_due') {
                const { error: updateError } = await supabase.rpc('update_subscription_status_with_history', {
                  p_member_id: memberData.id,
                  p_stripe_subscription_id: invoice.subscription as string,
                  p_new_status: 'active',
                  p_reason: 'payment_succeeded',
                  p_stripe_event_id: event.id,
                  p_changed_by: 'stripe',
                  p_metadata: { invoice_id: invoice.id }
                });

                if (updateError) {
                  logError(updateError, "INVOICE_PAYMENT_SUCCEEDED_STATUS_UPDATE");
                } else {
                  logStep("Member status updated to active", { memberId: memberData.id });
                }
              }
            }
          } else {
            logStep("Member not found for invoice", { subscriptionId: invoice.subscription });
          }
        } catch (invoiceError) {
          logError(invoiceError, "INVOICE_PAYMENT_SUCCEEDED");
          return errorResponse(invoiceError, "INVOICE_PAYMENT_SUCCEEDED");
        }
        break;
      }

      case 'invoice.payment_failed': {
        try {
          const invoice = event.data.object as Stripe.Invoice;
          logStep("Payment failed", { 
            invoiceId: invoice.id, 
            customerId: invoice.customer,
            subscriptionId: invoice.subscription
          });

          // Only process subscription invoices
          if (!invoice.subscription) {
            logStep("Skipping non-subscription invoice", { invoiceId: invoice.id });
            break;
          }

          // Find member by subscription ID
          const { data: memberData, error: memberError } = await supabase
            .from('members')
            .select('id, status, email, first_name, last_name')
            .eq('stripe_subscription_id', invoice.subscription as string)
            .maybeSingle();

          if (memberError) {
            logError(memberError, "INVOICE_PAYMENT_FAILED_MEMBER_LOOKUP");
          } else if (memberData) {
            // Get payment intent and charge details for failure info
            const paymentIntent = invoice.payment_intent as Stripe.PaymentIntent | string | null;
            const lastPaymentError = invoice.last_payment_error;
            
            let paymentIntentId: string | null = null;
            let chargeId: string | null = null;
            let paymentMethodId: string | null = null;
            let paymentMethodType: string | null = null;
            let failureCode: string | null = null;
            let failureMessage: string | null = null;
            let declineCode: string | null = null;
            let declineReason: string | null = null;
            let nextRetryAt: string | null = null;

            if (typeof paymentIntent === 'object' && paymentIntent) {
              paymentIntentId = paymentIntent.id;
              paymentMethodId = paymentIntent.payment_method as string | null;
              
              if (paymentIntent.last_payment_error) {
                failureCode = paymentIntent.last_payment_error.code || null;
                failureMessage = paymentIntent.last_payment_error.message || null;
                declineCode = paymentIntent.last_payment_error.decline_code || null;
                
                // Human-readable decline reason
                if (declineCode) {
                  const declineReasons: Record<string, string> = {
                    'generic_decline': 'Card declined',
                    'insufficient_funds': 'Insufficient funds',
                    'lost_card': 'Lost card',
                    'stolen_card': 'Stolen card',
                    'expired_card': 'Expired card',
                    'incorrect_cvc': 'Incorrect security code',
                    'incorrect_number': 'Incorrect card number',
                    'processing_error': 'Processing error',
                    'reenter_transaction': 'Transaction declined - please try again',
                    'restricted_card': 'Card restricted',
                    'security_violation': 'Security violation',
                    'service_not_allowed': 'Service not allowed',
                    'stop_payment_order': 'Stop payment order',
                    'testmode_decline': 'Test mode decline',
                    'withdrawal_count_limit_exceeded': 'Withdrawal count limit exceeded'
                  };
                  declineReason = declineReasons[declineCode] || declineCode;
                } else {
                  declineReason = failureMessage || 'Payment failed';
                }
              }
            } else if (typeof paymentIntent === 'string') {
              paymentIntentId = paymentIntent;
            }

            // Get failure info from last_payment_error if available
            if (lastPaymentError) {
              failureCode = lastPaymentError.code || failureCode;
              failureMessage = lastPaymentError.message || failureMessage;
              declineCode = lastPaymentError.decline_code || declineCode;
            }

            // Check if Stripe will retry (based on attempt_count)
            const attemptCount = invoice.attempt_count || 0;
            const willRetry = attemptCount < 4; // Stripe typically retries up to 4 times

            // Log failed payment attempt
            const { error: logAttemptError } = await supabase.rpc('log_payment_attempt', {
              p_member_id: memberData.id,
              p_stripe_invoice_id: invoice.id,
              p_stripe_payment_intent_id: paymentIntentId,
              p_stripe_charge_id: chargeId,
              p_stripe_subscription_id: invoice.subscription as string,
              p_invoice_number: invoice.number || null,
              p_amount: invoice.amount_due / 100, // Convert from cents
              p_currency: invoice.currency || 'usd',
              p_status: 'failed',
              p_attempt_number: attemptCount,
              p_payment_method_id: paymentMethodId,
              p_payment_method_type: paymentMethodType,
              p_failure_code: failureCode,
              p_failure_message: failureMessage,
              p_decline_code: declineCode,
              p_decline_reason: declineReason,
              p_retry_attempted: willRetry,
              p_next_retry_at: willRetry ? invoice.next_payment_attempt ? new Date(invoice.next_payment_attempt * 1000).toISOString() : null : null,
              p_failed_at: new Date().toISOString(),
              p_metadata: {
                billing_reason: invoice.billing_reason,
                attempt_count: attemptCount,
                next_payment_attempt: invoice.next_payment_attempt
              }
            });

            if (logAttemptError) {
              logError(logAttemptError, "INVOICE_PAYMENT_FAILED_LOG");
            }

            // Update member status to past_due if payment failed and subscription is active
            if (memberData.status === 'active') {
              const { error: updateError } = await supabase.rpc('update_subscription_status_with_history', {
                p_member_id: memberData.id,
                p_stripe_subscription_id: invoice.subscription as string,
                p_new_status: 'past_due',
                p_reason: 'payment_failed',
                p_stripe_event_id: event.id,
                p_changed_by: 'stripe',
                p_metadata: { 
                  invoice_id: invoice.id,
                  failure_code: failureCode,
                  decline_code: declineCode,
                  attempt_count: attemptCount
                }
              });

              if (updateError) {
                logError(updateError, "INVOICE_PAYMENT_FAILED_STATUS_UPDATE");
              } else {
                logStep("Member status updated to past_due", { memberId: memberData.id });
              }
            }

            // Send payment failure email notification
            if (memberData.email && (memberData.first_name || memberData.last_name)) {
              try {
                const memberName = memberData.first_name && memberData.last_name 
                  ? `${memberData.first_name} ${memberData.last_name}`
                  : memberData.first_name || memberData.last_name || 'Member';

                const { error: emailError } = await supabase.functions.invoke('send-email', {
                  body: {
                    type: 'payment_failed',
                    to: memberData.email,
                    data: {
                      name: memberName,
                      amount: invoice.amount_due / 100, // Convert from cents to dollars
                      failureReason: declineReason || failureMessage || 'Payment processing failed',
                      failureMessage: failureMessage || null,
                      declineReason: declineReason || null,
                      nextRetryAt: invoice.next_payment_attempt ? new Date(invoice.next_payment_attempt * 1000).toISOString() : null,
                      attemptCount: attemptCount,
                    },
                  },
                });

                if (emailError) {
                  logError(emailError, "INVOICE_PAYMENT_FAILED_EMAIL");
                } else {
                  logStep("Payment failure email sent", { memberId: memberData.id, email: memberData.email });
                }
              } catch (emailError) {
                logError(emailError, "INVOICE_PAYMENT_FAILED_EMAIL");
                // Don't fail the webhook if email fails
              }
            } else {
              logStep("Skipping payment failure email - no email or name", { memberId: memberData.id });
            }
          } else {
            logStep("Member not found for failed invoice", { subscriptionId: invoice.subscription });
          }
        } catch (invoiceError) {
          logError(invoiceError, "INVOICE_PAYMENT_FAILED");
          return errorResponse(invoiceError, "INVOICE_PAYMENT_FAILED");
        }
        break;
      }

      case 'invoice.payment_action_required': {
        try {
          const invoice = event.data.object as Stripe.Invoice;
          logStep("Payment action required", { 
            invoiceId: invoice.id, 
            customerId: invoice.customer,
            subscriptionId: invoice.subscription
          });

          // Only process subscription invoices
          if (!invoice.subscription) {
            logStep("Skipping non-subscription invoice", { invoiceId: invoice.id });
            break;
          }

          // Find member by subscription ID
          const { data: memberData, error: memberError } = await supabase
            .from('members')
            .select('id')
            .eq('stripe_subscription_id', invoice.subscription as string)
            .maybeSingle();

          if (memberError) {
            logError(memberError, "INVOICE_PAYMENT_ACTION_REQUIRED_MEMBER_LOOKUP");
          } else if (memberData) {
            const paymentIntent = invoice.payment_intent as Stripe.PaymentIntent | string | null;
            let paymentIntentId: string | null = null;

            if (typeof paymentIntent === 'object' && paymentIntent) {
              paymentIntentId = paymentIntent.id;
            } else if (typeof paymentIntent === 'string') {
              paymentIntentId = paymentIntent;
            }

            // Log payment attempt requiring action
            const { error: logAttemptError } = await supabase.rpc('log_payment_attempt', {
              p_member_id: memberData.id,
              p_stripe_invoice_id: invoice.id,
              p_stripe_payment_intent_id: paymentIntentId,
              p_stripe_subscription_id: invoice.subscription as string,
              p_invoice_number: invoice.number || null,
              p_amount: invoice.amount_due / 100,
              p_currency: invoice.currency || 'usd',
              p_status: 'requires_action',
              p_attempt_number: invoice.attempt_count || 1,
              p_metadata: {
                billing_reason: invoice.billing_reason,
                payment_intent_client_secret: typeof paymentIntent === 'object' ? paymentIntent.client_secret : null
              }
            });

            if (logAttemptError) {
              logError(logAttemptError, "INVOICE_PAYMENT_ACTION_REQUIRED_LOG");
            }
          }
        } catch (invoiceError) {
          logError(invoiceError, "INVOICE_PAYMENT_ACTION_REQUIRED");
          return errorResponse(invoiceError, "INVOICE_PAYMENT_ACTION_REQUIRED");
        }
        break;
      }

      case 'setup_intent.succeeded': {
        try {
          const setupIntent = event.data.object as Stripe.SetupIntent;
          const customerId = setupIntent.customer as string;
          const paymentMethodId = setupIntent.payment_method as string;
          const metadata = setupIntent.metadata || {};

          logStep("SetupIntent succeeded", { 
            setupIntentId: setupIntent.id, 
            customerId, 
            paymentMethodId,
            type: metadata.type || 'unknown'
          });

          // Fetch card details from Stripe
          let cardBrand: string | null = null;
          let cardLast4: string | null = null;
          let cardExpMonth: number | null = null;
          let cardExpYear: number | null = null;

          if (paymentMethodId) {
            try {
              const paymentMethod = await stripe.paymentMethods.retrieve(paymentMethodId);
              if (paymentMethod.card) {
                cardBrand = paymentMethod.card.brand || null;
                cardLast4 = paymentMethod.card.last4 || null;
                cardExpMonth = paymentMethod.card.exp_month || null;
                cardExpYear = paymentMethod.card.exp_year || null;
              }
              logStep("Retrieved card details", { cardBrand, cardLast4, cardExpMonth, cardExpYear });
            } catch (pmError) {
              logError(pmError, "SETUP_INTENT_FETCH_PAYMENT_METHOD");
              // Continue without card details - they can be fetched later
            }
          }

          // Sync to members table if this customer has a member record
          if (customerId) {
            const { data: memberData, error: memberError } = await supabase
              .from('members')
              .select('id, stripe_customer_id')
              .eq('stripe_customer_id', customerId)
              .maybeSingle();

            if (memberError) {
              logError(memberError, "SETUP_INTENT_MEMBER_LOOKUP");
            } else if (memberData) {
              // Update member with card details
              const { error: memberCardError } = await supabase
                .from('members')
                .update({
                  card_brand: cardBrand,
                  card_last4: cardLast4,
                  card_exp_month: cardExpMonth,
                  card_exp_year: cardExpYear,
                })
                .eq('id', memberData.id);

              if (memberCardError) {
                logError(memberCardError, "SETUP_INTENT_MEMBER_CARD_UPDATE");
              } else {
                logStep("Member card details updated", { memberId: memberData.id, cardBrand, cardLast4 });
              }

              // Log payment method update to audit table
              try {
                const { error: pmLogError } = await supabase
                  .from('payment_method_updates')
                  .insert({
                    member_id: memberData.id,
                    payment_method_id: paymentMethodId,
                    event_type: 'card_added',
                    card_brand: cardBrand,
                    card_last4: cardLast4,
                    card_exp_month: cardExpMonth,
                    card_exp_year: cardExpYear,
                    is_default: false,
                  });

                if (pmLogError) {
                  logError(pmLogError, "SETUP_INTENT_LOG_PAYMENT_METHOD");
                } else {
                  logStep("Payment method update logged", { memberId: memberData.id, paymentMethodId });
                }
              } catch (logErr) {
                logError(logErr, "SETUP_INTENT_LOG_PAYMENT_METHOD");
              }
            }
          }

          // Sync to membership_applications if this is an application setup
          if (metadata.type === 'application_card_setup' || metadata.type === 'admin_card_setup') {
            const applicantEmail = metadata.applicant_email || metadata.email;
            
            if (applicantEmail && customerId) {
              const { error: appUpdateError } = await supabase
                .from('membership_applications')
                .update({ 
                  stripe_customer_id: customerId,
                  payment_info_provided: true,
                  card_brand: cardBrand,
                  card_last4: cardLast4,
                  card_exp_month: cardExpMonth,
                  card_exp_year: cardExpYear,
                })
                .eq('email', applicantEmail);

              if (appUpdateError) {
                logError(appUpdateError, "SETUP_INTENT_APPLICATION_UPDATE");
              } else {
                logStep("Application updated with Stripe customer and card details", { 
                  email: applicantEmail, 
                  customerId,
                  cardBrand,
                  cardLast4
                });
              }
            }
          }

          // If metadata has member_id, ensure member record is synced with card details
          if (metadata.member_id && customerId) {
            const { error: memberSyncError } = await supabase
              .from('members')
              .update({ 
                stripe_customer_id: customerId,
                card_brand: cardBrand,
                card_last4: cardLast4,
                card_exp_month: cardExpMonth,
                card_exp_year: cardExpYear,
              })
              .eq('id', metadata.member_id);

            if (memberSyncError) {
              logError(memberSyncError, "SETUP_INTENT_MEMBER_SYNC");
            } else {
              logStep("Member stripe_customer_id and card details synced", { 
                memberId: metadata.member_id, 
                customerId,
                cardBrand,
                cardLast4
              });
            }
          }

        } catch (setupError) {
          logError(setupError, "SETUP_INTENT_SUCCEEDED");
          return errorResponse(setupError, "SETUP_INTENT_SUCCEEDED");
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
