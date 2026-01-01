import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.89.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface NotifyWaitlistRequest {
  session_id: string;
}

// Validate authorization - accepts either service role key, cron secret, or valid JWT
async function validateRequest(req: Request, supabase: any): Promise<boolean> {
  const authHeader = req.headers.get('Authorization');
  
  if (!authHeader) {
    console.log('No authorization header present');
    return false;
  }

  // Check for service role key (internal function calls)
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (authHeader === `Bearer ${serviceRoleKey}`) {
    console.log('Authorized via service role key');
    return true;
  }

  // Check for anon key (cron job calls via pg_net)
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
  if (authHeader === `Bearer ${anonKey}`) {
    console.log('Authorized via anon key (cron job)');
    return true;
  }

  // Validate JWT token for admin users
  try {
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error } = await supabase.auth.getUser(token);
    
    if (error || !user) {
      console.log('Invalid JWT token:', error?.message);
      return false;
    }

    // Check if user has admin role
    const { data: roles } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .in('role', ['super_admin', 'admin', 'manager']);

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

    const { session_id }: NotifyWaitlistRequest = await req.json();
    
    if (!session_id) {
      return new Response(
        JSON.stringify({ error: 'session_id is required' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    // Validate session_id format (UUID)
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(session_id)) {
      return new Response(
        JSON.stringify({ error: 'Invalid session_id format' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    console.log(`Checking waitlist for session: ${session_id}`);

    // Get the session details
    const { data: session, error: sessionError } = await supabase
      .from('class_sessions')
      .select(`
        id,
        session_date,
        start_time,
        room,
        current_enrollment,
        max_capacity,
        class_type:class_types(name),
        instructor:instructors(first_name, last_name)
      `)
      .eq('id', session_id)
      .single();

    if (sessionError || !session) {
      console.error('Session not found:', sessionError);
      return new Response(
        JSON.stringify({ error: 'Session not found' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 404 }
      );
    }

    // Check if there's actually a spot available
    if (session.current_enrollment >= session.max_capacity) {
      console.log('No spots available, skipping waitlist notification');
      return new Response(
        JSON.stringify({ message: 'No spots available' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      );
    }

    // Get the next person on the waitlist (status = 'waiting', lowest position)
    const { data: waitlistEntries, error: waitlistError } = await supabase
      .from('class_waitlist')
      .select('*')
      .eq('session_id', session_id)
      .eq('status', 'waiting')
      .order('position', { ascending: true })
      .limit(1);

    if (waitlistError) {
      console.error('Error fetching waitlist:', waitlistError);
      throw waitlistError;
    }

    if (!waitlistEntries || waitlistEntries.length === 0) {
      console.log('No one on waitlist for this session');
      return new Response(
        JSON.stringify({ message: 'No one on waitlist' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      );
    }

    const nextInLine = waitlistEntries[0];
    console.log(`Notifying user ${nextInLine.user_id} (position ${nextInLine.position})`);

    // Set claim expiration to 5 minutes from now
    const claimExpiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString();

    // Update waitlist entry to 'notified' status
    const { error: updateError } = await supabase
      .from('class_waitlist')
      .update({
        status: 'notified',
        notified_at: new Date().toISOString(),
        claim_expires_at: claimExpiresAt,
      })
      .eq('id', nextInLine.id);

    if (updateError) {
      console.error('Error updating waitlist entry:', updateError);
      throw updateError;
    }

    // Get user email
    const { data: userData, error: userError } = await supabase.auth.admin.getUserById(
      nextInLine.user_id
    );

    if (userError || !userData.user?.email) {
      console.error('Could not get user email:', userError);
      return new Response(
        JSON.stringify({ message: 'User notified but email failed', notified: true }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      );
    }

    // Format session details for email
    const classType = Array.isArray(session.class_type)
      ? session.class_type[0]
      : session.class_type;

    const sessionDate = new Date(session.session_date);
    const formattedDate = sessionDate.toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    });

    const [hours, minutes] = session.start_time.split(':');
    const timeDate = new Date();
    timeDate.setHours(parseInt(hours), parseInt(minutes));
    const formattedTime = timeDate.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });

    // Send notification email
    const { error: emailError } = await supabase.functions.invoke('send-email', {
      body: {
        type: 'waitlist_notification',
        to: userData.user.email,
        data: {
          class_name: classType?.name || 'Class',
          date: formattedDate,
          time: formattedTime,
        },
      },
    });

    if (emailError) {
      console.error('Error sending waitlist notification email:', emailError);
    } else {
      console.log(`Waitlist notification sent to ${userData.user.email}`);
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Waitlist user notified',
        user_id: nextInLine.user_id,
        claim_expires_at: claimExpiresAt,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );
  } catch (error) {
    console.error('Error in notify-waitlist:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
