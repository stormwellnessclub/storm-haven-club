import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { getInvoiceSubscriptionId, getLinePriceId } from "../_shared/stripeInvoice.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const logStep = (step: string, details?: unknown) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[STRIPE-FAILED-INVOICES] ${step}${detailsStr}`);
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const stripeSecretKey = Deno.env.get('STRIPE_SECRET_KEY');
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

  if (!stripeSecretKey) {
    return new Response(JSON.stringify({ error: 'STRIPE_SECRET_KEY not configured' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    // Authenticate admin user
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 401,
      });
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Invalid authorization' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 401,
      });
    }

    // Check admin role
    const { data: roles } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id);

    const userRoles = (roles || []).map((r: { role: string }) => r.role);
    const isAdmin = userRoles.some((r: string) => ['super_admin', 'admin', 'manager'].includes(r));

    if (!isAdmin) {
      return new Response(JSON.stringify({ error: 'Admin access required' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 403,
      });
    }

    logStep('Admin authenticated', { userId: user.id });

    const body = await req.json().catch(() => ({}));
    const { status: filterStatus = 'all' } = body;

    const stripe = new Stripe(stripeSecretKey, { apiVersion: '2025-08-27.basil' });

    // Fetch open and uncollectible invoices from Stripe
    const invoices: any[] = [];

    if (filterStatus === 'all' || filterStatus === 'open') {
      const openInvoices = await stripe.invoices.list({
        status: 'open',
        limit: 100,
        expand: ['data.customer', 'data.subscription'],
      });
      invoices.push(...openInvoices.data);
      logStep('Fetched open invoices', { count: openInvoices.data.length });
    }

    if (filterStatus === 'all' || filterStatus === 'uncollectible') {
      const uncollectibleInvoices = await stripe.invoices.list({
        status: 'uncollectible',
        limit: 100,
        expand: ['data.customer', 'data.subscription'],
      });
      invoices.push(...uncollectibleInvoices.data);
      logStep('Fetched uncollectible invoices', { count: uncollectibleInvoices.data.length });
    }

    // Format invoices for response
    const formattedInvoices = invoices.map((inv: any) => {
      const customer = typeof inv.customer === 'object' ? inv.customer : null;
      const subscription = typeof inv.subscription === 'object' ? inv.subscription : null;

      // Extract last failure info
      let lastFailureMessage: string | null = null;
      if (inv.last_finalization_error) {
        lastFailureMessage = inv.last_finalization_error.message || null;
      }

      return {
        id: inv.id,
        number: inv.number,
        customer_id: typeof inv.customer === 'string' ? inv.customer : customer?.id,
        customer_email: customer?.email || null,
        customer_name: customer?.name || null,
        amount_due: inv.amount_due / 100,
        amount_paid: inv.amount_paid / 100,
        currency: inv.currency,
        status: inv.status,
        created: new Date(inv.created * 1000).toISOString(),
        due_date: inv.due_date ? new Date(inv.due_date * 1000).toISOString() : null,
        attempt_count: inv.attempt_count || 0,
        next_payment_attempt: inv.next_payment_attempt
          ? new Date(inv.next_payment_attempt * 1000).toISOString()
          : null,
        last_failure_message: lastFailureMessage,
        subscription_id: subscription?.id || getInvoiceSubscriptionId(inv),
        subscription_status: subscription?.status || null,
        hosted_invoice_url: inv.hosted_invoice_url || null,
        period_start: inv.period_start ? new Date(inv.period_start * 1000).toISOString() : null,
        period_end: inv.period_end ? new Date(inv.period_end * 1000).toISOString() : null,
      };
    });

    // Calculate summary
    const totalOpen = formattedInvoices.filter((i: any) => i.status === 'open').length;
    const totalUncollectible = formattedInvoices.filter((i: any) => i.status === 'uncollectible').length;
    const totalAmountDue = formattedInvoices.reduce((sum: number, i: any) => sum + i.amount_due, 0);

    logStep('Response ready', { totalOpen, totalUncollectible, totalAmountDue });

    return new Response(JSON.stringify({
      invoices: formattedInvoices,
      summary: {
        total_open: totalOpen,
        total_uncollectible: totalUncollectible,
        total_amount_due: Math.round(totalAmountDue * 100) / 100,
      },
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep('ERROR', { message: errorMessage });
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});
