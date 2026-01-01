import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.21.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface PaymentRequest {
  action: 'create_checkout' | 'webhook' | 'get_subscription' | 'cancel_subscription';
  productType?: 'membership' | 'class_pass';
  priceId?: string;
  customerId?: string;
  subscriptionId?: string;
  successUrl?: string;
  cancelUrl?: string;
}

serve(async (req) => {
  // Handle CORS preflight requests
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

  const stripe = new Stripe(stripeSecretKey, {
    apiVersion: '2023-10-16',
  });

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    const { action, productType, priceId, customerId, subscriptionId, successUrl, cancelUrl }: PaymentRequest = await req.json();
    console.log(`Processing payment action: ${action}`);

    switch (action) {
      case 'create_checkout': {
        if (!priceId || !successUrl || !cancelUrl) {
          throw new Error("Missing required fields for checkout");
        }

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

        // Check if customer exists in Stripe
        let stripeCustomerId = customerId;
        if (!stripeCustomerId) {
          const customers = await stripe.customers.list({ email: user.email, limit: 1 });
          if (customers.data.length > 0) {
            stripeCustomerId = customers.data[0].id;
          } else {
            const customer = await stripe.customers.create({
              email: user.email,
              metadata: { user_id: user.id }
            });
            stripeCustomerId = customer.id;
          }
        }

        const sessionParams: Stripe.Checkout.SessionCreateParams = {
          customer: stripeCustomerId,
          line_items: [{ price: priceId, quantity: 1 }],
          mode: productType === 'membership' ? 'subscription' : 'payment',
          success_url: successUrl,
          cancel_url: cancelUrl,
          metadata: {
            user_id: user.id,
            product_type: productType || 'unknown'
          }
        };

        const session = await stripe.checkout.sessions.create(sessionParams);
        console.log("Checkout session created:", session.id);

        return new Response(
          JSON.stringify({ sessionId: session.id, url: session.url }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
        );
      }

      case 'get_subscription': {
        if (!subscriptionId) {
          throw new Error("Subscription ID required");
        }

        const subscription = await stripe.subscriptions.retrieve(subscriptionId);
        
        return new Response(
          JSON.stringify({ subscription }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
        );
      }

      case 'cancel_subscription': {
        if (!subscriptionId) {
          throw new Error("Subscription ID required");
        }

        const subscription = await stripe.subscriptions.cancel(subscriptionId);
        console.log("Subscription cancelled:", subscriptionId);
        
        return new Response(
          JSON.stringify({ success: true, subscription }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
        );
      }

      case 'webhook': {
        // Handle Stripe webhooks
        const signature = req.headers.get('stripe-signature');
        const webhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET');
        
        if (!signature || !webhookSecret) {
          throw new Error("Missing webhook signature or secret");
        }

        const body = await req.text();
        const event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
        
        console.log("Webhook event received:", event.type);

        switch (event.type) {
          case 'checkout.session.completed': {
            const session = event.data.object as Stripe.Checkout.Session;
            console.log("Checkout completed for:", session.metadata?.user_id);
            // Update member status, add credits, etc.
            break;
          }
          case 'customer.subscription.updated':
          case 'customer.subscription.deleted': {
            const subscription = event.data.object as Stripe.Subscription;
            console.log("Subscription event:", event.type, subscription.id);
            // Update member subscription status
            break;
          }
        }

        return new Response(
          JSON.stringify({ received: true }),
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
