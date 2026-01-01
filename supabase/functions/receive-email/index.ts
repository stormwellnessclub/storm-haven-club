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

// Input validation constants
const MAX_EMAIL_LENGTH = 254;
const MAX_SUBJECT_LENGTH = 500;
const MAX_MESSAGE_LENGTH = 100000; // 100KB limit
const MAX_NAME_LENGTH = 200;

// Simple email format validation
function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email) && email.length <= MAX_EMAIL_LENGTH;
}

// Sanitize HTML - strip script tags and event handlers
function sanitizeHtml(html: string): string {
  if (!html) return '';
  
  // Remove script tags and their content
  let sanitized = html.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
  
  // Remove event handlers (onclick, onerror, etc.)
  sanitized = sanitized.replace(/\s*on\w+\s*=\s*["'][^"']*["']/gi, '');
  sanitized = sanitized.replace(/\s*on\w+\s*=\s*[^\s>]+/gi, '');
  
  // Remove javascript: URLs
  sanitized = sanitized.replace(/javascript:/gi, '');
  
  // Remove data: URLs that could contain scripts
  sanitized = sanitized.replace(/data:\s*text\/html/gi, 'data:blocked');
  
  return sanitized;
}

// Truncate and sanitize text
function sanitizeText(text: string, maxLength: number): string {
  if (!text) return '';
  return text.slice(0, maxLength).trim();
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
    console.log("Received email webhook:", payload.type, "from:", payload.data?.from);

    // Only process email.received events
    if (payload.type !== 'email.received') {
      console.log(`Ignoring event type: ${payload.type}`);
      return new Response(
        JSON.stringify({ success: true, message: 'Event type ignored' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      );
    }

    const emailData = payload.data;
    
    // Validate required fields exist
    if (!emailData || !emailData.from) {
      console.error("Invalid email data: missing required fields");
      return new Response(
        JSON.stringify({ error: 'Invalid email data: missing sender' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    const senderEmail = emailData.from;
    const subject = sanitizeText(emailData.subject || 'No Subject', MAX_SUBJECT_LENGTH);
    
    // Sanitize message body - prefer text over HTML, apply sanitization
    let messageBody = '';
    if (emailData.text) {
      messageBody = sanitizeText(emailData.text, MAX_MESSAGE_LENGTH);
    } else if (emailData.html) {
      messageBody = sanitizeHtml(sanitizeText(emailData.html, MAX_MESSAGE_LENGTH));
    }

    // Extract sender name from email format "Name <email@domain.com>"
    let senderName = '';
    const nameMatch = senderEmail.match(/^([^<]+)\s*<([^>]+)>/);
    const rawEmail = nameMatch ? nameMatch[2] : senderEmail;
    const cleanEmail = rawEmail.toLowerCase().trim().slice(0, MAX_EMAIL_LENGTH);
    
    // Validate email format
    if (!isValidEmail(cleanEmail)) {
      console.error("Invalid sender email format:", cleanEmail);
      return new Response(
        JSON.stringify({ error: 'Invalid sender email format' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }
    
    if (nameMatch) {
      senderName = sanitizeText(nameMatch[1], MAX_NAME_LENGTH);
    }

    console.log(`Processing validated email from: ${cleanEmail}, subject: ${subject.slice(0, 50)}...`);

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
    const userName = profile 
      ? sanitizeText(`${profile.first_name} ${profile.last_name}`.trim(), MAX_NAME_LENGTH) 
      : senderName;

    // Check if this is a reply to an existing conversation by looking at subject
    // Common patterns: "Re: Original Subject" or "RE: Original Subject"
    const isReply = /^(re|fw|fwd):\s*/i.test(subject);
    const cleanSubject = subject.replace(/^(re|fw|fwd):\s*/gi, '').trim() || 'General Inquiry';

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
      console.log(`Created new conversation for known user: ${conversationId}`);
    } else {
      // Unknown sender - log but don't create conversation
      console.log(`Email from unknown sender: ${cleanEmail}`);
      
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'Email received from unknown sender',
          sender: cleanEmail 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      );
    }

    // Store the message with sanitized data
    const { error: messageError } = await supabase
      .from('email_messages')
      .insert({
        conversation_id: conversationId,
        sender_type: 'member',
        sender_email: cleanEmail,
        sender_name: userName,
        message_body: messageBody,
        resend_message_id: emailData.email_id?.slice(0, 255) || null,
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
