import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST" && req.method !== "GET") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const publishableKey =
    Deno.env.get("VITE_STRIPE_PUBLISHABLE_KEY") ??
    Deno.env.get("STRIPE_PUBLISHABLE_KEY") ??
    "";

  if (!publishableKey) {
    console.error("[STRIPE-CONFIG] Missing publishable key env var");
    return new Response(JSON.stringify({ error: "Stripe publishable key not configured" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Basic sanity check: Stripe publishable keys start with "pk_".
  // If this fails, Stripe.js will refuse to initialize and the UI will show "not configured".
  if (!publishableKey.startsWith("pk_")) {
    console.error("[STRIPE-CONFIG] Invalid publishable key prefix", {
      prefix: publishableKey.slice(0, 3),
    });
    return new Response(
      JSON.stringify({
        error: 'Invalid Stripe publishable key. Expected a key starting with "pk_".',
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }

  return new Response(JSON.stringify({ publishableKey }), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
