import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const logStep = (step: string, details?: unknown) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[STRIPE-WEBHOOK] ${step}${detailsStr}`);
};

// Credit allocations by tier
const TIER_CREDITS: Record<string, { class: number; red_light: number; dry_cryo: number }> = {
  silver: { class: 0, red_light: 0, dry_cryo: 0 },
  gold: { class: 0, red_light: 4, dry_cryo: 2 },
  platinum: { class: 0, red_light: 6, dry_cryo: 4 },
  diamond: { class: 10, red_light: 10, dry_cryo: 6 },
};

// Class pass details
const CLASS_PASS_CONFIG: Record<string, { category: string; classes: number; validityDays: number }> = {
  'single_pilatesCycling': { category: 'pilates_cycling', classes: 1, validityDays: 7 },
  'tenPack_pilatesCycling': { category: 'pilates_cycling', classes: 10, validityDays: 60 },
  'single_otherClasses': { category: 'other', classes: 1, validityDays: 7 },
  'tenPack_otherClasses': { category: 'other', classes: 10, validityDays: 60 },
};

serve(async (req) => {
  const stripeSecretKey = Deno.env.get('STRIPE_SECRET_KEY');
  const webhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET');
  
  if (!stripeSecretKey) {
    console.error("STRIPE_SECRET_KEY is not configured");
    return new Response("Configuration error", { status: 500 });
  }

  const stripe = new Stripe(stripeSecretKey, { apiVersion: '2025-08-27.basil' });
  
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    const body = await req.text();
    let event: Stripe.Event;

    // Verify webhook signature if secret is configured
    if (webhookSecret) {
      const signature = req.headers.get('stripe-signature');
      if (!signature) {
        throw new Error("Missing stripe-signature header");
      }
      event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
    } else {
      // For testing without signature verification
      event = JSON.parse(body);
      logStep("WARNING: Webhook signature verification disabled");
    }

    logStep(`Received event: ${event.type}`, { eventId: event.id });

    switch (event.type) {
      case 'checkout.session.completed': {
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
            throw new Error("Missing member_id or user_id in metadata");
          }

          // Get subscription ID from session
          const subscriptionId = session.subscription as string;
          
          // Update member record with Stripe info and activate
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
            logStep("Error updating member", { error: updateError });
            throw updateError;
          }

          logStep("Member activated", { memberId, tier, isFoundingMember });

          // Create initial credits based on tier
          const credits = TIER_CREDITS[tier] || TIER_CREDITS.silver;
          const cycleStart = new Date(startDate);
          const cycleEnd = new Date(cycleStart);
          cycleEnd.setMonth(cycleEnd.getMonth() + 1);
          const expiresAt = new Date(cycleEnd);
          expiresAt.setDate(expiresAt.getDate() + 7); // 7 day grace period

          const creditTypes = ['class', 'red_light', 'dry_cryo'] as const;
          for (const creditType of creditTypes) {
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
                logStep(`Error creating ${creditType} credits`, { error: creditError });
              } else {
                logStep(`Created ${creditType} credits`, { amount: creditAmount });
              }
            }
          }

        } else if (metadata.type === 'class_pass') {
          // Handle class pass purchase
          const userId = metadata.user_id;
          const category = metadata.category;
          const passType = metadata.pass_type;
          const isMember = metadata.is_member === 'true';

          const configKey = `${passType}_${category}`;
          const config = CLASS_PASS_CONFIG[configKey];

          if (!config) {
            throw new Error(`Unknown class pass config: ${configKey}`);
          }

          // Get member ID if user is a member
          let memberId: string | null = null;
          if (isMember) {
            const { data: memberData } = await supabase
              .from('members')
              .select('id')
              .eq('user_id', userId)
              .eq('status', 'active')
              .maybeSingle();
            
            memberId = memberData?.id || null;
          }

          // Calculate expiry date
          const expiresAt = new Date();
          expiresAt.setDate(expiresAt.getDate() + config.validityDays);

          // Create class pass record
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
            logStep("Error creating class pass", { error: passError });
            throw passError;
          }

          logStep("Class pass created", { userId, category, passType, classes: config.classes });
        }
        break;
      }

      case 'customer.subscription.updated': {
        const subscription = event.data.object as Stripe.Subscription;
        logStep("Subscription updated", { 
          subscriptionId: subscription.id, 
          status: subscription.status 
        });

        // Update member status based on subscription status
        if (subscription.status === 'past_due' || subscription.status === 'unpaid') {
          const { error } = await supabase
            .from('members')
            .update({ status: 'past_due' })
            .eq('stripe_subscription_id', subscription.id);

          if (error) {
            logStep("Error updating member to past_due", { error });
          }
        } else if (subscription.status === 'active') {
          const { error } = await supabase
            .from('members')
            .update({ status: 'active' })
            .eq('stripe_subscription_id', subscription.id);

          if (error) {
            logStep("Error updating member to active", { error });
          }
        }
        break;
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription;
        logStep("Subscription deleted", { subscriptionId: subscription.id });

        const { error } = await supabase
          .from('members')
          .update({ status: 'cancelled' })
          .eq('stripe_subscription_id', subscription.id);

        if (error) {
          logStep("Error updating member to cancelled", { error });
        }
        break;
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice;
        logStep("Payment failed", { invoiceId: invoice.id, customerId: invoice.customer });

        // Optionally send notification or update status
        break;
      }

      default:
        logStep(`Unhandled event type: ${event.type}`);
    }

    return new Response(JSON.stringify({ received: true }), {
      headers: { 'Content-Type': 'application/json' },
      status: 200,
    });
  } catch (error: unknown) {
    console.error("Webhook error:", error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: message }), {
      headers: { 'Content-Type': 'application/json' },
      status: 400,
    });
  }
});
