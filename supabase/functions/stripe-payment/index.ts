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

// Stripe Price IDs - matching src/lib/stripeProducts.ts
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
};

interface PaymentRequest {
  action: 'create_activation_checkout' | 'create_class_pass_checkout' | 'create_freeze_fee_checkout' | 'pay_annual_fee' | 'customer_portal' | 'get_subscription' | 'cancel_subscription' | 'charge_saved_card' | 'list_payment_methods' | 'create_application_setup' | 'refund_charge' | 'create_setup_intent' | 'detach_payment_method' | 'list_invoices' | 'set_default_payment_method' | 'update_payment_method_nickname' | 'create_membership_payment_link' | 'process_membership_payment' | 'create_class_pass_link' | 'process_class_pass' | 'charge_annual_fee' | 'pause_subscription' | 'resume_subscription' | 'update_subscription_billing' | 'create_subscription_payment_intent' | 'create_class_pass_payment_intent' | 'create_subscription_from_payment';
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
  // For class pass
  category?: 'pilatesCycling' | 'otherClasses' | 'reformer' | 'cycling' | 'aerobics';
  passType?: 'single' | 'tenPack';
  isMember?: boolean;
  userId?: string;
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
  paymentMethodId?: string;
  billingType?: 'monthly' | 'annual';
  customerId?: string;
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

      return new Response(
        JSON.stringify({ 
          clientSecret: setupIntent.client_secret,
          setupIntentId: setupIntent.id,
          customerId: customerId,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      );
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

        // Build line items - conditionally include annual fee
        const lineItems: { price: string; quantity: number }[] = [
          { price: membershipPriceId, quantity: 1 },
        ];
        
        if (annualFeePriceId) {
          lineItems.push({ price: annualFeePriceId, quantity: 1 });
          logStep("Including annual fee in checkout", { annualFeePriceId });
        } else {
          logStep("Skipping annual fee - already paid");
        }

        // Create checkout session with subscriptions
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
          .select('id, gender, stripe_customer_id, first_name, last_name, email, annual_fee_paid_at')
          .eq('id', memberId)
          .eq('user_id', user.id)
          .single();

        if (memberError || !member) {
          throw new Error("Member record not found or unauthorized");
        }

        logStep("Found member for annual fee payment", { memberId: member.id, gender: member.gender });

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

        // Create one-time payment for annual fee (not subscription - just immediate charge)
        const session = await stripe.checkout.sessions.create({
          customer: customerId,
          line_items: [{ price: annualFeePriceId, quantity: 1 }],
          mode: 'payment',
          payment_intent_data: {
            setup_future_usage: 'off_session',
          },
          success_url: `${successUrl}?session_id={CHECKOUT_SESSION_ID}&annual_fee_paid=true`,
          cancel_url: cancelUrl,
          metadata: {
            type: 'annual_fee_payment',
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

        // Map category names
        let mappedCategory = category;
        if (category === 'pilatesCycling') mappedCategory = 'reformer';
        if (category === 'otherClasses') mappedCategory = 'aerobics';

        const passConfig = STRIPE_PRODUCTS.classPasses[mappedCategory as keyof typeof STRIPE_PRODUCTS.classPasses];
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
            category: mappedCategory,
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

        // If price ID exists, use checkout instead
        if (annualFeePriceId) {
          const session = await stripe.checkout.sessions.create({
            customer: customerId,
            line_items: [{ price: annualFeePriceId, quantity: 1 }],
            mode: 'payment',
            success_url: `${Deno.env.get('SITE_URL') || 'http://localhost:5173'}/member?payment=success`,
            cancel_url: `${Deno.env.get('SITE_URL') || 'http://localhost:5173'}/member?payment=cancelled`,
            metadata: {
              type: 'annual_fee_payment',
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

        // Create subscription with saved payment method
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

        // Update member record
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
