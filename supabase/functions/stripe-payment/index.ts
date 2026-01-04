import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
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
  action: 'create_activation_checkout' | 'create_class_pass_checkout' | 'create_freeze_fee_checkout' | 'pay_annual_fee' | 'customer_portal' | 'get_subscription' | 'cancel_subscription' | 'charge_saved_card' | 'list_payment_methods' | 'create_application_setup' | 'refund_charge' | 'create_setup_intent' | 'detach_payment_method' | 'list_invoices' | 'set_default_payment_method' | 'update_payment_method_nickname';
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
  category?: 'pilatesCycling' | 'otherClasses';
  passType?: 'single' | 'tenPack';
  isMember?: boolean;
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

      // Build success URL safely to avoid malformed query strings
      const successUrlObj = new URL(successUrl);
      successUrlObj.searchParams.set('setup_success', 'true');
      successUrlObj.searchParams.set('customer_id', customerId);

      // Create SetupIntent Checkout session (saves card without charging)
      const session = await stripe.checkout.sessions.create({
        customer: customerId,
        mode: 'setup',
        payment_method_types: ['card'],
        success_url: successUrlObj.toString(),
        cancel_url: cancelUrl,
        metadata: {
          type: 'application_card_setup',
          applicant_email: applicantEmail,
        },
      });

      logStep("SetupIntent checkout session created", { sessionId: session.id, customerId });

      return new Response(
        JSON.stringify({ sessionId: session.id, url: session.url, customerId }),
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
