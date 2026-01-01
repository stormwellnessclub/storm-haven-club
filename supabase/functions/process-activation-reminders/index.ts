import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

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

  console.log('Starting activation reminders processing...');

  try {
    const now = new Date();

    // Get all members with pending_activation status
    const { data: pendingMembers, error: fetchError } = await supabase
      .from('members')
      .select('id, first_name, email, approved_at, activation_deadline')
      .eq('status', 'pending_activation');

    if (fetchError) {
      console.error('Error fetching pending members:', fetchError);
      throw fetchError;
    }

    console.log(`Found ${pendingMembers?.length || 0} pending activation members`);

    const results = {
      day3Reminders: 0,
      day5Reminders: 0,
      autoActivated: 0,
      errors: 0,
    };

    for (const member of pendingMembers || []) {
      if (!member.approved_at) continue;

      const approvedAt = new Date(member.approved_at);
      const daysSinceApproval = Math.floor((now.getTime() - approvedAt.getTime()) / (1000 * 60 * 60 * 24));
      const activationDeadline = member.activation_deadline 
        ? new Date(member.activation_deadline) 
        : new Date(approvedAt.getTime() + 7 * 24 * 60 * 60 * 1000);

      console.log(`Processing member ${member.email}: ${daysSinceApproval} days since approval`);

      try {
        // Day 3 reminder (between 3-4 days)
        if (daysSinceApproval >= 3 && daysSinceApproval < 4) {
          console.log(`Sending day 3 reminder to ${member.email}`);
          await supabase.functions.invoke('send-email', {
            body: {
              type: 'activation_reminder_day3',
              to: member.email,
              data: {
                name: member.first_name,
              },
            },
          });
          results.day3Reminders++;
        }
        // Day 5 reminder (between 5-6 days)
        else if (daysSinceApproval >= 5 && daysSinceApproval < 6) {
          console.log(`Sending day 5 reminder to ${member.email}`);
          await supabase.functions.invoke('send-email', {
            body: {
              type: 'activation_reminder_day5',
              to: member.email,
              data: {
                name: member.first_name,
                activationDeadline: activationDeadline.toLocaleDateString('en-US', { 
                  month: 'long', 
                  day: 'numeric', 
                  year: 'numeric' 
                }),
              },
            },
          });
          results.day5Reminders++;
        }
        // Auto-activate on day 7+
        else if (daysSinceApproval >= 7) {
          console.log(`Auto-activating membership for ${member.email}`);
          
          const today = new Date();
          const startDate = today.toISOString().split('T')[0]; // YYYY-MM-DD format
          
          const { error: updateError } = await supabase
            .from('members')
            .update({
              status: 'active',
              membership_start_date: startDate,
              activated_at: now.toISOString(),
            })
            .eq('id', member.id);

          if (updateError) {
            console.error(`Failed to auto-activate ${member.email}:`, updateError);
            results.errors++;
            continue;
          }

          // Send activation confirmation email
          await supabase.functions.invoke('send-email', {
            body: {
              type: 'membership_activated',
              to: member.email,
              data: {
                name: member.first_name,
                startDate: today.toLocaleDateString('en-US', { 
                  month: 'long', 
                  day: 'numeric', 
                  year: 'numeric' 
                }),
                membershipType: 'Your Selected Tier',
              },
            },
          });
          
          results.autoActivated++;
        }
      } catch (error) {
        console.error(`Error processing member ${member.email}:`, error);
        results.errors++;
      }
    }

    console.log('Processing complete:', results);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Activation reminders processed',
        results 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error in process-activation-reminders:', error);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
