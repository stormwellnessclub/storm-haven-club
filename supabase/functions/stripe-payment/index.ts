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
  action: 'create_activation_checkout' | 'create_class_pass_checkout' | 'customer_portal' | 'get_subscription' | 'cancel_subscription';
  // For activation checkout
  tier?: string;
  gender?: string;
  isFoundingMember?: boolean;
  startDate?: string;
  memberId?: string;
  // For class pass
  category?: 'pilatesCycling' | 'otherClasses';
  passType?: 'single' | 'tenPack';
  isMember?: boolean;
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

    // Get user from auth header
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
        const { tier, gender, isFoundingMember, startDate, memberId, successUrl, cancelUrl } = body;
        
        if (!tier || !gender || !startDate || !memberId || !successUrl || !cancelUrl) {
          throw new Error("Missing required fields for activation checkout");
        }

        const normalizedTier = tier.toLowerCase().replace(' membership', '') as keyof typeof STRIPE_PRODUCTS.memberships;
        const normalizedGender = (gender.toLowerCase() === 'male' || gender.toLowerCase() === 'men') ? 'men' : 'women';
        
        logStep("Normalized checkout params", { normalizedTier, normalizedGender, isFoundingMember });

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

        // Get annual fee price
        const annualFeePriceId = STRIPE_PRODUCTS.annualFee[normalizedGender];

        const customerId = await getOrCreateCustomer();
        
        // Calculate billing anchor date from start date
        const startDateObj = new Date(startDate);
        const billingAnchor = Math.floor(startDateObj.getTime() / 1000);

        // Create checkout session with both subscriptions
        const session = await stripe.checkout.sessions.create({
          customer: customerId,
          line_items: [
            { price: membershipPriceId, quantity: 1 },
            { price: annualFeePriceId, quantity: 1 },
          ],
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
          },
        });

        logStep("Checkout session created", { sessionId: session.id, url: session.url });

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

        const session = await stripe.checkout.sessions.create({
          customer: customerId,
          line_items: [{ price: priceId, quantity: 1 }],
          mode: 'payment',
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

      case 'customer_portal': {
        const customerId = await getOrCreateCustomer();
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
