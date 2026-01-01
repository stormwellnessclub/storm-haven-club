import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.89.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Validate authorization - accepts service role key, anon key (cron), or admin JWT
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

    // Calculate time window: classes starting between 23-25 hours from now
    const now = new Date();
    const in23Hours = new Date(now.getTime() + 23 * 60 * 60 * 1000);
    const in25Hours = new Date(now.getTime() + 25 * 60 * 60 * 1000);

    // Get the date range we need to check
    const startDate = in23Hours.toISOString().split('T')[0];
    const endDate = in25Hours.toISOString().split('T')[0];
    
    console.log(`Checking for classes between ${in23Hours.toISOString()} and ${in25Hours.toISOString()}`);

    // Get all confirmed bookings for sessions in the time window
    const { data: bookings, error: bookingsError } = await supabase
      .from('class_bookings')
      .select(`
        id,
        user_id,
        session:class_sessions!inner(
          id,
          session_date,
          start_time,
          room,
          class_type:class_types(name),
          instructor:instructors(first_name, last_name)
        )
      `)
      .eq('status', 'confirmed')
      .gte('session.session_date', startDate)
      .lte('session.session_date', endDate);

    if (bookingsError) {
      console.error('Error fetching bookings:', bookingsError);
      throw bookingsError;
    }

    console.log(`Found ${bookings?.length || 0} bookings to check`);

    const remindersToSend: any[] = [];

    // Filter bookings that fall within the 23-25 hour window
    for (const booking of bookings || []) {
      // Handle session as array or object
      const session = Array.isArray(booking.session) ? booking.session[0] : booking.session;
      if (!session) continue;

      const sessionDateTime = new Date(
        `${session.session_date}T${session.start_time}`
      );

      if (sessionDateTime >= in23Hours && sessionDateTime <= in25Hours) {
        remindersToSend.push({ ...booking, session });
      }
    }

    console.log(`${remindersToSend.length} reminders to send`);

    let sentCount = 0;
    let errorCount = 0;

    // Send reminder emails
    for (const booking of remindersToSend) {
      try {
        // Get user email from auth
        const { data: userData, error: userError } = await supabase.auth.admin.getUserById(
          booking.user_id
        );

        if (userError || !userData.user?.email) {
          console.error(`Could not get email for user ${booking.user_id}:`, userError);
          errorCount++;
          continue;
        }

        const classType = Array.isArray(booking.session.class_type)
          ? booking.session.class_type[0]
          : booking.session.class_type;
        const instructor = Array.isArray(booking.session.instructor)
          ? booking.session.instructor[0]
          : booking.session.instructor;

        // Format the date nicely
        const sessionDate = new Date(booking.session.session_date);
        const formattedDate = sessionDate.toLocaleDateString('en-US', {
          weekday: 'long',
          month: 'long',
          day: 'numeric',
          year: 'numeric',
        });

        // Format the time
        const [hours, minutes] = booking.session.start_time.split(':');
        const timeDate = new Date();
        timeDate.setHours(parseInt(hours), parseInt(minutes));
        const formattedTime = timeDate.toLocaleTimeString('en-US', {
          hour: 'numeric',
          minute: '2-digit',
          hour12: true,
        });

        // Call the send-email function
        const { error: emailError } = await supabase.functions.invoke('send-email', {
          body: {
            type: 'class_reminder',
            to: userData.user.email,
            data: {
              class_name: classType?.name || 'Class',
              date: formattedDate,
              time: formattedTime,
              room: booking.session.room || 'Storm Wellness Club',
              instructor: instructor
                ? `${instructor.first_name} ${instructor.last_name}`
                : 'TBA',
            },
          },
        });

        if (emailError) {
          console.error(`Error sending reminder to ${userData.user.email}:`, emailError);
          errorCount++;
        } else {
          console.log(`Reminder sent to ${userData.user.email} for ${classType?.name}`);
          sentCount++;
        }
      } catch (err) {
        console.error(`Error processing booking ${booking.id}:`, err);
        errorCount++;
      }
    }

    const result = {
      success: true,
      message: `Processed ${remindersToSend.length} reminders: ${sentCount} sent, ${errorCount} errors`,
      sent: sentCount,
      errors: errorCount,
    };

    console.log(result);

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });
  } catch (error) {
    console.error('Error in send-class-reminders:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
