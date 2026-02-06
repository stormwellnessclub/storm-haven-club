import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

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
      single: { member: 'price_1SlA2vLyZrsSqLhsBHHWlQPD', nonMember: 'price_1SlA38LyZrsSqLhsMjRhYzpT' },
      tenPack: { member: 'price_1SlA9sLyZrsSqLhsM0X8VDhN', nonMember: 'price_1SlAAJLyZrsSqLhstWGd3c8G' },
    },
    otherClasses: {
      single: { member: 'price_1SlAAvLyZrsSqLhsVfY0qJgr', nonMember: 'price_1SlABFLyZrsSqLhsGOpvWGFE' },
      tenPack: { member: 'price_1SlABPLyZrsSqLhsbL0mwcit', nonMember: 'price_1SlABzLyZrsSqLhseSyKYaDD' },
    },
  },
  guestPass: 'price_1SxATYLyZrsSqLhs6vDu1QWg',  // $60 - Guest Pass (gym and amenities access, subject to availability)
};

interface PaymentRequest {
  action: 'create_activation_checkout' | 'create_class_pass_checkout' | 'create_freeze_fee_checkout' | 'pay_annual_fee' | 'customer_portal' | 'get_subscription' | 'cancel_subscription' | 'charge_saved_card' | 'charge_saved_card_with_3ds' | 'list_payment_methods' | 'list_application_payment_methods' | 'create_application_setup' | 'create_admin_setup_intent' | 'refund_charge' | 'create_setup_intent' | 'detach_payment_method' | 'list_invoices' | 'set_default_payment_method' | 'update_payment_method_nickname' | 'create_membership_payment_link' | 'process_membership_payment' | 'create_class_pass_link' | 'process_class_pass' | 'charge_annual_fee' | 'pause_subscription' | 'resume_subscription' | 'update_subscription_billing' | 'create_subscription_payment_intent' | 'create_class_pass_payment_intent' | 'create_subscription_from_payment' | 'create_guest_pass_checkout' | 'admin_create_member_subscription' | 'cancel_annual_fee_subscription' | 'create_member_dues_checkout' | 'sync_member_card_metadata' | 'admin_update_member_tier' | 'create_annual_fee_payment_link' | 'process_admin_refund' | 'undo_admin_action' | 'log_card_setup_failure';
  // For detach_payment_method, set_default_payment_method, update_payment_method_nickname
  paymentMethodId?: string;
  nickname?: string;
  // For activation checkout
  tier?: string;
  gender?: string;
  isFoundingMember?: boolean;
  startDate?: string;
  memberId?: string;
  skipAnnualFee?: boolean; // Skip annual fee if already paid
  // For class pass - only support pilatesCycling and otherClasses
  category?: 'pilatesCycling' | 'otherClasses';
  passType?: 'single' | 'tenPack';
  isMember?: boolean;
  userId?: string;
  // For guest pass
  guestName?: string;
  guestEmail?: string;
  // For freeze fee
  freezeId?: string;
  freezeFeeAmount?: number;
  // For charge_saved_card (either memberId OR stripeCustomerId required)
  amount?: number;
  description?: string;
  stripeCustomerId?: string; // Direct customer ID for applications
  applicationId?: string; // For tracking application charges
  // For application setup (unauthenticated)
  applicantEmail?: string;
  applicantName?: string;
  // For refund_charge
  chargeId?: string;
  paymentIntentId?: string;
  refundAmount?: number;
  refundNotes?: string;
  refundMethodType?: string;
  // General
  subscriptionId?: string;
  successUrl?: string;
  cancelUrl?: string;
  // For create_subscription_from_payment
  billingType?: 'monthly' | 'annual';
  customerId?: string;
  // For admin_update_member_tier
  newTier?: 'silver' | 'gold' | 'platinum' | 'diamond';
  prorationBehavior?: 'create_prorations' | 'none' | 'always_invoice';
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
    if (action === 'create_application_setup') {
      const { applicantEmail, applicantName, successUrl, cancelUrl } = body;

      if (!applicantEmail || !applicantName || !successUrl || !cancelUrl) {
        throw new Error("Missing required fields for application setup");
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
    // This allows applicants to fetch their card details after saving without needing auth
    if (action === 'list_application_payment_methods') {
      const { stripeCustomerId: appCustomerId } = body;

      if (!appCustomerId) {
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
        const lineItems: { price: string; quantity: number }[] = [
          { price: membershipPriceId, quantity: 1 },
        ];
        
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
        const priceId = STRIPE_PRODUCTS.classPasses[category][passType][memberStatus];

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

        const session = await stripe.checkout.sessions.create({
          customer: customerId,
          line_items: [{ price: priceId, quantity: 1 }],
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

        return new Response(
          JSON.stringify({ sessionId: session.id, url: session.url }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
        );
      }

      case 'create_guest_pass_checkout': {
        const { guestName, guestEmail, successUrl, cancelUrl } = body;

        if (!guestName || !successUrl || !cancelUrl) {
          throw new Error("Missing required fields for guest pass checkout");
        }

        // Get price ID for guest pass
        const priceId = STRIPE_PRODUCTS.guestPass;
        
        if (!priceId || priceId.startsWith('TODO_')) {
          throw new Error("Guest pass price ID not configured. Please add Stripe price ID in stripeProducts.ts");
        }

        const customerId = await getOrCreateCustomer();

        // Create checkout session for guest pass
        const session = await stripe.checkout.sessions.create({
          customer: customerId,
          line_items: [{ price: priceId, quantity: 1 }],
          mode: 'payment',
          payment_intent_data: {
            setup_future_usage: 'off_session',
          },
          success_url: `${successUrl}?session_id={CHECKOUT_SESSION_ID}`,
          cancel_url: cancelUrl,
          metadata: {
            type: 'guest_pass',
            user_id: user.id, // Admin user who is selling the pass
            guest_name: guestName,
            guest_email: guestEmail || '',
          },
        });

        logStep("Guest pass checkout created", { sessionId: session.id, url: session.url, guestName });

        return new Response(
          JSON.stringify({ sessionId: session.id, url: session.url }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
        );
      }

      case 'create_freeze_fee_checkout': {
        const { freezeId, freezeFeeAmount, successUrl, cancelUrl } = body;

        if (!freezeId || !freezeFeeAmount || !successUrl || !cancelUrl) {
          throw new Error("Missing required fields for freeze fee checkout");
        }

        const customerId = await getOrCreateCustomer();

        // Create one-time payment for freeze fee
        const session = await stripe.checkout.sessions.create({
          customer: customerId,
          line_items: [
            {
              price_data: {
                currency: 'usd',
                product_data: {
                  name: 'Membership Freeze Fee',
                  description: `Freeze fee for membership hold`,
                },
                unit_amount: freezeFeeAmount * 100, // Convert to cents
              },
              quantity: 1,
            },
          ],
          mode: 'payment',
          payment_intent_data: {
            setup_future_usage: 'off_session',
          },
          success_url: `${successUrl}?session_id={CHECKOUT_SESSION_ID}`,
          cancel_url: cancelUrl,
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
        const session = await stripe.checkout.sessions.create({
          customer: customerId,
          line_items: [{ price: annualFeePriceId, quantity: 1 }],
          mode: 'subscription',
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
        const { memberId, stripeCustomerId: directCustomerId, applicantName, applicationId, amount, description } = body;

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
          // Look up from members table (existing behavior)
          const { data: memberData, error: memberError } = await supabase
            .from('members')
            .select('stripe_customer_id, first_name, last_name, user_id')
            .eq('id', memberId)
            .single();

          if (memberError || !memberData) {
            throw new Error("Member not found");
          }

          if (!memberData.stripe_customer_id) {
            throw new Error("Member has no payment method on file");
          }

          customerId = memberData.stripe_customer_id;
          customerName = `${memberData.first_name} ${memberData.last_name}`;
          memberIdForLog = memberId;
          userIdForLog = memberData.user_id;
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

        // Create and confirm a payment intent
        const paymentIntent = await stripe.paymentIntents.create({
          amount: amount, // Already in cents
          currency: 'usd',
          customer: customerId,
          payment_method: paymentMethodId,
          off_session: true,
          confirm: true,
          description: description,
          metadata: {
            type: 'manual_charge',
            member_id: memberIdForLog || 'application',
            charged_by: user.id,
            customer_name: customerName,
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
              amount: amount,
              description: description,
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
              amount: amount,
              description: description,
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
        const { memberId, stripeCustomerId: directCustomerId, applicantName, applicationId, amount, description } = body;

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
            .select('stripe_customer_id, first_name, last_name, user_id')
            .eq('id', memberId)
            .single();

          if (memberError3ds || !memberData3ds) {
            throw new Error("Member not found");
          }

          if (!memberData3ds.stripe_customer_id) {
            throw new Error("Member has no payment method on file");
          }

          customerId = memberData3ds.stripe_customer_id;
          customerName = `${memberData3ds.first_name} ${memberData3ds.last_name}`;
          memberIdForLog = memberId;
          userIdForLog = memberData3ds.user_id;
          logStep("Found member stripe customer for 3DS charge", { customerId, customerName, memberId });
        } else {
          throw new Error("Either memberId or stripeCustomerId is required");
        }

        // Get the customer's payment method
        const paymentMethods3ds = await stripe.paymentMethods.list({
          customer: customerId,
          type: 'card',
          limit: 1,
        });

        if (paymentMethods3ds.data.length === 0) {
          throw new Error("No payment method on file");
        }

        const paymentMethod3ds = paymentMethods3ds.data[0];
        const cardBrand3ds = paymentMethod3ds.card?.brand ? 
          paymentMethod3ds.card.brand.charAt(0).toUpperCase() + paymentMethod3ds.card.brand.slice(1) : 'Card';
        const cardLast43ds = paymentMethod3ds.card?.last4 || '****';

        // Create payment intent WITHOUT confirm: true to allow 3DS
        const paymentIntent3ds = await stripe.paymentIntents.create({
          amount: amount,
          currency: 'usd',
          customer: customerId,
          payment_method: paymentMethod3ds.id,
          description: description,
          confirmation_method: 'manual',
          confirm: true, // Confirm but don't require off_session
          return_url: `${Deno.env.get('SUPABASE_URL') || 'https://localhost'}/`,
          metadata: {
            type: 'manual_charge',
            member_id: memberIdForLog || 'application',
            application_id: applicationIdForLog || '',
            charged_by: user.id,
            customer_name: customerName,
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
                amount: amount,
                description: description,
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
                amount: amount,
                description: description,
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

        const lineItems: { price: string; quantity: number }[] = [
          { price: membershipPriceId, quantity: 1 },
        ];
        
        if (annualFeePriceId) {
          lineItems.push({ price: annualFeePriceId, quantity: 1 });
        }

        // For founding members paying annual upfront, charge 12 months
        if (isFoundingMember && billingType === 'annual') {
          // For annual upfront, we'll charge once and set up annual subscription
          const session = await stripe.checkout.sessions.create({
            customer: customerId,
            line_items: lineItems,
            mode: 'subscription',
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

        const priceId = passConfig[passType]?.[isMember ? 'member' : 'nonMember'];
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
          const session = await stripe.checkout.sessions.create({
            customer: customerId,
            line_items: [{ price: annualFeePriceId, quantity: 1 }],
            mode: 'subscription',
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
        const { subscriptionId } = body;
        if (!subscriptionId) throw new Error("Missing subscriptionId");

        const subscription = await stripe.subscriptions.update(subscriptionId, {
          pause_collection: {
            behavior: 'keep_as_draft',
          },
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

        // Create membership subscription with saved payment method
        const subscription = await stripe.subscriptions.create({
          customer: memberData.stripe_customer_id,
          items: [{ price: membershipPriceId }],
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

        // Update member record with membership subscription
        await supabase
          .from('members')
          .update({
            status: 'active',
            stripe_subscription_id: subscription.id,
            billing_type: billingType,
            is_founding_member: isFoundingMember,
            gender: normalizedGender,
            activated_at: new Date().toISOString(),
            membership_start_date: startDate,
            annual_fee_paid_at: skipAnnualFee ? null : new Date().toISOString(),
          })
          .eq('id', memberId);

        // Create annual fee subscription (separate recurring subscription) if not skipped
        let annualFeeSubscriptionId: string | null = null;
        if (!skipAnnualFee && annualFeePriceId) {
          try {
            console.log(`[STRIPE-PAYMENT] Creating annual fee subscription - ${JSON.stringify({ memberId, annualFeePriceId })}`);
            
            const annualFeeSubscription = await stripe.subscriptions.create({
              customer: memberData.stripe_customer_id,
              items: [{ price: annualFeePriceId }],
              default_payment_method: paymentMethodId,
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
        const expiresAt = new Date(cycleEnd);
        expiresAt.setDate(expiresAt.getDate() + 7);

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
        const { memberId, tier, gender, billingType: requestedBillingType, startDate, isFoundingMember } = body;

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

        logStep("Admin creating member subscription", { memberId, tier: normalizedTier, gender: normalizedGender, billingType });

        // Get membership price
        const membershipPrices = STRIPE_PRODUCTS.memberships[normalizedTier];
        if (!membershipPrices) {
          throw new Error(`Invalid membership tier: ${tier}`);
        }

        const membershipPriceId = membershipPrices[billingType as 'monthly' | 'annual'][normalizedGender];
        if (!membershipPriceId) {
          throw new Error(`Membership not available for ${gender} at ${tier} tier with ${billingType} billing`);
        }

        // Get member data
        const { data: memberData, error: memberError } = await supabase
          .from('members')
          .select('stripe_customer_id, user_id, email, first_name, last_name')
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
        const subscriptionStartDate = startDate ? new Date(startDate) : new Date();
        const now = new Date();
        const isStartDateInPast = subscriptionStartDate < now;

        // Build subscription parameters - handle past dates differently
        const subscriptionParams: any = {
          customer: memberData.stripe_customer_id,
          items: [{ price: membershipPriceId }],
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
            original_start_date: startDate || new Date().toISOString().split('T')[0],
          },
        };

        if (isStartDateInPast) {
          // For past dates, start immediately - Stripe doesn't allow billing_cycle_anchor in past
          logStep("Start date is in past, starting subscription from today", { 
            originalStartDate: startDate, 
            now: now.toISOString() 
          });
          // Don't set billing_cycle_anchor - defaults to now
        } else {
          // For future dates, use billing_cycle_anchor
          subscriptionParams.billing_cycle_anchor = Math.floor(subscriptionStartDate.getTime() / 1000);
        }

        // Create the subscription
        const subscription = await stripe.subscriptions.create(subscriptionParams);

        logStep("Admin subscription created", { subscriptionId: subscription.id, memberId });

        // Update member record
        await supabase
          .from('members')
          .update({
            stripe_subscription_id: subscription.id,
            status: 'active',
            billing_type: billingType,
            is_founding_member: isFoundingMember || false,
            activated_at: new Date().toISOString(),
            membership_start_date: subscriptionStartDate.toISOString().split('T')[0],
          })
          .eq('id', memberId);

        // Allocate credits
        const credits = TIER_CREDITS[normalizedTier] || TIER_CREDITS.silver;
        const cycleStart = subscriptionStartDate;
        const cycleEnd = new Date(cycleStart);
        cycleEnd.setMonth(cycleEnd.getMonth() + 1);
        const expiresAt = new Date(cycleEnd);
        expiresAt.setDate(expiresAt.getDate() + 7);

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
        let annualFeeSubscriptionId: string | null = null;
        const annualFeePriceId = STRIPE_PRODUCTS.annualFee[normalizedGender];
        
        if (annualFeePriceId) {
          try {
            logStep("Creating annual fee subscription for admin activation", { memberId, annualFeePriceId });
            
            const annualFeeSubscription = await stripe.subscriptions.create({
              customer: memberData.stripe_customer_id,
              items: [{ price: annualFeePriceId }],
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
          } catch (annualFeeError) {
            console.error(`[STRIPE-PAYMENT] ERROR ANNUAL_FEE_ADMIN_CREATION - ${annualFeeError instanceof Error ? annualFeeError.message : String(annualFeeError)}`);
            // Don't fail - membership subscription is already created
          }
        }

        return new Response(
          JSON.stringify({ 
            success: true, 
            subscriptionId: subscription.id,
            annualFeeSubscriptionId,
            status: subscription.status,
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
        const session = await stripe.checkout.sessions.create({
          customer: customerId,
          mode: 'subscription',
          line_items: [{
            price: priceId,
            quantity: 1,
          }],
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
              const expiresAt = new Date(cycleEnd);
              expiresAt.setDate(expiresAt.getDate() + 7);

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
        const linkSession = await stripe.checkout.sessions.create({
          customer: feeCustomerId,
          line_items: [{ price: feePriceId, quantity: 1 }],
          mode: 'subscription',  // Changed from 'payment' - annual fee is a yearly subscription
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

      default:
        throw new Error(`Unknown action: ${action}`);
    }
  } catch (error: unknown) {
    console.error("Payment error:", error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
