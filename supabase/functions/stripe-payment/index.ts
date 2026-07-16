import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Processing fee calculation: covers Stripe's 2.9% + $0.30
function calculateProcessingFee(amountInCents: number): number {
  if (amountInCents <= 0) return 0;
  const totalCents = Math.ceil((amountInCents + 30) / 0.971);
  return totalCents - amountInCents;
}

// Cache the Processing Fee product ID to avoid repeated lookups
let processingFeeProductId: string | null = null;

async function getOrCreateProcessingFeeProduct(stripe: Stripe): Promise<string> {
  if (processingFeeProductId) return processingFeeProductId;
  
  // Search for existing product
  const products = await stripe.products.search({
    query: "name:'Processing Fee'",
    limit: 1,
  });
  
  if (products.data.length > 0) {
    processingFeeProductId = products.data[0].id;
    return processingFeeProductId!;
  }
  
  // Create new product
  const product = await stripe.products.create({
    name: 'Processing Fee',
    description: 'Card processing fee (2.9% + $0.30)',
    metadata: { type: 'processing_fee' },
  });
  processingFeeProductId = product.id;
  return processingFeeProductId!;
}

async function createProcessingFeeLineItem(stripe: Stripe, baseAmountCents: number): Promise<{ price: string; quantity: number } | null> {
  const feeCents = calculateProcessingFee(baseAmountCents);
  if (feeCents <= 0) return null;
  
  const productId = await getOrCreateProcessingFeeProduct(stripe);
  
  const price = await stripe.prices.create({
    product: productId,
    unit_amount: feeCents,
    currency: 'usd',
  });
  
  return { price: price.id, quantity: 1 };
}

// Get or create a recurring processing fee price for subscription items
async function getOrCreateRecurringProcessingFeePrice(
  stripe: Stripe,
  baseAmountCents: number,
  interval: 'month' | 'year'
): Promise<string | null> {
  const feeCents = calculateProcessingFee(baseAmountCents);
  if (feeCents <= 0) return null;
  
  const productId = await getOrCreateProcessingFeeProduct(stripe);
  
  // Search for existing recurring price with matching amount and interval
  const existingPrices = await stripe.prices.list({
    product: productId,
    type: 'recurring',
    active: true,
    limit: 100,
  });
  
  const matchingPrice = existingPrices.data.find((p: Stripe.Price) => 
    p.unit_amount === feeCents && 
    p.recurring?.interval === interval
  );
  
  if (matchingPrice) return matchingPrice.id;
  
  // Create new recurring price
  const price = await stripe.prices.create({
    product: productId,
    unit_amount: feeCents,
    currency: 'usd',
    recurring: { interval },
    metadata: { type: 'processing_fee', base_amount: String(baseAmountCents) },
  });
  
  return price.id;
}

// Add recurring processing fee items to a subscription items array
// Looks up each base price to determine amount and interval, then adds a matching fee item
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
        console.log(`[STRIPE-PAYMENT] Added recurring processing fee: ${feePriceId} (${calculateProcessingFee(baseAmount)}¢ per ${interval})`);
      }
    } catch (e) {
      console.log(`[STRIPE-PAYMENT] Warning: Could not add processing fee for price ${item.price}:`, e instanceof Error ? e.message : String(e));
    }
  }
  return result;
}

// Credit allocations by tier (matching webhook)
const TIER_CREDITS: Record<string, { class: number; red_light: number; dry_cryo: number }> = {
  silver: { class: 0, red_light: 0, dry_cryo: 0 },
  gold: { class: 0, red_light: 4, dry_cryo: 2 },
  platinum: { class: 0, red_light: 6, dry_cryo: 4 },
  diamond: { class: 10, red_light: 10, dry_cryo: 6 },
};

// Stripe Price IDs - MUST MATCH src/lib/stripeProducts.ts
// IMPORTANT: This is duplicated from src/lib/stripeProducts.ts because Edge Functions
// run in Deno and cannot import TypeScript from the frontend codebase.
// When updating prices, update BOTH locations:
// 1) src/lib/stripeProducts.ts (source of truth)
// 2) This file (supabase/functions/stripe-payment/index.ts)
// 3) supabase/functions/stripe-webhook/index.ts (if it uses price IDs)
const STRIPE_PRODUCTS = {
  memberships: {
    silver: {
      monthly: { women: 'price_1Sl9llLyZrsSqLhsJhm0MdJi', men: 'price_1Sl9mBLyZrsSqLhsas4CTChz' },
      annual: { women: 'price_1Sl9x2LyZrsSqLhsYLtI7doB', men: 'price_1Sl9yLLyZrsSqLhsG6NiPqH5' },
    },
    gold: {
      monthly: { women: 'price_1Sl9pvLyZrsSqLhsIWyf2WwX', men: 'price_1Sl9quLyZrsSqLhs6PPn9AeL' },
      annual: { women: 'price_1SlA0bLyZrsSqLhsOIdyhLo7', men: 'price_1SlA11LyZrsSqLhsfSqUElkE' },
    },
    platinum: {
      monthly: { women: 'price_1Sl9r7LyZrsSqLhs5RBuy2f7', men: 'price_1Sl9roLyZrsSqLhsQCydIccE' },
      annual: { women: 'price_1SlA1cLyZrsSqLhsAXXQEqVx', men: 'price_1SlA1oLyZrsSqLhstHpodZzv' },
    },
    diamond: {
      monthly: { women: 'price_1Sl9wILyZrsSqLhsLjYqkoqq', men: null },
      annual: { women: 'price_1SlA1zLyZrsSqLhsbJMZ0za2', men: null },
    },
  },
  annualFee: {
    women: 'price_1SlA2BLyZrsSqLhs8VX17F0C',
    men: 'price_1SlA2RLyZrsSqLhsK3XQuANN',
  },
  classPasses: {
    pilatesCycling: {
      single: { member: 'price_1SlA2vLyZrsSqLhsBHHWlQPD', nonMember: 'price_1T2XzALyZrsSqLhs1N07i160' },
      tenPack: { member: 'price_1SlA9sLyZrsSqLhsM0X8VDhN', nonMember: 'price_1T2XzfLyZrsSqLhsd8Gu4c7B' },
    },
    otherClasses: {
      single: { member: 'price_1T2XmKLyZrsSqLhsmtaMSUiF', nonMember: 'price_1SlABFLyZrsSqLhsGOpvWGFE' },
      tenPack: { member: 'price_1T2YiALyZrsSqLhsuJGaqAaK', nonMember: 'price_1T2XoiLyZrsSqLhsjN7Hb2Lk' },
    },
  },
  guestPass: 'price_1SxATYLyZrsSqLhs6vDu1QWg',  // $60 - Guest Pass (gym and amenities access, subject to availability)
  guestAddons: {
    rlt10: 'price_1Sy3qVLyZrsSqLhsgs55vadk',    // $18 - Full Body Red Light Therapy 10 min
    rlt20: 'price_1Sy3y3LyZrsSqLhsN3WxRig0',    // $28 - Full Body Red Light Therapy 20 min
    cryo: 'price_1Sy3ytLyZrsSqLhsziHR3pw1',     // $45 - ZeroBody Cryo Session
    classPilatesCycling: 'price_1T2XzALyZrsSqLhs1N07i160', // $30 - Non-member Pilates/Cycling
    classOther: 'price_1SlABFLyZrsSqLhsGOpvWGFE',          // $30 - Non-member Other Classes
  },
  kidsCare: {
    member: 'price_1TCEyxLyZrsSqLhsHLRDNixO', // $75/mo - Kids Care Pass (Member), 4 sessions, 2hr max, auto-renew
  },
};

// Open-ended request shape: many actions accept dynamic fields, so we allow
// arbitrary properties while still documenting common ones.
// deno-lint-ignore no-explicit-any
interface PaymentRequest {
  action: string;
  [key: string]: any;
}

const logStep = (step: string, details?: unknown) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[STRIPE-PAYMENT] ${step}${detailsStr}`);
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const stripeSecretKey = Deno.env.get('STRIPE_SECRET_KEY');
  if (!stripeSecretKey) {
    console.error("STRIPE_SECRET_KEY is not configured");
    return new Response(
      JSON.stringify({ error: "Payment service not configured" }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }

  const stripe = new Stripe(stripeSecretKey, { apiVersion: '2025-08-27.basil' });
  
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    const body: PaymentRequest = await req.json();
    const { action } = body;
    logStep(`Processing action: ${action}`, body);

    // Handle unauthenticated action: create_application_setup
    // Note: successUrl and cancelUrl are optional - only used by admin portal
    // The self-service flow uses embedded PaymentElement which doesn't redirect
    if (action === 'create_application_setup') {
      const { applicantEmail, applicantName } = body;

      if (!applicantEmail || !applicantName) {
        throw new Error("Missing required fields for application setup (email, name)");
      }

      // Block check for application setup
      const { data: blockedApp } = await supabase
        .from('blocked_persons')
        .select('id')
        .ilike('email', applicantEmail.trim())
        .maybeSingle();
      if (blockedApp) {
        logStep("BLOCKED person attempted application setup", { email: applicantEmail });
        return new Response(
          JSON.stringify({ error: "Access denied. You are not permitted to use our services." }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 403 }
        );
      }

      // Validate email format
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(applicantEmail)) {
        throw new Error("Invalid email format");
      }

      logStep("Creating application setup for", { email: applicantEmail, name: applicantName });

      // Check if customer already exists
      const customers = await stripe.customers.list({ email: applicantEmail, limit: 1 });
      let customerId: string;
      
      if (customers.data.length > 0) {
        customerId = customers.data[0].id;
        logStep("Found existing Stripe customer", { customerId });
      } else {
        const customer = await stripe.customers.create({
          email: applicantEmail,
          name: applicantName,
          metadata: { source: 'membership_application' }
        });
        customerId = customer.id;
        logStep("Created new Stripe customer", { customerId });
      }

      // Create SetupIntent for embedded payment (stays in-app)
      const setupIntent = await stripe.setupIntents.create({
        customer: customerId,
        payment_method_types: ['card'],
        metadata: {
          type: 'application_card_setup',
          applicant_email: applicantEmail,
          applicant_name: applicantName,
          source: 'membership_application',
        },
      });

      logStep("Setup intent created", { setupIntentId: setupIntent.id, customerId });

      // Log card setup attempt for audit trail
      try {
        // Find application by email
        const { data: appData } = await supabase
          .from('membership_applications')
          .select('id')
          .ilike('email', applicantEmail)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        await supabase.from('card_setup_attempts').insert({
          application_id: appData?.id || null,
          stripe_customer_id: customerId,
          stripe_setup_intent: setupIntent.id,
          source: 'self_service',
          status: 'initiated',
          metadata: { applicant_email: applicantEmail, applicant_name: applicantName },
        });
        logStep("Card setup attempt logged (self_service)", { setupIntentId: setupIntent.id });
      } catch (auditErr) {
        logStep("Warning: Failed to log card setup attempt", { error: String(auditErr) });
      }

      return new Response(
        JSON.stringify({ 
          clientSecret: setupIntent.client_secret,
          setupIntentId: setupIntent.id,
          customerId: customerId,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      );
    }

    // Handle unauthenticated action: list_application_payment_methods
    // This allows applicants to fetch their card details after saving without needing auth.
    // SECURITY: The stripeCustomerId must be bound to a real membership_applications row
    // (created by our own create_application_setup flow) — this prevents card metadata
    // enumeration by callers who guess arbitrary Stripe customer IDs.
    if (action === 'list_application_payment_methods') {
      const { stripeCustomerId: appCustomerId } = body;

      if (!appCustomerId) {
        return new Response(
          JSON.stringify({ paymentMethods: [], hasPaymentMethod: false }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
        );
      }

      // Verify the customer ID is tied to an application we know about.
      const supabaseAdmin = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
      );
      const { data: appRow } = await supabaseAdmin
        .from('membership_applications')
        .select('id')
        .eq('stripe_customer_id', appCustomerId)
        .maybeSingle();

      if (!appRow) {
        logStep("list_application_payment_methods rejected: customer not tied to any application", { stripeCustomerId: appCustomerId });
        return new Response(
          JSON.stringify({ paymentMethods: [], hasPaymentMethod: false }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
        );
      }

      logStep("Listing payment methods for application (unauthenticated)", { stripeCustomerId: appCustomerId });

      try {
        // Get customer to find default payment method
        const appCustomer = await stripe.customers.retrieve(appCustomerId);
        const appDefaultPaymentMethodId = !appCustomer.deleted 
          ? appCustomer.invoice_settings?.default_payment_method as string | null
          : null;

        // List payment methods
        const appPaymentMethods = await stripe.paymentMethods.list({
          customer: appCustomerId,
          type: 'card',
        });

        const appFormattedMethods = appPaymentMethods.data.map((pm: { 
          id: string; 
          card?: { brand?: string; last4?: string; exp_month?: number; exp_year?: number };
          metadata?: Record<string, string>;
        }) => ({
          id: pm.id,
          brand: pm.card?.brand,
          last4: pm.card?.last4,
          expMonth: pm.card?.exp_month,
          expYear: pm.card?.exp_year,
          nickname: pm.metadata?.nickname || null,
          isDefault: pm.id === appDefaultPaymentMethodId,
        }));

        logStep("Application payment methods listed (unauthenticated)", { 
          stripeCustomerId: appCustomerId, 
          count: appFormattedMethods.length 
        });

        return new Response(
          JSON.stringify({ 
            paymentMethods: appFormattedMethods, 
            hasPaymentMethod: appFormattedMethods.length > 0,
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
        );
      } catch (stripeErr: any) {
        logStep("Error listing application payment methods (unauthenticated)", { error: stripeErr.message });
        return new Response(
          JSON.stringify({ paymentMethods: [], hasPaymentMethod: false, error: stripeErr.message }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
        );
      }
    }


    // All other actions require authentication
    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      throw new Error("Authorization required");
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      throw new Error("Invalid authorization");
    }
    logStep("User authenticated", { userId: user.id, email: user.email });

    // Block check: reject all payment actions for blocked persons
    if (user.email) {
      const { data: blockedPerson } = await supabase
        .from('blocked_persons')
        .select('id')
        .ilike('email', user.email.toLowerCase())
        .maybeSingle();
      if (blockedPerson) {
        logStep("BLOCKED person attempted payment action", { email: user.email, action });
        return new Response(
          JSON.stringify({ error: "Access denied. You are not permitted to use our services." }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 403 }
        );
      }
    }

    // Role helpers (security)
    const assertStaff = async (roles: string[] = ['super_admin', 'admin', 'manager']) => {
      const { data: rows } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id)
        .in('role', roles);
      if (!rows || rows.length === 0) {
        throw new Error("Unauthorized: Staff access required");
      }
    };
    const assertOwnerOrStaff = async (memberId: string | null | undefined, roles: string[] = ['super_admin', 'admin', 'manager', 'front_desk']) => {
      if (memberId) {
        const { data: m } = await supabase
          .from('members')
          .select('user_id')
          .eq('id', memberId)
          .maybeSingle();
        if (m?.user_id && m.user_id === user.id) return;
      }
      await assertStaff(roles);
    };



    // Get or create Stripe customer
    const getOrCreateCustomer = async (): Promise<string> => {
      const customers = await stripe.customers.list({ email: user.email!, limit: 1 });
      if (customers.data.length > 0) {
        logStep("Found existing Stripe customer", { customerId: customers.data[0].id });
        return customers.data[0].id;
      }
      const customer = await stripe.customers.create({
        email: user.email!,
        metadata: { user_id: user.id }
      });
      logStep("Created new Stripe customer", { customerId: customer.id });
      return customer.id;
    };

    switch (action) {
      case 'create_activation_checkout': {
        const { tier, gender, isFoundingMember, startDate, memberId, skipAnnualFee, successUrl, cancelUrl } = body;
        
        if (!tier || !gender || !startDate || !memberId || !successUrl || !cancelUrl) {
          throw new Error("Missing required fields for activation checkout");
        }

        const normalizedTier = tier.toLowerCase().replace(' membership', '') as keyof typeof STRIPE_PRODUCTS.memberships;
        const normalizedGender = (gender.toLowerCase() === 'male' || gender.toLowerCase() === 'men') ? 'men' : 'women';
        
        logStep("Normalized checkout params", { normalizedTier, normalizedGender, isFoundingMember, skipAnnualFee });

        // Get membership price based on founding member status
        const membershipPrices = STRIPE_PRODUCTS.memberships[normalizedTier];
        if (!membershipPrices) {
          throw new Error(`Invalid membership tier: ${tier}`);
        }

        const billingType = isFoundingMember ? 'annual' : 'monthly';
        const membershipPriceId = membershipPrices[billingType][normalizedGender];
        
        if (!membershipPriceId) {
          throw new Error(`Membership not available for ${gender} at ${tier} tier`);
        }

        // Get annual fee price (only if not skipping)
        const annualFeePriceId = skipAnnualFee ? null : STRIPE_PRODUCTS.annualFee[normalizedGender];

        const customerId = await getOrCreateCustomer();
        
        // Save stripe_customer_id to member record
        const { error: updateError } = await supabase
          .from('members')
          .update({ stripe_customer_id: customerId })
          .eq('id', memberId);
        
        if (updateError) {
          logStep("Warning: Failed to save stripe_customer_id", { error: updateError.message });
        } else {
          logStep("Saved stripe_customer_id to member", { memberId, customerId });
        }
        
        // Calculate billing anchor date from start date
        const startDateObj = new Date(startDate);
        const billingAnchor = Math.floor(startDateObj.getTime() / 1000);

        // Build line items - ONLY membership subscription (annual fee will be created separately as recurring subscription)
        const baseLineItems: { price: string; quantity: number }[] = [
          { price: membershipPriceId, quantity: 1 },
        ];
        
        // Add processing fee as recurring line item
        const lineItems = await addRecurringProcessingFeeItems(stripe, baseLineItems);
        
        // Note: Annual fee is NOT included in checkout line items
        // It will be created as a separate recurring subscription after checkout completes (in webhook)
        if (annualFeePriceId) {
          logStep("Annual fee will be created as separate subscription after checkout", { annualFeePriceId });
        } else {
          logStep("Skipping annual fee - already paid");
        }

        // Create checkout session with membership subscription only
        const session = await stripe.checkout.sessions.create({
          customer: customerId,
          line_items: lineItems,
          mode: 'subscription',
          payment_method_types: ['card', 'us_bank_account'],
          subscription_data: {
            billing_cycle_anchor: billingAnchor,
            proration_behavior: 'none',
            metadata: {
              member_id: memberId,
              user_id: user.id,
              tier: normalizedTier,
              gender: normalizedGender,
              is_founding_member: String(isFoundingMember),
              start_date: startDate,
              annual_fee_skipped: String(skipAnnualFee || false),
              annual_fee_price_id: annualFeePriceId || '', // Pass price ID for webhook
            },
          },
          success_url: `${successUrl}?session_id={CHECKOUT_SESSION_ID}`,
          cancel_url: cancelUrl,
          metadata: {
            type: 'membership_activation',
            member_id: memberId,
            user_id: user.id,
            tier: normalizedTier,
            gender: normalizedGender,
            is_founding_member: String(isFoundingMember),
            start_date: startDate,
            annual_fee_skipped: String(skipAnnualFee || false),
            annual_fee_price_id: annualFeePriceId || '', // Pass price ID for webhook
          },
        });

        logStep("Checkout session created", { sessionId: session.id, url: session.url, skipAnnualFee });

        return new Response(
          JSON.stringify({ sessionId: session.id, url: session.url }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
        );
      }

      case 'create_class_pass_checkout': {
        const { category, passType, successUrl, cancelUrl } = body;

        if (!category || !passType || !successUrl || !cancelUrl) {
          throw new Error("Missing required fields for class pass checkout");
        }

        // Server-side membership verification - DO NOT trust client-provided isMember
        const { data: memberData } = await supabase
          .from('members')
          .select('status')
          .eq('user_id', user.id)
          .eq('status', 'active')
          .maybeSingle();

        const isVerifiedMember = !!memberData;
        logStep("Membership verified server-side", { userId: user.id, isVerifiedMember });

        const memberStatus = isVerifiedMember ? 'member' : 'nonMember';
        const priceId = (STRIPE_PRODUCTS.classPasses as any)[category as string]?.[passType as string]?.[memberStatus];

        if (!priceId) {
          throw new Error(`Invalid class pass configuration: ${category}/${passType}/${memberStatus}`);
        }

        const customerId = await getOrCreateCustomer();

        // Save stripe_customer_id to member record if user is a member
        if (isVerifiedMember && memberData) {
          const { error: updateError } = await supabase
            .from('members')
            .update({ stripe_customer_id: customerId })
            .eq('user_id', user.id);
          
          if (updateError) {
            logStep("Warning: Failed to save stripe_customer_id", { error: updateError.message });
          } else {
            logStep("Saved stripe_customer_id to member", { userId: user.id, customerId });
          }
        }

        // Add processing fee line item
        const classPassPrice = await stripe.prices.retrieve(priceId);
        const classPassFeeItem = await createProcessingFeeLineItem(stripe, classPassPrice.unit_amount || 0);
        const classPassLineItems: { price: string; quantity: number }[] = [{ price: priceId, quantity: 1 }];
        if (classPassFeeItem) classPassLineItems.push(classPassFeeItem);

        const session = await stripe.checkout.sessions.create({
          customer: customerId,
          line_items: classPassLineItems,
          mode: 'payment',
          payment_intent_data: {
            setup_future_usage: 'off_session',
          },
          success_url: `${successUrl}?session_id={CHECKOUT_SESSION_ID}`,
          cancel_url: cancelUrl,
          metadata: {
            type: 'class_pass',
            user_id: user.id,
            category,
            pass_type: passType,
            is_member: String(isVerifiedMember),
          },
        });

        logStep("Class pass checkout created", { sessionId: session.id, url: session.url });

        // Track pending checkout for abandoned-cart recovery (best-effort, never blocks)
        try {
          await supabase.from('pending_class_pass_checkouts').insert({
            user_id: user.id,
            email: user.email,
            name: (user.user_metadata as any)?.first_name || (user.user_metadata as any)?.full_name || null,
            stripe_session_id: session.id,
            product_kind: 'class_pass',
            category,
            pass_type: passType,
            is_member: isVerifiedMember,
            amount_cents: classPassPrice.unit_amount || 0,
            status: 'pending',
          });
        } catch (e) {
          logStep("pending_class_pass_checkouts insert failed (non-fatal)", { error: (e as any)?.message });
        }

        return new Response(
          JSON.stringify({ sessionId: session.id, url: session.url }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
        );
      }

      case 'create_fundraiser_class_checkout': {
        const { sessionId, successUrl, cancelUrl } = body;
        if (!sessionId || !successUrl || !cancelUrl) {
          throw new Error("Missing required fields for fundraiser class checkout");
        }

        // Load session and validate it's a fundraiser, not cancelled, has capacity
        const { data: classSession, error: sessErr } = await supabase
          .from('class_sessions')
          .select(`
            id, is_fundraiser, is_cancelled, max_capacity, current_enrollment,
            override_price_cents, fundraiser_beneficiary, session_date, start_time,
            class_type:class_types(name)
          `)
          .eq('id', sessionId)
          .maybeSingle();

        if (sessErr || !classSession) throw new Error("Class session not found");
        if (!classSession.is_fundraiser) throw new Error("This class is not a fundraiser");
        if (classSession.is_cancelled) throw new Error("This class has been cancelled");
        if ((classSession.current_enrollment ?? 0) >= (classSession.max_capacity ?? 0)) {
          throw new Error("This class is full");
        }

        // Block double-booking
        const { data: existingBooking } = await supabase
          .from('class_bookings')
          .select('id')
          .eq('session_id', sessionId)
          .eq('user_id', user.id)
          .eq('status', 'confirmed')
          .maybeSingle();
        if (existingBooking) throw new Error("You already have a booking for this class");

        const amountCents = classSession.override_price_cents ?? 4000;
        const beneficiary = classSession.fundraiser_beneficiary || 'Charity';
        const className = (Array.isArray(classSession.class_type)
          ? (classSession.class_type[0] as any)?.name
          : (classSession.class_type as any)?.name) || 'Fundraiser Class';

        const customerId = await getOrCreateCustomer();

        // Inline price_data so we don't have to manage Stripe products for every fundraiser
        const fundraiserLineItems: any[] = [{
          price_data: {
            currency: 'usd',
            unit_amount: amountCents,
            product_data: {
              name: `${beneficiary} Fundraiser — ${className}`,
              description: `100% of proceeds donated to ${beneficiary}.`,
            },
          },
          quantity: 1,
        }];
        const fundraiserFeeItem = await createProcessingFeeLineItem(stripe, amountCents);
        if (fundraiserFeeItem) fundraiserLineItems.push(fundraiserFeeItem);

        const fundraiserMetadata = {
          type: 'fundraiser_class_booking',
          user_id: user.id,
          class_session_id: sessionId,
          amount_cents: String(amountCents),
          beneficiary,
        };

        const session = await stripe.checkout.sessions.create({
          customer: customerId,
          line_items: fundraiserLineItems,
          mode: 'payment',
          payment_intent_data: {
            metadata: fundraiserMetadata,
          },
          success_url: `${successUrl}?session_id={CHECKOUT_SESSION_ID}`,
          cancel_url: cancelUrl,
          metadata: fundraiserMetadata,
        });

        logStep("Fundraiser checkout created", { sessionId: session.id, classSessionId: sessionId, amountCents });

        return new Response(
          JSON.stringify({ sessionId: session.id, url: session.url }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
        );
      }

      case 'create_kids_care_checkout': {
        const { successUrl, cancelUrl, embedded } = body;

        if (!embedded && (!successUrl || !cancelUrl)) {
          throw new Error("Missing required fields for kids care checkout");
        }

        // Server-side membership verification
        const { data: memberData } = await supabase
          .from('members')
          .select('id, status')
          .eq('user_id', user.id)
          .eq('status', 'active')
          .maybeSingle();

        if (!memberData) {
          throw new Error("Active membership required to purchase Kids Care Pass");
        }

        logStep("Membership verified for Kids Care", { userId: user.id, memberId: memberData.id });

        const kidsCarePrice = STRIPE_PRODUCTS.kidsCare.member;
        const customerId = await getOrCreateCustomer();

        // Save stripe_customer_id to member record
        await supabase
          .from('members')
          .update({ stripe_customer_id: customerId })
          .eq('user_id', user.id);

        // Add recurring processing fee
        const subscriptionItems = await addRecurringProcessingFeeItems(stripe, [{ price: kidsCarePrice, quantity: 1 }]);

        const kidsCareMetadata = {
          type: 'kids_care_pass',
          user_id: user.id,
          member_id: memberData.id,
        };

        if (embedded) {
          // Embedded checkout mode — stays in-portal
          const embeddedSession = await stripe.checkout.sessions.create({
            customer: customerId,
            line_items: subscriptionItems,
            mode: 'subscription',
            ui_mode: 'embedded',
            subscription_data: { metadata: kidsCareMetadata },
            return_url: `${req.headers.get('origin') || ''}/member/kids-care?session_id={CHECKOUT_SESSION_ID}`,
            metadata: kidsCareMetadata,
          });

          logStep("Embedded Kids Care checkout created", { sessionId: embeddedSession.id });

          return new Response(
            JSON.stringify({ clientSecret: embeddedSession.client_secret }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
          );
        }

        const session = await stripe.checkout.sessions.create({
          customer: customerId,
          line_items: subscriptionItems,
          mode: 'subscription',
          subscription_data: { metadata: kidsCareMetadata },
          success_url: `${successUrl}?session_id={CHECKOUT_SESSION_ID}`,
          cancel_url: cancelUrl,
          metadata: kidsCareMetadata,
        });

        logStep("Kids Care checkout created", { sessionId: session.id, url: session.url });

        return new Response(
          JSON.stringify({ sessionId: session.id, url: session.url }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
        );
      }

      case 'create_guest_pass_checkout': {
        const { guestName, guestEmail, successUrl, cancelUrl } = body;
        const passQuantity = Math.max(1, Math.min(10, parseInt(body.quantity) || 1));
        const customPriceValue = body.customPrice != null ? parseFloat(body.customPrice) : null;

        if (!guestName || !successUrl || !cancelUrl) {
          throw new Error("Missing required fields for guest pass checkout");
        }

        // Get price ID for guest pass
        const priceId = STRIPE_PRODUCTS.guestPass;
        
        if (!priceId || priceId.startsWith('TODO_')) {
          throw new Error("Guest pass price ID not configured. Please add Stripe price ID in stripeProducts.ts");
        }

        const customerId = await getOrCreateCustomer();

        let lineItemPriceId = priceId;

        // If custom price provided, create an ad-hoc price
        if (customPriceValue != null && customPriceValue >= 0) {
          const originalPrice = await stripe.prices.retrieve(priceId);
          const adHocPrice = await stripe.prices.create({
            unit_amount: Math.round(customPriceValue * 100),
            currency: 'usd',
            product: originalPrice.product as string,
          });
          lineItemPriceId = adHocPrice.id;
        }

        // Add processing fee for guest pass
        const effectivePrice = customPriceValue != null ? Math.round(customPriceValue * 100) : (await stripe.prices.retrieve(priceId)).unit_amount || 0;
        const totalAmount = effectivePrice * passQuantity;
        const guestPassFeeItem = await createProcessingFeeLineItem(stripe, totalAmount);
        const guestPassLineItems: { price: string; quantity: number }[] = [{ price: lineItemPriceId, quantity: passQuantity }];
        if (guestPassFeeItem) guestPassLineItems.push(guestPassFeeItem);

        // Create checkout session for guest pass
        const session = await stripe.checkout.sessions.create({
          customer: customerId,
          line_items: guestPassLineItems,
          mode: 'payment',
          payment_intent_data: {
            setup_future_usage: 'off_session',
          },
          success_url: `${successUrl}?session_id={CHECKOUT_SESSION_ID}`,
          cancel_url: cancelUrl,
          metadata: {
            type: 'guest_pass',
            user_id: user.id,
            guest_name: guestName,
            guest_email: guestEmail || '',
            guest_gender: body.guestGender || '',
            phone_number: body.phoneNumber || '',
            valid_date: body.validDate || '',
            member_referral: body.memberReferral || '',
            quantity: String(passQuantity),
            custom_price: customPriceValue != null ? String(customPriceValue) : '',
            expires_at: body.expiresAt || '',
          },
        });

        logStep("Guest pass checkout created", { sessionId: session.id, url: session.url, guestName, quantity: passQuantity });

        return new Response(
          JSON.stringify({ sessionId: session.id, url: session.url }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
        );
      }

      case 'create_guest_pass_experience_checkout': {
        const { 
          guestName, 
          guestEmail,
          guestGender,
          phoneNumber, 
          validDate, 
          memberReferral, 
          visitInterests, 
          visitNotes, 
          addons,
          successUrl, 
          cancelUrl 
        } = body;

        if (!guestName || !guestEmail || !guestGender || !phoneNumber || !validDate || !successUrl || !cancelUrl) {
          throw new Error("Missing required fields for guest pass experience checkout");
        }

        if (!visitInterests || visitInterests.length === 0) {
          throw new Error("Please select at least one visit interest");
        }

        // Server-side capacity check (blocks males silently)
        if (guestGender === 'male') {
          logStep("Guest pass capacity check failed", { guestGender, guestName });
          throw new Error("We're sorry, guest passes are currently at capacity. Please email us at info@stormwellnessclub.com for more information.");
        }

        // Build line items starting with base guest pass
        const lineItems: { price: string; quantity: number }[] = [
          { price: STRIPE_PRODUCTS.guestPass, quantity: 1 },
        ];

        // Add selected add-ons
        if (addons && addons.length > 0) {
          for (const addon of addons) {
            let priceId: string | null = null;
            
            // Map addon IDs to Stripe price IDs
            switch (addon.id) {
              case 'rlt_10':
                priceId = STRIPE_PRODUCTS.guestAddons.rlt10;
                break;
              case 'rlt_20':
                priceId = STRIPE_PRODUCTS.guestAddons.rlt20;
                break;
              case 'cryo':
                priceId = STRIPE_PRODUCTS.guestAddons.cryo;
                break;
              case 'class_pilates_cycling':
                priceId = STRIPE_PRODUCTS.guestAddons.classPilatesCycling;
                break;
              case 'class_other':
                priceId = STRIPE_PRODUCTS.guestAddons.classOther;
                break;
            }

            if (priceId) {
              lineItems.push({ price: priceId, quantity: 1 });
            }
          }
        }

        const customerId = await getOrCreateCustomer();

        // Calculate total and add processing fee
        let experienceTotalCents = 0;
        for (const li of lineItems) {
          const p = await stripe.prices.retrieve(li.price);
          experienceTotalCents += (p.unit_amount || 0) * li.quantity;
        }
        const experienceFeeItem = await createProcessingFeeLineItem(stripe, experienceTotalCents);
        if (experienceFeeItem) lineItems.push(experienceFeeItem);

        // Create checkout session with all line items
        const session = await stripe.checkout.sessions.create({
          customer: customerId,
          line_items: lineItems,
          mode: 'payment',
          payment_intent_data: {
            setup_future_usage: 'off_session',
          },
          success_url: `${successUrl}?session_id={CHECKOUT_SESSION_ID}`,
          cancel_url: cancelUrl,
          metadata: {
            type: 'guest_pass_experience',
            user_id: user.id,
            guest_name: guestName,
            guest_email: guestEmail,
            guest_gender: guestGender || '',
            phone_number: phoneNumber,
            valid_date: validDate,
            member_referral: memberReferral || '',
            visit_interests: JSON.stringify(visitInterests),
            visit_notes: visitNotes || '',
            add_ons: JSON.stringify(addons || []),
          },
        });

        logStep("Guest pass experience checkout created", { 
          sessionId: session.id, 
          url: session.url, 
          guestName,
          validDate,
          addonsCount: addons?.length || 0,
          lineItemsCount: lineItems.length,
        });

        return new Response(
          JSON.stringify({ sessionId: session.id, url: session.url }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
        );
      }

      case 'create_freeze_fee_checkout': {
        const { freezeId, successUrl, cancelUrl } = body;

        if (!freezeId || !successUrl || !cancelUrl) {
          return new Response(
            JSON.stringify({ error: "Missing required fields for freeze fee checkout" }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
          );
        }

        // Validate the freeze belongs to the caller and is in the right state.
        const { data: freezeRow, error: freezeErr } = await supabase
          .from('member_freezes')
          .select('id, user_id, status, fee_paid, freeze_fee_total')
          .eq('id', freezeId)
          .maybeSingle();

        if (freezeErr || !freezeRow) {
          logStep("Freeze not found", { freezeId, error: freezeErr?.message });
          return new Response(
            JSON.stringify({ error: "Freeze request not found." }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 404 }
          );
        }
        if (freezeRow.user_id !== user.id) {
          return new Response(
            JSON.stringify({ error: "You are not authorized to pay for this freeze." }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 403 }
          );
        }
        if (freezeRow.status !== 'approved') {
          return new Response(
            JSON.stringify({ error: `This freeze request is not ready for payment (status: ${freezeRow.status}).` }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
          );
        }
        if (freezeRow.fee_paid) {
          return new Response(
            JSON.stringify({ error: "This freeze fee has already been paid." }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
          );
        }

        const customerId = await getOrCreateCustomer();

        // Trust DB amount, never the client-provided value.
        const freezeAmountCents = Math.round(Number(freezeRow.freeze_fee_total) * 100);
        if (!Number.isFinite(freezeAmountCents) || freezeAmountCents <= 0) {
          return new Response(
            JSON.stringify({ error: "Invalid freeze fee amount on record." }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
          );
        }
        const freezeFeeCents = calculateProcessingFee(freezeAmountCents);

        const freezeLineItems: any[] = [
          {
            price_data: {
              currency: 'usd',
              product_data: {
                name: 'Membership Freeze Fee',
                description: `Freeze fee for membership hold`,
              },
              unit_amount: freezeAmountCents,
            },
            quantity: 1,
          },
        ];

        if (freezeFeeCents > 0) {
          const freezeFeeProductId = await getOrCreateProcessingFeeProduct(stripe);
          freezeLineItems.push({
            price_data: {
              currency: 'usd',
              product: freezeFeeProductId,
              unit_amount: freezeFeeCents,
            },
            quantity: 1,
          });
        }

        const safeSuccess = successUrl || 'https://stormwellnessclub.com/member/freeze?payment=success';
        const safeCancel = cancelUrl || 'https://stormwellnessclub.com/member/freeze?payment=cancelled';

        // Create one-time payment for freeze fee
        const session = await stripe.checkout.sessions.create({
          customer: customerId,
          line_items: freezeLineItems,
          mode: 'payment',
          payment_intent_data: {
            setup_future_usage: 'off_session',
          },
          success_url: `${safeSuccess}${safeSuccess.includes('?') ? '&' : '?'}session_id={CHECKOUT_SESSION_ID}`,
          cancel_url: safeCancel,
          metadata: {
            type: 'freeze_fee',
            user_id: user.id,
            freeze_id: freezeId,
          },
        });

        logStep("Freeze fee checkout created", { sessionId: session.id, url: session.url, freezeId });

        return new Response(
          JSON.stringify({ sessionId: session.id, url: session.url }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
        );
      }


      case 'pay_annual_fee': {
        const { memberId, successUrl, cancelUrl } = body;

        if (!memberId || !successUrl || !cancelUrl) {
          throw new Error("Missing required fields for annual fee payment");
        }

        // Get member record to determine gender for pricing
        const { data: member, error: memberError } = await supabase
          .from('members')
          .select('id, gender, stripe_customer_id, first_name, last_name, email, annual_fee_paid_at, annual_fee_subscription_id')
          .eq('id', memberId)
          .eq('user_id', user.id)
          .single();

        if (memberError || !member) {
          throw new Error("Member record not found or unauthorized");
        }

        logStep("Found member for annual fee payment", { memberId: member.id, gender: member.gender });

        // WARNING: Check if member already has an active annual fee subscription
        if (member.annual_fee_subscription_id) {
          logStep("WARNING: Member already has annual fee subscription - proceeding with warning", { 
            memberId: member.id, 
            existingSubscriptionId: member.annual_fee_subscription_id 
          });
        }

        // WARNING: Check if annual_fee_paid_at is within the last year
        if (member.annual_fee_paid_at) {
          const paidDate = new Date(member.annual_fee_paid_at);
          const oneYearAgo = new Date();
          oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
          
          if (paidDate > oneYearAgo) {
            logStep("WARNING: Annual fee was paid within the last year - proceeding with warning", { 
              memberId: member.id, 
              paidAt: member.annual_fee_paid_at 
            });
          }
        }

        // Determine gender for pricing
        const normalizedGender = (member.gender?.toLowerCase() === 'male' || member.gender?.toLowerCase() === 'men') ? 'men' : 'women';
        const annualFeePriceId = STRIPE_PRODUCTS.annualFee[normalizedGender];

        if (!annualFeePriceId) {
          throw new Error(`Annual fee price not found for gender: ${member.gender}`);
        }

        // Get or create customer
        let customerId = member.stripe_customer_id;
        if (!customerId) {
          customerId = await getOrCreateCustomer();
          // Save to member record
          await supabase
            .from('members')
            .update({ stripe_customer_id: customerId })
            .eq('id', memberId);
          logStep("Created and saved Stripe customer", { customerId });
        }

        // Create annual fee subscription (yearly recurring)
        // Add processing fee to annual fee checkout
        const annualFeeLineItems = await addRecurringProcessingFeeItems(stripe, [{ price: annualFeePriceId, quantity: 1 }]);
        
        const session = await stripe.checkout.sessions.create({
          customer: customerId,
          line_items: annualFeeLineItems,
          mode: 'subscription',
          payment_method_types: ['card', 'us_bank_account'],
          subscription_data: {
            metadata: {
              type: 'annual_fee_subscription',
              member_id: memberId,
              user_id: user.id,
              gender: normalizedGender,
            },
          },
          success_url: `${successUrl}?session_id={CHECKOUT_SESSION_ID}&annual_fee_paid=true`,
          cancel_url: cancelUrl,
          metadata: {
            type: 'annual_fee_subscription',
            member_id: memberId,
            user_id: user.id,
            gender: normalizedGender,
          },
        });

        logStep("Annual fee checkout session created", { sessionId: session.id, url: session.url, memberId, gender: normalizedGender });

        return new Response(
          JSON.stringify({ sessionId: session.id, url: session.url }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
        );
      }

      case 'customer_portal': {
        const customerId = await getOrCreateCustomer();
        
        // Save stripe_customer_id to member record
        const { error: updateError } = await supabase
          .from('members')
          .update({ stripe_customer_id: customerId })
          .eq('user_id', user.id);
        
        if (updateError) {
          logStep("Warning: Failed to save stripe_customer_id", { error: updateError.message });
        } else {
          logStep("Saved stripe_customer_id to member", { userId: user.id, customerId });
        }
        
        const origin = req.headers.get('origin') || 'https://stormwellnessclub.com';

        const portalSession = await stripe.billingPortal.sessions.create({
          customer: customerId,
          return_url: `${origin}/member/membership`,
        });

        logStep("Customer portal session created", { url: portalSession.url });

        return new Response(
          JSON.stringify({ url: portalSession.url }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
        );
      }

      case 'get_subscription': {
        const { subscriptionId } = body;
        if (!subscriptionId) {
          throw new Error("Subscription ID required");
        }

        const subscription = await stripe.subscriptions.retrieve(subscriptionId);
        logStep("Subscription retrieved", { subscriptionId, status: subscription.status });
        
        return new Response(
          JSON.stringify({ subscription }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
        );
      }

      case 'cancel_subscription': {
        const { subscriptionId } = body;
        if (!subscriptionId) {
          throw new Error("Subscription ID required");
        }

        const subscription = await stripe.subscriptions.cancel(subscriptionId);
        logStep("Subscription cancelled", { subscriptionId });
        
        return new Response(
          JSON.stringify({ success: true, subscription }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
        );
      }

      case 'list_payment_methods': {
        const { memberId } = body;
        
        if (!memberId) {
          throw new Error("Member ID required");
        }
        await assertOwnerOrStaff(memberId);


        // Get member's stripe_customer_id
        const { data: memberData, error: memberError } = await supabase
          .from('members')
          .select('stripe_customer_id, first_name, last_name')
          .eq('id', memberId)
          .single();

        if (memberError || !memberData?.stripe_customer_id) {
          return new Response(
            JSON.stringify({ paymentMethods: [], hasPaymentMethod: false, defaultPaymentMethodId: null }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
          );
        }

        // Get customer to find default payment method
        const customer = await stripe.customers.retrieve(memberData.stripe_customer_id);
        const defaultPaymentMethodId = !customer.deleted 
          ? customer.invoice_settings?.default_payment_method as string | null
          : null;

        // List payment methods for the customer
        const paymentMethods = await stripe.paymentMethods.list({
          customer: memberData.stripe_customer_id,
          type: 'card',
        });

        const formattedMethods = paymentMethods.data.map((pm: { 
          id: string; 
          card?: { brand?: string; last4?: string; exp_month?: number; exp_year?: number };
          metadata?: Record<string, string>;
        }) => ({
          id: pm.id,
          brand: pm.card?.brand,
          last4: pm.card?.last4,
          expMonth: pm.card?.exp_month,
          expYear: pm.card?.exp_year,
          nickname: pm.metadata?.nickname || null,
          isDefault: pm.id === defaultPaymentMethodId,
        }));

        logStep("Payment methods listed", { memberId, count: formattedMethods.length, defaultPaymentMethodId });

        return new Response(
          JSON.stringify({ 
            paymentMethods: formattedMethods, 
            hasPaymentMethod: formattedMethods.length > 0,
            defaultPaymentMethodId,
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
        );
      }

      case 'create_admin_setup_intent': {
        // Create a SetupIntent for admin to add card on behalf of applicant/member
        const { 
          stripeCustomerId: adminSetupCustomerId, 
          applicantEmail: adminApplicantEmail, 
          applicantName: adminApplicantName,
          memberId: adminSetupMemberId  // NEW: Allow persisting customer ID to member record
        } = body;

        // Verify admin role
        const { data: adminRoleData } = await supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', user.id)
          .in('role', ['super_admin', 'admin', 'manager']);

        if (!adminRoleData || adminRoleData.length === 0) {
          throw new Error("Unauthorized: Admin access required");
        }

        logStep("Creating admin setup intent", { 
          customerId: adminSetupCustomerId, 
          email: adminApplicantEmail, 
          adminUserId: user.id,
          memberId: adminSetupMemberId 
        });

        let finalCustomerId = adminSetupCustomerId;

        // Create customer if needed
        if (!finalCustomerId && adminApplicantEmail) {
          const existingCustomers = await stripe.customers.list({ 
            email: adminApplicantEmail, 
            limit: 1 
          });
          
          if (existingCustomers.data.length > 0) {
            finalCustomerId = existingCustomers.data[0].id;
            logStep("Found existing customer for admin setup", { customerId: finalCustomerId });
          } else {
            const newCustomer = await stripe.customers.create({
              email: adminApplicantEmail,
              name: adminApplicantName || undefined,
              metadata: { 
                source: 'admin_card_addition',
                added_by: user.id,
              }
            });
            finalCustomerId = newCustomer.id;
            logStep("Created new customer for admin setup", { customerId: finalCustomerId });
          }
        }

        if (!finalCustomerId) {
          throw new Error("stripeCustomerId or applicantEmail required");
        }

        // NEW: Save customer ID to member record if memberId provided
        if (adminSetupMemberId && finalCustomerId) {
          const { error: memberUpdateError } = await supabase
            .from('members')
            .update({ stripe_customer_id: finalCustomerId })
            .eq('id', adminSetupMemberId);
          
          if (memberUpdateError) {
            logStep("Warning: Failed to save stripe_customer_id to member", { 
              error: memberUpdateError.message,
              memberId: adminSetupMemberId 
            });
          } else {
            logStep("Saved stripe_customer_id to member", { 
              memberId: adminSetupMemberId, 
              customerId: finalCustomerId 
            });
          }
        }

        const adminSetupIntent = await stripe.setupIntents.create({
          customer: finalCustomerId,
          payment_method_types: ['card'],
          metadata: {
            type: 'admin_card_setup',
            added_by: user.id,
            member_id: adminSetupMemberId || '',
          },
        });

        logStep("Admin setup intent created", { 
          setupIntentId: adminSetupIntent.id, 
          customerId: finalCustomerId 
        });

        // Log card setup attempt for audit trail (admin portal)
        try {
          // Try to find application ID if we have the email
          let applicationId: string | null = null;
          if (adminApplicantEmail) {
            const { data: appData } = await supabase
              .from('membership_applications')
              .select('id')
              .ilike('email', adminApplicantEmail)
              .order('created_at', { ascending: false })
              .limit(1)
              .maybeSingle();
            applicationId = appData?.id || null;
          }

          await supabase.from('card_setup_attempts').insert({
            member_id: adminSetupMemberId || null,
            application_id: applicationId,
            stripe_customer_id: finalCustomerId,
            stripe_setup_intent: adminSetupIntent.id,
            source: 'admin_portal',
            initiated_by: user.id,
            status: 'initiated',
            metadata: { 
              applicant_email: adminApplicantEmail || null, 
              applicant_name: adminApplicantName || null,
              admin_user_id: user.id,
            },
          });
          logStep("Card setup attempt logged (admin_portal)", { setupIntentId: adminSetupIntent.id });
        } catch (auditErr) {
          logStep("Warning: Failed to log admin card setup attempt", { error: String(auditErr) });
        }

        return new Response(
          JSON.stringify({ 
            clientSecret: adminSetupIntent.client_secret,
            customerId: finalCustomerId,
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
        );
      }

      case 'charge_saved_card': {
        const { memberId, stripeCustomerId: directCustomerId, applicantName, applicationId, amount, description, taxAmount, subtotal: bodySubtotal, payment_type } = body;
        await assertStaff();

        if (!amount || !description) {
          throw new Error("Amount and description are required");
        }

        if (!memberId && !directCustomerId) {
          throw new Error("Either memberId or stripeCustomerId is required");
        }


        if (amount < 50) {
          throw new Error("Minimum charge amount is $0.50");
        }

        let customerId: string;
        let customerName: string;
        let memberIdForLog: string | null = null;
        let userIdForLog: string | null = null;
        let applicationIdForLog: string | null = applicationId || null;

        if (directCustomerId) {
          // Direct customer ID provided (for applications without member record yet)
          customerId = directCustomerId;
          customerName = applicantName || 'Applicant';
          logStep("Using direct stripeCustomerId for charge", { customerId, customerName });
        } else if (memberId) {
          // Look up from members table
          const { data: memberData, error: memberError } = await supabase
            .from('members')
            .select('stripe_customer_id, first_name, last_name, user_id, email')
            .eq('id', memberId)
            .single();

          if (memberError || !memberData) {
            throw new Error("Member not found");
          }

          customerId = memberData.stripe_customer_id;
          customerName = `${memberData.first_name} ${memberData.last_name}`;
          memberIdForLog = memberId;
          userIdForLog = memberData.user_id;

          // If no stripe_customer_id in database, try to find by email in Stripe
          if (!customerId && memberData.email) {
            logStep("No stripe_customer_id in database, searching Stripe by email", { 
              email: memberData.email 
            });
            
            const customers = await stripe.customers.list({ 
              email: memberData.email, 
              limit: 1 
            });
            
            if (customers.data.length > 0) {
              customerId = customers.data[0].id;
              logStep("Found customer in Stripe by email", { customerId });
              
              // Update the member record with the discovered customer ID
              await supabase
                .from('members')
                .update({ stripe_customer_id: customerId })
                .eq('id', memberId);
            }
          }

          if (!customerId) {
            throw new Error("Member has no payment method on file. Card may have been added under a different email.");
          }

          logStep("Found member stripe customer", { customerId, customerName, memberId });
        } else {
          throw new Error("Either memberId or stripeCustomerId is required");
        }

        // Get the customer's default payment method
        const customer = await stripe.customers.retrieve(customerId);
        
        if (customer.deleted) {
          throw new Error("Stripe customer has been deleted");
        }

        // List payment methods and use the first one
        const paymentMethods = await stripe.paymentMethods.list({
          customer: customerId,
          type: 'card',
          limit: 1,
        });

        if (paymentMethods.data.length === 0) {
          throw new Error("No payment method on file");
        }

        const paymentMethod = paymentMethods.data[0];
        const paymentMethodId = paymentMethod.id;
        const cardBrand = paymentMethod.card?.brand ? paymentMethod.card.brand.charAt(0).toUpperCase() + paymentMethod.card.brand.slice(1) : 'Card';
        const cardLast4 = paymentMethod.card?.last4 || '****';

        // Calculate processing fee — for POS charges, the frontend already included the fee
        // in the amount, so we use it as-is. For non-POS charges, we add the fee on top.
        const isPosCharge = body.chargeType === 'pos';
        const processingFeeCents = isPosCharge
          ? (body.processingFee || 0)  // Use the fee the POS frontend already calculated
          : calculateProcessingFee(amount);
        const totalAmountWithFee = isPosCharge
          ? amount  // POS amount already includes the fee
          : amount + processingFeeCents;
        const feeDescription = processingFeeCents > 0 
          ? `${description} (includes $${(processingFeeCents / 100).toFixed(2)} processing fee)` 
          : description;

        // Create and confirm a payment intent
        const paymentIntent = await stripe.paymentIntents.create({
          amount: totalAmountWithFee,
          currency: 'usd',
          customer: customerId,
          payment_method: paymentMethodId,
          off_session: true,
          confirm: true,
          description: feeDescription,
          metadata: {
            type: isPosCharge ? 'pos' : (payment_type || 'manual_charge'),
            member_id: memberIdForLog || 'application',
            charged_by: user.id,
            customer_name: customerName,
            base_amount: isPosCharge ? String(amount - processingFeeCents) : String(amount),
            processing_fee: String(processingFeeCents),
            ...(taxAmount ? { tax_amount: String(taxAmount) } : {}),
            ...(bodySubtotal ? { subtotal: String(bodySubtotal) } : {}),
          },
        });

        logStep("Payment intent created", { 
          paymentIntentId: paymentIntent.id, 
          status: paymentIntent.status,
          amount,
          customerName,
        });

        // Record the charge in manual_charges table
        if (memberIdForLog && userIdForLog) {
          // Member charge
          const { error: insertError } = await supabase
            .from('manual_charges')
            .insert({
              member_id: memberIdForLog,
              user_id: userIdForLog,
              amount: totalAmountWithFee,
              description: feeDescription,
              stripe_payment_intent_id: paymentIntent.id,
              status: paymentIntent.status === 'succeeded' ? 'succeeded' : 'pending',
              charged_by: user.id,
            });

          if (insertError) {
            logStep("Warning: Failed to record manual charge", { error: insertError.message });
          }
        } else if (applicationIdForLog) {
          // Application charge (before member record exists)
          const { error: insertError } = await supabase
            .from('manual_charges')
            .insert({
              application_id: applicationIdForLog,
              user_id: user.id, // Use the admin's user_id since applicant doesn't have one yet
              amount: totalAmountWithFee,
              description: feeDescription,
              stripe_payment_intent_id: paymentIntent.id,
              status: paymentIntent.status === 'succeeded' ? 'succeeded' : 'pending',
              charged_by: user.id,
            });

          if (insertError) {
            logStep("Warning: Failed to record application charge", { error: insertError.message });
          } else {
            logStep("Recorded application charge", { applicationId: applicationIdForLog });
          }
        } else {
          logStep("Skipping manual_charges insert - no member or application ID");
        }

        // SYNC TO MEMBER PROFILE: If this is an initiation/annual fee charge, sync to member profile
        if (paymentIntent.status === 'succeeded') {
          const isInitiationFee = description.toLowerCase().includes('initiation') || 
                                  description.toLowerCase().includes('annual fee');
          
          if (isInitiationFee && applicationIdForLog) {
            logStep("Syncing initiation fee to member profile", { applicationId: applicationIdForLog });
            
            // Get application email to find member record
            const { data: appData } = await supabase
              .from('membership_applications')
              .select('email')
              .eq('id', applicationIdForLog)
              .single();
            
            if (appData?.email) {
              // Check if member record exists for this application's email
              const { data: memberDataForSync } = await supabase
                .from('members')
                .select('id')
                .ilike('email', appData.email)
                .maybeSingle();
              
              if (memberDataForSync) {
                // Sync annual_fee_paid_at to member profile (prevents double-billing during activation)
                const { error: syncError } = await supabase
                  .from('members')
                  .update({ 
                    annual_fee_paid_at: new Date().toISOString(),
                    stripe_customer_id: customerId 
                  })
                  .eq('id', memberDataForSync.id);
                
                if (syncError) {
                  logStep("Warning: Failed to sync annual_fee_paid_at to member", { error: syncError.message });
                } else {
                  logStep("Successfully synced annual_fee_paid_at to member profile", { 
                    memberId: memberDataForSync.id,
                    customerId,
                  });
                }
              } else {
                logStep("No member record found for application email - will sync on member creation", { 
                  email: appData.email 
                });
              }
            }
          }
        }

        return new Response(
          JSON.stringify({ 
            success: paymentIntent.status === 'succeeded',
            paymentIntentId: paymentIntent.id,
            status: paymentIntent.status,
            cardBrand,
            cardLast4,
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
        );
      }

      // NEW: 3DS-aware charging for admin card charges
      case 'charge_saved_card_with_3ds': {
        const { memberId, stripeCustomerId: directCustomerId, applicantName, applicationId, amount, description, taxAmount: taxAmount3ds, subtotal: bodySubtotal3ds, payment_type: paymentType3ds } = body;
        await assertStaff();

        if (!amount || !description) {
          throw new Error("Amount and description are required");
        }

        if (!memberId && !directCustomerId) {
          throw new Error("Either memberId or stripeCustomerId is required");
        }


        if (amount < 50) {
          throw new Error("Minimum charge amount is $0.50");
        }

        let customerId: string;
        let customerName: string;
        let memberIdForLog: string | null = null;
        let userIdForLog: string | null = null;
        let applicationIdForLog: string | null = applicationId || null;

        if (directCustomerId) {
          customerId = directCustomerId;
          customerName = applicantName || 'Applicant';
          logStep("Using direct stripeCustomerId for 3DS charge", { customerId, customerName });
        } else if (memberId) {
          const { data: memberData3ds, error: memberError3ds } = await supabase
            .from('members')
            .select('stripe_customer_id, first_name, last_name, user_id, email')
            .eq('id', memberId)
            .single();

          if (memberError3ds || !memberData3ds) {
            throw new Error("Member not found");
          }

          customerId = memberData3ds.stripe_customer_id;
          customerName = `${memberData3ds.first_name} ${memberData3ds.last_name}`;
          memberIdForLog = memberId;
          userIdForLog = memberData3ds.user_id;

          // If no stripe_customer_id in database, try to find by email in Stripe
          if (!customerId && memberData3ds.email) {
            logStep("No stripe_customer_id in database for 3DS, searching Stripe by email", { 
              email: memberData3ds.email 
            });
            
            const customers = await stripe.customers.list({ 
              email: memberData3ds.email, 
              limit: 1 
            });
            
            if (customers.data.length > 0) {
              customerId = customers.data[0].id;
              logStep("Found customer in Stripe by email for 3DS", { customerId });
              
              // Update the member record with the discovered customer ID
              await supabase
                .from('members')
                .update({ stripe_customer_id: customerId })
                .eq('id', memberId);
            }
          }

          if (!customerId) {
            throw new Error("Member has no payment method on file. Card may have been added under a different email.");
          }

          logStep("Found member stripe customer for 3DS charge", { customerId, customerName, memberId });
        } else {
          throw new Error("Either memberId or stripeCustomerId is required");
        }

        // Get the customer's payment method - try card first, then ACH, then link
        let paymentMethod3ds: Stripe.PaymentMethod | null = null;
        let paymentMethodType = 'card';

        // Try card first
        const cardMethods = await stripe.paymentMethods.list({
          customer: customerId,
          type: 'card',
          limit: 1,
        });
        if (cardMethods.data.length > 0) {
          paymentMethod3ds = cardMethods.data[0];
          paymentMethodType = 'card';
          logStep("Found card payment method", { id: paymentMethod3ds.id });
        }

        // If no card, try us_bank_account (ACH)
        if (!paymentMethod3ds) {
          const achMethods = await stripe.paymentMethods.list({
            customer: customerId,
            type: 'us_bank_account',
            limit: 1,
          });
          if (achMethods.data.length > 0) {
            paymentMethod3ds = achMethods.data[0];
            paymentMethodType = 'us_bank_account';
            logStep("Found ACH payment method", { id: paymentMethod3ds.id });
          }
        }

        // If no ACH, try link
        if (!paymentMethod3ds) {
          const linkMethods = await stripe.paymentMethods.list({
            customer: customerId,
            type: 'link',
            limit: 1,
          });
          if (linkMethods.data.length > 0) {
            paymentMethod3ds = linkMethods.data[0];
            paymentMethodType = 'link';
            logStep("Found Link payment method", { id: paymentMethod3ds.id });
          }
        }

        if (!paymentMethod3ds) {
          throw new Error("No payment method on file");
        }

        // Determine display info based on payment method type
        let cardBrand3ds = 'Card';
        let cardLast43ds = '****';
        if (paymentMethodType === 'card' && paymentMethod3ds.card) {
          cardBrand3ds = paymentMethod3ds.card.brand ? 
            paymentMethod3ds.card.brand.charAt(0).toUpperCase() + paymentMethod3ds.card.brand.slice(1) : 'Card';
          cardLast43ds = paymentMethod3ds.card.last4 || '****';
        } else if (paymentMethodType === 'us_bank_account' && paymentMethod3ds.us_bank_account) {
          cardBrand3ds = `ACH (${paymentMethod3ds.us_bank_account.bank_name || 'Bank'})`;
          cardLast43ds = paymentMethod3ds.us_bank_account.last4 || '****';
        } else if (paymentMethodType === 'link') {
          cardBrand3ds = 'Link';
          cardLast43ds = '****';
        }

        // Build payment_method_types based on what we found
        const pmTypes: string[] = [paymentMethodType];
        if (paymentMethodType === 'us_bank_account') {
          // ACH doesn't support 3DS/manual confirmation the same way
          // Use automatic confirmation for ACH
        }

        // Calculate processing fee — for POS charges, the frontend already included the fee
        const isPosCharge3ds = body.chargeType === 'pos';
        const processingFee3ds = isPosCharge3ds
          ? (body.processingFee || 0)
          : calculateProcessingFee(amount);
        const totalAmount3ds = isPosCharge3ds
          ? amount
          : amount + processingFee3ds;
        const feeDescription3ds = processingFee3ds > 0
          ? `${description} (includes $${(processingFee3ds / 100).toFixed(2)} processing fee)`
          : description;

        // Create payment intent
        const paymentIntent3ds = await stripe.paymentIntents.create({
          amount: totalAmount3ds,
          currency: 'usd',
          customer: customerId,
          payment_method: paymentMethod3ds.id,
          payment_method_types: pmTypes,
          description: feeDescription3ds,
          confirmation_method: paymentMethodType === 'card' ? 'manual' : 'automatic',
          confirm: true,
          return_url: `${Deno.env.get('SUPABASE_URL') || 'https://localhost'}/`,
          metadata: {
            type: isPosCharge3ds ? 'pos' : (paymentType3ds || 'manual_charge'),
            member_id: memberIdForLog || 'application',
            application_id: applicationIdForLog || '',
            charged_by: user.id,
            customer_name: customerName,
            base_amount: isPosCharge3ds ? String(amount - processingFee3ds) : String(amount),
            processing_fee: String(processingFee3ds),
            ...(taxAmount3ds ? { tax_amount: String(taxAmount3ds) } : {}),
            ...(bodySubtotal3ds ? { subtotal: String(bodySubtotal3ds) } : {}),
          },
        });

        logStep("3DS Payment intent created", { 
          paymentIntentId: paymentIntent3ds.id, 
          status: paymentIntent3ds.status,
          amount,
          customerName,
        });

        // Check if 3DS is required
        if (paymentIntent3ds.status === 'requires_action') {
          logStep("3DS required", { paymentIntentId: paymentIntent3ds.id });
          return new Response(
            JSON.stringify({ 
              requires_action: true,
              clientSecret: paymentIntent3ds.client_secret,
              paymentIntentId: paymentIntent3ds.id,
              cardBrand: cardBrand3ds,
              cardLast4: cardLast43ds,
            }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
          );
        }

        // If succeeded directly without 3DS
        if (paymentIntent3ds.status === 'succeeded') {
          // Record the charge in manual_charges table
          if (memberIdForLog && userIdForLog) {
            await supabase
              .from('manual_charges')
              .insert({
                member_id: memberIdForLog,
                user_id: userIdForLog,
                amount: totalAmount3ds,
                description: feeDescription3ds,
                stripe_payment_intent_id: paymentIntent3ds.id,
                status: 'succeeded',
                charged_by: user.id,
              });
          } else if (applicationIdForLog) {
            await supabase
              .from('manual_charges')
              .insert({
                application_id: applicationIdForLog,
                user_id: user.id,
                amount: totalAmount3ds,
                description: feeDescription3ds,
                stripe_payment_intent_id: paymentIntent3ds.id,
                status: 'succeeded',
                charged_by: user.id,
              });
          }

          // Sync to member profile if initiation fee
          const isInitiationFee3ds = description.toLowerCase().includes('initiation') || 
                                     description.toLowerCase().includes('annual fee');
          
          if (isInitiationFee3ds && applicationIdForLog) {
            const { data: appData3ds } = await supabase
              .from('membership_applications')
              .select('email')
              .eq('id', applicationIdForLog)
              .single();
            
            if (appData3ds?.email) {
              const { data: memberDataSync3ds } = await supabase
                .from('members')
                .select('id')
                .ilike('email', appData3ds.email)
                .maybeSingle();
              
              if (memberDataSync3ds) {
                await supabase
                  .from('members')
                  .update({ 
                    annual_fee_paid_at: new Date().toISOString(),
                    stripe_customer_id: customerId 
                  })
                  .eq('id', memberDataSync3ds.id);
                logStep("Synced annual_fee_paid_at to member (3DS)", { memberId: memberDataSync3ds.id });
              }
            }
          }

          return new Response(
            JSON.stringify({ 
              success: true,
              paymentIntentId: paymentIntent3ds.id,
              status: paymentIntent3ds.status,
              cardBrand: cardBrand3ds,
              cardLast4: cardLast43ds,
            }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
          );
        }

        // Handle other statuses
        return new Response(
          JSON.stringify({ 
            success: false,
            paymentIntentId: paymentIntent3ds.id,
            status: paymentIntent3ds.status,
            error: `Unexpected payment status: ${paymentIntent3ds.status}`,
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
        );
      }

      case 'refund_charge': {
        const { chargeId, paymentIntentId, refundAmount, refundNotes, refundMethodType } = body;

        if (!chargeId || !paymentIntentId) {
          throw new Error("Charge ID and Payment Intent ID are required");
        }

        // Verify the admin has permission (they're already authenticated)
        const { data: roleData } = await supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', user.id)
          .in('role', ['super_admin', 'admin', 'manager']);

        if (!roleData || roleData.length === 0) {
          throw new Error("Unauthorized: Admin access required");
        }

        logStep("Processing refund", { chargeId, paymentIntentId, refundAmount, refundNotes });

        // Create refund in Stripe
        const refundParams: { payment_intent: string; amount?: number } = {
          payment_intent: paymentIntentId,
        };

        // If refundAmount is provided, use it (partial refund), otherwise full refund
        if (refundAmount && refundAmount > 0) {
          refundParams.amount = refundAmount;
        }

        const refund = await stripe.refunds.create(refundParams);

        logStep("Refund created", { 
          refundId: refund.id, 
          status: refund.status, 
          amount: refund.amount 
        });

        // Update the charge status in manual_charges table with refund details
        const { error: updateError } = await supabase
          .from('manual_charges')
          .update({ 
            status: refundAmount ? 'partially_refunded' : 'refunded',
            refund_method: refundMethodType || 'stripe',
            refund_notes: refundNotes || null,
            refunded_at: new Date().toISOString(),
            refunded_by: user.id,
            updated_at: new Date().toISOString(),
          })
          .eq('id', chargeId);

        if (updateError) {
          logStep("Warning: Failed to update charge status", { error: updateError.message });
        } else {
          logStep("Charge status updated to refunded", { chargeId });
        }

        return new Response(
          JSON.stringify({ 
            success: true,
            refundId: refund.id,
            status: refund.status,
            amount: refund.amount,
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
        );
      }

      case 'create_setup_intent': {
        const { memberId } = body;
        
        // Determine Stripe mode from secret key prefix
        const stripeMode = stripeSecretKey.startsWith('sk_test') ? 'test' : 'live';
        logStep("Creating SetupIntent for inline card form", { userId: user.id, memberId, stripeMode });

        const customerId = await getOrCreateCustomer();
        
        // Save stripe_customer_id to member record if we have a memberId
        if (memberId) {
          const { error: updateError } = await supabase
            .from('members')
            .update({ stripe_customer_id: customerId })
            .eq('id', memberId);
          
          if (updateError) {
            logStep("Warning: Failed to save stripe_customer_id", { error: updateError.message });
          } else {
            logStep("Saved stripe_customer_id to member", { memberId, customerId });
          }
        } else {
          // Try to update by user_id
          const { error: updateError } = await supabase
            .from('members')
            .update({ stripe_customer_id: customerId })
            .eq('user_id', user.id);
          
          if (updateError) {
            logStep("Warning: Failed to save stripe_customer_id by user_id", { error: updateError.message });
          }
        }
        
        // Create SetupIntent for saving a card
        const setupIntent = await stripe.setupIntents.create({
          customer: customerId,
          payment_method_types: ['card'],
          metadata: {
            user_id: user.id,
            member_id: memberId || '',
          },
        });

        logStep("SetupIntent created", { setupIntentId: setupIntent.id, customerId, stripeMode });

        // Log card setup attempt for audit trail (member portal)
        try {
          // Get member ID from user if not provided
          let memberIdForAudit = memberId;
          if (!memberIdForAudit) {
            const { data: memberData } = await supabase
              .from('members')
              .select('id')
              .eq('user_id', user.id)
              .maybeSingle();
            memberIdForAudit = memberData?.id || null;
          }

          await supabase.from('card_setup_attempts').insert({
            member_id: memberIdForAudit,
            stripe_customer_id: customerId,
            stripe_setup_intent: setupIntent.id,
            source: 'member_portal',
            status: 'initiated',
            metadata: { user_id: user.id },
          });
          logStep("Card setup attempt logged (member_portal)", { setupIntentId: setupIntent.id });
        } catch (auditErr) {
          logStep("Warning: Failed to log member card setup attempt", { error: String(auditErr) });
        }

        return new Response(
          JSON.stringify({ 
            clientSecret: setupIntent.client_secret,
            customerId,
            stripeMode,
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
        );
      }

      case 'detach_payment_method': {
        const { paymentMethodId } = body;
        
        if (!paymentMethodId) {
          throw new Error("Payment method ID required");
        }

        logStep("Detaching payment method", { paymentMethodId, userId: user.id });

        // Verify the user owns this payment method
        const customerId = await getOrCreateCustomer();
        const paymentMethod = await stripe.paymentMethods.retrieve(paymentMethodId);
        
        if (paymentMethod.customer !== customerId) {
          throw new Error("Unauthorized: Payment method does not belong to this user");
        }

        // Check if this is the last payment method - members must keep at least one on file
        const allPaymentMethods = await stripe.paymentMethods.list({
          customer: customerId,
          type: 'card',
        });

        if (allPaymentMethods.data.length <= 1) {
          throw new Error("Cannot remove your last payment method. At least one card must remain on file for billing.");
        }

        // Detach the payment method
        await stripe.paymentMethods.detach(paymentMethodId);

        logStep("Payment method detached", { paymentMethodId });

        return new Response(
          JSON.stringify({ success: true }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
        );
      }

      case 'list_invoices': {
        const { memberId } = body;
        
        logStep("Listing invoices", { userId: user.id, memberId });

        const customerId = await getOrCreateCustomer();
        
        // List invoices for this customer
        const invoices = await stripe.invoices.list({
          customer: customerId,
          limit: 10,
        });

        const formattedInvoices = invoices.data.map((invoice: Stripe.Invoice) => ({
          id: invoice.id,
          number: invoice.number,
          created: invoice.created,
          status: invoice.status,
          amount_paid: invoice.amount_paid,
          amount_due: invoice.amount_due,
          currency: invoice.currency,
          invoice_pdf: invoice.invoice_pdf,
          hosted_invoice_url: invoice.hosted_invoice_url,
        }));

        logStep("Invoices retrieved", { count: formattedInvoices.length });

        return new Response(
          JSON.stringify({ invoices: formattedInvoices }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
        );
      }

      case 'set_default_payment_method': {
        const { paymentMethodId, memberId } = body;
        
        if (!paymentMethodId) {
          throw new Error("Payment method ID required");
        }
        await assertOwnerOrStaff(memberId);


        logStep("Setting default payment method", { paymentMethodId, userId: user.id, memberId });

        // Get member's stripe customer ID
        const { data: memberData, error: memberError } = await supabase
          .from('members')
          .select('stripe_customer_id')
          .eq('id', memberId)
          .single();

        if (memberError || !memberData?.stripe_customer_id) {
          throw new Error("Member not found or has no Stripe customer");
        }

        const customerId = memberData.stripe_customer_id;

        // Verify the payment method belongs to this customer
        const paymentMethod = await stripe.paymentMethods.retrieve(paymentMethodId);
        
        if (paymentMethod.customer !== customerId) {
          throw new Error("Unauthorized: Payment method does not belong to this user");
        }

        // Update customer's default payment method for invoices/subscriptions
        await stripe.customers.update(customerId, {
          invoice_settings: {
            default_payment_method: paymentMethodId,
          },
        });

        logStep("Default payment method updated", { paymentMethodId, customerId });

        return new Response(
          JSON.stringify({ success: true }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
        );
      }

      case 'update_payment_method_nickname': {
        const { paymentMethodId, nickname } = body;
        
        if (!paymentMethodId) {
          throw new Error("Payment method ID required");
        }

        logStep("Updating payment method nickname", { paymentMethodId, nickname, userId: user.id });

        // Get the payment method to verify ownership
        const paymentMethod = await stripe.paymentMethods.retrieve(paymentMethodId);
        
        // Verify the user owns this payment method by checking customer
        const customerId = await getOrCreateCustomer();
        if (paymentMethod.customer !== customerId) {
          throw new Error("Unauthorized: Payment method does not belong to this user");
        }

        // Update the payment method metadata with the nickname
        await stripe.paymentMethods.update(paymentMethodId, {
          metadata: {
            ...paymentMethod.metadata,
            nickname: nickname || '',
          },
        });

        logStep("Payment method nickname updated", { paymentMethodId, nickname });

        return new Response(
          JSON.stringify({ success: true }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
        );
      }

      case 'create_membership_payment_link':
      case 'process_membership_payment': {
        // Same logic as create_activation_checkout but can be called by admin
        const { tier, gender, isFoundingMember, startDate, memberId, skipAnnualFee, successUrl, cancelUrl } = body;
        await assertOwnerOrStaff(memberId);

        if (!tier || !gender || !startDate || !memberId) {

          throw new Error("Missing required fields for membership payment");
        }

        const normalizedTier = tier.toLowerCase().replace(' membership', '') as keyof typeof STRIPE_PRODUCTS.memberships;
        const normalizedGender = (gender.toLowerCase() === 'male' || gender.toLowerCase() === 'men') ? 'men' : 'women';
        
        const membershipPrices = STRIPE_PRODUCTS.memberships[normalizedTier];
        if (!membershipPrices) {
          throw new Error(`Invalid membership tier: ${tier}`);
        }

        const billingType = isFoundingMember ? 'annual' : 'monthly';
        const membershipPriceId = membershipPrices[billingType][normalizedGender];
        
        if (!membershipPriceId) {
          throw new Error(`Membership not available for ${gender} at ${tier} tier`);
        }

        const annualFeePriceId = skipAnnualFee ? null : STRIPE_PRODUCTS.annualFee[normalizedGender];

        // Get member to find customer ID
        const { data: memberData } = await supabase
          .from('members')
          .select('user_id, stripe_customer_id')
          .eq('id', memberId)
          .single();

        if (!memberData) throw new Error("Member not found");

        let customerId = memberData.stripe_customer_id;
        if (!customerId) {
          // Get or create customer
          const { data: profile } = await supabase
            .from('profiles')
            .select('email, full_name')
            .eq('user_id', memberData.user_id)
            .single();
          
          if (!profile) throw new Error("User profile not found");

          const customer = await stripe.customers.create({
            email: profile.email,
            name: profile.full_name,
            metadata: { member_id: memberId, user_id: memberData.user_id },
          });
          
          customerId = customer.id;
          
          // Save to member record
          await supabase
            .from('members')
            .update({ stripe_customer_id: customerId })
            .eq('id', memberId);
        }

        const startDateObj = new Date(startDate);
        const billingAnchor = Math.floor(startDateObj.getTime() / 1000);

        const baseLineItems: { price: string; quantity: number }[] = [
          { price: membershipPriceId, quantity: 1 },
        ];
        
        if (annualFeePriceId) {
          baseLineItems.push({ price: annualFeePriceId, quantity: 1 });
        }
        
        // Add processing fee for each subscription item
        const lineItems = await addRecurringProcessingFeeItems(stripe, baseLineItems);

        // For founding members paying annual upfront, charge 12 months
        if (isFoundingMember && billingType === 'annual') {
          // For annual upfront, we'll charge once and set up annual subscription
          const session = await stripe.checkout.sessions.create({
            customer: customerId,
            line_items: lineItems,
            mode: 'subscription',
            payment_method_types: ['card', 'us_bank_account'],
            subscription_data: {
              billing_cycle_anchor: billingAnchor,
              proration_behavior: 'none',
              metadata: {
                member_id: memberId,
                user_id: memberData.user_id,
                tier: normalizedTier,
                gender: normalizedGender,
                is_founding_member: String(isFoundingMember),
                start_date: startDate,
              },
            },
            success_url: successUrl || `${Deno.env.get('SITE_URL') || 'http://localhost:5173'}/member?payment=success`,
            cancel_url: cancelUrl || `${Deno.env.get('SITE_URL') || 'http://localhost:5173'}/member?payment=cancelled`,
            metadata: {
              type: 'membership_activation',
              member_id: memberId,
              user_id: memberData.user_id,
              tier: normalizedTier,
              gender: normalizedGender,
              is_founding_member: String(isFoundingMember),
              start_date: startDate,
            },
          });

          return new Response(
            JSON.stringify({ sessionId: session.id, url: session.url, success: true }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
          );
        } else {
          // Regular subscription flow
          const session = await stripe.checkout.sessions.create({
            customer: customerId,
            line_items: lineItems,
            mode: 'subscription',
            payment_method_types: ['card', 'us_bank_account'],
            subscription_data: {
              billing_cycle_anchor: billingAnchor,
              proration_behavior: 'none',
              metadata: {
                member_id: memberId,
                user_id: memberData.user_id,
                tier: normalizedTier,
                gender: normalizedGender,
                is_founding_member: String(isFoundingMember),
                start_date: startDate,
              },
            },
            success_url: successUrl || `${Deno.env.get('SITE_URL') || 'http://localhost:5173'}/member?payment=success`,
            cancel_url: cancelUrl || `${Deno.env.get('SITE_URL') || 'http://localhost:5173'}/member?payment=cancelled`,
            metadata: {
              type: 'membership_activation',
              member_id: memberId,
              user_id: memberData.user_id,
              tier: normalizedTier,
              gender: normalizedGender,
              is_founding_member: String(isFoundingMember),
              start_date: startDate,
            },
          });

          return new Response(
            JSON.stringify({ sessionId: session.id, url: session.url, success: true }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
          );
        }
      }

      case 'create_class_pass_link':
      case 'process_class_pass': {
        // Similar to create_class_pass_checkout but for admin use
        const { category, passType, userId, isMember, successUrl, cancelUrl } = body;
        if (userId !== user.id) {
          await assertStaff();
        }

        if (!category || !passType || !userId) {

          throw new Error("Missing required fields for class pass");
        }

        // Map category names to classPasses keys
        let passCategory: 'pilatesCycling' | 'otherClasses' = category as 'pilatesCycling' | 'otherClasses';
        // Category already matches classPasses keys (pilatesCycling or otherClasses)

        const passConfig = STRIPE_PRODUCTS.classPasses[passCategory];
        if (!passConfig) {
          throw new Error(`Invalid category: ${category}`);
        }

        const priceId = (passConfig as any)[passType as string]?.[isMember ? 'member' : 'nonMember'];
        if (!priceId) {
          throw new Error(`Price not found for ${category} ${passType} ${isMember ? 'member' : 'non-member'}`);
        }

        // Get or create customer
        const { data: profile } = await supabase
          .from('profiles')
          .select('email, full_name')
          .eq('user_id', userId)
          .single();

        if (!profile) throw new Error("User profile not found");

        let customer = await stripe.customers.list({ email: profile.email, limit: 1 });
        let customerId: string;
        
        if (customer.data.length > 0) {
          customerId = customer.data[0].id;
        } else {
          const newCustomer = await stripe.customers.create({
            email: profile.email,
            name: profile.full_name,
            metadata: { user_id: userId },
          });
          customerId = newCustomer.id;
        }

        const session = await stripe.checkout.sessions.create({
          customer: customerId,
          line_items: [{ price: priceId, quantity: 1 }],
          mode: 'payment',
          success_url: successUrl || `${Deno.env.get('SITE_URL') || 'http://localhost:5173'}/member/credits?purchase=success`,
          cancel_url: cancelUrl || `${Deno.env.get('SITE_URL') || 'http://localhost:5173'}/class-passes?purchase=cancelled`,
          metadata: {
            type: 'class_pass',
            user_id: userId,
            category: passCategory,
            pass_type: passType,
            is_member: String(isMember),
          },
        });

        return new Response(
          JSON.stringify({ sessionId: session.id, url: session.url, success: true }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
        );
      }

      case 'charge_annual_fee': {
        const { memberId, customerId } = body;
        await assertStaff();
        
        if (!memberId || !customerId) {
          throw new Error("Missing memberId or customerId");
        }


        // Get member to determine gender
        const { data: member } = await supabase
          .from('members')
          .select('gender')
          .eq('id', memberId)
          .single();

        if (!member) throw new Error("Member not found");

        const normalizedGender = (member.gender?.toLowerCase() === 'male' || member.gender?.toLowerCase() === 'men') ? 'men' : 'women';
        const annualFeePriceId = STRIPE_PRODUCTS.annualFee[normalizedGender];

        const paymentIntent = await stripe.paymentIntents.create({
          amount: annualFeePriceId ? 0 : (normalizedGender === 'men' ? 17500 : 30000), // cents
          currency: 'usd',
          customer: customerId,
          metadata: {
            type: 'annual_fee_payment',
            member_id: memberId,
          },
        });

        // If price ID exists, use subscription checkout instead (recurring yearly)
        if (annualFeePriceId) {
          const annualFeeCheckoutItems = await addRecurringProcessingFeeItems(stripe, [{ price: annualFeePriceId, quantity: 1 }]);
          const session = await stripe.checkout.sessions.create({
            customer: customerId,
            line_items: annualFeeCheckoutItems,
            mode: 'subscription',
            payment_method_types: ['card', 'us_bank_account'],
            subscription_data: {
              metadata: {
                type: 'annual_fee_subscription',
                member_id: memberId,
              },
            },
            success_url: `${Deno.env.get('SITE_URL') || 'http://localhost:5173'}/member?payment=success`,
            cancel_url: `${Deno.env.get('SITE_URL') || 'http://localhost:5173'}/member?payment=cancelled`,
            metadata: {
              type: 'annual_fee_subscription',
              member_id: memberId,
            },
          });

          return new Response(
            JSON.stringify({ sessionId: session.id, url: session.url, success: true }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
          );
        }

        return new Response(
          JSON.stringify({ paymentIntentId: paymentIntent.id, success: true }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
        );
      }

      case 'pause_subscription': {
        const { subscriptionId, resumesAt } = body;
        if (!subscriptionId) throw new Error("Missing subscriptionId");

        const pauseCollection: Record<string, any> = {
          behavior: 'keep_as_draft',
        };
        if (resumesAt) {
          const resumesAtUnix = Math.floor(new Date(resumesAt).getTime() / 1000);
          if (Number.isFinite(resumesAtUnix) && resumesAtUnix > Math.floor(Date.now() / 1000)) {
            pauseCollection.resumes_at = resumesAtUnix;
          }
        }

        const subscription = await stripe.subscriptions.update(subscriptionId, {
          pause_collection: pauseCollection as any,
        });

        return new Response(
          JSON.stringify({ subscription, success: true }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
        );
      }

      case 'resume_subscription': {
        const { subscriptionId } = body;
        if (!subscriptionId) throw new Error("Missing subscriptionId");

        const subscription = await stripe.subscriptions.update(subscriptionId, {
          pause_collection: null,
        });

        return new Response(
          JSON.stringify({ subscription, success: true }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
        );
      }

      case 'update_subscription_billing': {
        const { subscriptionId, billingType } = body;
        if (!subscriptionId || !billingType) {
          throw new Error("Missing subscriptionId or billingType");
        }

        // Get current subscription
        const subscription = await stripe.subscriptions.retrieve(subscriptionId);
        
        // Update to new billing interval
        const updated = await stripe.subscriptions.update(subscriptionId, {
          items: [{
            id: subscription.items.data[0].id,
            price: subscription.items.data[0].price.id, // Keep same price but update interval
          }],
          billing_cycle_anchor: 'unchanged',
          proration_behavior: 'always_invoice',
        });

        return new Response(
          JSON.stringify({ subscription: updated, success: true }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
        );
      }

      case 'create_subscription_payment_intent': {
        // Create payment intent for embedded subscription payment (stays in-app)
        const { tier, gender, isFoundingMember, startDate, memberId, skipAnnualFee } = body;
        
        if (!tier || !gender || !startDate || !memberId) {
          throw new Error("Missing required fields for subscription payment");
        }

        const normalizedTier = tier.toLowerCase().replace(' membership', '') as keyof typeof STRIPE_PRODUCTS.memberships;
        const normalizedGender = (gender.toLowerCase() === 'male' || gender.toLowerCase() === 'men') ? 'men' : 'women';
        
        const membershipPrices = STRIPE_PRODUCTS.memberships[normalizedTier];
        if (!membershipPrices) {
          throw new Error(`Invalid membership tier: ${tier}`);
        }

        const billingType = isFoundingMember ? 'annual' : 'monthly';
        const membershipPriceId = membershipPrices[billingType][normalizedGender];
        
        if (!membershipPriceId) {
          throw new Error(`Membership not available for ${gender} at ${tier} tier`);
        }

        const annualFeePriceId = skipAnnualFee ? null : STRIPE_PRODUCTS.annualFee[normalizedGender];

        // Get customer ID
        const customerId = await getOrCreateCustomer();

        // Save stripe_customer_id to member record
        await supabase
          .from('members')
          .update({ stripe_customer_id: customerId })
          .eq('id', memberId);

        // Calculate total amount for payment intent
        const price = await stripe.prices.retrieve(membershipPriceId);
        let amount = price.unit_amount || 0;
        
        if (annualFeePriceId) {
          const feePrice = await stripe.prices.retrieve(annualFeePriceId);
          amount += feePrice.unit_amount || 0;
        }

        // Create payment intent
        const paymentIntent = await stripe.paymentIntents.create({
          amount,
          currency: 'usd',
          customer: customerId,
          setup_future_usage: 'off_session', // Save payment method for subscription
          metadata: {
            type: 'membership_activation',
            member_id: memberId,
            user_id: user.id,
            tier: normalizedTier,
            gender: normalizedGender,
            is_founding_member: String(isFoundingMember),
            start_date: startDate,
            skip_annual_fee: String(skipAnnualFee || false),
          },
        });

        logStep("Payment intent created for subscription", { 
          paymentIntentId: paymentIntent.id, 
          memberId,
          amount: amount / 100 
        });

        return new Response(
          JSON.stringify({ 
            clientSecret: paymentIntent.client_secret,
            paymentIntentId: paymentIntent.id,
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
        );
      }

      case 'create_subscription_from_payment': {
        // Create subscription after payment is confirmed (for embedded payment flow)
        const { memberId, tier, gender, isFoundingMember, startDate, skipAnnualFee, paymentMethodId, paymentIntentId } = body;
        
        if (!memberId || !paymentMethodId || !tier || !gender || !startDate) {
          throw new Error("Missing required fields for subscription creation");
        }

        const normalizedTier = tier.toLowerCase().replace(' membership', '') as keyof typeof STRIPE_PRODUCTS.memberships;
        const normalizedGender = (gender.toLowerCase() === 'male' || gender.toLowerCase() === 'men') ? 'men' : 'women';
        
        const membershipPrices = STRIPE_PRODUCTS.memberships[normalizedTier];
        if (!membershipPrices) {
          throw new Error(`Invalid membership tier: ${tier}`);
        }

        const billingType = isFoundingMember ? 'annual' : 'monthly';
        const membershipPriceId = membershipPrices[billingType][normalizedGender];
        
        if (!membershipPriceId) {
          throw new Error(`Membership not available for ${gender} at ${tier} tier`);
        }

        // Get annual fee price (only if not skipping)
        const annualFeePriceId = skipAnnualFee ? null : STRIPE_PRODUCTS.annualFee[normalizedGender];

        // Get customer ID from member
        const { data: memberData } = await supabase
          .from('members')
          .select('stripe_customer_id, user_id')
          .eq('id', memberId)
          .single();

        if (!memberData?.stripe_customer_id) {
          throw new Error("Member has no Stripe customer ID");
        }

        const startDateObj = new Date(startDate);
        const billingAnchor = Math.floor(startDateObj.getTime() / 1000);

        // Create membership subscription with saved payment method + processing fee
        const membershipSubItems = await addRecurringProcessingFeeItems(stripe, [{ price: membershipPriceId }]);
        const subscription = await stripe.subscriptions.create({
          customer: memberData.stripe_customer_id,
          items: membershipSubItems,
          default_payment_method: paymentMethodId,
          billing_cycle_anchor: billingAnchor,
          proration_behavior: 'none',
          metadata: {
            member_id: memberId,
            user_id: memberData.user_id,
            tier: normalizedTier,
            gender: normalizedGender,
            is_founding_member: String(isFoundingMember),
            start_date: startDate,
            annual_fee_skipped: String(skipAnnualFee || false),
            payment_intent_id: paymentIntentId || '',
          },
        });

        // CRITICAL: Verify initial invoice is paid before marking as active
        // This prevents setting member to active when payment actually failed
        let paymentVerified = false;
        let newStatus = 'pending_activation';
        
        try {
          const subscriptionWithInvoice = await stripe.subscriptions.retrieve(subscription.id, {
            expand: ['latest_invoice'],
          });
          
          const latestInvoice = subscriptionWithInvoice.latest_invoice as Stripe.Invoice | null;
          const invoiceStatus = latestInvoice?.status;
          paymentVerified = invoiceStatus === 'paid' || latestInvoice?.amount_due === 0;
          
          if (paymentVerified) {
            newStatus = 'active';
            logStep("Initial payment verified - activating member", { 
              invoiceId: latestInvoice?.id, 
              invoiceStatus,
              memberId 
            });
          } else {
            logStep("Initial payment NOT verified - keeping pending", { 
              invoiceId: latestInvoice?.id, 
              invoiceStatus,
              subscriptionStatus: subscription.status,
              memberId 
            });
          }
        } catch (verifyError) {
          logStep("Warning: Could not verify invoice status", { 
            error: verifyError instanceof Error ? verifyError.message : String(verifyError) 
          });
          // Keep as pending_activation if we can't verify
        }

        // Update member record with appropriate status based on payment verification
        await supabase
          .from('members')
          .update({
            status: newStatus,
            stripe_subscription_id: subscription.id,
            billing_type: billingType,
            is_founding_member: isFoundingMember,
            gender: normalizedGender,
            activated_at: paymentVerified ? new Date().toISOString() : null,
            membership_start_date: startDate,
            annual_fee_paid_at: skipAnnualFee ? null : (paymentVerified ? new Date().toISOString() : null),
          })
          .eq('id', memberId);

        // Create annual fee subscription (separate recurring subscription) if not skipped
        let annualFeeSubscriptionId: string | null = null;
        if (!skipAnnualFee && annualFeePriceId) {
          try {
            console.log(`[STRIPE-PAYMENT] Creating annual fee subscription - ${JSON.stringify({ memberId, annualFeePriceId })}`);
            
            const annualFeeSubItems = await addRecurringProcessingFeeItems(stripe, [{ price: annualFeePriceId }]);
            const annualFeeSubscription = await stripe.subscriptions.create({
              customer: memberData.stripe_customer_id,
              items: annualFeeSubItems,
              billing_cycle_anchor: billingAnchor,
              proration_behavior: 'none',
              metadata: {
                member_id: memberId,
                user_id: memberData.user_id,
                type: 'annual_fee',
              },
            });

            annualFeeSubscriptionId = annualFeeSubscription.id;

            // Update member record with annual fee subscription ID
            await supabase
              .from('members')
              .update({
                annual_fee_subscription_id: annualFeeSubscriptionId,
              })
              .eq('id', memberId);

            console.log(`[STRIPE-PAYMENT] Annual fee subscription created - ${JSON.stringify({ memberId, annualFeeSubscriptionId })}`);
          } catch (annualFeeError) {
            console.error(`[STRIPE-PAYMENT] ERROR ANNUAL_FEE_SUBSCRIPTION_CREATION - ${annualFeeError instanceof Error ? annualFeeError.message : String(annualFeeError)}`);
            // Don't fail the function - membership subscription is already created
            // Annual fee subscription creation can be retried manually if needed
          }
        }

        // Create initial credits (webhook will also do this, but doing it here ensures it happens)
        const credits = TIER_CREDITS[normalizedTier] || TIER_CREDITS.silver;
        const cycleStart = new Date(startDate);
        const cycleEnd = new Date(cycleStart);
        cycleEnd.setMonth(cycleEnd.getMonth() + 1);
        cycleEnd.setDate(cycleEnd.getDate() - 1); // End day before next billing
        const expiresAt = new Date(cycleEnd);
        expiresAt.setHours(23, 59, 59, 999);

        const creditTypes = ['class', 'red_light', 'dry_cryo'] as const;
        for (const creditType of creditTypes) {
          const creditAmount = credits[creditType];
          if (creditAmount > 0) {
            await supabase
              .from('member_credits')
              .insert({
                member_id: memberId,
                user_id: memberData.user_id,
                credit_type: creditType,
                credits_total: creditAmount,
                credits_remaining: creditAmount,
                cycle_start: cycleStart.toISOString().split('T')[0],
                cycle_end: cycleEnd.toISOString().split('T')[0],
                expires_at: expiresAt.toISOString(),
              });
          }
        }

        logStep("Subscription created from payment", { subscriptionId: subscription.id, memberId });

        return new Response(
          JSON.stringify({ subscription, success: true }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
        );
      }

      case 'admin_create_member_subscription': {
        // Admin-initiated subscription creation for members
        const { memberId, tier, gender, billingType: requestedBillingType, startDate, isFoundingMember, firstChargeDate } = body;

        if (!memberId || !tier || !gender) {
          throw new Error("memberId, tier, and gender are required");
        }

        // Verify admin role
        const { data: roleData } = await supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', user.id)
          .in('role', ['super_admin', 'admin', 'manager']);

        if (!roleData || roleData.length === 0) {
          throw new Error("Unauthorized: Admin access required");
        }

        const normalizedTier = tier.toLowerCase().replace(' membership', '') as keyof typeof STRIPE_PRODUCTS.memberships;
        const normalizedGender = (gender.toLowerCase() === 'male' || gender.toLowerCase() === 'men') ? 'men' : 'women';
        const billingType = requestedBillingType || (isFoundingMember ? 'annual' : 'monthly');

        // Determine charge date
        const now = new Date();
        const chargeDate = firstChargeDate ? new Date(firstChargeDate) : now;
        const isChargeDateInFuture = chargeDate > now;
        const benefitsStartDate = startDate ? new Date(startDate) : now;

        logStep("Admin creating member subscription", { 
          memberId, 
          tier: normalizedTier, 
          gender: normalizedGender, 
          billingType, 
          benefitsStartDate: benefitsStartDate.toISOString(),
          chargeDate: chargeDate.toISOString(),
          isChargeDateInFuture,
        });

        // Get membership price
        const membershipPrices = STRIPE_PRODUCTS.memberships[normalizedTier];
        if (!membershipPrices) {
          throw new Error(`Invalid membership tier: ${tier}`);
        }

        const membershipPriceId = membershipPrices[billingType as 'monthly' | 'annual'][normalizedGender];
        if (!membershipPriceId) {
          throw new Error(`Membership not available for ${gender} at ${tier} tier with ${billingType} billing`);
        }

        // Get member data - include annual fee fields to prevent double-charging
        const { data: memberData, error: memberError } = await supabase
          .from('members')
          .select('stripe_customer_id, user_id, email, first_name, last_name, annual_fee_paid_at, annual_fee_subscription_id')
          .eq('id', memberId)
          .single();

        if (memberError || !memberData) {
          throw new Error("Member not found");
        }

        if (!memberData.stripe_customer_id) {
          throw new Error("Member has no Stripe customer ID. Add a payment method first.");
        }

        // Get default payment method
        const paymentMethods = await stripe.paymentMethods.list({
          customer: memberData.stripe_customer_id,
          type: 'card',
          limit: 1,
        });

        if (paymentMethods.data.length === 0) {
          throw new Error("No payment method on file. Add a card first.");
        }

        const paymentMethodId = paymentMethods.data[0].id;
        const isStartDateInPast = benefitsStartDate < now;

        // Build subscription parameters - handle different scenarios
        const membershipAdminItems = await addRecurringProcessingFeeItems(stripe, [{ price: membershipPriceId }]);
        const subscriptionParams: any = {
          customer: memberData.stripe_customer_id,
          items: membershipAdminItems,
          default_payment_method: paymentMethodId,
          proration_behavior: 'none',
          metadata: {
            member_id: memberId,
            user_id: memberData.user_id || '',
            tier: normalizedTier,
            gender: normalizedGender,
            is_founding_member: String(isFoundingMember || false),
            billing_type: billingType,
            created_by_admin: user.id,
            benefits_start_date: startDate || now.toISOString().split('T')[0],
            first_charge_date: chargeDate.toISOString().split('T')[0],
          },
        };

        // Determine billing behavior based on charge date
        if (isChargeDateInFuture) {
          // Defer first charge to the specified charge date
          subscriptionParams.billing_cycle_anchor = Math.floor(chargeDate.getTime() / 1000);
          logStep("Deferring charge to specified date", { 
            chargeDate: chargeDate.toISOString(), 
            billingAnchor: subscriptionParams.billing_cycle_anchor 
          });
        } else if (isStartDateInPast) {
          // For past dates, start immediately - Stripe doesn't allow billing_cycle_anchor in past
          logStep("Start date is in past, charging immediately", { 
            originalStartDate: startDate, 
            now: now.toISOString() 
          });
          subscriptionParams.metadata.original_start_date = startDate;
        }
        // else: charge immediately (default Stripe behavior)

        // Create the subscription
        const subscription = await stripe.subscriptions.create(subscriptionParams);

        logStep("Admin subscription created", { 
          subscriptionId: subscription.id, 
          memberId, 
          chargedImmediately: !isChargeDateInFuture 
        });

        // Verify first invoice status before marking as active
        // This prevents marking member active if their initial payment fails
        let paymentWarning: string | null = null;
        let newStatus = 'active';
        
        if (!isChargeDateInFuture) {
          // Retrieve subscription with expanded latest_invoice
          const subscriptionWithInvoice = await stripe.subscriptions.retrieve(subscription.id, {
            expand: ['latest_invoice'],
          });
          
          const latestInvoice = subscriptionWithInvoice.latest_invoice as Stripe.Invoice | null;
          const invoiceStatus = latestInvoice?.status;
          const isPaid = invoiceStatus === 'paid' || latestInvoice?.amount_due === 0;
          
          logStep("Checking initial invoice status", { 
            invoiceId: latestInvoice?.id,
            invoiceStatus,
            amountDue: latestInvoice?.amount_due,
            isPaid,
          });
          
          if (!isPaid) {
            newStatus = 'pending_activation';
            paymentWarning = `Subscription created but initial payment is ${invoiceStatus || 'pending'}. Member will be activated when payment succeeds.`;
            logStep("Initial payment not confirmed - setting pending status", { newStatus, invoiceStatus });
          }
        }

        // Update member record with appropriate status
        await supabase
          .from('members')
          .update({
            stripe_subscription_id: subscription.id,
            status: newStatus,
            billing_type: billingType,
            is_founding_member: isFoundingMember || false,
            activated_at: newStatus === 'active' ? new Date().toISOString() : null,
            membership_start_date: benefitsStartDate.toISOString().split('T')[0],
          })
          .eq('id', memberId);

        // Allocate credits
        const credits = TIER_CREDITS[normalizedTier] || TIER_CREDITS.silver;
        const cycleStart = benefitsStartDate;
        const cycleEnd = new Date(cycleStart);
        cycleEnd.setMonth(cycleEnd.getMonth() + 1);
        cycleEnd.setDate(cycleEnd.getDate() - 1); // End day before next billing
        const expiresAt = new Date(cycleEnd);
        expiresAt.setHours(23, 59, 59, 999);

        const creditTypes = ['class', 'red_light', 'dry_cryo'] as const;
        for (const creditType of creditTypes) {
          const creditAmount = credits[creditType];
          if (creditAmount > 0) {
            await supabase
              .from('member_credits')
              .insert({
                member_id: memberId,
                user_id: memberData.user_id,
                credit_type: creditType,
                credits_total: creditAmount,
                credits_remaining: creditAmount,
                cycle_start: cycleStart.toISOString().split('T')[0],
                cycle_end: cycleEnd.toISOString().split('T')[0],
                expires_at: expiresAt.toISOString(),
              });
          }
        }

        logStep("Admin subscription complete with credits", { memberId, subscriptionId: subscription.id });

        // Create annual fee subscription (separate recurring subscription)
        // CRITICAL: Triple-check to prevent double-charging members who already paid
        let annualFeeSubscriptionId: string | null = memberData.annual_fee_subscription_id || null;
        const annualFeePriceId = STRIPE_PRODUCTS.annualFee[normalizedGender];
        
        // Check 1: Already paid in database?
        const alreadyPaidInDB = !!memberData.annual_fee_paid_at;
        
        // Check 2: Subscription ID already linked?
        const hasLinkedSubscription = !!memberData.annual_fee_subscription_id;
        
        if (alreadyPaidInDB) {
          logStep("SKIPPING annual fee creation - already marked as paid in database", { 
            memberId, 
            annual_fee_paid_at: memberData.annual_fee_paid_at,
            annual_fee_subscription_id: memberData.annual_fee_subscription_id
          });
        } else if (hasLinkedSubscription) {
          logStep("SKIPPING annual fee creation - subscription already linked", { 
            memberId, 
            annual_fee_subscription_id: memberData.annual_fee_subscription_id 
          });
        } else if (annualFeePriceId) {
          try {
            // Check 3: Search Stripe for existing annual fee subscription (fallback for unlinked subscriptions)
            logStep("Checking Stripe for existing annual fee subscription", { memberId, stripeCustomerId: memberData.stripe_customer_id });
            
            const existingSubs = await stripe.subscriptions.list({
              customer: memberData.stripe_customer_id,
              limit: 20,
            });
            
            const existingAnnualFeeSub = existingSubs.data.find((sub: Stripe.Subscription) => {
              const isActiveOrTrialing = ['active', 'trialing'].includes(sub.status);
              const isAnnualFeeByMetadata = sub.metadata.type === 'annual_fee';
              const isAnnualFeeByPrice = sub.items.data.some((item: Stripe.SubscriptionItem) => 
                Object.values(STRIPE_PRODUCTS.annualFee).includes(item.price.id)
              );
              return isActiveOrTrialing && (isAnnualFeeByMetadata || isAnnualFeeByPrice);
            });
            
            if (existingAnnualFeeSub) {
              // Found existing subscription in Stripe - link it instead of creating duplicate
              annualFeeSubscriptionId = existingAnnualFeeSub.id;
              logStep("SKIPPING annual fee creation - found existing subscription in Stripe, linking it", { 
                memberId, 
                existingSubscriptionId: annualFeeSubscriptionId,
                status: existingAnnualFeeSub.status
              });
              
              // Link the existing subscription to the member record
              await supabase
                .from('members')
                .update({
                  annual_fee_subscription_id: annualFeeSubscriptionId,
                  annual_fee_paid_at: new Date().toISOString(),
                })
                .eq('id', memberId);
            } else {
              // No existing subscription found - create new one
              logStep("Creating annual fee subscription for admin activation", { memberId, annualFeePriceId });
              
              const annualFeeAdminItems = await addRecurringProcessingFeeItems(stripe, [{ price: annualFeePriceId }]);
              const annualFeeSubscription = await stripe.subscriptions.create({
                customer: memberData.stripe_customer_id,
                items: annualFeeAdminItems,
                default_payment_method: paymentMethodId,
                proration_behavior: 'none',
                metadata: {
                  member_id: memberId,
                  user_id: memberData.user_id || '',
                  type: 'annual_fee',
                  created_by_admin: user.id,
                },
              });

              annualFeeSubscriptionId = annualFeeSubscription.id;

              // Update member record with annual fee subscription ID
              await supabase
                .from('members')
                .update({
                  annual_fee_subscription_id: annualFeeSubscriptionId,
                  annual_fee_paid_at: new Date().toISOString(),
                })
                .eq('id', memberId);

              logStep("Annual fee subscription created during admin activation", { 
                memberId, 
                annualFeeSubscriptionId 
              });
            }
          } catch (annualFeeError) {
            console.error(`[STRIPE-PAYMENT] ERROR ANNUAL_FEE_ADMIN_CREATION - ${annualFeeError instanceof Error ? annualFeeError.message : String(annualFeeError)}`);
            // Don't fail - membership subscription is already created
          }
        }

        // RECEIPT EMAIL LOGIC
        // CRITICAL: Only send receipt if payment is CONFIRMED (invoice.status = 'paid')
        // Do NOT rely on subscription status alone - a subscription can be 'active' while payment is still processing
        // If payment fails, the webhook will handle the failed payment email
        let invoiceIsPaid = false;
        
        if (!isChargeDateInFuture) {
          try {
            const subscriptionForEmail = await stripe.subscriptions.retrieve(subscription.id, {
              expand: ['latest_invoice'],
            });
            const latestInvoiceForEmail = subscriptionForEmail.latest_invoice as Stripe.Invoice | null;
            invoiceIsPaid = latestInvoiceForEmail?.status === 'paid' || latestInvoiceForEmail?.amount_due === 0;
            logStep("Email decision - checking if invoice is paid", { 
              invoiceId: latestInvoiceForEmail?.id,
              invoiceStatus: latestInvoiceForEmail?.status,
              invoiceIsPaid 
            });
          } catch (invoiceCheckError) {
            logStep("Warning: Could not check invoice status for email decision", { 
              error: invoiceCheckError instanceof Error ? invoiceCheckError.message : String(invoiceCheckError) 
            });
          }
        }
        
        const shouldSendReceiptNow = !isChargeDateInFuture && memberData.email && invoiceIsPaid;

        if (shouldSendReceiptNow) {
          try {
            const memberName = memberData.first_name && memberData.last_name 
              ? `${memberData.first_name} ${memberData.last_name}`
              : memberData.first_name || memberData.last_name || 'Member';
            
            // Get pricing info
            const priceInfo = await stripe.prices.retrieve(membershipPriceId);
            const priceAmount = priceInfo.unit_amount ? (priceInfo.unit_amount / 100).toFixed(2) : '0.00';
            
            // Get card info
            const cardBrand = paymentMethods.data[0].card?.brand 
              ? paymentMethods.data[0].card.brand.charAt(0).toUpperCase() + paymentMethods.data[0].card.brand.slice(1)
              : 'Card';
            const cardLast4 = paymentMethods.data[0].card?.last4 || '****';
            
            // Format dates - payment is happening NOW
            const paymentDateFormatted = now.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
            const benefitsStartFormatted = benefitsStartDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
            
            // Calculate next billing date based on when charge occurred (now)
            const nextBillingDt = new Date(now);
            nextBillingDt.setMonth(nextBillingDt.getMonth() + (billingType === 'annual' ? 12 : 1));
            const nextBillingFormatted = nextBillingDt.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
            
            // Determine description
            const tierDisplay = normalizedTier.charAt(0).toUpperCase() + normalizedTier.slice(1);
            const description = `Membership Dues - ${tierDisplay}${billingType === 'annual' ? ' (Annual)' : ''}`;

            // Only show benefits start date if it's different from today
            const showBenefitsStart = benefitsStartDate.toDateString() !== now.toDateString();

            await supabase.functions.invoke('send-email', {
              body: {
                type: 'charge_confirmation',
                to: memberData.email,
                data: {
                  name: memberName,
                  description: description,
                  amount: priceAmount,
                  paymentDate: paymentDateFormatted,
                  benefitsStartDate: showBenefitsStart ? benefitsStartFormatted : undefined,
                  nextBillingDate: nextBillingFormatted,
                  cardBrand: cardBrand,
                  cardLast4: cardLast4,
                },
              },
            });

            logStep("Receipt email sent to member (charged now)", { memberId, email: memberData.email });
          } catch (emailError) {
            console.error(`[STRIPE-PAYMENT] ERROR SENDING_RECEIPT_EMAIL - ${emailError instanceof Error ? emailError.message : String(emailError)}`);
            // Don't fail - subscription is already created
          }
        } else if (isChargeDateInFuture && memberData.email) {
          // Send membership scheduled email for future charges
          try {
            const memberName = memberData.first_name && memberData.last_name 
              ? `${memberData.first_name} ${memberData.last_name}`
              : memberData.first_name || memberData.last_name || 'Member';
            
            // Get pricing info
            const priceInfo = await stripe.prices.retrieve(membershipPriceId);
            const priceAmount = priceInfo.unit_amount ? (priceInfo.unit_amount / 100).toFixed(2) : '0.00';
            
            // Get card info
            const cardBrand = paymentMethods.data[0].card?.brand 
              ? paymentMethods.data[0].card.brand.charAt(0).toUpperCase() + paymentMethods.data[0].card.brand.slice(1)
              : 'Card';
            const cardLast4 = paymentMethods.data[0].card?.last4 || '****';
            
            // Format dates
            const chargeDateFormatted = chargeDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
            const benefitsStartFormatted = benefitsStartDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
            
            // Determine description
            const tierDisplay = normalizedTier.charAt(0).toUpperCase() + normalizedTier.slice(1);

            await supabase.functions.invoke('send-email', {
              body: {
                type: 'membership_scheduled',
                to: memberData.email,
                data: {
                  name: memberName,
                  tier: tierDisplay,
                  amount: priceAmount,
                  firstChargeDate: chargeDateFormatted,
                  benefitsStartDate: benefitsStartFormatted,
                  cardBrand: cardBrand,
                  cardLast4: cardLast4,
                },
              },
            });

            logStep("Membership scheduled email sent to member", { 
              memberId, 
              email: memberData.email,
              chargeDate: chargeDateFormatted,
              benefitsStartDate: benefitsStartFormatted
            });
          } catch (emailError) {
            console.error(`[STRIPE-PAYMENT] ERROR SENDING_SCHEDULED_EMAIL - ${emailError instanceof Error ? emailError.message : String(emailError)}`);
            // Don't fail - subscription is already created
          }
        } else if (isChargeDateInFuture) {
          logStep("Membership scheduled email not sent - no email address available", { memberId });
        }

        return new Response(
          JSON.stringify({ 
            success: true, 
            subscriptionId: subscription.id,
            annualFeeSubscriptionId,
            status: newStatus,
            paymentStatus: paymentWarning ? 'pending' : 'paid',
            warning: paymentWarning,
            chargedImmediately: !isChargeDateInFuture,
            chargeDate: chargeDate.toISOString(),
            benefitsStartDate: benefitsStartDate.toISOString(),
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
        );
      }

      case 'cancel_annual_fee_subscription': {
        const { memberId, subscriptionId } = body;

        if (!memberId || !subscriptionId) {
          throw new Error("Missing required fields for canceling annual fee subscription");
        }

        logStep("Canceling annual fee subscription", { memberId, subscriptionId });

        // Verify admin role
        const { data: adminRoles } = await supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', user.id);
        
        const isAdmin = adminRoles?.some(r => ['admin', 'super_admin'].includes(r.role));
        if (!isAdmin) {
          throw new Error("Admin access required to cancel annual fee subscription");
        }

        // Cancel the subscription in Stripe
        const canceledSubscription = await stripe.subscriptions.cancel(subscriptionId);
        logStep("Stripe subscription canceled", { subscriptionId, status: canceledSubscription.status });

        // Clear from member record
        const { error: updateError } = await supabase
          .from('members')
          .update({ 
            annual_fee_subscription_id: null,
            updated_at: new Date().toISOString()
          })
          .eq('id', memberId);

        if (updateError) {
          logStep("Error clearing annual fee subscription from member", updateError);
          throw new Error("Failed to update member record");
        }

        logStep("Annual fee subscription canceled and cleared from member record", { memberId });

        return new Response(
          JSON.stringify({ 
            success: true, 
            message: "Annual fee subscription canceled",
            canceledSubscriptionId: subscriptionId,
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
        );
      }

      case 'create_member_dues_checkout': {
        // Member self-service subscription checkout - creates a checkout session for their tier
        const { memberId, successUrl, cancelUrl } = body;

        if (!memberId || !successUrl || !cancelUrl) {
          throw new Error("memberId, successUrl, and cancelUrl are required");
        }

        logStep("Creating member dues checkout", { memberId });

        // Get member data including their tier and payment info
        const { data: memberData, error: memberError } = await supabase
          .from('members')
          .select('id, user_id, email, first_name, last_name, membership_type, gender, is_founding_member, billing_type, stripe_customer_id, stripe_subscription_id')
          .eq('id', memberId)
          .single();

        if (memberError || !memberData) {
          throw new Error("Member not found");
        }

        // Verify this member belongs to the authenticated user
        if (memberData.user_id !== user.id) {
          throw new Error("Unauthorized: You can only set up billing for your own membership");
        }

        // Check if already has an active subscription
        if (memberData.stripe_subscription_id) {
          throw new Error("You already have an active subscription");
        }

        // Normalize tier and gender
        const normalizedTier = memberData.membership_type.toLowerCase().replace(' membership', '') as keyof typeof STRIPE_PRODUCTS.memberships;
        const normalizedGender = (memberData.gender?.toLowerCase() === 'male' || memberData.gender?.toLowerCase() === 'men') ? 'men' : 'women';
        const billingType = memberData.is_founding_member ? 'annual' : (memberData.billing_type || 'monthly');

        logStep("Member dues checkout - tier info", { tier: normalizedTier, gender: normalizedGender, billingType });

        // Get membership price ID
        const membershipPrices = STRIPE_PRODUCTS.memberships[normalizedTier];
        if (!membershipPrices) {
          throw new Error(`Invalid membership tier: ${memberData.membership_type}`);
        }

        const priceId = membershipPrices[billingType as 'monthly' | 'annual'][normalizedGender];
        if (!priceId) {
          throw new Error(`Membership not available for your tier and billing type`);
        }

        // Get or create Stripe customer
        let customerId = memberData.stripe_customer_id;
        
        if (!customerId) {
          // Check if customer exists by email
          const existingCustomers = await stripe.customers.list({ email: memberData.email, limit: 1 });
          
          if (existingCustomers.data.length > 0) {
            customerId = existingCustomers.data[0].id;
          } else {
            const customer = await stripe.customers.create({
              email: memberData.email,
              name: `${memberData.first_name} ${memberData.last_name}`,
              metadata: {
                member_id: memberId,
                user_id: user.id,
              },
            });
            customerId = customer.id;
          }

          // Update member with customer ID
          await supabase
            .from('members')
            .update({ stripe_customer_id: customerId })
            .eq('id', memberId);
        }

        // Create checkout session for subscription
        // Add processing fee to membership dues checkout
        const duesLineItems = await addRecurringProcessingFeeItems(stripe, [{ price: priceId, quantity: 1 }]);
        
        const session = await stripe.checkout.sessions.create({
          customer: customerId,
          mode: 'subscription',
          payment_method_types: ['card', 'us_bank_account'],
          line_items: duesLineItems,
          success_url: successUrl,
          cancel_url: cancelUrl,
          metadata: {
            type: 'membership_dues',
            member_id: memberId,
            user_id: user.id,
            tier: normalizedTier,
            gender: normalizedGender,
            billing_type: billingType,
            is_founding_member: String(memberData.is_founding_member || false),
          },
          subscription_data: {
            metadata: {
              member_id: memberId,
              user_id: user.id,
              tier: normalizedTier,
              gender: normalizedGender,
              billing_type: billingType,
              is_founding_member: String(memberData.is_founding_member || false),
            },
          },
        });

        logStep("Member dues checkout session created", { sessionId: session.id, url: session.url });

        return new Response(
          JSON.stringify({ url: session.url, sessionId: session.id }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
        );
      }

      case 'sync_member_card_metadata': {
        // Sync card metadata from Stripe to the members table
        const { memberId, stripeCustomerId: providedCustomerId } = body;
        
        if (!memberId) {
          throw new Error("Member ID required");
        }
        await assertOwnerOrStaff(memberId);


        // Get member's stripe_customer_id
        const { data: memberData, error: memberError } = await supabase
          .from('members')
          .select('stripe_customer_id')
          .eq('id', memberId)
          .single();

        if (memberError) {
          throw new Error("Member not found");
        }

        // Use provided customer ID if member doesn't have one yet
        const customerIdToUse = memberData?.stripe_customer_id || providedCustomerId;

        if (!customerIdToUse) {
          logStep("No stripe_customer_id, cannot sync card metadata", { memberId });
          return new Response(
            JSON.stringify({ success: false, message: "No Stripe customer ID on file" }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
          );
        }

        // If member record was missing customer ID but we have one provided, update it now
        if (!memberData?.stripe_customer_id && providedCustomerId) {
          const { error: customerUpdateError } = await supabase
            .from('members')
            .update({ stripe_customer_id: providedCustomerId })
            .eq('id', memberId);
          
          if (customerUpdateError) {
            logStep("Warning: Failed to update stripe_customer_id on member", { 
              error: customerUpdateError.message 
            });
          } else {
            logStep("Updated member with provided stripe_customer_id", { 
              memberId, 
              customerId: providedCustomerId 
            });
          }
        }

        // Get the default payment method from customer
        const customer = await stripe.customers.retrieve(customerIdToUse);
        const defaultPaymentMethodId = !customer.deleted 
          ? customer.invoice_settings?.default_payment_method as string | null
          : null;

        // List payment methods to find the default or most recent
        const paymentMethods = await stripe.paymentMethods.list({
          customer: customerIdToUse,
          type: 'card',
          limit: 10,
        });

        if (paymentMethods.data.length === 0) {
          logStep("No payment methods found", { memberId });
          return new Response(
            JSON.stringify({ success: false, message: "No payment methods on file" }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
          );
        }

        // Use default payment method, or fall back to most recent
        let cardToSync = paymentMethods.data.find((pm: { id: string }) => pm.id === defaultPaymentMethodId);
        if (!cardToSync) {
          cardToSync = paymentMethods.data[0]; // Most recent
        }

        const cardDetails = {
          card_brand: cardToSync.card?.brand || null,
          card_last4: cardToSync.card?.last4 || null,
          card_exp_month: cardToSync.card?.exp_month || null,
          card_exp_year: cardToSync.card?.exp_year || null,
        };

        // Update member record with card details AND ensure stripe_customer_id is set
        const { error: updateError } = await supabase
          .from('members')
          .update({
            ...cardDetails,
            stripe_customer_id: customerIdToUse,
          })
          .eq('id', memberId);

        if (updateError) {
          throw new Error("Failed to update member card metadata");
        }

        // Log the update
        await supabase.from('payment_method_updates').insert({
          member_id: memberId,
          payment_method_id: cardToSync.id,
          event_type: 'card_metadata_synced',
          is_default: cardToSync.id === defaultPaymentMethodId,
        });

        logStep("Card metadata synced to member", { 
          memberId, 
          cardBrand: cardDetails.card_brand, 
          cardLast4: cardDetails.card_last4 
        });

        // Update card_setup_attempts to succeeded (find by customer ID, most recent initiated)
        try {
          await supabase
            .from('card_setup_attempts')
            .update({
              status: 'succeeded',
              completed_at: new Date().toISOString(),
              card_brand: cardDetails.card_brand,
              card_last4: cardDetails.card_last4,
            })
            .eq('stripe_customer_id', customerIdToUse)
            .eq('status', 'initiated')
            .order('created_at', { ascending: false })
            .limit(1);
          logStep("Updated card_setup_attempt to succeeded", { customerId: customerIdToUse });
        } catch (auditErr) {
          logStep("Warning: Failed to update card_setup_attempt", { error: String(auditErr) });
        }

        return new Response(
          JSON.stringify({ 
            success: true, 
            cardBrand: cardDetails.card_brand,
            cardLast4: cardDetails.card_last4,
            cardExpMonth: cardDetails.card_exp_month,
            cardExpYear: cardDetails.card_exp_year,
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
        );
      }

      case 'admin_update_member_tier': {
        // Admin-initiated tier upgrade/downgrade
        const { memberId, newTier, prorationBehavior = 'create_prorations' } = body;

        if (!memberId || !newTier) {
          throw new Error("memberId and newTier are required");
        }

        logStep("Admin updating member tier", { memberId, newTier, prorationBehavior });

        // Verify admin role
        const { data: roleData } = await supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', user.id)
          .in('role', ['super_admin', 'admin', 'manager']);

        if (!roleData || roleData.length === 0) {
          throw new Error("Unauthorized: Admin access required");
        }

        // Get member data
        const { data: memberData, error: memberError } = await supabase
          .from('members')
          .select('id, user_id, stripe_subscription_id, stripe_customer_id, gender, billing_type, membership_type, is_founding_member')
          .eq('id', memberId)
          .single();

        if (memberError || !memberData) {
          throw new Error("Member not found");
        }

        // Validate subscription exists
        if (!memberData.stripe_subscription_id) {
          throw new Error("Member has no active subscription to modify. Create a subscription first.");
        }

        // Normalize gender and billing type
        const normalizedGender = (memberData.gender?.toLowerCase() === 'male' || memberData.gender?.toLowerCase() === 'men') ? 'men' : 'women';
        const billingType = memberData.billing_type || (memberData.is_founding_member ? 'annual' : 'monthly');
        const normalizedTier = newTier.toLowerCase() as keyof typeof STRIPE_PRODUCTS.memberships;

        // Get new price ID
        const membershipPrices = STRIPE_PRODUCTS.memberships[normalizedTier];
        if (!membershipPrices) {
          throw new Error(`Invalid membership tier: ${newTier}`);
        }

        const newPriceId = membershipPrices[billingType as 'monthly' | 'annual'][normalizedGender];
        if (!newPriceId) {
          throw new Error(`${newTier} tier is not available for ${normalizedGender === 'men' ? 'men' : 'women'}`);
        }

        logStep("Tier change details", { 
          currentTier: memberData.membership_type, 
          newTier, 
          gender: normalizedGender, 
          billingType, 
          newPriceId 
        });

        // Retrieve current subscription
        const subscription = await stripe.subscriptions.retrieve(memberData.stripe_subscription_id);
        
        if (!subscription || subscription.status === 'canceled') {
          throw new Error("Subscription is not active");
        }

        // Get the subscription item ID (first item)
        const subscriptionItem = subscription.items.data[0];
        if (!subscriptionItem) {
          throw new Error("No subscription item found");
        }

        const oldPriceId = subscriptionItem.price.id;
        const oldTier = memberData.membership_type?.toLowerCase().replace(' membership', '') || 'unknown';

        // Update subscription with new price
        const updatedSubscription = await stripe.subscriptions.update(memberData.stripe_subscription_id, {
          items: [{
            id: subscriptionItem.id,
            price: newPriceId,
          }],
          proration_behavior: prorationBehavior as 'create_prorations' | 'none' | 'always_invoice',
          metadata: {
            ...subscription.metadata,
            tier: normalizedTier,
            previous_tier: oldTier,
            tier_changed_at: new Date().toISOString(),
            tier_changed_by: user.id,
          },
        });

        logStep("Stripe subscription updated", { 
          subscriptionId: updatedSubscription.id, 
          oldPriceId, 
          newPriceId, 
          status: updatedSubscription.status 
        });

        // Update member record in database
        const capitalizedTier = normalizedTier.charAt(0).toUpperCase() + normalizedTier.slice(1);
        const { error: updateError } = await supabase
          .from('members')
          .update({
            membership_type: capitalizedTier,
            updated_at: new Date().toISOString(),
          })
          .eq('id', memberId);

        if (updateError) {
          logStep("Warning: Failed to update member record", { error: updateError.message });
        }

        // Handle credit adjustments for upgrades
        const oldTierCredits = TIER_CREDITS[oldTier] || TIER_CREDITS.silver;
        const newTierCredits = TIER_CREDITS[normalizedTier] || TIER_CREDITS.silver;

        // For upgrades, add the difference in credits for the current cycle
        const creditTypes = ['class', 'red_light', 'dry_cryo'] as const;
        let creditsAdded: Record<string, number> = {};

        for (const creditType of creditTypes) {
          const oldAmount = oldTierCredits[creditType];
          const newAmount = newTierCredits[creditType];
          const difference = newAmount - oldAmount;

          if (difference > 0) {
            // Upgrading: Add the difference
            const { data: existingCredit } = await supabase
              .from('member_credits')
              .select('id, credits_remaining, credits_total')
              .eq('member_id', memberId)
              .eq('credit_type', creditType)
              .gt('expires_at', new Date().toISOString())
              .order('expires_at', { ascending: false })
              .limit(1)
              .maybeSingle();

            if (existingCredit) {
              // Update existing credit
              const newRemaining = existingCredit.credits_remaining + difference;
              const newTotal = existingCredit.credits_total + difference;
              
              await supabase
                .from('member_credits')
                .update({ 
                  credits_remaining: newRemaining, 
                  credits_total: newTotal,
                  updated_at: new Date().toISOString()
                })
                .eq('id', existingCredit.id);

              // Log the adjustment
              await supabase.from('credit_adjustments').insert({
                member_id: memberId,
                member_credit_id: existingCredit.id,
                credit_type: creditType,
                adjustment_type: 'add',
                amount: difference,
                previous_balance: existingCredit.credits_remaining,
                new_balance: newRemaining,
                reason: `Tier upgrade from ${oldTier} to ${normalizedTier}`,
                adjusted_by: user.id,
              });

              creditsAdded[creditType] = difference;
            } else if (newAmount > 0 && memberData.user_id) {
              // No existing credit, create one for the new tier
              const cycleStart = new Date();
              const cycleEnd = new Date(cycleStart);
              cycleEnd.setMonth(cycleEnd.getMonth() + 1);
              cycleEnd.setDate(cycleEnd.getDate() - 1); // End day before next billing
              const expiresAt = new Date(cycleEnd);
              expiresAt.setHours(23, 59, 59, 999);

              await supabase.from('member_credits').insert({
                member_id: memberId,
                user_id: memberData.user_id,
                credit_type: creditType,
                credits_total: newAmount,
                credits_remaining: newAmount,
                cycle_start: cycleStart.toISOString().split('T')[0],
                cycle_end: cycleEnd.toISOString().split('T')[0],
                expires_at: expiresAt.toISOString(),
              });

              creditsAdded[creditType] = newAmount;
            }
          }
          // For downgrades: Don't remove existing credits - they stay until next renewal
        }

        logStep("Tier change complete", { 
          memberId, 
          oldTier, 
          newTier: normalizedTier, 
          creditsAdded,
          subscriptionStatus: updatedSubscription.status 
        });

        return new Response(
          JSON.stringify({
            success: true,
            oldTier,
            newTier: normalizedTier,
            subscriptionId: updatedSubscription.id,
            subscriptionStatus: updatedSubscription.status,
            creditsAdded,
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
        );
      }

      case 'create_annual_fee_payment_link': {
        const { applicationId, gender: feeGender, successUrl: feeSuccessUrl, cancelUrl: feeCancelUrl } = body;
        
        if (!applicationId || !feeGender) {
          throw new Error("Missing applicationId or gender for payment link");
        }

        logStep("Creating annual fee payment link with auto-email", { applicationId, gender: feeGender });

        // Verify admin/staff role
        const { data: staffRole } = await supabase
          .from('staff_roles')
          .select('role')
          .eq('user_id', user.id)
          .maybeSingle();

        const { data: userRole } = await supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', user.id)
          .maybeSingle();

        if (!staffRole?.role && !userRole?.role) {
          throw new Error("Unauthorized: Admin access required");
        }

        // Fetch application details
        const { data: application, error: appError } = await supabase
          .from('membership_applications')
          .select('id, email, full_name, first_name, last_name, stripe_customer_id')
          .eq('id', applicationId)
          .single();

        if (appError || !application) {
          throw new Error("Application not found");
        }

        const applicantEmail = application.email;
        const applicantFirstName = application.first_name || 
          (application.full_name?.split(' ')[0]) || 'Applicant';
        const applicantName = application.full_name || 
          `${application.first_name || ''} ${application.last_name || ''}`.trim();

        // Get or create Stripe customer
        let feeCustomerId: string;
        if (application.stripe_customer_id) {
          feeCustomerId = application.stripe_customer_id;
          logStep("Using existing Stripe customer", { customerId: feeCustomerId });
        } else {
          const customers = await stripe.customers.list({ 
            email: applicantEmail, 
            limit: 1 
          });
          
          if (customers.data.length > 0) {
            feeCustomerId = customers.data[0].id;
            logStep("Found existing Stripe customer", { customerId: feeCustomerId });
          } else {
            const customer = await stripe.customers.create({
              email: applicantEmail,
              name: applicantName,
              metadata: { 
                source: 'annual_fee_payment_link', 
                application_id: applicationId 
              }
            });
            feeCustomerId = customer.id;
            logStep("Created new Stripe customer", { customerId: feeCustomerId });
          }
        }

        // Get annual fee price ID based on gender
        const normalizedFeeGender = (feeGender.toLowerCase() === 'male' || 
          feeGender.toLowerCase() === 'men') ? 'men' : 'women';
        const feePriceId = STRIPE_PRODUCTS.annualFee[normalizedFeeGender];

        if (!feePriceId) {
          throw new Error(`No annual fee price found for gender: ${feeGender}`);
        }

        // Calculate fee amount for logging and email
        const feeAmount = normalizedFeeGender === 'men' ? 175 : 300;

        // Create checkout session for annual fee subscription
        // Add processing fee to annual fee payment link
        const feePaymentLineItems = await addRecurringProcessingFeeItems(stripe, [{ price: feePriceId, quantity: 1 }]);
        
        const linkSession = await stripe.checkout.sessions.create({
          customer: feeCustomerId,
          line_items: feePaymentLineItems,
          mode: 'subscription',
          payment_method_types: ['card', 'us_bank_account'],
          success_url: feeSuccessUrl || 'https://storm-haven-club.lovable.app/payment-success?type=annual_fee',
          cancel_url: feeCancelUrl || 'https://storm-haven-club.lovable.app/',
          subscription_data: {
            metadata: {
              type: 'annual_fee_payment_link',
              application_id: applicationId,
              source: 'admin_generated_link',
            },
          },
          metadata: {
            type: 'annual_fee_payment_link',
            application_id: applicationId,
            source: 'admin_generated_link',
          },
        });

        // Update application with Stripe customer ID and payment link sent timestamp
        const updateData: { stripe_customer_id?: string; payment_link_sent_at?: string } = {};
        if (!application.stripe_customer_id) {
          updateData.stripe_customer_id = feeCustomerId;
        }
        // Always record when the payment link was generated/sent
        updateData.payment_link_sent_at = new Date().toISOString();
        
        await supabase
          .from('membership_applications')
          .update(updateData)
          .eq('id', applicationId);

        logStep("Annual fee payment link created", { 
          sessionId: linkSession.id, 
          url: linkSession.url,
          applicationId,
          amount: feeAmount,
        });

        // Send email with payment link automatically
        let emailSent = false;
        try {
          const emailResponse = await fetch(`${supabaseUrl}/functions/v1/send-email`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${supabaseServiceKey}`,
            },
            body: JSON.stringify({
              type: 'annual_fee_payment_request',
              to: applicantEmail,
              data: {
                name: applicantFirstName,
                amount: feeAmount,
                paymentUrl: linkSession.url,
              },
            }),
          });

          if (emailResponse.ok) {
            emailSent = true;
            logStep("Payment request email sent", { email: applicantEmail });
          } else {
            const emailError = await emailResponse.text();
            logStep("Failed to send payment request email", { error: emailError });
          }
        } catch (emailErr) {
          logStep("Error sending payment request email", { error: String(emailErr) });
        }

        return new Response(
          JSON.stringify({ 
            url: linkSession.url, 
            applicationId,
            amount: feeAmount,
            customerId: feeCustomerId,
            emailSent,
            emailAddress: applicantEmail,
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
        );
      }

      case 'process_admin_refund': {
        const { memberId, chargeId, paymentIntentId, chargeType, refundAmount: adminRefundAmount, refundNotes: adminRefundNotes, managerCode, refundMethodType: adminRefundMethod } = body;

        if (!memberId) throw new Error("Member ID is required");
        if (!adminRefundAmount || adminRefundAmount <= 0) throw new Error("Valid refund amount is required");

        logStep("Processing admin refund", { memberId, chargeId, chargeType, adminRefundAmount, adminRefundMethod });

        // Check user roles
        const { data: adminRoleData } = await supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', user.id);

        const userRoles = (adminRoleData || []).map((r: { role: string }) => r.role);
        const isSuperAdminUser = userRoles.includes('super_admin');
        const hasAdminRole = userRoles.some((r: string) => ['super_admin', 'admin', 'manager'].includes(r));

        if (!hasAdminRole) throw new Error("Unauthorized: Admin access required");

        // Check if membership charge requires super admin
        const membershipChargeTypes = ['membership_dues', 'initiation_fee', 'annual_fee'];
        const isMembershipCharge = membershipChargeTypes.includes(chargeType) || 
          (chargeType === 'manual_charge' && !chargeId); // Default check for description-based detection

        if (isMembershipCharge && !isSuperAdminUser) {
          throw new Error("Only Super Admins can refund membership-related charges");
        }

        // Validate manager code for non-super admins
        if (!isSuperAdminUser && managerCode) {
          const { data: codeData } = await supabase
            .from('profiles')
            .select('user_id')
            .eq('manager_refund_code', managerCode)
            .single();

          if (!codeData) throw new Error("Invalid manager code");
          logStep("Manager code validated", { managerUserId: codeData.user_id });
        }

        let stripeRefundId: string | null = null;
        let stripeRefundStatus: string | null = null;

        // Process Stripe refund if method is stripe and we have payment intent
        if (adminRefundMethod === 'stripe' && paymentIntentId) {
          const refund = await stripe.refunds.create({
            payment_intent: paymentIntentId,
            amount: adminRefundAmount,
          });
          stripeRefundId = refund.id;
          stripeRefundStatus = refund.status;
          logStep("Stripe refund created", { refundId: refund.id, status: refund.status, amount: refund.amount });
        }

        // Log to refund_requests table
        const { error: refundLogError } = await supabase
          .from('refund_requests')
          .insert({
            member_id: memberId,
            original_charge_id: chargeId || null,
            original_payment_intent_id: paymentIntentId || null,
            charge_type: chargeType,
            refund_type: adminRefundMethod === 'stripe' ? 'stripe' : adminRefundMethod,
            amount_cents: adminRefundAmount,
            currency: 'usd',
            reason: adminRefundNotes || null,
            status: stripeRefundId ? 'processed' : 'completed',
            requested_by: user.id,
            manager_code: managerCode || null,
            stripe_refund_id: stripeRefundId,
            processed_at: new Date().toISOString(),
          });

        if (refundLogError) {
          logStep("Warning: Failed to log refund request", { error: refundLogError.message });
        }

        // Update manual_charges status if we have a chargeId
        if (chargeId) {
          const { error: updateError } = await supabase
            .from('manual_charges')
            .update({
              status: 'refunded',
              refund_method: adminRefundMethod,
              refund_notes: adminRefundNotes || null,
              refunded_at: new Date().toISOString(),
              refunded_by: user.id,
              updated_at: new Date().toISOString(),
            })
            .eq('id', chargeId);

          if (updateError) {
            logStep("Warning: Failed to update charge status", { error: updateError.message });
          }
        }

        return new Response(
          JSON.stringify({
            success: true,
            refundId: stripeRefundId,
            status: stripeRefundStatus || 'completed',
            amount: adminRefundAmount,
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
        );
      }

      case 'undo_admin_action': {
        const { actionLogId, includeRefund, managerCode: undoManagerCode } = body;

        if (!actionLogId) throw new Error("Action log ID is required");

        logStep("Processing undo action", { actionLogId, includeRefund });

        // Fetch the action from admin_action_log
        const { data: actionData, error: actionError } = await supabase
          .from('admin_action_log')
          .select('*')
          .eq('id', actionLogId)
          .single();

        if (actionError || !actionData) throw new Error("Action not found");

        // Validate action is undoable
        if (!actionData.can_undo) throw new Error("This action cannot be undone");
        if (actionData.undone_at) throw new Error("This action has already been undone");
        if (actionData.undo_expires_at && new Date(actionData.undo_expires_at) < new Date()) {
          throw new Error("Undo window has expired (24 hours)");
        }

        // Check user roles
        const { data: undoRoleData } = await supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', user.id);

        const undoUserRoles = (undoRoleData || []).map((r: { role: string }) => r.role);
        const isUndoSuperAdmin = undoUserRoles.includes('super_admin');
        const hasUndoAdminRole = undoUserRoles.some((r: string) => ['super_admin', 'admin', 'manager'].includes(r));

        if (!hasUndoAdminRole) throw new Error("Unauthorized: Admin access required");

        // Validate manager code for non-super admins
        if (!isUndoSuperAdmin && undoManagerCode) {
          const { data: codeData } = await supabase
            .from('profiles')
            .select('user_id')
            .eq('manager_refund_code', undoManagerCode)
            .single();

          if (!codeData) throw new Error("Invalid manager code");
        }

        const actionDataParsed = actionData.action_data as Record<string, unknown>;
        const undoMemberId = actionData.member_id;

        // Process based on action type
        switch (actionData.action_type) {
          case 'create_subscription':
          case 'sell_membership': {
            // Cancel Stripe subscription if exists
            const subId = actionDataParsed.subscription_id as string;
            if (subId) {
              try {
                await stripe.subscriptions.cancel(subId);
                logStep("Cancelled Stripe subscription", { subscriptionId: subId });
              } catch (stripeErr) {
                logStep("Warning: Failed to cancel subscription", { error: String(stripeErr) });
              }
            }

            // Reset member status to pending_activation
            const { error: memberUpdateError } = await supabase
              .from('members')
              .update({
                status: 'pending_activation',
                stripe_subscription_id: null,
                updated_at: new Date().toISOString(),
              })
              .eq('id', undoMemberId);

            if (memberUpdateError) {
              logStep("Warning: Failed to reset member status", { error: memberUpdateError.message });
            }

            // Remove allocated credits if tracked
            const creditsAllocated = actionDataParsed.credits_allocated as Record<string, number> | undefined;
            if (creditsAllocated && undoMemberId) {
              const { error: creditDeleteError } = await supabase
                .from('member_credits')
                .delete()
                .eq('member_id', undoMemberId)
                .gte('created_at', actionData.created_at);

              if (creditDeleteError) {
                logStep("Warning: Failed to remove credits", { error: creditDeleteError.message });
              }
            }
            break;
          }

          case 'sell_class_package': {
            const passId = actionDataParsed.pass_id as string;
            if (passId) {
              const { error: passUpdateError } = await supabase
                .from('class_passes')
                .update({ status: 'cancelled', updated_at: new Date().toISOString() })
                .eq('id', passId);

              if (passUpdateError) {
                logStep("Warning: Failed to cancel class pass", { error: passUpdateError.message });
              }
            }
            break;
          }

          case 'status_change': {
            const oldStatus = actionDataParsed.old_status as string;
            if (oldStatus && undoMemberId) {
              const { error: statusUpdateError } = await supabase
                .from('members')
                .update({ status: oldStatus, updated_at: new Date().toISOString() })
                .eq('id', undoMemberId);

              if (statusUpdateError) {
                logStep("Warning: Failed to revert status", { error: statusUpdateError.message });
              }
            }
            break;
          }
        }

        // Process refund if requested
        if (includeRefund && actionDataParsed.payment_intent_id) {
          try {
            const piId = actionDataParsed.payment_intent_id as string;
            const chargeAmountVal = actionDataParsed.charge_amount as number;
            
            const refund = await stripe.refunds.create({
              payment_intent: piId,
              amount: chargeAmountVal || undefined,
            });
            logStep("Processed refund as part of undo", { refundId: refund.id, amount: refund.amount });
          } catch (refundErr) {
            logStep("Warning: Failed to process refund", { error: String(refundErr) });
          }
        }

        // Mark action as undone
        const { error: markUndoneError } = await supabase
          .from('admin_action_log')
          .update({
            undone_at: new Date().toISOString(),
            undone_by: user.id,
          })
          .eq('id', actionLogId);

        if (markUndoneError) {
          logStep("Warning: Failed to mark action as undone", { error: markUndoneError.message });
        }

        return new Response(
          JSON.stringify({
            success: true,
            memberId: undoMemberId,
            actionType: actionData.action_type,
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
        );
      }

      case 'log_card_setup_failure': {
        // Log a failed card setup attempt (called from frontend on decline)
        const { 
          stripeCustomerId: failureCustomerId, 
          setupIntentId: failureSetupIntentId,
          applicationId: failureAppId,
          memberId: failureMemberId,
          source: failureSource,
          declineCode,
          declineMessage,
          initiatedBy,
        } = body;

        logStep("Logging card setup failure", { 
          customerId: failureCustomerId, 
          setupIntentId: failureSetupIntentId,
          declineCode 
        });

        // Try to find and update existing attempt record by setupIntentId first
        if (failureSetupIntentId) {
          const { data: existingAttempt } = await supabase
            .from('card_setup_attempts')
            .select('id')
            .eq('stripe_setup_intent', failureSetupIntentId)
            .maybeSingle();

          if (existingAttempt) {
            await supabase
              .from('card_setup_attempts')
              .update({
                status: 'failed',
                completed_at: new Date().toISOString(),
                decline_code: declineCode || null,
                decline_message: declineMessage || null,
              })
              .eq('id', existingAttempt.id);
            
            logStep("Updated existing card_setup_attempt to failed", { id: existingAttempt.id });
            
            return new Response(
              JSON.stringify({ success: true, updated: true }),
              { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
            );
          }
        }

        // If no existing record, insert a new one
        await supabase.from('card_setup_attempts').insert({
          member_id: failureMemberId || null,
          application_id: failureAppId || null,
          stripe_customer_id: failureCustomerId || 'unknown',
          stripe_setup_intent: failureSetupIntentId || null,
          source: failureSource || 'unknown',
          initiated_by: initiatedBy || null,
          status: 'failed',
          completed_at: new Date().toISOString(),
          decline_code: declineCode || null,
          decline_message: declineMessage || null,
          metadata: { logged_from: 'frontend' },
        });

        logStep("Inserted new card_setup_attempt as failed", { 
          customerId: failureCustomerId 
        });

        return new Response(
          JSON.stringify({ success: true, inserted: true }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
        );
      }

      case 'admin_list_member_payment_methods': {
        // Admin action to list ALL payment methods for a member directly from Stripe
        // This bypasses cached metadata and queries Stripe directly
        const { memberId } = body;

        if (!memberId) {
          throw new Error("memberId is required");
        }

        logStep("Admin listing member payment methods", { memberId, adminUserId: user.id });

        // Verify admin role
        const { data: roleData } = await supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', user.id)
          .in('role', ['super_admin', 'admin', 'manager', 'front_desk']);

        if (!roleData || roleData.length === 0) {
          throw new Error("Unauthorized: Admin access required");
        }

        // Get member data including email for Stripe lookup
        const { data: memberData, error: memberError } = await supabase
          .from('members')
          .select('id, email, stripe_customer_id, first_name, last_name, user_id')
          .eq('id', memberId)
          .single();

        if (memberError || !memberData) {
          throw new Error("Member not found");
        }

        let customerId = memberData.stripe_customer_id;
        let customerSource: 'database' | 'stripe_lookup' = 'database';

        // If no stripe_customer_id in database, try to find by email in Stripe
        if (!customerId && memberData.email) {
          logStep("No stripe_customer_id in database, searching Stripe by email", { 
            email: memberData.email 
          });
          
          const customers = await stripe.customers.list({ 
            email: memberData.email, 
            limit: 1 
          });
          
          if (customers.data.length > 0) {
            customerId = customers.data[0].id;
            customerSource = 'stripe_lookup';
            logStep("Found customer in Stripe by email", { customerId });
            
            // Update the member record with the discovered customer ID
            const { error: updateError } = await supabase
              .from('members')
              .update({ stripe_customer_id: customerId })
              .eq('id', memberId);
            
            if (updateError) {
              logStep("Warning: Failed to update stripe_customer_id", { error: updateError.message });
            } else {
              logStep("Updated member with discovered stripe_customer_id", { memberId, customerId });
            }
          }
        }

        if (!customerId) {
          return new Response(
            JSON.stringify({ 
              paymentMethods: [], 
              hasPaymentMethod: false,
              message: "No Stripe customer found for this member. They may not have added a card yet.",
              memberEmail: memberData.email,
            }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
          );
        }

        // Get customer to find default payment method
        const customer = await stripe.customers.retrieve(customerId);
        const defaultPaymentMethodId = !customer.deleted 
          ? customer.invoice_settings?.default_payment_method as string | null
          : null;

        // List all payment methods
        const paymentMethods = await stripe.paymentMethods.list({
          customer: customerId,
          type: 'card',
        });

        const formattedMethods = paymentMethods.data.map((pm: { 
          id: string; 
          created: number;
          card?: { brand?: string; last4?: string; exp_month?: number; exp_year?: number };
          metadata?: Record<string, string>;
        }) => ({
          id: pm.id,
          brand: pm.card?.brand,
          last4: pm.card?.last4,
          expMonth: pm.card?.exp_month,
          expYear: pm.card?.exp_year,
          nickname: pm.metadata?.nickname || null,
          isDefault: pm.id === defaultPaymentMethodId,
          createdAt: new Date(pm.created * 1000).toISOString(),
        }));

        logStep("Admin fetched member payment methods", { 
          memberId, 
          customerId, 
          customerSource,
          count: formattedMethods.length 
        });

        // If we found cards but member metadata is not synced, sync it now
        if (formattedMethods.length > 0) {
          const primaryCard = formattedMethods.find((pm: { isDefault: boolean }) => pm.isDefault) || formattedMethods[0];
          
          // Check if member metadata needs updating
          const { data: currentMember } = await supabase
            .from('members')
            .select('card_brand, card_last4')
            .eq('id', memberId)
            .single();
          
          if (!currentMember?.card_brand || !currentMember?.card_last4 || 
              currentMember.card_brand !== primaryCard.brand || 
              currentMember.card_last4 !== primaryCard.last4) {
            await supabase
              .from('members')
              .update({
                card_brand: primaryCard.brand,
                card_last4: primaryCard.last4,
                card_exp_month: primaryCard.expMonth,
                card_exp_year: primaryCard.expYear,
                stripe_customer_id: customerId,
              })
              .eq('id', memberId);
            logStep("Synced card metadata to member during admin fetch", { 
              memberId, 
              brand: primaryCard.brand,
              last4: primaryCard.last4 
            });
          }
        }

        return new Response(
          JSON.stringify({ 
            paymentMethods: formattedMethods, 
            hasPaymentMethod: formattedMethods.length > 0,
            stripeCustomerId: customerId,
            customerSource,
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
        );
      }

      case 'admin_create_initiation_fee_subscription': {
        // Admin-initiated initiation fee subscription creation (as recurring yearly subscription)
        const { memberId, startDate: startDateParam, chargeImmediately: chargeImmediatelyParam } = body;

        if (!memberId) {
          throw new Error("memberId is required");
        }

        // Verify admin role
        const { data: adminRoleCheck } = await supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', user.id)
          .in('role', ['super_admin', 'admin', 'manager']);

        if (!adminRoleCheck || adminRoleCheck.length === 0) {
          throw new Error("Unauthorized: Admin access required");
        }

        logStep("Admin creating initiation fee subscription", { memberId, startDate: startDateParam, chargeImmediately: chargeImmediatelyParam });

        // Get member data
        const { data: memberDataForFee, error: memberErrorForFee } = await supabase
          .from('members')
          .select('stripe_customer_id, user_id, email, first_name, last_name, gender, annual_fee_subscription_id')
          .eq('id', memberId)
          .single();

        if (memberErrorForFee || !memberDataForFee) {
          throw new Error("Member not found");
        }

        if (memberDataForFee.annual_fee_subscription_id) {
          throw new Error("Member already has an initiation fee subscription");
        }

        let customerIdForFee = memberDataForFee.stripe_customer_id;

        // If no stripe_customer_id in database, try to find by email in Stripe
        if (!customerIdForFee && memberDataForFee.email) {
          logStep("No stripe_customer_id in database, searching Stripe by email", { 
            email: memberDataForFee.email 
          });
          
          const customersSearch = await stripe.customers.list({ 
            email: memberDataForFee.email, 
            limit: 1 
          });
          
          if (customersSearch.data.length > 0) {
            customerIdForFee = customersSearch.data[0].id;
            logStep("Found customer in Stripe by email", { customerId: customerIdForFee });
            
            // Update the member record with the discovered customer ID
            await supabase
              .from('members')
              .update({ stripe_customer_id: customerIdForFee })
              .eq('id', memberId);
          }
        }

        if (!customerIdForFee) {
          throw new Error("Member has no Stripe customer ID. Add a payment method first.");
        }

        // Get default payment method
        const paymentMethodsForFee = await stripe.paymentMethods.list({
          customer: customerIdForFee,
          type: 'card',
          limit: 1,
        });

        if (paymentMethodsForFee.data.length === 0) {
          throw new Error("No payment method on file. Add a card first.");
        }

        const paymentMethodForFee = paymentMethodsForFee.data[0];
        const paymentMethodIdForFee = paymentMethodForFee.id;
        const cardBrandForFee = paymentMethodForFee.card?.brand ? 
          paymentMethodForFee.card.brand.charAt(0).toUpperCase() + paymentMethodForFee.card.brand.slice(1) : 'Card';
        const cardLast4ForFee = paymentMethodForFee.card?.last4 || '****';

        // Determine gender for pricing
        const normalizedGenderForFee = (memberDataForFee.gender?.toLowerCase() === 'male' || 
                                        memberDataForFee.gender?.toLowerCase() === 'men') ? 'men' : 'women';
        const annualFeePriceIdForMember = STRIPE_PRODUCTS.annualFee[normalizedGenderForFee];

        if (!annualFeePriceIdForMember) {
          throw new Error("Annual fee price not found");
        }

        // Handle start date logic
        const now = new Date();
        const subscriptionStart = startDateParam ? new Date(startDateParam) : now;
        const isPastDate = subscriptionStart < now;
        const isFutureDate = subscriptionStart > now;
        // Default to true if not specified (charge immediately)
        const chargeImmediatelyForFee = chargeImmediatelyParam !== false;

        let initiationFeeSubscription;

        if (isFutureDate && chargeImmediatelyForFee) {
          // CHARGE NOW, but record the future start date for renewal cycle
          logStep("Creating subscription with immediate charge and future renewal date", { 
            startDate: subscriptionStart.toISOString(),
            chargeImmediately: true
          });

          const initiationItems1 = await addRecurringProcessingFeeItems(stripe, [{ price: annualFeePriceIdForMember }]);
          initiationFeeSubscription = await stripe.subscriptions.create({
            customer: customerIdForFee,
            items: initiationItems1,
            proration_behavior: 'none',
            metadata: {
              member_id: memberId,
              user_id: memberDataForFee.user_id || '',
              type: 'annual_fee',
              created_by_admin: user.id,
              original_start_date: subscriptionStart.toISOString(),
              charge_now_activate_later: 'true',
              benefits_start_date: subscriptionStart.toISOString(),
            },
          });
        } else if (isFutureDate) {
          // Future date: Use billing_cycle_anchor (defer charge)
          const billingAnchor = Math.floor(subscriptionStart.getTime() / 1000);
          logStep("Creating subscription with future billing anchor (deferred charge)", { 
            startDate: subscriptionStart.toISOString(), 
            billingAnchor 
          });

          const initiationItems2 = await addRecurringProcessingFeeItems(stripe, [{ price: annualFeePriceIdForMember }]);
          initiationFeeSubscription = await stripe.subscriptions.create({
            customer: customerIdForFee,
            items: initiationItems2,
            billing_cycle_anchor: billingAnchor,
            proration_behavior: 'none',
            metadata: {
              member_id: memberId,
              user_id: memberDataForFee.user_id || '',
              type: 'annual_fee',
              created_by_admin: user.id,
              start_date: subscriptionStart.toISOString(),
            },
          });
        } else if (isPastDate) {
          // Past date: Start immediately, record original_start_date in metadata
          logStep("Creating subscription immediately with backdated start", { 
            originalStartDate: subscriptionStart.toISOString() 
          });

          const initiationItems3 = await addRecurringProcessingFeeItems(stripe, [{ price: annualFeePriceIdForMember }]);
          initiationFeeSubscription = await stripe.subscriptions.create({
            customer: customerIdForFee,
            items: initiationItems3,
            proration_behavior: 'none',
            metadata: {
              member_id: memberId,
              user_id: memberDataForFee.user_id || '',
              type: 'annual_fee',
              created_by_admin: user.id,
              original_start_date: subscriptionStart.toISOString(),
              backdated: 'true',
            },
          });
        } else {
          // Today: Normal immediate subscription
          const initiationItems4 = await addRecurringProcessingFeeItems(stripe, [{ price: annualFeePriceIdForMember }]);
          initiationFeeSubscription = await stripe.subscriptions.create({
            customer: customerIdForFee,
            items: initiationItems4,
            proration_behavior: 'none',
            metadata: {
              member_id: memberId,
              user_id: memberDataForFee.user_id || '',
              type: 'annual_fee',
              created_by_admin: user.id,
            },
          });
        }

        logStep("Initiation fee subscription created", { 
          subscriptionId: initiationFeeSubscription.id,
          memberId,
          status: initiationFeeSubscription.status,
          isPastDate,
          isFutureDate,
        });

        // Update member record with annual fee subscription ID
        const { error: updateErrorForFee } = await supabase
          .from('members')
          .update({
            annual_fee_subscription_id: initiationFeeSubscription.id,
            annual_fee_paid_at: new Date().toISOString(),
            stripe_customer_id: customerIdForFee,
          })
          .eq('id', memberId);

        if (updateErrorForFee) {
          logStep("Error updating member with annual fee subscription", updateErrorForFee);
          // Don't throw - subscription was created successfully
        }

        // Record in manual_charges for audit trail
        await supabase
          .from('manual_charges')
          .insert({
            member_id: memberId,
            user_id: memberDataForFee.user_id || user.id,
            amount: normalizedGenderForFee === 'women' ? 30000 : 17500, // in cents
            description: 'Initiation Fee',
            stripe_payment_intent_id: initiationFeeSubscription.latest_invoice as string || initiationFeeSubscription.id,
            status: initiationFeeSubscription.status === 'active' ? 'succeeded' : 'pending',
            charged_by: user.id,
          });

        return new Response(
          JSON.stringify({ 
            success: true,
            subscriptionId: initiationFeeSubscription.id,
            status: initiationFeeSubscription.status,
            cardBrand: cardBrandForFee,
            cardLast4: cardLast4ForFee,
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
        );
      }

      case 'admin_create_initiation_fee_subscription_no_charge': {
        // Admin creates subscription for member who already paid (no immediate charge)
        // Uses billing_cycle_anchor to delay first charge to 1 year from now
        const { memberId, originalPaymentMethod, originalPaymentDate, note } = body as unknown as { 
          memberId: string; 
          originalPaymentMethod: string; 
          originalPaymentDate?: string;
          note: string | null;
        };

        if (!memberId) {
          throw new Error("memberId is required");
        }

        // Verify admin role
        const { data: adminRoleCheckNoCharge } = await supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', user.id)
          .in('role', ['super_admin', 'admin', 'manager']);

        if (!adminRoleCheckNoCharge || adminRoleCheckNoCharge.length === 0) {
          throw new Error("Unauthorized: Admin access required");
        }

        logStep("Admin creating no-charge initiation fee subscription", { memberId, originalPaymentMethod });

        // Get member data
        const { data: memberDataNoCharge, error: memberErrorNoCharge } = await supabase
          .from('members')
          .select('stripe_customer_id, user_id, email, first_name, last_name, gender, annual_fee_paid_at, annual_fee_subscription_id')
          .eq('id', memberId)
          .single();

        if (memberErrorNoCharge || !memberDataNoCharge) {
          throw new Error("Member not found");
        }

        // Verify the initiation fee was already paid
        if (!memberDataNoCharge.annual_fee_paid_at) {
          throw new Error("This action is only for members whose initiation fee is already marked as paid.");
        }

        if (memberDataNoCharge.annual_fee_subscription_id) {
          throw new Error("Member already has an initiation fee subscription");
        }

        let customerIdNoCharge = memberDataNoCharge.stripe_customer_id;

        // If no stripe_customer_id in database, try to find by email in Stripe
        if (!customerIdNoCharge && memberDataNoCharge.email) {
          logStep("No stripe_customer_id in database, searching Stripe by email", { 
            email: memberDataNoCharge.email 
          });
          
          const customersSearchNoCharge = await stripe.customers.list({ 
            email: memberDataNoCharge.email, 
            limit: 1 
          });
          
          if (customersSearchNoCharge.data.length > 0) {
            customerIdNoCharge = customersSearchNoCharge.data[0].id;
            logStep("Found customer in Stripe by email", { customerId: customerIdNoCharge });
            
            // Update the member record with the discovered customer ID
            await supabase
              .from('members')
              .update({ stripe_customer_id: customerIdNoCharge })
              .eq('id', memberId);
          }
        }

        if (!customerIdNoCharge) {
          throw new Error("Member has no Stripe customer ID. Add a payment method first.");
        }

        // Get default payment method
        const paymentMethodsNoCharge = await stripe.paymentMethods.list({
          customer: customerIdNoCharge,
          type: 'card',
          limit: 1,
        });

        if (paymentMethodsNoCharge.data.length === 0) {
          throw new Error("No payment method on file. Add a card first.");
        }

        const paymentMethodNoCharge = paymentMethodsNoCharge.data[0];
        const paymentMethodIdNoCharge = paymentMethodNoCharge.id;
        const cardBrandNoCharge = paymentMethodNoCharge.card?.brand ? 
          paymentMethodNoCharge.card.brand.charAt(0).toUpperCase() + paymentMethodNoCharge.card.brand.slice(1) : 'Card';
        const cardLast4NoCharge = paymentMethodNoCharge.card?.last4 || '****';

        // Determine gender for pricing
        const normalizedGenderNoCharge = (memberDataNoCharge.gender?.toLowerCase() === 'male' || 
                                          memberDataNoCharge.gender?.toLowerCase() === 'men') ? 'men' : 'women';
        const annualFeePriceIdNoCharge = STRIPE_PRODUCTS.annualFee[normalizedGenderNoCharge];

        if (!annualFeePriceIdNoCharge) {
          throw new Error("Annual fee price not found");
        }

        // Calculate billing_cycle_anchor to 1 year from original payment date (or from now if not provided)
        const paymentDate = originalPaymentDate ? new Date(originalPaymentDate) : new Date();
        const oneYearFromPayment = new Date(paymentDate);
        oneYearFromPayment.setFullYear(oneYearFromPayment.getFullYear() + 1);
        const billingAnchorNoCharge = Math.floor(oneYearFromPayment.getTime() / 1000);
        
        logStep("Calculating billing anchor from original payment date", { 
          originalPaymentDate: paymentDate.toISOString(),
          nextBillingDate: oneYearFromPayment.toISOString(),
        });

        // Create the initiation fee subscription with delayed first charge
        const initiationItemsNoCharge = await addRecurringProcessingFeeItems(stripe, [{ price: annualFeePriceIdNoCharge }]);
        const initiationFeeSubNoCharge = await stripe.subscriptions.create({
          customer: customerIdNoCharge,
          items: initiationItemsNoCharge,
          default_payment_method: paymentMethodIdNoCharge,
          billing_cycle_anchor: billingAnchorNoCharge,
          proration_behavior: 'none',
          metadata: {
            member_id: memberId,
            user_id: memberDataNoCharge.user_id || '',
            type: 'annual_fee',
            created_by_admin: user.id,
            no_charge_reason: 'already_paid',
            original_payment_method: originalPaymentMethod || 'unknown',
            admin_note: note || '',
          },
        });

        logStep("No-charge initiation fee subscription created", { 
          subscriptionId: initiationFeeSubNoCharge.id,
          memberId,
          status: initiationFeeSubNoCharge.status,
          originalPaymentDate: paymentDate.toISOString(),
          nextBillingDate: oneYearFromPayment.toISOString(),
        });

        // Update member record with annual fee subscription ID (don't update annual_fee_paid_at - it's already set)
        const { error: updateErrorNoCharge } = await supabase
          .from('members')
          .update({
            annual_fee_subscription_id: initiationFeeSubNoCharge.id,
            stripe_customer_id: customerIdNoCharge,
          })
          .eq('id', memberId);

        if (updateErrorNoCharge) {
          logStep("Error updating member with annual fee subscription", updateErrorNoCharge);
          // Don't throw - subscription was created successfully
        }

        // Record in admin_action_log for audit trail
        await supabase
          .from('admin_action_log')
          .insert({
            action_type: 'create_initiation_fee_subscription_no_charge',
            member_id: memberId,
            performed_by: user.id,
            action_data: {
              subscription_id: initiationFeeSubNoCharge.id,
              original_payment_method: originalPaymentMethod,
              note: note,
              next_billing_date: oneYearFromPayment.toISOString(),
              original_payment_date: paymentDate.toISOString(),
              price_id: annualFeePriceIdNoCharge,
              gender: normalizedGenderNoCharge,
            },
            can_undo: false, // Can't undo subscription creation easily
          });

        return new Response(
          JSON.stringify({ 
            success: true,
            subscriptionId: initiationFeeSubNoCharge.id,
            status: initiationFeeSubNoCharge.status,
            cardBrand: cardBrandNoCharge,
            cardLast4: cardLast4NoCharge,
            nextBillingDate: oneYearFromPayment.toISOString(),
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
        );
      }

      case 'get_member_billing_health': {
        // Get comprehensive billing health data for admin view
        const { memberId } = body;

        if (!memberId) {
          throw new Error("memberId is required");
        }

        // Verify admin role
        const { data: adminRoleBilling } = await supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', user.id)
          .in('role', ['super_admin', 'admin', 'manager']);

        if (!adminRoleBilling || adminRoleBilling.length === 0) {
          throw new Error("Unauthorized: Admin access required");
        }

        logStep("Getting billing health for member", { memberId });

        // Get member data
        const { data: memberBilling, error: memberBillingError } = await supabase
          .from('members')
          .select('*')
          .eq('id', memberId)
          .single();

        if (memberBillingError || !memberBilling) {
          throw new Error("Member not found");
        }

        const issues: Array<{ type: 'error' | 'warning' | 'info'; code: string; message: string }> = [];
        const discrepancies: string[] = [];

        // Get Stripe customer data
        let stripeCustomer: any = null;
        let stripeCustomerId = memberBilling.stripe_customer_id;

        // If no customer ID in database, try to find by email
        if (!stripeCustomerId && memberBilling.email) {
          const searchResult = await stripe.customers.list({ email: memberBilling.email, limit: 1 });
          if (searchResult.data.length > 0) {
            stripeCustomerId = searchResult.data[0].id;
            discrepancies.push(`Stripe customer found by email but not in database: ${stripeCustomerId}`);
          }
        }

        if (stripeCustomerId) {
          try {
            stripeCustomer = await stripe.customers.retrieve(stripeCustomerId);
          } catch (e) {
            logStep("Could not retrieve Stripe customer", { error: String(e) });
            issues.push({ type: 'warning', code: 'CUSTOMER_NOT_FOUND', message: 'Stripe customer ID exists but customer not found in Stripe' });
          }
        } else {
          issues.push({ type: 'warning', code: 'NO_STRIPE_CUSTOMER', message: 'No Stripe customer linked to this member' });
        }

        // Get dues subscription details
        let duesSubscription: any = null;
        if (memberBilling.stripe_subscription_id) {
          try {
            const sub = await stripe.subscriptions.retrieve(memberBilling.stripe_subscription_id, {
              expand: ['latest_invoice', 'latest_invoice.payment_intent'],
            });
            
            const latestInvoice = sub.latest_invoice as any;
            
            duesSubscription = {
              id: sub.id,
              status: sub.status,
              currentPeriodEnd: sub.current_period_end ? new Date(sub.current_period_end * 1000).toISOString() : null,
              currentPeriodStart: sub.current_period_start ? new Date(sub.current_period_start * 1000).toISOString() : null,
              cancelAtPeriodEnd: sub.cancel_at_period_end,
              amountDue: sub.items.data[0]?.price?.unit_amount || null,
              interval: sub.items.data[0]?.price?.recurring?.interval || null,
              lastPaymentDate: latestInvoice?.status_transitions?.paid_at 
                ? new Date(latestInvoice.status_transitions.paid_at * 1000).toISOString() 
                : null,
              lastPaymentStatus: latestInvoice?.status || null,
              nextInvoiceAmount: sub.items.data.reduce((sum: number, item: any) => sum + (item.price?.unit_amount || 0), 0),
            };

            // Check for issues
            if (sub.status === 'past_due') {
              issues.push({ type: 'error', code: 'DUES_PAST_DUE', message: 'Membership dues subscription is past due' });
            } else if (sub.status === 'canceled') {
              issues.push({ type: 'error', code: 'DUES_CANCELED', message: 'Membership dues subscription has been canceled' });
            } else if (sub.cancel_at_period_end) {
              issues.push({ type: 'warning', code: 'DUES_CANCELING', message: 'Subscription will cancel at end of current period' });
            }

            // Check if DB status matches Stripe
            if (memberBilling.status === 'active' && sub.status !== 'active') {
              discrepancies.push(`DB status is 'active' but Stripe subscription is '${sub.status}'`);
            }
          } catch (e) {
            logStep("Could not retrieve dues subscription", { error: String(e) });
            issues.push({ type: 'error', code: 'SUBSCRIPTION_NOT_FOUND', message: 'Subscription ID exists but not found in Stripe' });
          }
        } else if (memberBilling.status === 'active') {
          issues.push({ type: 'error', code: 'NO_SUBSCRIPTION', message: 'Member is active but has no dues subscription' });
        }

        // Get initiation fee subscription details
        let initiationFeeSubscription: any = null;
        if (memberBilling.annual_fee_subscription_id) {
          try {
            const feeSub = await stripe.subscriptions.retrieve(memberBilling.annual_fee_subscription_id);
            initiationFeeSubscription = {
              id: feeSub.id,
              status: feeSub.status,
              currentPeriodEnd: feeSub.current_period_end ? new Date(feeSub.current_period_end * 1000).toISOString() : null,
              amountDue: feeSub.items.data[0]?.price?.unit_amount || null,
            };
          } catch (e) {
            logStep("Could not retrieve initiation fee subscription", { error: String(e) });
          }
        }

        // Check initiation fee status
        if (!memberBilling.annual_fee_paid_at && memberBilling.status !== 'pending_activation') {
          issues.push({ type: 'error', code: 'INITIATION_FEE_UNPAID', message: 'Initiation fee has not been paid' });
        }

        // Get payment method health
        let paymentMethodHealth = {
          hasPaymentMethod: false,
          cardBrand: memberBilling.card_brand || null,
          cardLast4: memberBilling.card_last4 || null,
          cardExpMonth: memberBilling.card_exp_month || null,
          cardExpYear: memberBilling.card_exp_year || null,
          isExpiringSoon: false,
          expirationWarning: null as string | null,
        };

        if (stripeCustomerId) {
          try {
            const paymentMethods = await stripe.paymentMethods.list({
              customer: stripeCustomerId,
              type: 'card',
              limit: 1,
            });

            if (paymentMethods.data.length > 0) {
              const pm = paymentMethods.data[0];
              paymentMethodHealth.hasPaymentMethod = true;
              paymentMethodHealth.cardBrand = pm.card?.brand || null;
              paymentMethodHealth.cardLast4 = pm.card?.last4 || null;
              paymentMethodHealth.cardExpMonth = pm.card?.exp_month || null;
              paymentMethodHealth.cardExpYear = pm.card?.exp_year || null;

              // Check if card is expiring soon (within 60 days)
              if (pm.card?.exp_month && pm.card?.exp_year) {
                const expDate = new Date(pm.card.exp_year, pm.card.exp_month - 1, 28);
                const now = new Date();
                const daysUntilExpiry = Math.floor((expDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
                
                if (daysUntilExpiry < 0) {
                  paymentMethodHealth.isExpiringSoon = true;
                  paymentMethodHealth.expirationWarning = 'Card expired';
                  issues.push({ type: 'error', code: 'CARD_EXPIRED', message: 'Payment method has expired' });
                } else if (daysUntilExpiry < 30) {
                  paymentMethodHealth.isExpiringSoon = true;
                  paymentMethodHealth.expirationWarning = `Expires in ${daysUntilExpiry} days`;
                  issues.push({ type: 'warning', code: 'CARD_EXPIRING_SOON', message: `Card expires in ${daysUntilExpiry} days` });
                } else if (daysUntilExpiry < 60) {
                  paymentMethodHealth.isExpiringSoon = true;
                  paymentMethodHealth.expirationWarning = `Expires in ${daysUntilExpiry} days`;
                }
              }

              // Check for discrepancy between DB and Stripe
              if (memberBilling.card_last4 && pm.card?.last4 !== memberBilling.card_last4) {
                discrepancies.push(`Card in Stripe (${pm.card?.last4}) differs from database (${memberBilling.card_last4})`);
              }
            } else if (memberBilling.card_last4) {
              discrepancies.push('Database shows card on file but none found in Stripe');
            }
          } catch (e) {
            logStep("Could not list payment methods", { error: String(e) });
          }
        }

        if (!paymentMethodHealth.hasPaymentMethod && memberBilling.status === 'active') {
          issues.push({ type: 'error', code: 'NO_PAYMENT_METHOD', message: 'Active member has no payment method on file' });
        }

        // Get recent payment attempts
        const recentPaymentAttempts: Array<{
          id: string;
          date: string;
          amount: number;
          status: 'succeeded' | 'failed' | 'pending';
          description: string | null;
          failureReason: string | null;
        }> = [];

        // From manual_charges table
        const { data: manualCharges } = await supabase
          .from('manual_charges')
          .select('*')
          .eq('member_id', memberId)
          .order('created_at', { ascending: false })
          .limit(10);

        (manualCharges || []).forEach((charge: any) => {
          recentPaymentAttempts.push({
            id: charge.id,
            date: charge.created_at,
            amount: charge.amount,
            status: charge.status as 'succeeded' | 'failed' | 'pending',
            description: charge.description,
            failureReason: null,
          });
        });

        // From payment_attempts table (failed payments from webhook)
        const { data: failedAttempts } = await supabase
          .from('payment_attempts')
          .select('*')
          .eq('member_id', memberId)
          .order('created_at', { ascending: false })
          .limit(5);

        (failedAttempts || []).forEach((attempt: any) => {
          recentPaymentAttempts.push({
            id: attempt.id,
            date: attempt.created_at,
            amount: attempt.amount || 0,
            status: 'failed',
            description: attempt.event_type,
            failureReason: attempt.decline_reason || attempt.failure_code,
          });
        });

        // Sort by date
        recentPaymentAttempts.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

        const billingHealth = {
          stripeCustomerId,
          customerCreatedAt: stripeCustomer?.created ? new Date(stripeCustomer.created * 1000).toISOString() : null,
          duesSubscription,
          initiationFeeSubscription,
          paymentMethodHealth,
          recentPaymentAttempts: recentPaymentAttempts.slice(0, 10),
          issues,
          syncStatus: {
            lastSynced: new Date().toISOString(),
            dbMatchesStripe: discrepancies.length === 0,
            discrepancies,
          },
        };

        logStep("Billing health retrieved", { 
          memberId, 
          issueCount: issues.length,
          discrepancyCount: discrepancies.length 
        });

        return new Response(
          JSON.stringify(billingHealth),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
        );
      }

      case 'sync_member_billing_data': {
        // Sync billing data from Stripe to database
        const { memberId } = body;

        if (!memberId) {
          throw new Error("memberId is required");
        }

        // Verify admin role
        const { data: adminRoleSync } = await supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', user.id)
          .in('role', ['super_admin', 'admin', 'manager']);

        if (!adminRoleSync || adminRoleSync.length === 0) {
          throw new Error("Unauthorized: Admin access required");
        }

        logStep("Syncing billing data for member", { memberId });

        // Get member data
        const { data: memberSync, error: memberSyncError } = await supabase
          .from('members')
          .select('*')
          .eq('id', memberId)
          .single();

        if (memberSyncError || !memberSync) {
          throw new Error("Member not found");
        }

        const updates: Record<string, any> = {};

        // Find or verify Stripe customer
        let stripeCustomerId = memberSync.stripe_customer_id;
        if (!stripeCustomerId && memberSync.email) {
          const searchResult = await stripe.customers.list({ email: memberSync.email, limit: 1 });
          if (searchResult.data.length > 0) {
            stripeCustomerId = searchResult.data[0].id;
            updates.stripe_customer_id = stripeCustomerId;
            logStep("Found and linking Stripe customer", { stripeCustomerId });
          }
        }

        if (!stripeCustomerId) {
          throw new Error("No Stripe customer found for this member");
        }

        // Sync payment method metadata
        const paymentMethods = await stripe.paymentMethods.list({
          customer: stripeCustomerId,
          type: 'card',
          limit: 1,
        });

        if (paymentMethods.data.length > 0) {
          const pm = paymentMethods.data[0];
          updates.card_brand = pm.card?.brand ? 
            pm.card.brand.charAt(0).toUpperCase() + pm.card.brand.slice(1) : null;
          updates.card_last4 = pm.card?.last4 || null;
          updates.card_exp_month = pm.card?.exp_month || null;
          updates.card_exp_year = pm.card?.exp_year || null;
        }

        // Sync subscription status if there's a subscription
        if (memberSync.stripe_subscription_id) {
          try {
            const sub = await stripe.subscriptions.retrieve(memberSync.stripe_subscription_id);

            // Always reflect Stripe's subscription status into the dedicated column
            updates.subscription_status = sub.status;

            // Update member lifecycle status based on subscription — but DO NOT
            // auto-cancel the membership here. Membership "cancelled" is owned
            // by the Application Portal (pending_activation members) or by the
            // separate activated-member cancellation protocol. Stripe sub cancel
            // is a billing issue, not a lifecycle terminal state.
            if (sub.status === 'active' && memberSync.status !== 'active' && memberSync.status !== 'frozen') {
              updates.status = 'active';
            } else if (sub.status === 'past_due' && memberSync.status !== 'past_due') {
              updates.status = 'past_due';
            }
            // sub.status === 'canceled'/'incomplete_expired' intentionally does NOT touch members.status
          } catch (e) {
            logStep("Could not sync subscription status", { error: String(e) });
          }
        }

        // Apply updates
        if (Object.keys(updates).length > 0) {
          const { error: updateError } = await supabase
            .from('members')
            .update(updates)
            .eq('id', memberId);

          if (updateError) {
            throw new Error(`Failed to update member: ${updateError.message}`);
          }

          logStep("Member billing data synced", { memberId, updates });
        } else {
          logStep("No updates needed", { memberId });
        }

        return new Response(
          JSON.stringify({ 
            success: true, 
            updatedFields: Object.keys(updates),
            message: Object.keys(updates).length > 0 
              ? `Updated ${Object.keys(updates).length} fields`
              : 'Already in sync'
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
        );
      }

      // ==================== SYNC MEMBER ARREARS FROM STRIPE ====================
      case 'sync_member_arrears': {
        const { memberId } = body;
        if (!memberId) throw new Error("memberId is required");

        // Verify admin role
        const { data: adminRoleArr } = await supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', user.id)
          .in('role', ['super_admin', 'admin', 'manager']);
        if (!adminRoleArr || adminRoleArr.length === 0) throw new Error("Unauthorized");

        // Get member
        const { data: memberArr, error: memberArrErr } = await supabase
          .from('members')
          .select('id, stripe_customer_id, stripe_subscription_id, annual_fee_subscription_id')
          .eq('id', memberId)
          .single();
        if (memberArrErr || !memberArr) throw new Error("Member not found");
        if (!memberArr.stripe_customer_id) throw new Error("No Stripe customer");

        logStep("Syncing arrears from Stripe invoices", { memberId });

        // Pull all open/uncollectible/void invoices for this customer
        const invoices = await stripe.invoices.list({
          customer: memberArr.stripe_customer_id,
          limit: 50,
          status: 'open',
        });

        // Also get past invoices that might be uncollectible
        const paidInvoices = await stripe.invoices.list({
          customer: memberArr.stripe_customer_id,
          limit: 50,
          status: 'paid',
        });

        const voidInvoices = await stripe.invoices.list({
          customer: memberArr.stripe_customer_id,
          limit: 50,
          status: 'void',
        });

        const uncollectibleInvoices = await stripe.invoices.list({
          customer: memberArr.stripe_customer_id,
          limit: 50,
          status: 'uncollectible',
        });

        const allInvoices = [
          ...invoices.data,
          ...paidInvoices.data,
          ...voidInvoices.data,
          ...uncollectibleInvoices.data,
        ];

        let upserted = 0;
        const annualFeePriceIds = ['price_1SlA2BLyZrsSqLhs8VX17F0C', 'price_1SlA2RLyZrsSqLhsK3XQuANN'];

        for (const inv of allInvoices) {
          if (!inv.subscription) continue; // skip one-time

          const isAnnualFee = inv.lines?.data?.some((line: any) =>
            line.price && annualFeePriceIds.includes(line.price.id)
          ) || false;

          const periodStart = inv.period_start ? new Date(inv.period_start * 1000).toISOString().split('T')[0] : new Date(inv.created * 1000).toISOString().split('T')[0];
          const periodEnd = inv.period_end ? new Date(inv.period_end * 1000).toISOString().split('T')[0] : periodStart;

          let arrStatus = 'unpaid';
          if (inv.status === 'paid') arrStatus = 'paid';
          else if (inv.status === 'void') arrStatus = 'void';
          else if (inv.status === 'uncollectible') arrStatus = 'uncollectible';
          else if (inv.status === 'open' && inv.amount_paid > 0 && inv.amount_paid < inv.amount_due) arrStatus = 'partial';

          const piId = typeof inv.payment_intent === 'string' ? inv.payment_intent : inv.payment_intent?.id || null;

          const { error: uErr } = await supabase
            .from('billing_arrears')
            .upsert({
              member_id: memberArr.id,
              stripe_invoice_id: inv.id,
              billing_type: isAnnualFee ? 'annual_fee' : 'membership_dues',
              period_start: periodStart,
              period_end: periodEnd,
              amount_due_cents: inv.amount_due || 0,
              amount_paid_cents: inv.amount_paid || 0,
              stripe_subscription_id: inv.subscription as string,
              stripe_payment_intent_id: piId,
              status: arrStatus,
              attempt_count: inv.attempt_count || 0,
              paid_at: arrStatus === 'paid' ? new Date((inv.status_transitions?.paid_at || inv.created) * 1000).toISOString() : null,
              failure_message: inv.last_payment_error?.message || null,
              decline_code: inv.last_payment_error?.decline_code || null,
              next_retry_at: inv.next_payment_attempt ? new Date(inv.next_payment_attempt * 1000).toISOString() : null,
              updated_at: new Date().toISOString(),
            }, { onConflict: 'member_id,stripe_invoice_id' });

          if (!uErr) upserted++;
        }

        logStep("Arrears sync complete", { memberId, upserted, totalInvoices: allInvoices.length });

        return new Response(
          JSON.stringify({ success: true, upserted, totalInvoices: allInvoices.length }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
        );
      }

      // ==================== DETECT DUPLICATE CUSTOMERS ====================
      case 'detect_duplicate_customers': {
        // Admin only
        const { data: adminRoleDupe } = await supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', user?.id)
          .in('role', ['super_admin', 'admin', 'manager']);

        if (!adminRoleDupe || adminRoleDupe.length === 0) {
          throw new Error("Unauthorized: Admin access required");
        }

        logStep("Detecting duplicate Stripe customers");

        // Get all members with Stripe customer IDs
        const { data: membersWithCustomers, error: fetchError } = await supabase
          .from('members')
          .select('id, email, first_name, last_name, stripe_customer_id, status')
          .not('stripe_customer_id', 'is', null);

        if (fetchError) throw fetchError;

        interface DuplicateInfo {
          email: string;
          members: Array<{
            member_id: string;
            member_name: string;
            stripe_customer_id: string;
            status: string;
          }>;
          stripe_customers: Array<{
            customer_id: string;
            email: string;
            created: number;
            has_payment_method: boolean;
            has_subscription: boolean;
          }>;
        }

        const duplicates: DuplicateInfo[] = [];
        const processedEmails = new Set<string>();

        // Group members by email (case-insensitive)
        const emailGroups: Record<string, typeof membersWithCustomers> = {};
        for (const member of membersWithCustomers || []) {
          const emailKey = member.email?.toLowerCase();
          if (!emailKey) continue;
          if (!emailGroups[emailKey]) emailGroups[emailKey] = [];
          emailGroups[emailKey].push(member);
        }

        // Check each unique email for duplicates in Stripe
        for (const [email, members] of Object.entries(emailGroups)) {
          if (processedEmails.has(email)) continue;
          processedEmails.add(email);

          try {
            // Search Stripe for all customers with this email
            const stripeCustomers = await stripe.customers.list({
              email: email,
              limit: 10
            });

            if (stripeCustomers.data.length > 1 || members.length > 1) {
              // We have potential duplicates
              const customerDetails = await Promise.all(
                stripeCustomers.data.map(async (customer: Stripe.Customer) => {
                  // Check for payment methods
                  const pms = await stripe.paymentMethods.list({
                    customer: customer.id,
                    type: 'card',
                    limit: 1
                  });

                  // Check for subscriptions
                  const subs = await stripe.subscriptions.list({
                    customer: customer.id,
                    limit: 1
                  });

                  return {
                    customer_id: customer.id,
                    email: customer.email || '',
                    created: customer.created,
                    has_payment_method: pms.data.length > 0,
                    has_subscription: subs.data.length > 0
                  };
                })
              );

              duplicates.push({
                email,
                members: members.map(m => ({
                  member_id: m.id,
                  member_name: `${m.first_name} ${m.last_name}`,
                  stripe_customer_id: m.stripe_customer_id,
                  status: m.status
                })),
                stripe_customers: customerDetails
              });
            }
          } catch (e) {
            logStep("Error checking email", { email, error: String(e) });
          }
        }

        logStep("Duplicate detection complete", { 
          totalEmails: processedEmails.size,
          duplicatesFound: duplicates.length 
        });

        return new Response(
          JSON.stringify({
            success: true,
            duplicates,
            summary: {
              emails_checked: processedEmails.size,
              duplicates_found: duplicates.length
            }
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
        );
      }

      // ==================== CONSOLIDATE CUSTOMER ====================
      case 'consolidate_customer': {
        const { memberId } = body as unknown as { memberId: string };

        // Admin only
        const { data: adminRoleConsolidate } = await supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', user?.id)
          .in('role', ['super_admin', 'admin']);

        if (!adminRoleConsolidate || adminRoleConsolidate.length === 0) {
          throw new Error("Unauthorized: Super Admin or Admin access required");
        }

        if (!memberId) throw new Error("memberId is required");

        logStep("Consolidating customer for member", { memberId });

        // Get member data
        const { data: memberCons, error: memberConsError } = await supabase
          .from('members')
          .select('*')
          .eq('id', memberId)
          .single();

        if (memberConsError || !memberCons) {
          throw new Error("Member not found");
        }

        if (!memberCons.email) {
          throw new Error("Member has no email address");
        }

        // Find all Stripe customers for this email
        const allCustomers = await stripe.customers.list({
          email: memberCons.email.toLowerCase(),
          limit: 10
        });

        if (allCustomers.data.length <= 1) {
          return new Response(
            JSON.stringify({ 
              success: true, 
              message: "No duplicate customers to consolidate",
              customer_id: allCustomers.data[0]?.id || memberCons.stripe_customer_id
            }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
          );
        }

        // Determine primary customer (prefer one with subscription, then one with payment method, then newest)
        let primaryCustomer: Stripe.Customer | null = null;
        let primaryHasSubscription = false;
        let primaryHasPaymentMethod = false;

        for (const customer of allCustomers.data) {
          const subs = await stripe.subscriptions.list({ customer: customer.id, limit: 1 });
          const pms = await stripe.paymentMethods.list({ customer: customer.id, type: 'card', limit: 1 });

          const hasSub = subs.data.length > 0;
          const hasPm = pms.data.length > 0;

          // Priority: has subscription > has payment method > newest
          if (hasSub && !primaryHasSubscription) {
            primaryCustomer = customer;
            primaryHasSubscription = true;
            primaryHasPaymentMethod = hasPm;
          } else if (!primaryHasSubscription && hasPm && !primaryHasPaymentMethod) {
            primaryCustomer = customer;
            primaryHasPaymentMethod = true;
          } else if (!primaryHasSubscription && !primaryHasPaymentMethod && !primaryCustomer) {
            primaryCustomer = customer;
          }
        }

        if (!primaryCustomer) {
          primaryCustomer = allCustomers.data[0];
        }

        // Update member to use primary customer
        const { error: updateConsError } = await supabase
          .from('members')
          .update({ 
            stripe_customer_id: primaryCustomer.id,
            updated_at: new Date().toISOString()
          })
          .eq('id', memberId);

        if (updateConsError) {
          throw new Error(`Failed to update member: ${updateConsError.message}`);
        }

        // Sync card metadata from primary customer
        const primaryPms = await stripe.paymentMethods.list({
          customer: primaryCustomer.id,
          type: 'card',
          limit: 1
        });

        if (primaryPms.data.length > 0) {
          const pm = primaryPms.data[0];
          await supabase
            .from('members')
            .update({
              card_brand: pm.card?.brand,
              card_last4: pm.card?.last4,
              card_exp_month: pm.card?.exp_month,
              card_exp_year: pm.card?.exp_year
            })
            .eq('id', memberId);
        }

        const otherCustomerIds = allCustomers.data
          .filter((c: Stripe.Customer) => c.id !== primaryCustomer!.id)
          .map((c: Stripe.Customer) => c.id);

        logStep("Customer consolidated", { 
          memberId, 
          primaryCustomerId: primaryCustomer.id,
          otherCustomerIds
        });

        return new Response(
          JSON.stringify({
            success: true,
            message: `Consolidated to customer ${primaryCustomer.id}`,
            primary_customer_id: primaryCustomer.id,
            other_customer_ids: otherCustomerIds,
            note: "Other customer IDs were NOT deleted. Review them in Stripe dashboard if needed."
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
        );
      }

      case 'update_annual_fee_billing_date': {
        // Admin action to update the next billing date for an annual fee subscription
        const { subscriptionId, memberId, newBillingDate } = body;

        if (!subscriptionId || !memberId || !newBillingDate) {
          throw new Error("subscriptionId, memberId, and newBillingDate are required");
        }

        // Verify admin role
        const { data: adminCheck } = await supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', user.id)
          .in('role', ['super_admin', 'admin', 'manager']);

        if (!adminCheck || adminCheck.length === 0) {
          throw new Error("Unauthorized: Admin access required");
        }

        logStep("Updating annual fee billing date", { subscriptionId, memberId, newBillingDate });

        // Verify the subscription belongs to this member
        const { data: memberCheck, error: memberCheckError } = await supabase
          .from('members')
          .select('annual_fee_subscription_id')
          .eq('id', memberId)
          .single();

        if (memberCheckError || !memberCheck) {
          throw new Error("Member not found");
        }

        if (memberCheck.annual_fee_subscription_id !== subscriptionId) {
          throw new Error("Subscription does not belong to this member");
        }

        // Get current subscription
        const currentSub = await stripe.subscriptions.retrieve(subscriptionId);
        
        if (currentSub.status === 'canceled') {
          throw new Error("Cannot update a canceled subscription");
        }

        // Calculate new billing anchor timestamp
        const newBillingDateObj = new Date(newBillingDate);
        const newAnchorTimestamp = Math.floor(newBillingDateObj.getTime() / 1000);

        // Update the subscription's billing cycle anchor
        // Note: We use a trial_end to shift the next billing date
        const updatedSub = await stripe.subscriptions.update(subscriptionId, {
          trial_end: newAnchorTimestamp,
          proration_behavior: 'none',
          metadata: {
            ...currentSub.metadata,
            billing_date_updated_at: new Date().toISOString(),
            billing_date_updated_by: user.id,
            previous_period_end: new Date(currentSub.current_period_end * 1000).toISOString(),
          }
        });

        logStep("Annual fee billing date updated", {
          subscriptionId,
          newBillingDate: newBillingDateObj.toISOString(),
          newTrialEnd: newAnchorTimestamp,
          status: updatedSub.status
        });

        return new Response(
          JSON.stringify({
            success: true,
            subscriptionId: updatedSub.id,
            newBillingDate: newBillingDateObj.toISOString(),
            status: updatedSub.status
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
        );
      }

      case 'audit_duplicate_annual_fees': {
        // Admin action to find members with multiple active annual fee subscriptions
        
        // Verify admin role
        const { data: adminCheck } = await supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', user.id)
          .in('role', ['super_admin', 'admin', 'manager']);

        if (!adminCheck || adminCheck.length === 0) {
          throw new Error("Unauthorized: Admin access required");
        }

        logStep("Starting audit for duplicate annual fee subscriptions");

        // Get all members with stripe_customer_id
        const { data: members, error: membersError } = await supabase
          .from('members')
          .select('id, first_name, last_name, email, stripe_customer_id, annual_fee_subscription_id')
          .not('stripe_customer_id', 'is', null);

        if (membersError) {
          throw new Error(`Failed to fetch members: ${membersError.message}`);
        }

        logStep("Fetched members with Stripe customer IDs", { count: members?.length || 0 });

        const annualFeePriceIds = Object.values(STRIPE_PRODUCTS.annualFee);
        const duplicates: Array<{
          member_id: string;
          member_name: string;
          email: string;
          stripe_customer_id: string;
          linked_subscription_id: string | null;
          orphan_subscriptions: Array<{
            id: string;
            created: string;
            status: string;
            last_invoice_amount: number;
          }>;
        }> = [];

        for (const member of members || []) {
          try {
            // Get all active subscriptions for this customer
            const subs = await stripe.subscriptions.list({
              customer: member.stripe_customer_id,
              status: 'active',
              limit: 20,
              expand: ['data.latest_invoice'],
            });

            // Filter to only annual fee subscriptions
            const annualFeeSubs = subs.data.filter((sub: Stripe.Subscription) =>
              sub.items.data.some((item: Stripe.SubscriptionItem) => annualFeePriceIds.includes(item.price.id)) ||
              sub.metadata?.type === 'annual_fee' ||
              sub.metadata?.type === 'initiation_fee'
            );

            // If more than one, we have duplicates
            if (annualFeeSubs.length > 1) {
              const orphans = annualFeeSubs
                .filter((sub: Stripe.Subscription) => sub.id !== member.annual_fee_subscription_id)
                .map((sub: Stripe.Subscription) => {
                  const latestInvoice = sub.latest_invoice as { amount_paid?: number } | null;
                  return {
                    id: sub.id,
                    created: new Date(sub.created * 1000).toISOString(),
                    status: sub.status,
                    last_invoice_amount: latestInvoice?.amount_paid || 0,
                  };
                });

              if (orphans.length > 0) {
                duplicates.push({
                  member_id: member.id,
                  member_name: `${member.first_name} ${member.last_name}`,
                  email: member.email || '',
                  stripe_customer_id: member.stripe_customer_id,
                  linked_subscription_id: member.annual_fee_subscription_id,
                  orphan_subscriptions: orphans,
                });
              }
            }
          } catch (stripeErr) {
            logStep("Error checking member subscriptions", { 
              memberId: member.id, 
              error: stripeErr instanceof Error ? stripeErr.message : String(stripeErr) 
            });
          }
        }

        const totalOrphans = duplicates.reduce((acc, d) => acc + d.orphan_subscriptions.length, 0);
        logStep("Audit complete", { duplicatesFound: duplicates.length, totalOrphans });

        return new Response(
          JSON.stringify({
            duplicates,
            total_orphans: totalOrphans
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
        );
      }

      case 'cancel_orphan_subscription': {
        // Admin action to cancel an orphan subscription (not linked to any member)
        const { subscriptionId, processRefund } = body;

        if (!subscriptionId) {
          throw new Error("subscriptionId is required");
        }

        // Verify admin role
        const { data: adminCheck } = await supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', user.id)
          .in('role', ['super_admin', 'admin', 'manager']);

        if (!adminCheck || adminCheck.length === 0) {
          throw new Error("Unauthorized: Admin access required");
        }

        logStep("Cancel orphan subscription request", { subscriptionId, processRefund });

        // Safety: verify this subscription is NOT linked to any member
        const { data: linkedMember } = await supabase
          .from('members')
          .select('id, first_name, last_name')
          .eq('annual_fee_subscription_id', subscriptionId)
          .maybeSingle();

        if (linkedMember) {
          throw new Error(`Cannot cancel - this subscription is linked to ${linkedMember.first_name} ${linkedMember.last_name}`);
        }

        // Get subscription details before canceling (for refund)
        let refundResult = null;
        if (processRefund) {
          try {
            const sub = await stripe.subscriptions.retrieve(subscriptionId, { 
              expand: ['latest_invoice.payment_intent'] 
            });
            const latestInvoice = sub.latest_invoice as { payment_intent?: { id: string } | string } | null;
            
            let paymentIntentId: string | null = null;
            if (latestInvoice?.payment_intent) {
              if (typeof latestInvoice.payment_intent === 'string') {
                paymentIntentId = latestInvoice.payment_intent;
              } else {
                paymentIntentId = latestInvoice.payment_intent.id;
              }
            }

            if (paymentIntentId) {
              const refund = await stripe.refunds.create({ 
                payment_intent: paymentIntentId,
                reason: 'duplicate',
              });
              refundResult = {
                refund_id: refund.id,
                amount: refund.amount,
                status: refund.status,
              };
              logStep("Refund processed", refundResult);
            } else {
              logStep("No payment intent found for refund");
            }
          } catch (refundErr) {
            logStep("Error processing refund", { 
              error: refundErr instanceof Error ? refundErr.message : String(refundErr) 
            });
          }
        }

        // Cancel the subscription
        await stripe.subscriptions.cancel(subscriptionId);
        logStep("Subscription cancelled", { subscriptionId });

        return new Response(
          JSON.stringify({
            success: true,
            cancelled: subscriptionId,
            refunded: processRefund,
            refund_details: refundResult
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
        );
      }

      case 'retry_subscription_invoice': {
        const { memberId } = body;
        if (!memberId) throw new Error("Missing memberId");

        logStep("Retry subscription invoice", { memberId });

        // Get member's subscription ID
        const { data: memberData, error: memberErr } = await supabase
          .from('members')
          .select('stripe_subscription_id, stripe_customer_id, first_name, last_name')
          .eq('id', memberId)
          .single();

        if (memberErr || !memberData) throw new Error("Member not found");
        if (!memberData.stripe_subscription_id) throw new Error("No subscription found for this member");

        // Find the latest open/unpaid invoice for this subscription
        const invoices = await stripe.invoices.list({
          subscription: memberData.stripe_subscription_id,
          status: 'open',
          limit: 1,
        });

        if (invoices.data.length === 0) {
          // Try draft invoices too
          const draftInvoices = await stripe.invoices.list({
            subscription: memberData.stripe_subscription_id,
            status: 'draft',
            limit: 1,
          });
          
          if (draftInvoices.data.length > 0) {
            // Finalize then pay
            const finalized = await stripe.invoices.finalizeInvoice(draftInvoices.data[0].id);
            const paid = await stripe.invoices.pay(finalized.id);
            logStep("Draft invoice finalized and paid", { invoiceId: paid.id, status: paid.status });
            
            if (paid.status === 'paid') {
              await supabase.from('members').update({ subscription_status: 'active' }).eq('id', memberId);
            }
            
            return new Response(
              JSON.stringify({ success: true, invoiceId: paid.id, status: paid.status, amount: paid.amount_paid }),
              { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
            );
          }
          
          throw new Error("No open or draft invoices found for this subscription");
        }

        const invoice = invoices.data[0];
        logStep("Found open invoice", { invoiceId: invoice.id, amount: invoice.amount_due });

        // Retry payment
        const paidInvoice = await stripe.invoices.pay(invoice.id);
        logStep("Invoice payment result", { invoiceId: paidInvoice.id, status: paidInvoice.status });

        // Update member subscription_status if payment succeeded
        if (paidInvoice.status === 'paid') {
          await supabase.from('members').update({ subscription_status: 'active' }).eq('id', memberId);
        }

        return new Response(
          JSON.stringify({ 
            success: true, 
            invoiceId: paidInvoice.id, 
            status: paidInvoice.status,
            amount: paidInvoice.amount_paid,
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
        );
      }

      case 'sync_member_subscription_status': {
        const { memberId } = body;
        if (!memberId) throw new Error("Missing memberId");

        logStep("Sync member subscription status", { memberId });

        const { data: memberData, error: memberErr } = await supabase
          .from('members')
          .select('stripe_subscription_id, stripe_customer_id, subscription_status')
          .eq('id', memberId)
          .single();

        if (memberErr || !memberData) throw new Error("Member not found");
        if (!memberData.stripe_subscription_id) {
          return new Response(
            JSON.stringify({ success: true, status: 'no_subscription', synced: false }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
          );
        }

        // Get subscription from Stripe
        const subscription = await stripe.subscriptions.retrieve(memberData.stripe_subscription_id);
        const stripeStatus = subscription.status;
        logStep("Stripe subscription status", { stripeStatus, dbStatus: memberData.subscription_status });

        // Update member record if different
        if (stripeStatus !== memberData.subscription_status) {
          await supabase.from('members').update({ subscription_status: stripeStatus }).eq('id', memberId);
          logStep("Updated subscription_status", { from: memberData.subscription_status, to: stripeStatus });
        }

        // Get latest invoice for failure details
        let failureDetails = null;
        if (['incomplete', 'past_due', 'unpaid'].includes(stripeStatus)) {
          const latestInvoice = await stripe.invoices.list({
            subscription: memberData.stripe_subscription_id,
            limit: 1,
          });
          if (latestInvoice.data.length > 0) {
            const inv = latestInvoice.data[0];
            failureDetails = {
              invoiceId: inv.id,
              amount: inv.amount_due,
              status: inv.status,
              attemptCount: inv.attempt_count,
              nextAttempt: inv.next_payment_attempt,
            };
          }
        }

        return new Response(
          JSON.stringify({ 
            success: true, 
            previousStatus: memberData.subscription_status,
            currentStatus: stripeStatus,
            synced: stripeStatus !== memberData.subscription_status,
            failureDetails,
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
        );
      }

      case 'deactivate_member': {
        const { memberId, detachPaymentMethods = true } = body;
        if (!memberId) throw new Error("Missing memberId");

        logStep("Deactivate member", { memberId, detachPaymentMethods });

        const { data: memberData, error: memberErr } = await supabase
          .from('members')
          .select('stripe_subscription_id, stripe_customer_id, annual_fee_subscription_id, first_name, last_name, status, email')
          .eq('id', memberId)
          .single();

        if (memberErr || !memberData) throw new Error("Member not found");

        const cancelledSubs: string[] = [];
        const voidedInvoices: string[] = [];
        const detachedPMs: string[] = [];

        // Cancel the known dues subscription
        if (memberData.stripe_subscription_id) {
          try {
            await stripe.subscriptions.cancel(memberData.stripe_subscription_id);
            cancelledSubs.push(memberData.stripe_subscription_id);
            logStep("Cancelled dues subscription", { subscriptionId: memberData.stripe_subscription_id });
          } catch (cancelErr) {
            logStep("Warning: Failed to cancel dues subscription", { error: String(cancelErr) });
          }
        }

        // Cancel the known annual fee subscription
        if (memberData.annual_fee_subscription_id) {
          try {
            await stripe.subscriptions.cancel(memberData.annual_fee_subscription_id);
            cancelledSubs.push(memberData.annual_fee_subscription_id);
            logStep("Cancelled annual fee subscription", { subscriptionId: memberData.annual_fee_subscription_id });
          } catch (cancelErr) {
            logStep("Warning: Failed to cancel annual fee subscription", { error: String(cancelErr) });
          }
        }

        // CRITICAL: Also cancel ALL remaining active/past_due subscriptions on the Stripe customer
        // This catches orphaned subscriptions not tracked in our DB
        const customerId = memberData.stripe_customer_id;
        if (customerId) {
          try {
            const activeStripeSubs = await stripe.subscriptions.list({
              customer: customerId,
              status: 'active',
              limit: 100,
            });
            const pastDueStripeSubs = await stripe.subscriptions.list({
              customer: customerId,
              status: 'past_due',
              limit: 100,
            });
            const allRemainingSubs = [...activeStripeSubs.data, ...pastDueStripeSubs.data]
              .filter(s => !cancelledSubs.includes(s.id));

            for (const sub of allRemainingSubs) {
              try {
                await stripe.subscriptions.cancel(sub.id);
                cancelledSubs.push(sub.id);
                logStep("Cancelled orphaned subscription", { subscriptionId: sub.id, status: sub.status });
              } catch (orphanErr) {
                logStep("Warning: Failed to cancel orphaned subscription", { subscriptionId: sub.id, error: String(orphanErr) });
              }
            }

            if (allRemainingSubs.length > 0) {
              logStep("Cancelled orphaned subscriptions", { count: allRemainingSubs.length });
            }
          } catch (listErr) {
            logStep("Warning: Failed to list Stripe subscriptions for cleanup", { error: String(listErr) });
          }

          // NEW: Void/delete open + draft subscription invoices so Stripe stops retrying
          try {
            const openInvoices = await stripe.invoices.list({ customer: customerId, status: 'open', limit: 100 });
            const draftInvoices = await stripe.invoices.list({ customer: customerId, status: 'draft', limit: 100 });
            const candidateInvoices = [...openInvoices.data, ...draftInvoices.data].filter((inv: any) => {
              const reason = inv.billing_reason as string | undefined;
              return !!inv.subscription || reason === 'subscription_cycle' || reason === 'subscription_create' || reason === 'subscription_update' || reason === 'subscription';
            });

            for (const inv of candidateInvoices) {
              try {
                if (inv.status === 'draft') {
                  await stripe.invoices.del(inv.id);
                } else {
                  await stripe.invoices.voidInvoice(inv.id);
                }
                voidedInvoices.push(inv.id);
                logStep("Voided/deleted invoice on cancellation", { invoiceId: inv.id, status: inv.status, billingReason: inv.billing_reason });

                const { error: arrErr } = await supabase
                  .from('billing_arrears')
                  .update({
                    status: 'voided',
                    paid_at: new Date().toISOString(),
                    failure_message: 'membership_cancelled',
                    updated_at: new Date().toISOString(),
                  })
                  .eq('member_id', memberId)
                  .eq('stripe_invoice_id', inv.id);
                if (arrErr) logStep("Warning: failed to mark arrears voided", { invoiceId: inv.id, error: arrErr.message });
              } catch (voidErr) {
                logStep("Warning: failed to void/delete invoice", { invoiceId: inv.id, error: String(voidErr) });
              }
            }
          } catch (invListErr) {
            logStep("Warning: failed to list invoices for cleanup", { error: String(invListErr) });
          }

          // NEW: Detach saved payment methods so nothing can be charged later by accident
          if (detachPaymentMethods) {
            try {
              const pms = await stripe.paymentMethods.list({ customer: customerId, type: 'card', limit: 100 });
              for (const pm of pms.data) {
                try {
                  await stripe.paymentMethods.detach(pm.id);
                  detachedPMs.push(pm.id);
                  logStep("Detached payment method", { paymentMethodId: pm.id });
                } catch (pmErr) {
                  logStep("Warning: failed to detach payment method", { paymentMethodId: pm.id, error: String(pmErr) });
                }
              }
            } catch (pmListErr) {
              logStep("Warning: failed to list payment methods", { error: String(pmListErr) });
            }
          }
        }

        // Update member status
        await supabase.from('members').update({ 
          status: 'suspended',
          subscription_status: 'canceled',
          stripe_subscription_id: null,
          annual_fee_subscription_id: null,
        }).eq('id', memberId);

        try {
          await supabase.from('audit_logs').insert({
            actor_id: user.id,
            action: 'member_deactivated_with_billing_cleanup',
            entity_type: 'member',
            entity_id: memberId,
            metadata: {
              cancelled_subscriptions: cancelledSubs,
              voided_invoices: voidedInvoices,
              detached_payment_methods: detachedPMs,
              member_email: memberData.email,
            },
          });
        } catch (auditErr) {
          logStep("Warning: failed to write audit log", { error: String(auditErr) });
        }

        logStep("Member deactivated", { memberId, name: `${memberData.first_name} ${memberData.last_name}`, totalCancelled: cancelledSubs.length, totalVoided: voidedInvoices.length, totalDetached: detachedPMs.length });

        return new Response(
          JSON.stringify({ success: true, memberId, cancelledSubscriptions: cancelledSubs, voidedInvoices, detachedPaymentMethods: detachedPMs }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
        );
      }

      case 'cleanup_cancelled_member_billing': {
        // One-shot cleanup for already-cancelled members with orphan invoices/PMs
        const { memberId, detachPaymentMethods = true } = body;
        if (!memberId) throw new Error("Missing memberId");

        const { data: adminRoles } = await supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', user.id);
        const isAdmin = adminRoles?.some(r => ['admin', 'super_admin'].includes(r.role));
        if (!isAdmin) throw new Error("Admin access required");

        const { data: memberData, error: memberErr } = await supabase
          .from('members')
          .select('stripe_customer_id, first_name, last_name, email')
          .eq('id', memberId)
          .single();
        if (memberErr || !memberData?.stripe_customer_id) throw new Error("Member or Stripe customer not found");

        const customerId = memberData.stripe_customer_id;
        const voidedInvoices: string[] = [];
        const detachedPMs: string[] = [];

        const openInvoices = await stripe.invoices.list({ customer: customerId, status: 'open', limit: 100 });
        const draftInvoices = await stripe.invoices.list({ customer: customerId, status: 'draft', limit: 100 });
        const candidateInvoices = [...openInvoices.data, ...draftInvoices.data];

        for (const inv of candidateInvoices) {
          try {
            if (inv.status === 'draft') {
              await stripe.invoices.del(inv.id);
            } else {
              await stripe.invoices.voidInvoice(inv.id);
            }
            voidedInvoices.push(inv.id);

            await supabase
              .from('billing_arrears')
              .update({
                status: 'voided',
                paid_at: new Date().toISOString(),
                failure_message: 'membership_cancelled_post_invoice',
                updated_at: new Date().toISOString(),
              })
              .eq('member_id', memberId)
              .eq('stripe_invoice_id', inv.id);
          } catch (voidErr) {
            logStep("Warning: failed to void invoice during cleanup", { invoiceId: inv.id, error: String(voidErr) });
          }
        }

        if (detachPaymentMethods) {
          const pms = await stripe.paymentMethods.list({ customer: customerId, type: 'card', limit: 100 });
          for (const pm of pms.data) {
            try {
              await stripe.paymentMethods.detach(pm.id);
              detachedPMs.push(pm.id);
            } catch (pmErr) {
              logStep("Warning: failed to detach payment method during cleanup", { paymentMethodId: pm.id, error: String(pmErr) });
            }
          }
        }

        try {
          await supabase.from('audit_logs').insert({
            actor_id: user.id,
            action: 'cancelled_member_billing_cleanup',
            entity_type: 'member',
            entity_id: memberId,
            metadata: {
              voided_invoices: voidedInvoices,
              detached_payment_methods: detachedPMs,
              member_email: memberData.email,
            },
          });
        } catch (auditErr) {
          logStep("Warning: failed to write audit log", { error: String(auditErr) });
        }

        return new Response(
          JSON.stringify({ success: true, memberId, voidedInvoices, detachedPaymentMethods: detachedPMs }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
        );
      }

      case 'create_guest_payment_link': {
        const { guestEmail, guestName, amount: guestAmount, description: guestDesc, serviceId, successUrl: guestSuccessUrl, cancelUrl: guestCancelUrl } = body;

        if (!guestEmail || !guestName || !guestAmount) {
          throw new Error("Missing required fields: guestEmail, guestName, amount");
        }

        logStep("Creating guest payment link", { guestEmail, guestName, amount: guestAmount });

        // Find or create Stripe customer
        const guestCustomers = await stripe.customers.list({ email: guestEmail, limit: 1 });
        let guestCustomerId: string;
        if (guestCustomers.data.length > 0) {
          guestCustomerId = guestCustomers.data[0].id;
          logStep("Found existing guest customer", { guestCustomerId });
        } else {
          const guestCustomer = await stripe.customers.create({
            email: guestEmail,
            name: guestName,
            metadata: { source: 'guest_service' },
          });
          guestCustomerId = guestCustomer.id;
          logStep("Created new guest customer", { guestCustomerId });
        }

        // Save stripe_customer_id to guest_passes
        await supabase
          .from('guest_passes')
          .update({ stripe_customer_id: guestCustomerId })
          .ilike('guest_email', guestEmail);

        // Create checkout session in payment mode with card saved for future use
        const guestSession = await stripe.checkout.sessions.create({
          customer: guestCustomerId,
          mode: 'payment',
          payment_intent_data: {
            setup_future_usage: 'off_session',
          },
          line_items: [{
            price_data: {
              currency: 'usd',
              unit_amount: guestAmount,
              product_data: {
                name: guestDesc || 'Guest Service',
                description: `Service for ${guestName}`,
              },
            },
            quantity: 1,
          }],
          metadata: {
            type: 'guest_service_payment',
            service_id: serviceId || '',
            guest_name: guestName,
            guest_email: guestEmail,
          },
          success_url: guestSuccessUrl || `${req.headers.get('origin') || ''}/admin/guests?payment=success`,
          cancel_url: guestCancelUrl || `${req.headers.get('origin') || ''}/admin/guests?payment=cancelled`,
        });

        logStep("Guest payment link created", { sessionId: guestSession.id, url: guestSession.url });

        return new Response(
          JSON.stringify({ url: guestSession.url, sessionId: guestSession.id, customerId: guestCustomerId }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
        );
      }

      case 'create_guest_setup_intent': {
        const { guestEmail: setupEmail, guestName: setupName } = body;

        if (!setupEmail || !setupName) {
          throw new Error("Missing required fields: guestEmail, guestName");
        }

        logStep("Creating guest setup intent (card on file)", { setupEmail, setupName });

        // Find or create Stripe customer
        const setupCustomers = await stripe.customers.list({ email: setupEmail, limit: 1 });
        let setupCustomerId: string;
        if (setupCustomers.data.length > 0) {
          setupCustomerId = setupCustomers.data[0].id;
        } else {
          const setupCustomer = await stripe.customers.create({
            email: setupEmail,
            name: setupName,
            metadata: { source: 'guest_card_on_file' },
          });
          setupCustomerId = setupCustomer.id;
        }

        // Save stripe_customer_id to guest_passes
        await supabase
          .from('guest_passes')
          .update({ stripe_customer_id: setupCustomerId })
          .ilike('guest_email', setupEmail);

        // Create checkout session in setup mode (no charge, just save card)
        const setupSession = await stripe.checkout.sessions.create({
          customer: setupCustomerId,
          mode: 'setup',
          metadata: {
            type: 'guest_card_setup',
            guest_name: setupName,
            guest_email: setupEmail,
          },
          success_url: `${req.headers.get('origin') || ''}/admin/guests?card_saved=success`,
          cancel_url: `${req.headers.get('origin') || ''}/admin/guests?card_saved=cancelled`,
        });

        logStep("Guest setup session created", { sessionId: setupSession.id, url: setupSession.url });

        return new Response(
          JSON.stringify({ url: setupSession.url, sessionId: setupSession.id, customerId: setupCustomerId }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
        );
      }

      // =============================================
      // NON-MEMBER PORTAL ACTIONS
      // =============================================

      case 'create_nonmember_setup_intent': {
        logStep("Creating non-member SetupIntent", { userId: user.id });

        const nmCustomerId = await getOrCreateCustomer();

        // Save stripe_customer_id to non_member_profiles
        const { error: nmUpdateErr } = await supabase
          .from('non_member_profiles')
          .update({ stripe_customer_id: nmCustomerId })
          .eq('user_id', user.id);

        if (nmUpdateErr) {
          // Try upsert if no row exists yet
          await supabase.from('non_member_profiles').upsert({
            user_id: user.id,
            email: user.email,
            stripe_customer_id: nmCustomerId,
          }, { onConflict: 'user_id' });
        }

        const nmSetupIntent = await stripe.setupIntents.create({
          customer: nmCustomerId,
          payment_method_types: ['card'],
          metadata: { user_id: user.id, source: 'nonmember_portal' },
        });

        // Audit log
        try {
          await supabase.from('card_setup_attempts').insert({
            member_id: null,
            stripe_customer_id: nmCustomerId,
            stripe_setup_intent: nmSetupIntent.id,
            source: 'nonmember_portal',
            status: 'initiated',
            metadata: { user_id: user.id },
          });
        } catch (auditErr) {
          logStep("Warning: Failed to log non-member card setup attempt", { error: String(auditErr) });
        }

        return new Response(
          JSON.stringify({
            clientSecret: nmSetupIntent.client_secret,
            customerId: nmCustomerId,
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
        );
      }

      case 'sync_nonmember_card_metadata': {
        logStep("Syncing non-member card metadata", { userId: user.id });

        const { data: nmProfile } = await supabase
          .from('non_member_profiles')
          .select('stripe_customer_id')
          .eq('user_id', user.id)
          .maybeSingle();

        const nmCustId = nmProfile?.stripe_customer_id || body.stripeCustomerId;
        if (!nmCustId) {
          return new Response(
            JSON.stringify({ success: false, message: "No Stripe customer ID on file" }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
          );
        }

        // Get default payment method
        const nmCustomer = await stripe.customers.retrieve(nmCustId);
        const nmDefaultPmId = !nmCustomer.deleted
          ? nmCustomer.invoice_settings?.default_payment_method as string | null
          : null;

        const nmPaymentMethods = await stripe.paymentMethods.list({
          customer: nmCustId,
          type: 'card',
          limit: 10,
        });

        if (nmPaymentMethods.data.length === 0) {
          return new Response(
            JSON.stringify({ success: false, message: "No payment methods on file" }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
          );
        }

        let nmCardToSync = nmPaymentMethods.data.find((pm: { id: string }) => pm.id === nmDefaultPmId);
        if (!nmCardToSync) nmCardToSync = nmPaymentMethods.data[0];

        // Set as customer default
        if (!nmCustomer.deleted) {
          await stripe.customers.update(nmCustId, {
            invoice_settings: { default_payment_method: nmCardToSync.id },
          });
        }

        const nmCardDetails = {
          card_brand: nmCardToSync.card?.brand || null,
          card_last4: nmCardToSync.card?.last4 || null,
          card_exp_month: nmCardToSync.card?.exp_month || null,
          card_exp_year: nmCardToSync.card?.exp_year || null,
          stripe_customer_id: nmCustId,
        };

        const { error: nmSyncErr } = await supabase
          .from('non_member_profiles')
          .update(nmCardDetails)
          .eq('user_id', user.id);

        if (nmSyncErr) {
          throw new Error("Failed to update non-member card metadata");
        }

        logStep("Non-member card metadata synced", {
          userId: user.id,
          cardBrand: nmCardDetails.card_brand,
          cardLast4: nmCardDetails.card_last4,
        });

        return new Response(
          JSON.stringify({ success: true, ...nmCardDetails }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
        );
      }

      case 'charge_nonmember_saved_card': {
        const {
          amount: nmAmount,
          description: nmDesc,
          paymentMethodId: nmPmId,
          processingFee: nmFee,
          taxAmount: nmTax,
          subtotal: nmSub,
          chargeType: nmChargeType,
        } = body;

        if (!nmAmount || !nmDesc) {
          throw new Error("Amount and description are required");
        }
        if (nmAmount < 50) {
          throw new Error("Minimum charge amount is $0.50");
        }

        const { data: nmProfileForCharge } = await supabase
          .from('non_member_profiles')
          .select('stripe_customer_id, first_name, last_name')
          .eq('user_id', user.id)
          .maybeSingle();

        if (!nmProfileForCharge?.stripe_customer_id) {
          throw new Error("No payment method on file. Please add a card first.");
        }

        const nmCustomerId = nmProfileForCharge.stripe_customer_id;
        const nmCustomerName = `${nmProfileForCharge.first_name || ''} ${nmProfileForCharge.last_name || ''}`.trim() || (user.email || 'Non-member');

        // Determine payment method: prefer caller-provided, else first card on customer
        let nmPaymentMethodId = nmPmId as string | undefined;
        if (!nmPaymentMethodId) {
          const nmPms = await stripe.paymentMethods.list({
            customer: nmCustomerId,
            type: 'card',
            limit: 1,
          });
          if (nmPms.data.length === 0) {
            throw new Error("No payment method on file. Please add a card first.");
          }
          nmPaymentMethodId = nmPms.data[0].id;
        }

        // For POS charges, the frontend has already grossed-up the fee into amount.
        const nmIsPos = nmChargeType === 'pos';
        const nmProcessingFeeCents = nmIsPos
          ? (nmFee || 0)
          : calculateProcessingFee(nmAmount);
        const nmTotal = nmIsPos ? nmAmount : nmAmount + nmProcessingFeeCents;

        try {
          const nmPaymentIntent = await stripe.paymentIntents.create({
            amount: nmTotal,
            currency: 'usd',
            customer: nmCustomerId,
            payment_method: nmPaymentMethodId,
            off_session: true,
            confirm: true,
            description: nmDesc,
            metadata: {
              type: nmIsPos ? 'pos' : 'nonmember_charge',
              user_id: user.id,
              customer_name: nmCustomerName,
              base_amount: nmIsPos ? String(nmAmount - nmProcessingFeeCents) : String(nmAmount),
              processing_fee: String(nmProcessingFeeCents),
              ...(nmTax ? { tax_amount: String(nmTax) } : {}),
              ...(nmSub ? { subtotal: String(nmSub) } : {}),
            },
          });

          logStep("Non-member POS payment intent created", {
            paymentIntentId: nmPaymentIntent.id,
            status: nmPaymentIntent.status,
            userId: user.id,
          });

          return new Response(
            JSON.stringify({
              success: nmPaymentIntent.status === 'succeeded',
              paymentIntentId: nmPaymentIntent.id,
              status: nmPaymentIntent.status,
            }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
          );
        } catch (chargeErr: any) {
          logStep("Non-member charge failed", { error: chargeErr.message });
          return new Response(
            JSON.stringify({
              success: false,
              error: chargeErr.message || 'Card was declined',
            }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
          );
        }
      }

      case 'list_nonmember_payment_methods': {
        logStep("Listing non-member payment methods", { userId: user.id });

        const { data: nmProf } = await supabase
          .from('non_member_profiles')
          .select('stripe_customer_id')
          .eq('user_id', user.id)
          .maybeSingle();

        if (!nmProf?.stripe_customer_id) {
          return new Response(
            JSON.stringify({ paymentMethods: [], hasPaymentMethod: false }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
          );
        }

        const nmCust = await stripe.customers.retrieve(nmProf.stripe_customer_id);
        const nmDefPm = !nmCust.deleted
          ? nmCust.invoice_settings?.default_payment_method as string | null
          : null;

        const nmPms = await stripe.paymentMethods.list({
          customer: nmProf.stripe_customer_id,
          type: 'card',
        });

        const nmFormatted = nmPms.data.map((pm: any) => ({
          id: pm.id,
          brand: pm.card?.brand || 'unknown',
          last4: pm.card?.last4 || '****',
          expMonth: pm.card?.exp_month,
          expYear: pm.card?.exp_year,
          isDefault: pm.id === nmDefPm,
          nickname: pm.metadata?.nickname || null,
        }));

        return new Response(
          JSON.stringify({ paymentMethods: nmFormatted, hasPaymentMethod: nmFormatted.length > 0 }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
        );
      }

      case 'create_recovery_checkout': {
        const { serviceName, embedded } = body;
        logStep("Creating recovery checkout", { userId: user.id, serviceName, embedded });

        if (!serviceName) {
          throw new Error("Service name is required");
        }

        // Map service to price ID
        const recoveryPriceMap: Record<string, string> = {
          'rlt20': STRIPE_PRODUCTS.guestAddons.rlt20,
          'cryo': STRIPE_PRODUCTS.guestAddons.cryo,
        };

        const recoveryPriceId = recoveryPriceMap[serviceName];
        if (!recoveryPriceId) {
          throw new Error(`Unknown recovery service: ${serviceName}`);
        }

        const recoveryCustomerId = await getOrCreateCustomer();

        // Save stripe_customer_id to non_member_profiles
        await supabase.from('non_member_profiles').upsert({
          user_id: user.id,
          email: user.email,
          stripe_customer_id: recoveryCustomerId,
        }, { onConflict: 'user_id' });

        // Add processing fee
        const recoveryPrice = await stripe.prices.retrieve(recoveryPriceId);
        const recoveryFeeItem = await createProcessingFeeLineItem(stripe, recoveryPrice.unit_amount || 0);
        const recoveryLineItems: { price: string; quantity: number }[] = [{ price: recoveryPriceId, quantity: 1 }];
        if (recoveryFeeItem) recoveryLineItems.push(recoveryFeeItem);

        if (embedded) {
          // Embedded checkout mode - returns client_secret instead of URL
          const embeddedSession = await stripe.checkout.sessions.create({
            customer: recoveryCustomerId,
            line_items: recoveryLineItems,
            mode: 'payment',
            ui_mode: 'embedded',
            return_url: `${req.headers.get('origin') || ''}/portal/wellness?session_id={CHECKOUT_SESSION_ID}`,
          });

          logStep("Embedded recovery checkout session created", { sessionId: embeddedSession.id });

          return new Response(
            JSON.stringify({ clientSecret: embeddedSession.client_secret }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
          );
        }

        const recoverySession = await stripe.checkout.sessions.create({
          customer: recoveryCustomerId,
          line_items: recoveryLineItems,
          mode: 'payment',
          success_url: `${req.headers.get('origin') || ''}/portal?recovery=success`,
          cancel_url: `${req.headers.get('origin') || ''}/portal/wellness?recovery=cancelled`,
        });

        logStep("Recovery checkout session created", { sessionId: recoverySession.id });

        return new Response(
          JSON.stringify({ url: recoverySession.url }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
        );
      }

      case 'create_wellness_credit_checkout': {
        const { creditType, quantity } = body;
        logStep("Creating wellness credit checkout", { userId: user.id, creditType, quantity });

        if (!creditType || !quantity) {
          throw new Error("creditType and quantity are required");
        }

        // Map credit type to price IDs for wellness packs
        const wellnessPriceMap: Record<string, string> = {
          'red_light_4': STRIPE_PRODUCTS.guestAddons.rlt20,   // Red Light single session price x4
          'dry_cryo_4': STRIPE_PRODUCTS.guestAddons.cryo,     // Dry Cryo single session price x4
        };

        // Use single session price * quantity
        const singlePriceId = creditType === 'red_light' 
          ? STRIPE_PRODUCTS.guestAddons.rlt20 
          : STRIPE_PRODUCTS.guestAddons.cryo;

        const wellnessCustomerId = await getOrCreateCustomer();

        // Save stripe_customer_id to non_member_profiles
        await supabase.from('non_member_profiles').upsert({
          user_id: user.id,
          email: user.email,
          stripe_customer_id: wellnessCustomerId,
        }, { onConflict: 'user_id' });

        const wellnessPrice = await stripe.prices.retrieve(singlePriceId);
        const totalAmount = (wellnessPrice.unit_amount || 0) * quantity;
        const wellnessFeeItem = await createProcessingFeeLineItem(stripe, totalAmount);
        const wellnessLineItems: { price: string; quantity: number }[] = [{ price: singlePriceId, quantity }];
        if (wellnessFeeItem) wellnessLineItems.push(wellnessFeeItem);

        const wellnessSession = await stripe.checkout.sessions.create({
          customer: wellnessCustomerId,
          line_items: wellnessLineItems,
          mode: 'payment',
          ui_mode: 'embedded',
          return_url: `${req.headers.get('origin') || ''}/portal/wellness?session_id={CHECKOUT_SESSION_ID}`,
          metadata: {
            type: 'wellness_credit_purchase',
            credit_type: creditType,
            quantity: quantity.toString(),
            user_id: user.id,
          },
        });

        logStep("Wellness credit checkout session created", { sessionId: wellnessSession.id });

        return new Response(
          JSON.stringify({ clientSecret: wellnessSession.client_secret }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
        );
      }

      case 'admin_refresh_nonmember_card': {
        logStep("Admin refreshing non-member card", { userId: body.userId });

        // Verify admin role
        const { data: adminRefreshRoles } = await supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', user.id);
        const adminRefreshRoleNames = (adminRefreshRoles || []).map((r: any) => r.role);
        if (!['super_admin', 'admin', 'manager', 'front_desk'].some(r => adminRefreshRoleNames.includes(r))) {
          throw new Error('Unauthorized: admin role required');
        }

        const targetUserId = body.userId;
        if (!targetUserId) throw new Error('userId is required');

        // Get non-member profile to find email
        const { data: nmProfile } = await supabase
          .from('non_member_profiles')
          .select('email, stripe_customer_id')
          .eq('user_id', targetUserId)
          .maybeSingle();

        if (!nmProfile?.email) throw new Error('Non-member profile not found');

        let nmCustomerId = nmProfile.stripe_customer_id;
        if (!nmCustomerId) {
          // Try to find by email in Stripe
          const nmCustomers = await stripe.customers.list({ email: nmProfile.email, limit: 1 });
          if (nmCustomers.data.length === 0) throw new Error('No Stripe customer found for this email');
          nmCustomerId = nmCustomers.data[0].id;
        }

        // Get default payment method
        const nmCustomer = await stripe.customers.retrieve(nmCustomerId);
        if (nmCustomer.deleted) throw new Error('Stripe customer has been deleted');

        const nmDefaultPmId = nmCustomer.invoice_settings?.default_payment_method as string | null;
        let cardUpdate: Record<string, any> = { stripe_customer_id: nmCustomerId };

        if (nmDefaultPmId) {
          const nmPm = await stripe.paymentMethods.retrieve(nmDefaultPmId);
          cardUpdate.card_brand = nmPm.card?.brand || null;
          cardUpdate.card_last4 = nmPm.card?.last4 || null;
          cardUpdate.card_exp_month = nmPm.card?.exp_month || null;
          cardUpdate.card_exp_year = nmPm.card?.exp_year || null;
        } else {
          // Try listing payment methods
          const nmPms = await stripe.paymentMethods.list({ customer: nmCustomerId, type: 'card', limit: 1 });
          if (nmPms.data.length > 0) {
            const firstPm = nmPms.data[0];
            cardUpdate.card_brand = firstPm.card?.brand || null;
            cardUpdate.card_last4 = firstPm.card?.last4 || null;
            cardUpdate.card_exp_month = firstPm.card?.exp_month || null;
            cardUpdate.card_exp_year = firstPm.card?.exp_year || null;
          }
        }

        await supabase.from('non_member_profiles').update(cardUpdate).eq('user_id', targetUserId);

        return new Response(
          JSON.stringify({ success: true, ...cardUpdate }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
        );
      }

      case 'admin_import_stripe_class_passes': {
        logStep("Admin importing Stripe class passes", { priceId: (body as any).priceId, confirm: (body as any).confirm });

        // Verify admin role
        const { data: adminImportRoles } = await supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', user.id);
        const adminImportRoleNames = (adminImportRoles || []).map((r: any) => r.role);
        if (!['super_admin', 'admin', 'manager'].some(r => adminImportRoleNames.includes(r))) {
          throw new Error('Unauthorized: admin role required');
        }

        const importPriceId = (body as any).priceId;
        const confirmImport = (body as any).confirm === true;
        const selectedSessionIds: string[] = (body as any).sessionIds || [];

        if (!importPriceId) throw new Error('priceId is required');

        // Determine category and pass type from price ID
        let importCategory = 'other';
        let importPassType = 'single';
        let importClassCount = 1;
        
        const pcSingle = [STRIPE_PRODUCTS.classPasses.pilatesCycling.single.member, STRIPE_PRODUCTS.classPasses.pilatesCycling.single.nonMember];
        const pcTen = [STRIPE_PRODUCTS.classPasses.pilatesCycling.tenPack.member, STRIPE_PRODUCTS.classPasses.pilatesCycling.tenPack.nonMember];
        const otSingle = [STRIPE_PRODUCTS.classPasses.otherClasses.single.member, STRIPE_PRODUCTS.classPasses.otherClasses.single.nonMember];
        const otTen = [STRIPE_PRODUCTS.classPasses.otherClasses.tenPack.member, STRIPE_PRODUCTS.classPasses.otherClasses.tenPack.nonMember];

        if (pcSingle.includes(importPriceId)) { importCategory = 'pilates_cycling'; importPassType = 'single'; importClassCount = 1; }
        else if (pcTen.includes(importPriceId)) { importCategory = 'pilates_cycling'; importPassType = '10-pack'; importClassCount = 10; }
        else if (otSingle.includes(importPriceId)) { importCategory = 'other'; importPassType = 'single'; importClassCount = 1; }
        else if (otTen.includes(importPriceId)) { importCategory = 'other'; importPassType = '10-pack'; importClassCount = 10; }

        // Fetch completed checkout sessions from Stripe with this price
        const checkoutSessions = await stripe.checkout.sessions.list({
          limit: 100,
          status: 'complete',
        });

        // Filter to sessions that contain the target price
        const matchingSessions: any[] = [];
        for (const session of checkoutSessions.data) {
          if (!session.customer_email) continue;
          const lineItems = await stripe.checkout.sessions.listLineItems(session.id, { limit: 10 });
          const hasTargetPrice = lineItems.data.some((li: any) => li.price?.id === importPriceId);
          if (hasTargetPrice) {
            matchingSessions.push({
              sessionId: session.id,
              customerEmail: session.customer_email,
              customerName: session.customer_details?.name || '',
              amount: session.amount_total || 0,
              currency: session.currency || 'usd',
              created: Math.floor(new Date(session.created * 1000).getTime() / 1000),
              productName: lineItems.data[0]?.description || 'Class Pass',
            });
          }
        }

        // Match emails to auth accounts
        const emailList = [...new Set(matchingSessions.map(s => s.customerEmail.toLowerCase()))];
        
        // Get user IDs by email from profiles
        const { data: profileMatches } = await supabase
          .from('profiles')
          .select('user_id, email')
          .in('email', emailList);

        const emailToUserId: Record<string, string> = {};
        (profileMatches || []).forEach((p: any) => {
          if (p.email) emailToUserId[p.email.toLowerCase()] = p.user_id;
        });

        // Check which sessions are already imported (by checking existing class_passes metadata)
        // We'll check if a pass with matching purchased_at date and user exists
        const { data: existingPasses } = await supabase
          .from('class_passes')
          .select('user_id, purchased_at')
          .eq('category', importCategory)
          .eq('pass_type', importPassType);

        const existingKeys = new Set(
          (existingPasses || []).map((p: any) => `${p.user_id}_${p.purchased_at?.split('T')[0]}`)
        );

        const sessionsWithStatus = matchingSessions.map(s => {
          const matchedUserId = emailToUserId[s.customerEmail.toLowerCase()];
          const purchaseDate = new Date(s.created * 1000).toISOString().split('T')[0];
          const alreadyImported = matchedUserId ? existingKeys.has(`${matchedUserId}_${purchaseDate}`) : false;
          return {
            ...s,
            matched: !!matchedUserId,
            matchedUserId,
            alreadyImported,
          };
        });

        if (!confirmImport) {
          // Preview mode
          return new Response(
            JSON.stringify({ success: true, sessions: sessionsWithStatus }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
          );
        }

        // Confirm mode: import selected sessions
        let importedCount = 0;
        for (const session of sessionsWithStatus) {
          if (!selectedSessionIds.includes(session.sessionId)) continue;
          if (!session.matched || session.alreadyImported || !session.matchedUserId) continue;

          const expiresAt = new Date();
          expiresAt.setDate(expiresAt.getDate() + 90); // 90-day expiration

          const { error: insertError } = await supabase.from('class_passes').insert({
            user_id: session.matchedUserId,
            category: importCategory,
            pass_type: importPassType,
            classes_total: importClassCount,
            classes_remaining: importClassCount,
            price_paid: session.amount / 100,
            is_member_price: false,
            expires_at: expiresAt.toISOString(),
            purchased_at: new Date(session.created * 1000).toISOString(),
            status: 'active',
          });

          if (!insertError) importedCount++;
          else logStep("Failed to import session", { sessionId: session.sessionId, error: insertError.message });
        }

        return new Response(
          JSON.stringify({ success: true, imported: importedCount }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
        );
      }

      case 'update_billing_anchor': {
        // Shift the next billing date for a subscription (e.g., after a freeze)
        // Uses trial_end to defer the next charge without creating an immediate invoice
        const { subscriptionId, newBillingDate } = body;
        if (!subscriptionId || !newBillingDate) {
          throw new Error("Missing subscriptionId or newBillingDate");
        }

        // Verify admin role
        const { data: anchorRoleData } = await supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', user.id)
          .in('role', ['super_admin', 'admin', 'manager']);

        if (!anchorRoleData || anchorRoleData.length === 0) {
          throw new Error("Unauthorized: Admin access required");
        }

        const newDate = new Date(newBillingDate);
        const now = new Date();
        
        if (newDate <= now) {
          throw new Error("New billing date must be in the future");
        }

        const newAnchorTimestamp = Math.floor(newDate.getTime() / 1000);

        logStep("Updating billing anchor", { subscriptionId, newBillingDate, newAnchorTimestamp });

        // Get current subscription to log what's changing
        const currentSub = await stripe.subscriptions.retrieve(subscriptionId);
        const oldPeriodEnd = currentSub.current_period_end;

        logStep("Current period end", { 
          oldPeriodEnd: new Date(oldPeriodEnd * 1000).toISOString(),
          newPeriodEnd: newDate.toISOString()
        });

        // Use trial_end to shift the next billing date without generating an immediate invoice
        // This extends the current period to the new date without charging
        const updatedSubscription = await stripe.subscriptions.update(subscriptionId, {
          trial_end: newAnchorTimestamp,
          proration_behavior: 'none',
        });

        logStep("Billing anchor updated", { 
          subscriptionId, 
          newTrialEnd: updatedSubscription.trial_end,
          status: updatedSubscription.status 
        });

        return new Response(
          JSON.stringify({ 
            success: true, 
            subscription: {
              id: updatedSubscription.id,
              status: updatedSubscription.status,
              trial_end: updatedSubscription.trial_end,
              current_period_end: updatedSubscription.current_period_end,
            },
            old_period_end: new Date(oldPeriodEnd * 1000).toISOString(),
            new_billing_date: newDate.toISOString(),
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
        );
      }

      case 'add_processing_fees_to_subscription': {
        // Retroactively add processing fee line items to an existing subscription
        const { subscriptionId } = body;
        if (!subscriptionId) throw new Error("Missing subscriptionId");

        // Verify admin role
        const { data: feeRoleData } = await supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', user.id)
          .in('role', ['super_admin', 'admin']);

        if (!feeRoleData || feeRoleData.length === 0) {
          throw new Error("Unauthorized: Admin access required");
        }

        const existingSub = await stripe.subscriptions.retrieve(subscriptionId);
        
        // Check if processing fees already exist
        const hasProcessingFee = existingSub.items.data.some((item: Stripe.SubscriptionItem) => {
          const productId = typeof item.price.product === 'string' ? item.price.product : (item.price.product as any)?.id;
          return item.price.metadata?.type === 'processing_fee' || false;
        });

        if (hasProcessingFee) {
          return new Response(
            JSON.stringify({ success: true, message: "Processing fees already exist on this subscription", skipped: true }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
          );
        }

        // Find the base price items (non-fee items)
        const baseItems = existingSub.items.data.filter((item: Stripe.SubscriptionItem) => {
          return !item.price.metadata?.type || item.price.metadata.type !== 'processing_fee';
        });

        if (baseItems.length === 0) {
          throw new Error("No base price items found on subscription");
        }

        // Add processing fee for each base item
        const addedFees: string[] = [];
        for (const baseItem of baseItems) {
          const baseAmount = baseItem.price.unit_amount || 0;
          const interval = (baseItem.price.recurring?.interval as 'month' | 'year') || 'month';
          
          const feePriceId = await getOrCreateRecurringProcessingFeePrice(stripe, baseAmount, interval);
          if (feePriceId) {
            await stripe.subscriptions.update(subscriptionId, {
              items: [{ price: feePriceId, quantity: 1 }],
              proration_behavior: 'none',
            });
            addedFees.push(feePriceId);
            logStep("Added processing fee to subscription", { subscriptionId, feePriceId, baseAmount, interval });
          }
        }

        return new Response(
          JSON.stringify({ 
            success: true, 
            fees_added: addedFees.length,
            fee_price_ids: addedFees,
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
        );
      }

      case 'admin_list_user_payment_methods': {
        const { userId } = body;
        if (!userId) throw new Error("userId is required");

        const { data: roleData } = await supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', user.id)
          .in('role', ['super_admin', 'admin', 'manager', 'front_desk']);
        if (!roleData || roleData.length === 0) {
          throw new Error("Unauthorized: Admin access required");
        }

        let email: string | null = null;
        let memberRecordId: string | null = null;
        let stripeCustomerId: string | null = null;

        const { data: m } = await supabase
          .from('members')
          .select('id, email, stripe_customer_id')
          .eq('user_id', userId)
          .maybeSingle();
        if (m) {
          email = m.email;
          memberRecordId = m.id;
          stripeCustomerId = m.stripe_customer_id;
        }
        if (!email) {
          const { data: nm } = await supabase
            .from('non_member_profiles')
            .select('email, stripe_customer_id')
            .eq('user_id', userId)
            .maybeSingle();
          if (nm) {
            email = nm.email;
            stripeCustomerId = stripeCustomerId || (nm as any).stripe_customer_id || null;
          }
        }
        if (!email) {
          const { data: p } = await supabase
            .from('profiles')
            .select('email')
            .eq('user_id', userId)
            .maybeSingle();
          if (p) email = p.email;
        }

        if (!stripeCustomerId && email) {
          const customers = await stripe.customers.list({ email, limit: 1 });
          if (customers.data.length > 0) stripeCustomerId = customers.data[0].id;
        }

        if (!stripeCustomerId) {
          return new Response(
            JSON.stringify({ paymentMethods: [], hasPaymentMethod: false, memberEmail: email }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
          );
        }

        const customer = await stripe.customers.retrieve(stripeCustomerId);
        const defaultPmId = !customer.deleted ? (customer.invoice_settings?.default_payment_method as string | null) : null;

        const pms = await stripe.paymentMethods.list({ customer: stripeCustomerId, type: 'card' });
        const formatted = pms.data.map((pm: any) => ({
          id: pm.id,
          brand: pm.card?.brand,
          last4: pm.card?.last4,
          expMonth: pm.card?.exp_month,
          expYear: pm.card?.exp_year,
          nickname: pm.metadata?.nickname || null,
          isDefault: pm.id === defaultPmId,
          createdAt: new Date(pm.created * 1000).toISOString(),
        }));

        return new Response(
          JSON.stringify({
            paymentMethods: formatted,
            hasPaymentMethod: formatted.length > 0,
            stripeCustomerId,
            memberEmail: email,
            memberRecordId,
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
        );
      }

      case 'admin_charge_user_saved_card': {
        const {
          userId,
          paymentMethodId,
          amount,
          description,
          grossUpFee = true,
          metadata: extraMetadata = {},
        } = body;

        if (!userId || !amount || !description) {
          throw new Error("userId, amount, and description are required");
        }
        if (amount < 50) throw new Error("Minimum charge amount is $0.50");

        const { data: roleData } = await supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', user.id)
          .in('role', ['super_admin', 'admin', 'manager', 'front_desk']);
        if (!roleData || roleData.length === 0) {
          throw new Error("Unauthorized: Admin access required");
        }

        let email: string | null = null;
        let memberRecordId: string | null = null;
        let stripeCustomerId: string | null = null;
        let displayName = 'Customer';

        const { data: m } = await supabase
          .from('members')
          .select('id, email, stripe_customer_id, first_name, last_name')
          .eq('user_id', userId)
          .maybeSingle();
        if (m) {
          email = m.email;
          memberRecordId = m.id;
          stripeCustomerId = m.stripe_customer_id;
          displayName = `${m.first_name ?? ''} ${m.last_name ?? ''}`.trim() || email || displayName;
        }
        if (!email) {
          const { data: nm } = await supabase
            .from('non_member_profiles')
            .select('email, stripe_customer_id, first_name, last_name')
            .eq('user_id', userId)
            .maybeSingle();
          if (nm) {
            email = nm.email;
            stripeCustomerId = stripeCustomerId || (nm as any).stripe_customer_id || null;
            displayName = `${nm.first_name ?? ''} ${nm.last_name ?? ''}`.trim() || email || displayName;
          }
        }
        if (!email) {
          const { data: p } = await supabase
            .from('profiles')
            .select('email, full_name')
            .eq('user_id', userId)
            .maybeSingle();
          if (p) {
            email = p.email;
            displayName = (p as any).full_name || email || displayName;
          }
        }

        if (!stripeCustomerId && email) {
          const customers = await stripe.customers.list({ email, limit: 1 });
          if (customers.data.length > 0) stripeCustomerId = customers.data[0].id;
        }
        if (!stripeCustomerId) throw new Error("No payment method on file for this customer.");

        let pmId: string | undefined = paymentMethodId;
        if (!pmId) {
          const pms = await stripe.paymentMethods.list({ customer: stripeCustomerId, type: 'card', limit: 1 });
          if (pms.data.length === 0) throw new Error("No payment method on file");
          pmId = pms.data[0].id;
        }

        const baseAmount = Number(amount);
        const processingFeeCents = grossUpFee ? calculateProcessingFee(baseAmount) : 0;
        const totalAmount = baseAmount + processingFeeCents;
        const fullDescription = processingFeeCents > 0
          ? `${description} (includes $${(processingFeeCents / 100).toFixed(2)} processing fee)`
          : description;

        const paymentIntent = await stripe.paymentIntents.create({
          amount: totalAmount,
          currency: 'usd',
          customer: stripeCustomerId,
          payment_method: pmId,
          off_session: true,
          confirm: true,
          description: fullDescription,
          metadata: {
            type: 'admin_user_charge',
            user_id: userId,
            member_id: memberRecordId || '',
            charged_by: user.id,
            customer_name: displayName,
            base_amount: String(baseAmount),
            processing_fee: String(processingFeeCents),
            ...Object.fromEntries(
              Object.entries(extraMetadata || {}).map(([k, v]) => [k, String(v)])
            ),
          },
        });

        const { error: chargeInsertError } = await supabase
          .from('manual_charges')
          .insert({
            member_id: memberRecordId,
            user_id: userId,
            amount: totalAmount,
            description: fullDescription,
            stripe_payment_intent_id: paymentIntent.id,
            status: paymentIntent.status === 'succeeded' ? 'succeeded' : 'pending',
            charged_by: user.id,
          });
        if (chargeInsertError) {
          logStep("Warning: failed to record manual_charges row", { error: chargeInsertError.message });
        }

        const pm = await stripe.paymentMethods.retrieve(pmId);
        const cardBrand = pm.card?.brand ? pm.card.brand.charAt(0).toUpperCase() + pm.card.brand.slice(1) : 'Card';
        const cardLast4 = pm.card?.last4 || '****';

        return new Response(
          JSON.stringify({
            success: paymentIntent.status === 'succeeded',
            paymentIntentId: paymentIntent.id,
            status: paymentIntent.status,
            cardBrand,
            cardLast4,
            baseAmount,
            processingFee: processingFeeCents,
            totalAmount,
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
        );
      }

      default:
        throw new Error(`Unknown action: ${action}`);
    }
  } catch (error: unknown) {
    console.error("Payment error:", error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    
    // Return card errors as 200 with error field so the frontend can read the message
    // (non-2xx responses from supabase.functions.invoke lose the response body)
    const isStripeCardError = (error as any)?.type === 'StripeCardError';
    const isValidationError = message.includes('required') || message.includes('not found') || 
                              message.includes('No payment method') || message.includes('already has') ||
                              message.includes('Unauthorized') || message.includes('Invalid');
    
    if (isStripeCardError || isValidationError) {
      return new Response(
        JSON.stringify({ error: message, success: false }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      );
    }
    
    return new Response(
      JSON.stringify({ error: message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
