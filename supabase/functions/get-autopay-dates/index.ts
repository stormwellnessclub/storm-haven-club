import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { requireStaff } from "../_shared/requireStaff.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const auth = await requireStaff(req);
  if (!auth.ok) return auth.response;

  try {
    const stripeKey = Deno.env.get('STRIPE_SECRET_KEY');
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!stripeKey) {
      throw new Error('STRIPE_SECRET_KEY is not set');
    }
    if (!supabaseUrl || !serviceRoleKey) {
      throw new Error('Supabase service credentials are not set');
    }

    const { subscription_ids } = await req.json();
    if (!Array.isArray(subscription_ids) || subscription_ids.length === 0) {
      return new Response(JSON.stringify({}), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }


    const stripe = new Stripe(stripeKey, { apiVersion: '2025-08-27.basil' });
    const supabase = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });

    // Batch fetch in parallel, with error handling per subscription
    const results: Record<string, string> = {};
    
    await Promise.all(
      subscription_ids.map(async (subId: string) => {
        try {
          const subscription = await stripe.subscriptions.retrieve(subId);
          if (subscription.current_period_end) {
            const nextDate = new Date(subscription.current_period_end * 1000).toISOString();
            const nextDateOnly = nextDate.split('T')[0];
            results[subId] = nextDate;

            await supabase
              .from('members')
              .update({ next_billing_date: nextDateOnly })
              .eq('stripe_subscription_id', subId);

            await supabase
              .from('members')
              .update({ next_annual_fee_date: nextDateOnly })
              .eq('annual_fee_subscription_id', subId);
          }
        } catch (err) {
          console.warn(`Failed to fetch subscription ${subId}:`, (err as Error).message);
        }
      })
    );

    return new Response(JSON.stringify(results), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('get-autopay-dates error:', error);
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});
