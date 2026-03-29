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

// Processing fee calculation: covers Stripe's 2.9% + $0.30
function calculateProcessingFee(amountInCents: number): number {
  if (amountInCents <= 0) return 0;
  const totalCents = Math.ceil((amountInCents + 30) / 0.971);
  return totalCents - amountInCents;
}

// Cache the Processing Fee product ID
let processingFeeProductId: string | null = null;

async function getOrCreateProcessingFeeProduct(stripe: Stripe): Promise<string> {
  if (processingFeeProductId) return processingFeeProductId;
  const products = await stripe.products.search({ query: "name:'Processing Fee'", limit: 1 });
  if (products.data.length > 0) {
    processingFeeProductId = products.data[0].id;
    return processingFeeProductId;
  }
  const product = await stripe.products.create({
    name: 'Processing Fee',
    description: 'Card processing fee (2.9% + $0.30)',
    metadata: { type: 'processing_fee' },
  });
  processingFeeProductId = product.id;
  return processingFeeProductId;
}

async function getOrCreateRecurringProcessingFeePrice(
  stripe: Stripe,
  baseAmountCents: number,
  interval: 'month' | 'year'
): Promise<string | null> {
  const feeCents = calculateProcessingFee(baseAmountCents);
  if (feeCents <= 0) return null;
  const productId = await getOrCreateProcessingFeeProduct(stripe);
  const existingPrices = await stripe.prices.list({ product: productId, type: 'recurring', active: true, limit: 100 });
  const matchingPrice = existingPrices.data.find(p => p.unit_amount === feeCents && p.recurring?.interval === interval);
  if (matchingPrice) return matchingPrice.id;
  const price = await stripe.prices.create({
    product: productId,
    unit_amount: feeCents,
    currency: 'usd',
    recurring: { interval },
    metadata: { type: 'processing_fee', base_amount: String(baseAmountCents) },
  });
  return price.id;
}

async function addRecurringProcessingFeeItems(
  stripe: Stripe,
  items: Array<{ price: string; quantity?: number }>
): Promise<Array<{ price: string; quantity?: number }>> {
  const result = [...items];
  for (const item of items) {
    try {
      const basePrice = await stripe.prices.retrieve(item.price);
      const baseAmount = basePrice.unit_amount || 0;
      const interval = (basePrice.recurring?.interval as 'month' | 'year') || 'year';
      const feePriceId = await getOrCreateRecurringProcessingFeePrice(stripe, baseAmount, interval);
      if (feePriceId) {
        result.push({ price: feePriceId, quantity: 1 });
        logStep(`Added recurring processing fee: ${feePriceId} (${calculateProcessingFee(baseAmount)}¢ per ${interval})`);
      }
    } catch (e) {
      logStep(`Warning: Could not add processing fee for price ${item.price}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }
  return result;
}

// Helper to get tier name from membership type
function getTierName(membershipType: string): string {
  const normalized = membershipType.toLowerCase().trim();
  if (normalized.includes("diamond")) return "diamond";
  if (normalized.includes("platinum")) return "platinum";
  if (normalized.includes("gold")) return "gold";
  return "silver";
}

// Class pass details - Fixed to use pilates_cycling category for broader matching
const CLASS_PASS_CONFIG: Record<string, { category: string; classes: number; validityDays: number }> = {
  'single_pilatesCycling': { category: 'pilates_cycling', classes: 1, validityDays: 7 },
  'tenPack_pilatesCycling': { category: 'pilates_cycling', classes: 10, validityDays: 60 },
  'single_cycling': { category: 'pilates_cycling', classes: 1, validityDays: 7 },
  'tenPack_cycling': { category: 'pilates_cycling', classes: 10, validityDays: 60 },
  'single_otherClasses': { category: 'aerobics', classes: 1, validityDays: 7 },
  'tenPack_otherClasses': { category: 'aerobics', classes: 10, validityDays: 60 },
};

// Reverse map: Stripe price ID → { category, passType, isMember, classes, validityDays, label }
const PRICE_ID_MAP: Record<string, {
  productType: 'class_pass' | 'guest_pass' | 'guest_addon';
  category: string;
  passType: string;
  isMember: boolean;
  classes: number;
  validityDays: number;
  label: string;
}> = {
  // Pilates/Cycling
  'price_1SlA2vLyZrsSqLhsBHHWlQPD': { productType: 'class_pass', category: 'pilates_cycling', passType: 'single', isMember: true, classes: 1, validityDays: 7, label: 'Pilates/Cycling Single (Member)' },
  'price_1T2XzALyZrsSqLhs1N07i160': { productType: 'class_pass', category: 'pilates_cycling', passType: 'single', isMember: false, classes: 1, validityDays: 7, label: 'Pilates/Cycling Single (Non-Member)' },
  'price_1SlA9sLyZrsSqLhsM0X8VDhN': { productType: 'class_pass', category: 'pilates_cycling', passType: 'tenPack', isMember: true, classes: 10, validityDays: 60, label: 'Pilates/Cycling 10-Pack (Member)' },
  'price_1T2XzfLyZrsSqLhsd8Gu4c7B': { productType: 'class_pass', category: 'pilates_cycling', passType: 'tenPack', isMember: false, classes: 10, validityDays: 60, label: 'Pilates/Cycling 10-Pack (Non-Member)' },
  // Other Classes
  'price_1T2XmKLyZrsSqLhsmtaMSUiF': { productType: 'class_pass', category: 'aerobics', passType: 'single', isMember: true, classes: 1, validityDays: 7, label: 'Other Classes Single (Member)' },
  'price_1SlABFLyZrsSqLhsGOpvWGFE': { productType: 'class_pass', category: 'aerobics', passType: 'single', isMember: false, classes: 1, validityDays: 7, label: 'Other Classes Single (Non-Member)' },
  'price_1T2YiALyZrsSqLhsuJGaqAaK': { productType: 'class_pass', category: 'aerobics', passType: 'tenPack', isMember: true, classes: 10, validityDays: 60, label: 'Other Classes 10-Pack (Member)' },
  'price_1T2XoiLyZrsSqLhsjN7Hb2Lk': { productType: 'class_pass', category: 'aerobics', passType: 'tenPack', isMember: false, classes: 10, validityDays: 60, label: 'Other Classes 10-Pack (Non-Member)' },
  // Guest Pass
  'price_1SxATYLyZrsSqLhs6vDu1QWg': { productType: 'guest_pass', category: 'guest', passType: 'guest_pass', isMember: false, classes: 0, validityDays: 1, label: 'Guest Pass ($60)' },
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
              cycleEnd.setDate(cycleEnd.getDate() - 1); // End day before next billing
              const expiresAt = new Date(cycleEnd);
              expiresAt.setHours(23, 59, 59, 999);

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
                  
                  // Create annual fee subscription (yearly recurring) with processing fee
                  const annualFeeWebhookItems = await addRecurringProcessingFeeItems(stripe, [{ price: annualFeePriceId }]);
                  const annualFeeSubscription = await stripe.subscriptions.create({
                    customer: session.customer as string,
                    items: annualFeeWebhookItems,
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
            // Now mapping to pilates_cycling for broader class matching
            let mappedCategory = category;
            if (category === 'pilatesCycling') mappedCategory = 'pilates_cycling';
            if (category === 'otherClasses') mappedCategory = 'aerobics';

            const configKey = `${passType}_${category}`;
            const altConfigKey = `${passType}_${mappedCategory}`;
            let config = CLASS_PASS_CONFIG[configKey] || CLASS_PASS_CONFIG[altConfigKey];

            if (!config) {
              // Try to infer from category if exact match not found
              const defaultConfig = {
                'pilates_cycling': { category: 'pilates_cycling', classes: passType === 'tenPack' ? 10 : 1, validityDays: passType === 'tenPack' ? 60 : 7 },
                'reformer': { category: 'pilates_cycling', classes: passType === 'tenPack' ? 10 : 1, validityDays: passType === 'tenPack' ? 60 : 7 },
                'cycling': { category: 'pilates_cycling', classes: passType === 'tenPack' ? 10 : 1, validityDays: passType === 'tenPack' ? 60 : 7 },
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

          } else if (metadata.type === 'kids_care_pass') {
            // Handle Kids Care Pass subscription purchase
            const userId = metadata.user_id;
            const memberId = metadata.member_id;

            if (!userId) {
              logError("Missing user_id in kids_care_pass metadata", "KIDS_CARE_PASS");
              return errorResponse(new Error("Missing user_id"), "KIDS_CARE_PASS");
            }

            try {
              // Calculate expiry: 30 days from now
              const expiresAt = new Date();
              expiresAt.setDate(expiresAt.getDate() + 30);

              // Create a kids_care pass in class_passes
              const { error: passError } = await supabase
                .from('class_passes')
                .insert({
                  user_id: userId,
                  member_id: memberId || null,
                  category: 'other',
                  pass_type: 'kids_care',
                  classes_total: 16,
                  classes_remaining: 16,
                  price_paid: session.amount_total ? session.amount_total / 100 : 75,
                  is_member_price: true,
                  expires_at: expiresAt.toISOString(),
                  status: 'active',
                });

              if (passError) {
                logError(passError, "KIDS_CARE_PASS_CREATION");
                return errorResponse(passError, "KIDS_CARE_PASS_CREATION");
              }

              // Mark service form as completed if not already
              if (userId) {
                try {
                  await supabase
                    .from('profiles')
                    .update({ kids_care_service_form_completed: true })
                    .eq('user_id', userId);
                } catch (profileErr) {
                  logStep("Warning: Could not update profile kids_care flag", { error: String(profileErr) });
                }
              }

              logStep("Kids Care Pass created", { userId, memberId, expiresAt: expiresAt.toISOString() });
            } catch (passError) {
              logError(passError, "KIDS_CARE_PASS_CREATION");
              return errorResponse(passError, "KIDS_CARE_PASS_CREATION");
            }

          } else if (metadata.type === 'guest_pass') {
            // Handle guest pass purchase
            const userId = metadata.user_id; // Admin user who sold the pass
            const guestName = metadata.guest_name;
            const guestEmail = metadata.guest_email || null;
            const passQuantity = Math.max(1, parseInt(metadata.quantity || '1') || 1);

            if (!userId || !guestName) {
              logError("Missing required metadata for guest_pass", "GUEST_PASS");
              return errorResponse(new Error("Missing required metadata: user_id or guest_name"), "GUEST_PASS");
            }

            // Guest pass expires 1 day from purchase
            const expiresAt = new Date();
            expiresAt.setDate(expiresAt.getDate() + 1); // 1 day

            // Calculate per-pass price
            const customPriceMeta = metadata.custom_price;
            const perPassPrice = customPriceMeta ? parseFloat(customPriceMeta) : (session.amount_total ? session.amount_total / 100 / passQuantity : 60.00);

            // Create guest pass records (one per quantity)
            try {
              const passRecords = [];
              for (let i = 0; i < passQuantity; i++) {
                passRecords.push({
                  guest_name: guestName,
                  guest_email: guestEmail,
                  guest_gender: metadata.guest_gender || null,
                  phone_number: metadata.phone_number || null,
                  valid_date: metadata.valid_date || null,
                  member_referral: metadata.member_referral || null,
                  user_id: userId,
                  price_paid: perPassPrice,
                  status: 'active',
                  expires_at: expiresAt.toISOString(),
                  stripe_payment_id: session.payment_intent as string,
                  sold_by: userId,
                });
              }

              const { error: passError } = await supabase
                .from('guest_passes')
                .insert(passRecords);

              if (passError) {
                logError(passError, "GUEST_PASS_CREATION");
                return errorResponse(passError, "GUEST_PASS_CREATION");
              }

              logStep("Guest pass(es) created", { userId, guestName, quantity: passQuantity, expiresAt: expiresAt.toISOString() });
            } catch (passError) {
              logError(passError, "GUEST_PASS_CREATION");
              return errorResponse(passError, "GUEST_PASS_CREATION");
            }

          } else if (metadata.type === 'guest_pass_experience') {
            // Handle enhanced guest pass experience purchase
            const userId = metadata.user_id;
            const guestName = metadata.guest_name;
            const guestEmail = metadata.guest_email || null;
            const phoneNumber = metadata.phone_number || null;
            const validDate = metadata.valid_date;
            const memberReferral = metadata.member_referral || null;
            const visitInterests = metadata.visit_interests ? JSON.parse(metadata.visit_interests) : [];
            const visitNotes = metadata.visit_notes || null;
            const addOns = metadata.add_ons ? JSON.parse(metadata.add_ons) : [];

            if (!userId || !guestName || !validDate) {
              logError("Missing required metadata for guest_pass_experience", "GUEST_PASS_EXPERIENCE");
              return errorResponse(new Error("Missing required metadata: user_id, guest_name, or valid_date"), "GUEST_PASS_EXPERIENCE");
            }

            // Calculate expiration: 11:59 PM on valid_date
            const validDateObj = new Date(validDate + 'T23:59:59');
            
            try {
              // Create guest pass record with all personalization data
              const { error: passError } = await supabase
                .from('guest_passes')
                .insert({
                  guest_name: guestName,
                  guest_email: guestEmail,
                  guest_gender: metadata.guest_gender || null,
                  phone_number: phoneNumber,
                  user_id: userId,
                  valid_date: validDate,
                  member_referral: memberReferral,
                  visit_interests: visitInterests,
                  visit_notes: visitNotes,
                  add_ons: addOns,
                  price_paid: session.amount_total ? session.amount_total / 100 : 60.00,
                  status: 'active',
                  expires_at: validDateObj.toISOString(),
                  stripe_payment_id: session.payment_intent as string,
                  stripe_customer_id: session.customer as string,
                });

              if (passError) {
                logError(passError, "GUEST_PASS_EXPERIENCE_CREATION");
                return errorResponse(passError, "GUEST_PASS_EXPERIENCE_CREATION");
              }

              logStep("Guest pass experience created", { 
                userId, 
                guestName, 
                validDate,
                expiresAt: validDateObj.toISOString(),
                addOnsCount: addOns.length,
              });

              // Send confirmation email to guest if email provided
              if (guestEmail) {
                try {
                  const amountPaid = session.amount_total ? (session.amount_total / 100).toFixed(2) : '60.00';
                  const formattedDate = new Date(validDate).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
                  await supabase.functions.invoke('send-email', {
                    body: {
                      type: 'guest_pass_purchase_confirmation',
                      to: guestEmail,
                      data: {
                        name: guestName,
                        visitDate: formattedDate,
                        amountPaid,
                      },
                    },
                  });
                  logStep("Guest pass experience confirmation email sent", { guestEmail });
                } catch (emailError) {
                  logError(emailError, "GUEST_PASS_EXPERIENCE_CONFIRMATION_EMAIL");
                  // Don't fail the webhook if email fails
                }
              }

              // Create class passes if class add-ons were purchased
              const classAddons = addOns.filter((addon: { id: string }) => 
                addon.id === 'class_pilates_cycling' || addon.id === 'class_other'
              );

              for (const classAddon of classAddons) {
                try {
                  const category = classAddon.id === 'class_pilates_cycling' ? 'pilates_cycling' : 'aerobics';
                  const expiresAt = new Date(validDateObj);
                  expiresAt.setDate(expiresAt.getDate() + 7); // 7 day validity for class pass

                  const { error: classPassError } = await supabase
                    .from('class_passes')
                    .insert({
                      user_id: userId,
                      category: category,
                      pass_type: 'single',
                      classes_total: 1,
                      classes_remaining: 1,
                      price_paid: classAddon.price || 0,
                      is_member_price: false,
                      expires_at: expiresAt.toISOString(),
                      status: 'active',
                    });

                  if (classPassError) {
                    logError(classPassError, `CLASS_PASS_CREATION_${classAddon.id}`);
                  } else {
                    logStep(`Class pass created for guest`, { category, userId });
                  }
                } catch (classErr) {
                  logError(classErr, `CLASS_PASS_CREATION_${classAddon.id}`);
                }
              }

            } catch (passError) {
              logError(passError, "GUEST_PASS_EXPERIENCE_CREATION");
              return errorResponse(passError, "GUEST_PASS_EXPERIENCE_CREATION");
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
          } else if (metadata.type === 'annual_fee_payment_link') {
            // Handle admin-generated annual fee payment link
            const applicationId = metadata.application_id;
            
            if (!applicationId) {
              logError("Missing application_id in annual fee payment link metadata", "ANNUAL_FEE_LINK");
              return errorResponse(new Error("Missing application_id"), "ANNUAL_FEE_LINK");
            }

            try {
              // Update application with paid status and customer ID
              const { error: updateError } = await supabase
                .from('membership_applications')
                .update({
                  annual_fee_status: 'paid',
                  stripe_customer_id: session.customer as string,
                })
                .eq('id', applicationId);

              if (updateError) {
                logError(updateError, "ANNUAL_FEE_LINK_UPDATE");
                return errorResponse(updateError, "ANNUAL_FEE_LINK_UPDATE");
              }

              // Sync card details to application from subscription or payment
              try {
                let paymentMethodId: string | null = null;
                
                // For subscription mode, get payment method from subscription
                if (session.subscription) {
                  const subscription = await stripe.subscriptions.retrieve(
                    session.subscription as string
                  );
                  paymentMethodId = subscription.default_payment_method as string;
                  
                  // Also update application with subscription ID for tracking
                  await supabase
                    .from('membership_applications')
                    .update({
                      annual_fee_subscription_id: subscription.id,
                    })
                    .eq('id', applicationId);
                  logStep("Annual fee subscription ID saved", { subscriptionId: subscription.id });
                } else if (session.payment_intent) {
                  // Fallback for one-time payment mode
                  const paymentIntent = await stripe.paymentIntents.retrieve(
                    session.payment_intent as string
                  );
                  paymentMethodId = paymentIntent.payment_method as string;
                }
                
                if (paymentMethodId) {
                  const pm = await stripe.paymentMethods.retrieve(paymentMethodId);
                  if (pm.card) {
                    await supabase
                      .from('membership_applications')
                      .update({
                        card_brand: pm.card.brand,
                        card_last4: pm.card.last4,
                        card_exp_month: pm.card.exp_month,
                        card_exp_year: pm.card.exp_year,
                      })
                      .eq('id', applicationId);
                    logStep("Card details synced to application", { last4: pm.card.last4 });
                  }
                }
              } catch (cardError) {
                logError(cardError, "ANNUAL_FEE_LINK_CARD_SYNC");
                // Don't fail webhook for card sync issues
              }

              // CRITICAL: Sync annual fee payment to member table if member exists
              // This ensures Application Portal and Member Portal stay in sync
              try {
                // Get application email to find member record
                const { data: appForSync } = await supabase
                  .from('membership_applications')
                  .select('email')
                  .eq('id', applicationId)
                  .single();

                if (appForSync?.email) {
                  const { data: memberForSync } = await supabase
                    .from('members')
                    .select('id')
                    .ilike('email', appForSync.email)
                    .maybeSingle();

                  if (memberForSync) {
                    const { error: memberSyncError } = await supabase
                      .from('members')
                      .update({
                        annual_fee_paid_at: new Date().toISOString(),
                        stripe_customer_id: session.customer as string,
                      })
                      .eq('id', memberForSync.id);

                    if (memberSyncError) {
                      logError(memberSyncError, "ANNUAL_FEE_MEMBER_SYNC");
                    } else {
                      logStep("Synced annual fee to member record", { 
                        memberId: memberForSync.id, 
                        applicationId,
                        customerId: session.customer 
                      });
                    }
                  } else {
                    logStep("No member record found for application email - will sync on member creation", {
                      email: appForSync.email,
                      applicationId,
                    });
                  }
                }
              } catch (memberSyncError) {
                logError(memberSyncError, "ANNUAL_FEE_MEMBER_SYNC");
                // Don't fail webhook for member sync issues
              }

              logStep("Annual fee payment link processed", { applicationId, customerId: session.customer });
            } catch (annualFeeLinkError) {
              logError(annualFeeLinkError, "ANNUAL_FEE_LINK");
              return errorResponse(annualFeeLinkError, "ANNUAL_FEE_LINK");
            }
          } else if (metadata.type === 'wellness_credit_purchase') {
            // Handle wellness credit pack purchase for non-members
            const wcUserId = metadata.user_id;
            const wcCreditType = metadata.credit_type;
            const wcQuantity = parseInt(metadata.quantity || '0');

            logStep("Processing wellness credit purchase", { userId: wcUserId, creditType: wcCreditType, quantity: wcQuantity });

            if (!wcUserId || !wcCreditType || wcQuantity <= 0) {
              logStep("Invalid wellness credit purchase metadata", { metadata });
            } else {
              try {
                const now = new Date();
                const expiresAt = new Date(now.getFullYear(), now.getMonth() + 3, now.getDate()); // 90 day validity
                const cycleStart = now.toISOString().split('T')[0];
                const cycleEnd = expiresAt.toISOString().split('T')[0];

                const { error: creditInsertError } = await supabase
                  .from('member_credits')
                  .insert({
                    user_id: wcUserId,
                    member_id: null,
                    credit_type: wcCreditType,
                    credits_total: wcQuantity,
                    credits_remaining: wcQuantity,
                    cycle_start: cycleStart,
                    cycle_end: cycleEnd,
                    expires_at: expiresAt.toISOString(),
                  });

                if (creditInsertError) {
                  logError(creditInsertError, "WELLNESS_CREDIT_INSERT");
                } else {
                  logStep("Wellness credits provisioned successfully", { userId: wcUserId, creditType: wcCreditType, quantity: wcQuantity });

                  // Sync Stripe customer ID to non_member_profiles
                  if (session.customer) {
                    await supabase.from('non_member_profiles').update({
                      stripe_customer_id: session.customer as string,
                    }).eq('user_id', wcUserId);
                  }

                  // Sync name from Stripe session if available
                  const customerName = session.customer_details?.name;
                  if (customerName) {
                    const nameParts = customerName.split(' ');
                    const firstName = nameParts[0] || null;
                    const lastName = nameParts.slice(1).join(' ') || null;
                    await supabase.from('non_member_profiles').update({
                      first_name: firstName,
                      last_name: lastName,
                    }).eq('user_id', wcUserId).is('first_name', null);
                  }
                }
              } catch (wcError) {
                logError(wcError, "WELLNESS_CREDIT_PURCHASE");
              }
            }
          } else {
            // FALLBACK: Handle purchases from Stripe Payment Links (no metadata)
            logStep("No recognized metadata type — attempting price-based fallback", { type: metadata.type, sessionId: session.id });

            try {
              // 1. Retrieve line items to identify what was purchased
              const lineItems = await stripe.checkout.sessions.listLineItems(session.id, { limit: 10 });
              const priceIds = lineItems.data
                .map((li: { price?: { id?: string } }) => li.price?.id)
                .filter(Boolean) as string[];

              logStep("Fallback: line item price IDs", { priceIds });

              if (priceIds.length === 0) {
                logStep("Fallback: no line items found, skipping", { sessionId: session.id });
              } else {
                // 2. Match price IDs against known products
                const matchedProduct = priceIds
                  .map((pid: string) => ({ priceId: pid, info: PRICE_ID_MAP[pid] }))
                  .find((m: { priceId: string; info: typeof PRICE_ID_MAP[string] | undefined }) => m.info);

                if (!matchedProduct || !matchedProduct.info) {
                  logStep("Fallback: no known price ID matched — logging for manual review", {
                    sessionId: session.id,
                    priceIds,
                    customerEmail: session.customer_details?.email,
                    amount: session.amount_total,
                  });
                } else {
                  const product = matchedProduct.info;
                  logStep("Fallback: matched product", { label: product.label, priceId: matchedProduct.priceId });

                  // 3. Look up the buyer by email
                  const customerEmail = session.customer_details?.email;
                  let matchedUserId: string | null = null;
                  let matchedMemberId: string | null = null;

                  if (customerEmail) {
                    // Check members table first
                    const { data: memberMatch } = await supabase
                      .from('members')
                      .select('id, user_id')
                      .ilike('email', customerEmail)
                      .maybeSingle();

                    if (memberMatch?.user_id) {
                      matchedUserId = memberMatch.user_id;
                      matchedMemberId = memberMatch.id;
                      logStep("Fallback: matched to member", { memberId: memberMatch.id, email: customerEmail });
                    } else {
                      // Check non_member_profiles
                      const { data: nonMemberMatch } = await supabase
                        .from('non_member_profiles')
                        .select('id, user_id')
                        .ilike('email', customerEmail)
                        .maybeSingle();

                      if (nonMemberMatch?.user_id) {
                        matchedUserId = nonMemberMatch.user_id;
                        logStep("Fallback: matched to non-member profile", { id: nonMemberMatch.id, email: customerEmail });
                      } else {
                        // AUTO-CREATE: No account found — create auth user + non_member_profile
                        logStep("Fallback: no account found — auto-creating account", { email: customerEmail });
                        try {
                          // Generate a random password (user will reset via email)
                          const randomPassword = crypto.randomUUID() + '!Aa1';
                          
                          const { data: newUser, error: createUserError } = await supabase.auth.admin.createUser({
                            email: customerEmail,
                            password: randomPassword,
                            email_confirm: true, // Skip email verification since they already paid
                            user_metadata: { source: 'payment_link' },
                          });

                          if (createUserError) {
                            // If user already exists, try to find them
                            if (createUserError.message?.includes('already been registered') || createUserError.message?.includes('already exists')) {
                              logStep("Fallback: user already exists in auth, looking up", { email: customerEmail });
                              const { data: existingUsers } = await supabase.auth.admin.listUsers();
                              const existingUser = existingUsers?.users?.find(
                                (u: { email?: string }) => u.email?.toLowerCase() === customerEmail.toLowerCase()
                              );
                              if (existingUser) {
                                matchedUserId = existingUser.id;
                                logStep("Fallback: found existing auth user", { userId: existingUser.id });
                                // Ensure non_member_profile exists
                                await supabase.from('non_member_profiles').upsert({
                                  user_id: existingUser.id,
                                  email: customerEmail,
                                  stripe_customer_id: session.customer as string || null,
                                }, { onConflict: 'user_id' });
                              }
                            } else {
                              logError(createUserError, "AUTO_CREATE_USER");
                            }
                          } else if (newUser?.user) {
                            matchedUserId = newUser.user.id;
                            logStep("Fallback: auth user created", { userId: newUser.user.id, email: customerEmail });

                            // Extract name from Stripe customer if available
                            let firstName: string | null = null;
                            let lastName: string | null = null;
                            const fullName = session.customer_details?.name;
                            if (fullName) {
                              const parts = fullName.trim().split(/\s+/);
                              firstName = parts[0] || null;
                              lastName = parts.slice(1).join(' ') || null;
                            }

                            // Create non_member_profile
                            const { error: profileError } = await supabase
                              .from('non_member_profiles')
                              .insert({
                                user_id: newUser.user.id,
                                email: customerEmail,
                                first_name: firstName,
                                last_name: lastName,
                                stripe_customer_id: session.customer as string || null,
                              });

                            if (profileError) {
                              logError(profileError, "AUTO_CREATE_PROFILE");
                            } else {
                              logStep("Fallback: non_member_profile created", { userId: newUser.user.id });
                            }

                            // Also create a profiles record for auth consistency
                            await supabase.from('profiles').upsert({
                              user_id: newUser.user.id,
                              email: customerEmail,
                              full_name: fullName || customerEmail,
                            }, { onConflict: 'user_id' });

                            // Send welcome email with password reset link
                            try {
                              // Generate password reset link
                              const { data: resetData } = await supabase.auth.admin.generateLink({
                                type: 'recovery',
                                email: customerEmail,
                              });

                              const resetUrl = resetData?.properties?.action_link || `${Deno.env.get('APP_BASE_URL') || 'https://stormwellnessclub.com'}/reset-password`;

                              await supabase.functions.invoke('send-email', {
                                body: {
                                  type: 'payment_link_welcome',
                                  to: customerEmail,
                                  data: {
                                    name: firstName || 'there',
                                    productLabel: product.label,
                                    resetUrl,
                                  },
                                },
                              });
                              logStep("Fallback: welcome email sent", { email: customerEmail });
                            } catch (emailError) {
                              logError(emailError, "AUTO_CREATE_WELCOME_EMAIL");
                              // Don't fail webhook for email errors
                            }
                          }
                        } catch (autoCreateError) {
                          logError(autoCreateError, "AUTO_CREATE_ACCOUNT");
                          // Don't fail webhook for auto-create errors
                        }
                      }
                    }
                  }

                  // 4. Create the record based on product type
                  if (product.productType === 'class_pass' && matchedUserId) {
                    const now = new Date();
                    const expiresAt = new Date(now);
                    expiresAt.setDate(expiresAt.getDate() + product.validityDays);

                    const pricePaid = (session.amount_total || 0) / 100;

                    const { error: insertError } = await supabase
                      .from('class_passes')
                      .insert({
                        user_id: matchedUserId,
                        member_id: matchedMemberId,
                        category: product.category as 'pilates_cycling' | 'aerobics',
                        pass_type: product.passType === 'tenPack' ? '10-pack' : 'single',
                        classes_total: product.classes,
                        classes_remaining: product.classes,
                        price_paid: pricePaid,
                        is_member_price: product.isMember,
                        purchased_at: now.toISOString(),
                        expires_at: expiresAt.toISOString(),
                        status: 'active',
                      });

                    if (insertError) {
                      logError(insertError, "FALLBACK_CLASS_PASS_INSERT");
                    } else {
                      logStep("Fallback: class pass created successfully", {
                        label: product.label,
                        userId: matchedUserId,
                        classes: product.classes,
                        email: customerEmail,
                      });
                    }
                  } else if (product.productType === 'class_pass' && !matchedUserId) {
                    logStep("Fallback: class pass purchased but could not create account — needs manual reconciliation", {
                      label: product.label,
                      email: customerEmail,
                      amount: session.amount_total,
                      sessionId: session.id,
                    });
                  } else if (product.productType === 'guest_pass') {
                    // For guest passes, still create the record if we have a user
                    if (matchedUserId) {
                      const now = new Date();
                      const expiresAt = new Date(now);
                      expiresAt.setDate(expiresAt.getDate() + 30); // 30 days to use guest pass

                      const { error: gpError } = await supabase
                        .from('guest_passes')
                        .insert({
                          user_id: matchedUserId,
                          guest_name: session.customer_details?.name || customerEmail || 'Guest',
                          guest_email: customerEmail,
                          price_paid: (session.amount_total || 0) / 100,
                          status: 'active',
                          expires_at: expiresAt.toISOString(),
                          valid_date: now.toISOString().split('T')[0],
                        });

                      if (gpError) {
                        logError(gpError, "FALLBACK_GUEST_PASS_INSERT");
                      } else {
                        logStep("Fallback: guest pass created", { userId: matchedUserId, email: customerEmail });
                      }
                    } else {
                      logStep("Fallback: guest pass purchased but no account — needs manual processing", {
                        email: customerEmail,
                        amount: session.amount_total,
                        sessionId: session.id,
                      });
                    }
                  }
                }
              }
            } catch (fallbackError) {
              logError(fallbackError, "PAYMENT_LINK_FALLBACK");
              // Don't fail the webhook for fallback errors
            }
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
            // Always sync the subscription_status column to match Stripe
            const { error: syncError } = await supabase
              .from('members')
              .update({ 
                subscription_status: subscription.status,
                updated_at: new Date().toISOString()
              })
              .eq('id', memberData.id);
            
            if (syncError) {
              logError(syncError, "SUBSCRIPTION_STATUS_SYNC");
            } else {
              logStep("Synced subscription_status", { memberId: memberData.id, status: subscription.status });
            }
            
            // Map Stripe subscription status to member status
            let newStatus: string;
            let reason: string;

            if (subscription.status === 'past_due' || subscription.status === 'unpaid') {
              newStatus = 'past_due';
              reason = subscription.status === 'past_due' ? 'payment_past_due' : 'payment_unpaid';
            } else if (subscription.status === 'active') {
              // Only auto-activate members recovering from past_due
              // Do NOT auto-activate pending_activation members - they need explicit admin activation
              const currentMemberStatus = memberData.status;
              if (currentMemberStatus === 'pending_activation') {
                logStep("Subscription active but member is pending_activation - keeping pending (requires admin activation)", { memberId: memberData.id });
                // Still sync subscription_status but don't change member status
                break;
              }
              newStatus = 'active';
              reason = 'subscription_active';
            } else if (subscription.status === 'canceled' || subscription.status === 'incomplete_expired') {
              // Treat incomplete_expired the same as canceled - subscription failed before starting
              newStatus = 'pending_activation';
              reason = subscription.status === 'canceled' ? 'subscription_canceled' : 'subscription_incomplete_expired';
              
              // Only clear the subscription ID if it matches the one we're tracking
              // This prevents a canceled duplicate subscription from wiping the active one
              if (memberData.stripe_subscription_id === subscription.id) {
                const { error: clearSubError } = await supabase.from('members')
                  .update({ stripe_subscription_id: null, subscription_status: 'none' })
                  .eq('id', memberData.id);
                
                if (clearSubError) {
                  logStep("Failed to clear dead subscription ID", { error: clearSubError.message });
                } else {
                  logStep("Cleared dead subscription ID for member", { memberId: memberData.id });
                }
              } else {
                logStep("Canceled subscription does not match stored subscription - skipping clear", {
                  memberId: memberData.id,
                  canceledSubId: subscription.id,
                  storedSubId: memberData.stripe_subscription_id
                });
                // Don't change member status either since their tracked subscription is still active
                break;
              }
            } else if (subscription.status === 'incomplete') {
              // Payment failed on first attempt - don't activate, keep as pending
              // Keep the subscription ID but mark status as incomplete so we can track it
              newStatus = 'pending_activation';
              reason = 'initial_payment_failed';
              
              logStep("Subscription incomplete - payment failed, benefits frozen", { memberId: memberData.id });
            } else {
              // For other statuses (trialing, paused, etc.), keep current status or handle appropriately
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

          // Find member by membership subscription ID first
          let memberData: { id: string } | null = null;
          let isAnnualFeeSubscription = false;
          
          const { data: memberByDues, error: duesError } = await supabase
            .from('members')
            .select('id')
            .eq('stripe_subscription_id', subscription.id)
            .maybeSingle();

          if (duesError) {
            logError(duesError, "SUBSCRIPTION_DELETED_DUES_LOOKUP");
          }
          
          if (memberByDues) {
            memberData = memberByDues;
          } else {
            // Not found by dues subscription - check annual fee subscription
            const { data: memberByAnnualFee, error: annualFeeError } = await supabase
              .from('members')
              .select('id')
              .eq('annual_fee_subscription_id', subscription.id)
              .maybeSingle();
            
            if (annualFeeError) {
              logError(annualFeeError, "SUBSCRIPTION_DELETED_ANNUAL_FEE_LOOKUP");
            }
            
            if (memberByAnnualFee) {
              memberData = memberByAnnualFee;
              isAnnualFeeSubscription = true;
            }
          }

          if (memberData) {
            if (isAnnualFeeSubscription) {
              // Clear annual fee subscription ID only
              const { error: updateError } = await supabase
                .from('members')
                .update({ annual_fee_subscription_id: null })
                .eq('id', memberData.id);

              if (updateError) {
                logError(updateError, "SUBSCRIPTION_DELETED_ANNUAL_FEE_CLEAR");
              } else {
                logStep("Annual fee subscription deleted - cleared from member", { memberId: memberData.id });
              }
            } else {
              // Membership dues subscription - update status with history tracking
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

              // Only clear subscription fields if the deleted subscription matches the stored one
              if (memberData.stripe_subscription_id === subscription.id || !memberData.stripe_subscription_id) {
                const { error: clearError } = await supabase
                  .from('members')
                  .update({
                    stripe_subscription_id: null,
                    subscription_status: 'none',
                    updated_at: new Date().toISOString()
                  })
                  .eq('id', memberData.id);

                if (clearError) {
                  logError(clearError, "SUBSCRIPTION_DELETED_CLEAR_FIELDS");
                } else {
                  logStep("Cleared stale subscription fields", { memberId: memberData.id });
                }
              } else {
                logStep("Deleted subscription does not match stored subscription - skipping clear", {
                  memberId: memberData.id,
                  deletedSubId: subscription.id,
                  storedSubId: memberData.stripe_subscription_id
                });
              }
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

          // Check if this is a Kids Care Pass renewal
          const kidsCarePassPriceId = 'price_1TCEyxLyZrsSqLhsHLRDNixO';
          const isKidsCareInvoice = invoice.lines?.data?.some((line: Stripe.InvoiceLineItem) =>
            line.price && line.price.id === kidsCarePassPriceId
          ) || false;

          if (isKidsCareInvoice) {
            logStep("Kids Care Pass renewal detected", { subscriptionId: invoice.subscription });

            // Find the subscription to get user_id from metadata
            try {
              const subscription = await stripe.subscriptions.retrieve(invoice.subscription as string);
              const subUserId = subscription.metadata?.user_id;
              const subMemberId = subscription.metadata?.member_id;

              if (subUserId) {
                // Reset or create kids care pass: 4 sessions, 30-day expiry
                const expiresAt = new Date();
                expiresAt.setDate(expiresAt.getDate() + 30);

                // Try to find existing active kids_care pass and reset it
                const { data: existingPass } = await supabase
                  .from('class_passes')
                  .select('id')
                  .eq('user_id', subUserId)
                  .eq('pass_type', 'kids_care')
                  .eq('status', 'active')
                  .order('created_at', { ascending: false })
                  .limit(1)
                  .maybeSingle();

                if (existingPass) {
                  // Reset existing pass
                  await supabase
                    .from('class_passes')
                    .update({
                      classes_remaining: 16,
                      classes_total: 16,
                      expires_at: expiresAt.toISOString(),
                      status: 'active',
                    })
                    .eq('id', existingPass.id);
                  logStep("Kids Care Pass renewed (reset existing)", { passId: existingPass.id });
                } else {
                  // Create new pass
                  await supabase
                    .from('class_passes')
                    .insert({
                      user_id: subUserId,
                      member_id: subMemberId || null,
                      category: 'other',
                      pass_type: 'kids_care',
                      classes_total: 16,
                      classes_remaining: 16,
                      price_paid: 75,
                      is_member_price: true,
                      expires_at: expiresAt.toISOString(),
                      status: 'active',
                    });
                  logStep("Kids Care Pass renewed (created new)", { userId: subUserId });
                }
              }
            } catch (renewError) {
              logError(renewError, "KIDS_CARE_RENEWAL");
            }
            // Don't break — continue to process payment attempt logging below
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
            // Block check: if member's email is blocked, refund and cancel
            const { data: memberEmail } = await supabase
              .from('members')
              .select('email')
              .eq('id', memberData.id)
              .maybeSingle();
            if (memberEmail?.email) {
              const { data: blockedMember } = await supabase
                .from('blocked_persons')
                .select('id')
                .ilike('email', memberEmail.email.toLowerCase())
                .maybeSingle();
              if (blockedMember) {
                logStep("BLOCKED person payment detected — refunding and cancelling", { memberId: memberData.id, email: memberEmail.email });
                // Refund the payment
                try {
                  const pi = invoice.payment_intent;
                  const piId = typeof pi === 'string' ? pi : pi?.id;
                  if (piId) {
                    await stripe.refunds.create({ payment_intent: piId });
                    logStep("Refund created for blocked person", { paymentIntentId: piId });
                  }
                } catch (refundErr) {
                  logError(refundErr, "BLOCKED_PERSON_REFUND");
                }
                // Cancel the subscription
                try {
                  const subId = invoice.subscription as string;
                  if (subId) {
                    await stripe.subscriptions.cancel(subId);
                    logStep("Subscription cancelled for blocked person", { subscriptionId: subId });
                  }
                } catch (cancelErr) {
                  logError(cancelErr, "BLOCKED_PERSON_CANCEL_SUB");
                }
                return successResponse({ blocked: true, memberId: memberData.id });
              }
            }
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

            // ── Upsert billing_arrears ledger: mark this period as paid ──
            try {
              const periodStart = invoice.period_start ? new Date(invoice.period_start * 1000).toISOString().split('T')[0] : new Date().toISOString().split('T')[0];
              const periodEnd = invoice.period_end ? new Date(invoice.period_end * 1000).toISOString().split('T')[0] : periodStart;
              const billingType = isAnnualFeeInvoice ? 'annual_fee' : 'membership_dues';

              const { error: arrUpsertErr } = await supabase
                .from('billing_arrears')
                .upsert({
                  member_id: memberData.id,
                  stripe_invoice_id: invoice.id,
                  billing_type: billingType,
                  period_start: periodStart,
                  period_end: periodEnd,
                  amount_due_cents: invoice.amount_due || 0,
                  amount_paid_cents: invoice.amount_paid || 0,
                  stripe_subscription_id: invoice.subscription as string,
                  stripe_payment_intent_id: paymentIntentId,
                  status: 'paid',
                  attempt_count: invoice.attempt_count || 1,
                  paid_at: new Date().toISOString(),
                  failure_code: null,
                  failure_message: null,
                  decline_code: null,
                  next_retry_at: null,
                  updated_at: new Date().toISOString(),
                }, { onConflict: 'member_id,stripe_invoice_id' });

              if (arrUpsertErr) {
                logError(arrUpsertErr, "BILLING_ARREARS_UPSERT_SUCCEEDED");
              } else {
                logStep("Billing arrears marked paid", { memberId: memberData.id, invoiceId: invoice.id });
              }
            } catch (arrErr) {
              logError(arrErr, "BILLING_ARREARS_UPSERT_SUCCEEDED");
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

                // Send receipt email for annual fee renewal
                try {
                  const { data: fullMemberData } = await supabase
                    .from('members')
                    .select('email, first_name, last_name, membership_type')
                    .eq('id', memberData.id)
                    .single();

                  if (fullMemberData?.email) {
                    const tierName = getTierName(fullMemberData.membership_type || 'silver');
                    const tierDisplay = tierName.charAt(0).toUpperCase() + tierName.slice(1);
                    const memberName = `${fullMemberData.first_name || ''} ${fullMemberData.last_name || ''}`.trim() || 'Member';
                    
                    // Get subscription for next billing date
                    const subscription = await stripe.subscriptions.retrieve(invoice.subscription as string);
                    const nextBillingDate = new Date(subscription.current_period_end * 1000).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric'
                    });

                    const paymentDateStr = new Date(invoice.created * 1000).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric'
                    });

                    await supabase.functions.invoke('send-email', {
                      body: {
                        type: 'charge_confirmation',
                        to: fullMemberData.email,
                        data: {
                          name: memberName,
                          description: `Annual Fee - ${tierDisplay}`,
                          amount: (invoice.amount_paid / 100).toFixed(2),
                          paymentDate: paymentDateStr,
                          nextBillingDate: nextBillingDate,
                          cardBrand: cardBrand || 'Unknown',
                          cardLast4: cardLast4 || '****',
                        },
                      },
                    });

                    logStep("Receipt email sent for annual fee", { memberId: memberData.id, email: fullMemberData.email });
                  }
                } catch (emailError) {
                  logError(emailError, "RECEIPT_EMAIL_ANNUAL_FEE");
                  // Don't fail webhook for email errors
                }
              }
            } else {
              // Sync subscription_status to 'active' on successful payment
              const { error: syncError } = await supabase
                .from('members')
                .update({ 
                  subscription_status: 'active',
                  updated_at: new Date().toISOString()
                })
                .eq('id', memberData.id);
              
              if (syncError) {
                logError(syncError, "SUBSCRIPTION_STATUS_SYNC_PAYMENT_SUCCEEDED");
              } else {
                logStep("Synced subscription_status to active", { memberId: memberData.id });
              }
              
              // Update member status to active if it was past_due or pending_activation (membership subscription)
              // pending_activation covers cases where a subscription was incomplete_expired but payment later succeeded
              if (memberData.status === 'past_due' || memberData.status === 'pending_activation') {
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

              // Create new monthly credits for successful subscription renewal
              try {
                // Get member tier to determine credit amounts
                const { data: memberInfo } = await supabase
                  .from('members')
                  .select('membership_type, user_id, membership_start_date')
                  .eq('id', memberData.id)
                  .single();

                if (memberInfo && memberInfo.user_id) {
                  const tierName = getTierName(memberInfo.membership_type || 'silver');
                  const tierCredits = TIER_CREDITS[tierName] || TIER_CREDITS.silver;

                  // Calculate cycle dates based on invoice period
                  const cycleStart = new Date(invoice.period_start * 1000);
                  const cycleEnd = new Date(invoice.period_end * 1000);
                  cycleEnd.setDate(cycleEnd.getDate() - 1); // End day before next billing
                  const expiresAt = new Date(cycleEnd);
                  expiresAt.setHours(23, 59, 59, 999);

                  const cycleStartStr = cycleStart.toISOString().split('T')[0];
                  const cycleEndStr = cycleEnd.toISOString().split('T')[0];

                  // Check if credits already exist for this cycle
                  const { data: existingCredits } = await supabase
                    .from('member_credits')
                    .select('credit_type')
                    .eq('user_id', memberInfo.user_id)
                    .eq('cycle_start', cycleStartStr);

                  const existingTypes = new Set(existingCredits?.map((c: { credit_type: string }) => c.credit_type) || []);

                  const creditsToCreate: Array<{
                    user_id: string;
                    member_id: string;
                    credit_type: string;
                    credits_total: number;
                    credits_remaining: number;
                    cycle_start: string;
                    cycle_end: string;
                    expires_at: string;
                  }> = [];
                  const creditTypes = ['class', 'red_light', 'dry_cryo'] as const;

                  for (const creditType of creditTypes) {
                    const amount = tierCredits[creditType];
                    if (amount > 0 && !existingTypes.has(creditType)) {
                      creditsToCreate.push({
                        user_id: memberInfo.user_id,
                        member_id: memberData.id,
                        credit_type: creditType,
                        credits_total: amount,
                        credits_remaining: amount,
                        cycle_start: cycleStartStr,
                        cycle_end: cycleEndStr,
                        expires_at: expiresAt.toISOString(),
                      });
                    }
                  }

                  if (creditsToCreate.length > 0) {
                    const { error: creditError } = await supabase
                      .from('member_credits')
                      .insert(creditsToCreate);

                    if (creditError) {
                      logError(creditError, "CREDIT_RENEWAL");
                    } else {
                      logStep("Monthly credits renewed", { 
                        memberId: memberData.id, 
                        credits: creditsToCreate.length,
                        tier: tierName
                      });
                    }
                  } else {
                    logStep("Credits already exist or tier has no credits", { 
                      memberId: memberData.id,
                      tier: tierName,
                      cycleStart: cycleStartStr
                    });
                  }
                }
              } catch (creditRenewalError) {
                logError(creditRenewalError, "CREDIT_RENEWAL");
              }

              // Send receipt email for membership dues renewal
              try {
                const { data: fullMemberData } = await supabase
                  .from('members')
                  .select('email, first_name, last_name, membership_type')
                  .eq('id', memberData.id)
                  .single();

                if (fullMemberData?.email) {
                  const tierName = getTierName(fullMemberData.membership_type || 'silver');
                  const tierDisplay = tierName.charAt(0).toUpperCase() + tierName.slice(1);
                  const memberName = `${fullMemberData.first_name || ''} ${fullMemberData.last_name || ''}`.trim() || 'Member';
                  
                  // Get subscription for next billing date
                  const subscription = await stripe.subscriptions.retrieve(invoice.subscription as string);
                  const nextBillingDate = new Date(subscription.current_period_end * 1000).toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric'
                  });

                  const paymentDateStr = new Date(invoice.created * 1000).toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric'
                  });

                  await supabase.functions.invoke('send-email', {
                    body: {
                      type: 'charge_confirmation',
                      to: fullMemberData.email,
                      data: {
                        name: memberName,
                        description: `Membership Dues - ${tierDisplay}`,
                        amount: (invoice.amount_paid / 100).toFixed(2),
                        paymentDate: paymentDateStr,
                        nextBillingDate: nextBillingDate,
                        cardBrand: cardBrand || 'Unknown',
                        cardLast4: cardLast4 || '****',
                      },
                    },
                  });

                  logStep("Receipt email sent for membership dues", { memberId: memberData.id, email: fullMemberData.email });
                }
              } catch (emailError) {
                logError(emailError, "RECEIPT_EMAIL_MEMBERSHIP");
                // Don't fail webhook for email errors
                // Don't fail the webhook for credit creation issues
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

          // Find member by subscription ID (check both dues and annual fee subscriptions)
          let memberData: { id: string; status: string; email: string; first_name: string; last_name: string } | null = null;
          let subscriptionType: 'membership_dues' | 'annual_fee' = 'membership_dues';
          
          // First try to find by dues subscription
          const { data: duesMember, error: duesError } = await supabase
            .from('members')
            .select('id, status, email, first_name, last_name')
            .eq('stripe_subscription_id', invoice.subscription as string)
            .maybeSingle();

          if (duesError) {
            logError(duesError, "INVOICE_PAYMENT_FAILED_MEMBER_LOOKUP_DUES");
          }
          
          if (duesMember) {
            memberData = duesMember;
            subscriptionType = 'membership_dues';
          } else {
            // If not found, try annual_fee_subscription_id
            const { data: annualFeeMember, error: annualFeeError } = await supabase
              .from('members')
              .select('id, status, email, first_name, last_name')
              .eq('annual_fee_subscription_id', invoice.subscription as string)
              .maybeSingle();
            
            if (annualFeeError) {
              logError(annualFeeError, "INVOICE_PAYMENT_FAILED_MEMBER_LOOKUP_ANNUAL_FEE");
            }
            
            if (annualFeeMember) {
              memberData = annualFeeMember;
              subscriptionType = 'annual_fee';
            }
          }

          if (memberData) {
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

            // ── Upsert billing_arrears ledger: mark this period as unpaid ──
            try {
              const periodStart = invoice.period_start ? new Date(invoice.period_start * 1000).toISOString().split('T')[0] : new Date().toISOString().split('T')[0];
              const periodEnd = invoice.period_end ? new Date(invoice.period_end * 1000).toISOString().split('T')[0] : periodStart;

              const { error: arrUpsertErr } = await supabase
                .from('billing_arrears')
                .upsert({
                  member_id: memberData.id,
                  stripe_invoice_id: invoice.id,
                  billing_type: subscriptionType === 'annual_fee' ? 'annual_fee' : 'membership_dues',
                  period_start: periodStart,
                  period_end: periodEnd,
                  amount_due_cents: invoice.amount_due || 0,
                  amount_paid_cents: 0,
                  stripe_subscription_id: invoice.subscription as string,
                  stripe_payment_intent_id: paymentIntentId,
                  status: 'unpaid',
                  failure_code: failureCode,
                  failure_message: declineReason || failureMessage,
                  decline_code: declineCode,
                  attempt_count: attemptCount,
                  next_retry_at: willRetry && invoice.next_payment_attempt
                    ? new Date(invoice.next_payment_attempt * 1000).toISOString()
                    : null,
                  updated_at: new Date().toISOString(),
                }, { onConflict: 'member_id,stripe_invoice_id' });

              if (arrUpsertErr) {
                logError(arrUpsertErr, "BILLING_ARREARS_UPSERT_FAILED");
              } else {
                logStep("Billing arrears recorded as unpaid", { memberId: memberData.id, invoiceId: invoice.id });
              }
            } catch (arrErr) {
              logError(arrErr, "BILLING_ARREARS_UPSERT_FAILED");
            }

            // Update member status to past_due for payment failures
            // Apply to 'active' and 'pending_activation' members (not frozen/cancelled/etc)
            const statusesToUpdate = ['active', 'pending_activation'];
            if (statusesToUpdate.includes(memberData.status)) {
              const newStatus = memberData.status === 'active' ? 'past_due' : 'pending_activation';
              
              // For pending_activation, we keep the status but log the failure
              // For active members, we move them to past_due
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
                    attempt_count: attemptCount,
                    subscription_type: subscriptionType
                  }
                });

                if (updateError) {
                  logError(updateError, "INVOICE_PAYMENT_FAILED_STATUS_UPDATE");
                } else {
                  logStep("Member status updated to past_due", { 
                    memberId: memberData.id,
                    previousStatus: memberData.status,
                    subscriptionType
                  });
                }
              } else {
                // For pending_activation, just log that payment failed
                logStep("Payment failed for pending_activation member - keeping status", { 
                  memberId: memberData.id,
                  subscriptionType
                });
              }
            } else {
              logStep("Member status not updated - current status does not allow auto-update", {
                memberId: memberData.id,
                currentStatus: memberData.status,
                subscriptionType
              });
            }

            // Send payment failure email notification to member
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

            // Send admin alert email
            try {
              const memberNameForAdmin = memberData.first_name && memberData.last_name 
                ? `${memberData.first_name} ${memberData.last_name}`
                : memberData.first_name || memberData.last_name || 'Unknown Member';
              
              // Check if this is an annual fee subscription
              const annualFeePriceIds = ['price_1SlA2BLyZrsSqLhs8VX17F0C', 'price_1SlA2RLyZrsSqLhsK3XQuANN'];
              const isAnnualFeeFailure = invoice.lines?.data?.some((line: Stripe.InvoiceLineItem) => 
                line.price && annualFeePriceIds.includes(line.price.id as string)
              ) || false;
              
              // Determine admin email recipient
              const adminAlertEmail = Deno.env.get('ADMIN_ALERT_EMAIL') || 'hello@stormwellnessclub.com';
              
              const { error: adminEmailError } = await supabase.functions.invoke('send-email', {
                body: {
                  type: 'admin_payment_failed_alert',
                  to: adminAlertEmail,
                  data: {
                    memberName: memberNameForAdmin,
                    memberEmail: memberData.email || '',
                    memberId: memberData.id,
                    amount: invoice.amount_due / 100,
                    failureReason: declineReason || failureMessage || 'Payment processing failed',
                    subscriptionType: isAnnualFeeFailure ? 'Initiation Fee (Annual)' : 'Membership Dues',
                    willRetry: willRetry,
                    nextRetryDate: invoice.next_payment_attempt ? new Date(invoice.next_payment_attempt * 1000).toISOString() : null,
                  },
                },
              });

              if (adminEmailError) {
                logError(adminEmailError, "INVOICE_PAYMENT_FAILED_ADMIN_ALERT");
              } else {
                logStep("Admin payment failure alert sent", { memberId: memberData.id, adminEmail: adminAlertEmail });
              }
            } catch (adminAlertError) {
              logError(adminAlertError, "INVOICE_PAYMENT_FAILED_ADMIN_ALERT");
              // Don't fail the webhook if admin alert fails
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

          // Update card_setup_attempts to succeeded (audit trail)
          try {
            await supabase
              .from('card_setup_attempts')
              .update({
                status: 'succeeded',
                completed_at: new Date().toISOString(),
                card_brand: cardBrand,
                card_last4: cardLast4,
              })
              .eq('stripe_setup_intent', setupIntent.id);
            logStep("Updated card_setup_attempt to succeeded", { setupIntentId: setupIntent.id });
          } catch (auditErr) {
            logError(auditErr, "SETUP_INTENT_AUDIT_UPDATE");
          }

        } catch (setupError) {
          logError(setupError, "SETUP_INTENT_SUCCEEDED");
          return errorResponse(setupError, "SETUP_INTENT_SUCCEEDED");
        }
        break;
      }

      case 'setup_intent.setup_failed': {
        // Handle card setup failures (declines)
        try {
          const setupIntent = event.data.object as Stripe.SetupIntent;
          const customerId = setupIntent.customer as string;
          const lastError = setupIntent.last_setup_error;

          const declineCode = lastError?.decline_code || lastError?.code || null;
          const declineMessage = lastError?.message || 'Card setup failed';

          logStep("SetupIntent failed", { 
            setupIntentId: setupIntent.id, 
            customerId, 
            declineCode,
            declineMessage,
          });

          // Update card_setup_attempts to failed
          try {
            const { data: existingAttempt } = await supabase
              .from('card_setup_attempts')
              .select('id')
              .eq('stripe_setup_intent', setupIntent.id)
              .maybeSingle();

            if (existingAttempt) {
              await supabase
                .from('card_setup_attempts')
                .update({
                  status: 'failed',
                  completed_at: new Date().toISOString(),
                  decline_code: declineCode,
                  decline_message: declineMessage,
                })
                .eq('id', existingAttempt.id);
              
              logStep("Updated card_setup_attempt to failed", { 
                id: existingAttempt.id, 
                declineCode 
              });
            } else {
              // Insert new record if not found (shouldn't happen but safety net)
              await supabase.from('card_setup_attempts').insert({
                stripe_customer_id: customerId || 'unknown',
                stripe_setup_intent: setupIntent.id,
                source: 'unknown', // We don't have context here
                status: 'failed',
                completed_at: new Date().toISOString(),
                decline_code: declineCode,
                decline_message: declineMessage,
                metadata: { logged_from: 'webhook' },
              });
              logStep("Inserted card_setup_attempt as failed (webhook)", { 
                setupIntentId: setupIntent.id 
              });
            }
          } catch (auditErr) {
            logError(auditErr, "SETUP_INTENT_FAILED_AUDIT");
          }

        } catch (setupFailedError) {
          logError(setupFailedError, "SETUP_INTENT_FAILED");
          return errorResponse(setupFailedError, "SETUP_INTENT_FAILED");
        }
        break;
      }

      case 'invoice.created': {
        // Add processing fee to draft invoices for recurring subscriptions
        try {
          const invoice = event.data.object as Stripe.Invoice;
          
          // Only process draft invoices (before finalization) for subscriptions
          if (invoice.status !== 'draft' || !invoice.subscription) {
            logStep("Skipping invoice.created - not a draft subscription invoice", { 
              invoiceId: invoice.id, 
              status: invoice.status,
              hasSubscription: !!invoice.subscription 
            });
            break;
          }

          // Don't add fee if there's already a processing fee line item
          const existingFeeItem = invoice.lines?.data?.find(
            (line: any) => line.description?.toLowerCase().includes('processing fee')
          );
          if (existingFeeItem) {
            logStep("Processing fee already exists on invoice", { invoiceId: invoice.id });
            break;
          }

          const subtotalCents = invoice.subtotal || 0;
          if (subtotalCents <= 0) {
            logStep("Invoice subtotal is zero - skipping fee", { invoiceId: invoice.id });
            break;
          }

          // Calculate processing fee: total = ceil((base + 30) / 0.971), fee = total - base
          const totalCents = Math.ceil((subtotalCents + 30) / 0.971);
          const feeCents = totalCents - subtotalCents;

          if (feeCents <= 0) {
            logStep("Calculated fee is zero - skipping", { invoiceId: invoice.id, subtotalCents });
            break;
          }

          // Add processing fee as an invoice item
          await stripe.invoiceItems.create({
            customer: invoice.customer as string,
            invoice: invoice.id,
            amount: feeCents,
            currency: 'usd',
            description: 'Processing Fee',
          });

          logStep("Processing fee added to invoice", { 
            invoiceId: invoice.id, 
            subtotalCents, 
            feeCents,
            totalCents
          });
        } catch (invoiceCreatedError) {
          logError(invoiceCreatedError, "INVOICE_CREATED_PROCESSING_FEE");
          // Don't fail - fee is nice-to-have, shouldn't block invoice
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
