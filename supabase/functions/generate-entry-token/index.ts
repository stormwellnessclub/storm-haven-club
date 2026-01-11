import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// HMAC-SHA256 implementation for Deno
async function hmacSha256(key: string, message: string): Promise<string> {
  const encoder = new TextEncoder();
  const keyData = encoder.encode(key);
  const messageData = encoder.encode(message);
  
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    keyData,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  
  const signature = await crypto.subtle.sign("HMAC", cryptoKey, messageData);
  return Array.from(new Uint8Array(signature))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

// Get the current 5-minute window timestamp
function getCurrentWindow(): number {
  const now = Date.now();
  const windowMs = 5 * 60 * 1000; // 5 minutes
  return Math.floor(now / windowMs) * windowMs;
}

// Check if a timestamp is within the valid window (with 30-second grace period)
function isTimestampValid(timestamp: number): boolean {
  const now = Date.now();
  const windowMs = 5 * 60 * 1000; // 5 minutes
  const graceMs = 30 * 1000; // 30-second grace period
  
  // Token is valid if it's within the last window + grace period
  const validStart = now - windowMs - graceMs;
  const validEnd = now + graceMs; // Small buffer for clock skew
  
  return timestamp >= validStart && timestamp <= validEnd;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const url = new URL(req.url);
    const action = url.pathname.split("/").pop();

    // Get authorization header for user context
    const authHeader = req.headers.get("Authorization");
    
    if (action === "generate" || req.method === "GET") {
      // Generate a token for the authenticated member
      console.log("[Entry Token] Generating token for member");
      
      if (!authHeader) {
        return new Response(
          JSON.stringify({ error: "Authorization required" }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Get user from JWT
      const token = authHeader.replace("Bearer ", "");
      const { data: { user }, error: userError } = await supabase.auth.getUser(token);
      
      if (userError || !user) {
        console.error("[Entry Token] User auth error:", userError);
        return new Response(
          JSON.stringify({ error: "Invalid authentication" }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Get member record
      const { data: member, error: memberError } = await supabase
        .from("members")
        .select("id, member_id, first_name, last_name, membership_type, status, photo_url")
        .eq("user_id", user.id)
        .single();

      if (memberError || !member) {
        console.error("[Entry Token] Member not found:", memberError);
        return new Response(
          JSON.stringify({ error: "Member not found" }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Get token secret from scanner settings
      const { data: settings, error: settingsError } = await supabase
        .from("scanner_settings")
        .select("qr_token_secret")
        .eq("location_name", "front_desk")
        .single();

      if (settingsError || !settings?.qr_token_secret) {
        console.error("[Entry Token] Token secret not found:", settingsError);
        return new Response(
          JSON.stringify({ error: "Configuration error" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Generate token: member_id:timestamp:signature
      const currentWindow = getCurrentWindow();
      const message = `${member.member_id}:${currentWindow}`;
      const signature = await hmacSha256(settings.qr_token_secret, message);
      const entryToken = `${member.member_id}:${currentWindow}:${signature}`;

      console.log("[Entry Token] Token generated for member:", member.member_id);

      return new Response(
        JSON.stringify({
          success: true,
          token: entryToken,
          member: {
            id: member.id,
            member_id: member.member_id,
            first_name: member.first_name,
            last_name: member.last_name,
            membership_type: member.membership_type,
            status: member.status,
            photo_url: member.photo_url,
          },
          expires_at: currentWindow + (5 * 60 * 1000), // Next window start
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "validate" && req.method === "POST") {
      // Validate a scanned token (called by admin scanner)
      console.log("[Entry Token] Validating scanned token");

      const body = await req.json();
      const { token: scannedToken } = body;

      if (!scannedToken) {
        return new Response(
          JSON.stringify({ valid: false, error: "No token provided" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Parse token: member_id:timestamp:signature
      const parts = scannedToken.split(":");
      if (parts.length !== 3) {
        console.log("[Entry Token] Invalid token format");
        return new Response(
          JSON.stringify({ valid: false, error: "Invalid code format" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const [memberId, timestampStr, providedSignature] = parts;
      const timestamp = parseInt(timestampStr, 10);

      if (isNaN(timestamp)) {
        console.log("[Entry Token] Invalid timestamp in token");
        return new Response(
          JSON.stringify({ valid: false, error: "Invalid code" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Check if timestamp is valid
      if (!isTimestampValid(timestamp)) {
        console.log("[Entry Token] Token expired, timestamp:", timestamp, "now:", Date.now());
        return new Response(
          JSON.stringify({ 
            valid: false, 
            error: "Code expired - ask member to refresh their app",
            expired: true 
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Get token secret
      const { data: settings, error: settingsError } = await supabase
        .from("scanner_settings")
        .select("qr_token_secret")
        .eq("location_name", "front_desk")
        .single();

      if (settingsError || !settings?.qr_token_secret) {
        console.error("[Entry Token] Token secret not found:", settingsError);
        return new Response(
          JSON.stringify({ valid: false, error: "Configuration error" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Verify signature
      const message = `${memberId}:${timestamp}`;
      const expectedSignature = await hmacSha256(settings.qr_token_secret, message);

      if (providedSignature !== expectedSignature) {
        console.log("[Entry Token] Invalid signature");
        return new Response(
          JSON.stringify({ valid: false, error: "Invalid code" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      console.log("[Entry Token] Token valid for member:", memberId);

      return new Response(
        JSON.stringify({ 
          valid: true, 
          member_id: memberId,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ error: "Invalid action" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: unknown) {
    console.error("[Entry Token] Error:", error);
    const errorMessage = error instanceof Error ? error.message : "Internal server error";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
