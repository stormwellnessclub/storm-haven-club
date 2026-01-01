import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, svix-id, svix-timestamp, svix-signature',
};

interface ResendEmailPayload {
  type: string;
  created_at: string;
  data: {
    email_id: string;
    from: string;
    to: string[];
    subject: string;
    text?: string;
    html?: string;
    created_at: string;
  };
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    const payload: ResendEmailPayload = await req.json();
    console.log("Received email webhook:", JSON.stringify(payload, null, 2));

    // Only process email.received events
    if (payload.type !== 'email.received') {
      console.log(`Ignoring event type: ${payload.type}`);
      return new Response(
        JSON.stringify({ success: true, message: 'Event type ignored' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      );
    }

    const emailData = payload.data;
    const senderEmail = emailData.from;
    const subject = emailData.subject || 'No Subject';
    const messageBody = emailData.text || emailData.html || '';

    // Extract sender name from email format "Name <email@domain.com>"
    let senderName = '';
    const nameMatch = senderEmail.match(/^([^<]+)\s*<([^>]+)>/);
    const cleanEmail = nameMatch ? nameMatch[2].toLowerCase() : senderEmail.toLowerCase();
    if (nameMatch) {
      senderName = nameMatch[1].trim();
    }

    console.log(`Processing email from: ${cleanEmail}, subject: ${subject}`);

    // Look up user by email in profiles table
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('user_id, first_name, last_name')
      .eq('email', cleanEmail)
      .single();

    if (profileError && profileError.code !== 'PGRST116') {
      console.error("Error looking up profile:", profileError);
    }

    const userId = profile?.user_id;
    const userName = profile ? `${profile.first_name} ${profile.last_name}`.trim() : senderName;

    // Check if this is a reply to an existing conversation by looking at subject
    // Common patterns: "Re: Original Subject" or "RE: Original Subject"
    const isReply = /^(re|fw|fwd):\s*/i.test(subject);
    const cleanSubject = subject.replace(/^(re|fw|fwd):\s*/gi, '').trim();

    let conversationId: string;

    if (isReply && userId) {
      // Try to find existing conversation with matching subject
      const { data: existingConversation } = await supabase
        .from('email_conversations')
        .select('id')
        .eq('user_id', userId)
        .eq('subject', cleanSubject)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (existingConversation) {
        conversationId = existingConversation.id;
        console.log(`Found existing conversation: ${conversationId}`);

        // Update conversation status and last_message_at
        await supabase
          .from('email_conversations')
          .update({
            status: 'open',
            last_message_at: new Date().toISOString(),
          })
          .eq('id', conversationId);
      } else {
        // Create new conversation
        const { data: newConversation, error: convError } = await supabase
          .from('email_conversations')
          .insert({
            user_id: userId,
            subject: cleanSubject,
            status: 'open',
          })
          .select('id')
          .single();

        if (convError) {
          console.error("Error creating conversation:", convError);
          throw convError;
        }
        conversationId = newConversation.id;
        console.log(`Created new conversation: ${conversationId}`);
      }
    } else if (userId) {
      // New conversation from known user
      const { data: newConversation, error: convError } = await supabase
        .from('email_conversations')
        .insert({
          user_id: userId,
          subject: cleanSubject || 'General Inquiry',
          status: 'open',
        })
        .select('id')
        .single();

      if (convError) {
        console.error("Error creating conversation:", convError);
        throw convError;
      }
      conversationId = newConversation.id;
      console.log(`Created new conversation for known user: ${conversationId}`);
    } else {
      // Unknown sender - log but don't create conversation
      console.log(`Email from unknown sender: ${cleanEmail}`);
      
      // You could optionally create a special "unassigned" handling here
      // For now, we'll just acknowledge receipt
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'Email received from unknown sender',
          sender: cleanEmail 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      );
    }

    // Store the message
    const { error: messageError } = await supabase
      .from('email_messages')
      .insert({
        conversation_id: conversationId,
        sender_type: 'member',
        sender_email: cleanEmail,
        sender_name: userName,
        message_body: messageBody,
        resend_message_id: emailData.email_id,
        is_read: false,
      });

    if (messageError) {
      console.error("Error storing message:", messageError);
      throw messageError;
    }

    console.log(`Message stored successfully in conversation: ${conversationId}`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        conversationId,
        message: 'Email processed successfully' 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );

  } catch (error: unknown) {
    console.error("Error processing email webhook:", error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
