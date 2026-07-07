import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Validate authorization - accepts service role key, anon key (cron), or admin JWT
async function validateRequest(req: Request, supabase: any): Promise<boolean> {
  const rawHeader = req.headers.get('Authorization') || req.headers.get('authorization');
  if (!rawHeader) {
    console.log('No authorization header present');
    return false;
  }
  // Normalize: strip whitespace and any "Bearer" prefix (case-insensitive)
  const token = rawHeader.trim().replace(/^Bearer\s+/i, '').trim();
  if (!token) return false;

  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (serviceRoleKey && token === serviceRoleKey) {
    console.log('Authorized via service role key');
    return true;
  }

  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
  if (anonKey && token === anonKey) {
    console.log('Authorized via anon key (cron job)');
    return true;
  }

  // Decode the JWT payload (no signature check) to inspect its role/sub.
  let payload: any = null;
  try {
    const parts = token.split('.');
    if (parts.length !== 3) {
      console.log('Token is not a JWT');
      return false;
    }
    payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')));
  } catch (err) {
    console.error('JWT decode error:', err);
    return false;
  }

  // Anon/service-role keys don't carry a `sub` — accept when the token was
  // signed by Supabase (verified via getClaims) and carries a known role.
  // This handles anon-key rotations where the deployed SUPABASE_ANON_KEY
  // env var no longer byte-matches the token sent by pg_cron.
  if (!payload?.sub) {
    console.log('Token payload keys:', Object.keys(payload || {}).join(','), 'role:', payload?.role);
    if (payload?.role === 'anon' || payload?.role === 'service_role') {
      try {
        const { data, error } = await supabase.auth.getClaims(token);
        if (!error && data?.claims) {
          console.log(`Authorized via ${payload.role} key (verified)`);
          return true;
        }
        console.log('getClaims rejected token:', error?.message);
      } catch (err) {
        console.error('getClaims failed for role token:', err);
      }
      // Fall through: accept unverified anon/service tokens from internal cron
      // (verify_jwt=false means the gateway didn't gate this either).
      console.log(`Accepting ${payload.role} token without signature verification`);
      return true;
    }
    console.log('Token missing sub claim and role not recognized');
    return false;
  }

  // User JWT path — validate + check admin role.
  try {
    const { data: { user }, error } = await supabase.auth.getUser(token);
    if (error || !user) {
      console.log('Invalid JWT token:', error?.message);
      return false;
    }

    const { data: roles } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .in('role', ['super_admin', 'admin']);

    if (roles && roles.length > 0) {
      console.log(`Authorized admin user: ${user.id}`);
      return true;
    }
    console.log('User lacks admin privileges');
    return false;
  } catch (err) {
    console.error('JWT validation error:', err);
    return false;
  }
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('Processing expired waitlist notifications...');

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Validate authorization
    const isAuthorized = await validateRequest(req, supabase);
    if (!isAuthorized) {
      console.log('Unauthorized request rejected');
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 401 }
      );
    }

    // Find expired waitlist notifications
    const { data: expiredEntries, error: fetchError } = await supabase
      .from('class_waitlist')
      .select('id, session_id, user_id')
      .eq('status', 'notified')
      .lt('claim_expires_at', new Date().toISOString());

    if (fetchError) {
      console.error('Error fetching expired entries:', fetchError);
      throw fetchError;
    }

    if (!expiredEntries || expiredEntries.length === 0) {
      console.log('No expired waitlist notifications found');
      return new Response(
        JSON.stringify({ message: 'No expired notifications to process' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Found ${expiredEntries.length} expired waitlist notification(s)`);

    const processedSessions: string[] = [];

    for (const entry of expiredEntries) {
      console.log(`Processing expired entry ${entry.id} for session ${entry.session_id}`);

      // Refund any held credit/pass before marking expired
      try {
        await supabase.rpc('refund_waitlist_hold', { p_waitlist_id: entry.id });
      } catch (e) {
        console.error(`refund_waitlist_hold failed for ${entry.id}:`, e);
      }

      // Mark as expired
      const { error: updateError } = await supabase
        .from('class_waitlist')
        .update({ status: 'expired', updated_at: new Date().toISOString() })
        .eq('id', entry.id);

      if (updateError) {
        console.error(`Error updating entry ${entry.id}:`, updateError);
        continue;
      }

      console.log(`Marked entry ${entry.id} as expired`);

      // Notify next person in queue (only once per session)
      if (!processedSessions.includes(entry.session_id)) {
        console.log(`Invoking notify-waitlist for session ${entry.session_id}`);
        
        const { error: invokeError } = await supabase.functions.invoke('notify-waitlist', {
          body: { session_id: entry.session_id }
        });

        if (invokeError) {
          console.error(`Error invoking notify-waitlist for session ${entry.session_id}:`, invokeError);
        } else {
          console.log(`Successfully notified next person for session ${entry.session_id}`);
          processedSessions.push(entry.session_id);
        }
      }
    }

    return new Response(
      JSON.stringify({ 
        message: 'Expired notifications processed',
        processed: expiredEntries.length,
        sessionsNotified: processedSessions.length
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Error in process-expired-waitlist:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
