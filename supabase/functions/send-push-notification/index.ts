import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { requireStaff } from "../_shared/requireStaff.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// ---- VAPID key helpers using Web Crypto API ----

async function generateVapidKeys(): Promise<{
  publicKey: string;
  privateKey: string;
}> {
  const keyPair = await crypto.subtle.generateKey(
    { name: "ECDSA", namedCurve: "P-256" },
    true,
    ["sign", "verify"]
  );

  const pubRaw = await crypto.subtle.exportKey("raw", keyPair.publicKey);
  const privJwk = await crypto.subtle.exportKey("jwk", keyPair.privateKey);

  const publicKey = base64urlEncode(new Uint8Array(pubRaw));
  const privateKey = privJwk.d!; // already base64url

  return { publicKey, privateKey };
}

function base64urlEncode(buf: Uint8Array): string {
  let s = "";
  for (const b of buf) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function base64urlDecode(s: string): Uint8Array {
  const padded = s + "=".repeat((4 - (s.length % 4)) % 4);
  const bin = atob(padded.replace(/-/g, "+").replace(/_/g, "/"));
  const buf = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i);
  return buf;
}

// ---- Web Push sending (RFC 8291 + VAPID) ----

async function sendWebPush(
  subscription: { endpoint: string; p256dh: string; auth_key: string },
  payload: string,
  vapidPublicKey: string,
  vapidPrivateKey: string
) {
  // Import VAPID private key
  const privKeyBytes = base64urlDecode(vapidPrivateKey);
  const pubKeyBytes = base64urlDecode(vapidPublicKey);

  const vapidKey = await crypto.subtle.importKey(
    "jwk",
    {
      kty: "EC",
      crv: "P-256",
      d: vapidPrivateKey,
      x: base64urlEncode(pubKeyBytes.slice(1, 33)),
      y: base64urlEncode(pubKeyBytes.slice(33, 65)),
    },
    { name: "ECDSA", namedCurve: "P-256" },
    false,
    ["sign"]
  );

  // Create VAPID JWT
  const audience = new URL(subscription.endpoint).origin;
  const jwt = await createVapidJwt(vapidKey, audience, "mailto:noreply@stormwellness.club");

  // Encrypt payload using Web Push encryption (simplified aes128gcm)
  const { ciphertext, salt, localPublicKey } = await encryptPayload(
    subscription.p256dh,
    subscription.auth_key,
    new TextEncoder().encode(payload)
  );

  // Send to push service
  const headers: Record<string, string> = {
    Authorization: `vapid t=${jwt}, k=${vapidPublicKey}`,
    "Content-Type": "application/octet-stream",
    "Content-Encoding": "aes128gcm",
    TTL: "86400",
    Urgency: "high",
  };

  const response = await fetch(subscription.endpoint, {
    method: "POST",
    headers,
    body: ciphertext,
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Push failed (${response.status}): ${text}`);
  }
  await response.text(); // consume body
}

async function createVapidJwt(
  key: CryptoKey,
  audience: string,
  subject: string
): Promise<string> {
  const header = base64urlEncode(
    new TextEncoder().encode(JSON.stringify({ typ: "JWT", alg: "ES256" }))
  );
  const now = Math.floor(Date.now() / 1000);
  const payload = base64urlEncode(
    new TextEncoder().encode(
      JSON.stringify({ aud: audience, exp: now + 3600, sub: subject })
    )
  );

  const signInput = new TextEncoder().encode(`${header}.${payload}`);
  const sigBuf = await crypto.subtle.sign(
    { name: "ECDSA", hash: "SHA-256" },
    key,
    signInput
  );

  // Convert DER signature to raw r||s (64 bytes)
  const sig = derToRaw(new Uint8Array(sigBuf));

  return `${header}.${payload}.${base64urlEncode(sig)}`;
}

function derToRaw(der: Uint8Array): Uint8Array {
  // ECDSA signatures from WebCrypto are already raw r||s on most platforms
  if (der.length === 64) return der;
  // Parse DER format
  const raw = new Uint8Array(64);
  let offset = 2;
  const rLen = der[offset + 1];
  offset += 2;
  const rStart = rLen > 32 ? offset + (rLen - 32) : offset;
  const rDest = rLen < 32 ? 32 - rLen : 0;
  raw.set(der.slice(rStart, rStart + Math.min(rLen, 32)), rDest);
  offset += rLen;
  const sLen = der[offset + 1];
  offset += 2;
  const sStart = sLen > 32 ? offset + (sLen - 32) : offset;
  const sDest = sLen < 32 ? 64 - sLen : 32;
  raw.set(der.slice(sStart, sStart + Math.min(sLen, 32)), sDest);
  return raw;
}

async function encryptPayload(
  p256dhKey: string,
  authSecret: string,
  plaintext: Uint8Array
): Promise<{
  ciphertext: Uint8Array;
  salt: Uint8Array;
  localPublicKey: Uint8Array;
}> {
  const subscriberPublicKey = base64urlDecode(p256dhKey);
  const authSecretBytes = base64urlDecode(authSecret);

  // Generate local ECDH key pair
  const localKeyPair = await crypto.subtle.generateKey(
    { name: "ECDH", namedCurve: "P-256" },
    true,
    ["deriveBits"]
  );

  const localPubRaw = new Uint8Array(
    await crypto.subtle.exportKey("raw", localKeyPair.publicKey)
  );

  // Import subscriber public key
  const subPubKey = await crypto.subtle.importKey(
    "raw",
    subscriberPublicKey as BufferSource,
    { name: "ECDH", namedCurve: "P-256" },
    false,
    []
  );

  // ECDH shared secret
  const sharedSecretBits = await crypto.subtle.deriveBits(
    { name: "ECDH", public: subPubKey },
    localKeyPair.privateKey,
    256
  );
  const sharedSecret = new Uint8Array(sharedSecretBits);

  // Generate salt
  const salt = crypto.getRandomValues(new Uint8Array(16));

  // HKDF to derive encryption key (RFC 8291)
  const ikm = await hkdfExtractAndExpand(
    authSecretBytes,
    sharedSecret,
    concatBuffers(
      new TextEncoder().encode("WebPush: info\0"),
      subscriberPublicKey,
      localPubRaw
    ),
    32
  );

  const prk = await hkdfExtract(salt, ikm);
  const contentKey = await hkdfExpand(
    prk,
    new TextEncoder().encode("Content-Encoding: aes128gcm\0"),
    16
  );
  const nonce = await hkdfExpand(
    prk,
    new TextEncoder().encode("Content-Encoding: nonce\0"),
    12
  );

  // AES-128-GCM encryption
  const key = await crypto.subtle.importKey(
    "raw",
    contentKey as BufferSource,
    { name: "AES-GCM" },
    false,
    ["encrypt"]
  );

  // Add padding delimiter
  const padded = concatBuffers(plaintext, new Uint8Array([2]));

  const encrypted = new Uint8Array(
    await crypto.subtle.encrypt({ name: "AES-GCM", iv: nonce as BufferSource }, key, padded as BufferSource)
  );

  // Build aes128gcm record: salt(16) + rs(4) + idlen(1) + keyid(65) + encrypted
  const rs = new Uint8Array(4);
  new DataView(rs.buffer).setUint32(0, 4096, false);

  const header = concatBuffers(
    salt,
    rs,
    new Uint8Array([localPubRaw.length]),
    localPubRaw
  );

  return {
    ciphertext: concatBuffers(header, encrypted),
    salt,
    localPublicKey: localPubRaw,
  };
}

function concatBuffers(...bufs: Uint8Array[]): Uint8Array {
  const total = bufs.reduce((s, b) => s + b.length, 0);
  const result = new Uint8Array(total);
  let offset = 0;
  for (const b of bufs) {
    result.set(b, offset);
    offset += b.length;
  }
  return result;
}

async function hkdfExtract(
  salt: Uint8Array,
  ikm: Uint8Array
): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey(
    "raw",
    salt as BufferSource,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  return new Uint8Array(await crypto.subtle.sign("HMAC", key, ikm as BufferSource));
}

async function hkdfExpand(
  prk: Uint8Array,
  info: Uint8Array,
  length: number
): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey(
    "raw",
    prk as BufferSource,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const input = concatBuffers(info, new Uint8Array([1]));
  const output = new Uint8Array(await crypto.subtle.sign("HMAC", key, input as BufferSource));
  return output.slice(0, length);
}

async function hkdfExtractAndExpand(
  salt: Uint8Array,
  ikm: Uint8Array,
  info: Uint8Array,
  length: number
): Promise<Uint8Array> {
  const prk = await hkdfExtract(salt, ikm);
  return hkdfExpand(prk, info, length);
}

// ---- Main handler ----

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    const body = await req.json();
    const { action } = body;

    // Action: get-vapid-public-key — returns the public key (generates if missing)
    if (action === "get-vapid-public-key") {
      let { data: existing } = await supabase
        .from("system_config")
        .select("value")
        .eq("key", "vapid_public_key")
        .maybeSingle();

      if (existing?.value) {
        return new Response(
          JSON.stringify({ publicKey: existing.value }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Generate new key pair
      const keys = await generateVapidKeys();
      await supabase.from("system_config").upsert([
        { key: "vapid_public_key", value: keys.publicKey, updated_at: new Date().toISOString() },
        { key: "vapid_private_key", value: keys.privateKey, updated_at: new Date().toISOString() },
      ]);

      return new Response(
        JSON.stringify({ publicKey: keys.publicKey }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Action: send — send push notification to specific users
    if (action === "send") {
      // Require a staff JWT (or service-role key) — never a bare anon key.
      const auth = await requireStaff(req);
      if (!auth.ok) return auth.response;

      const { user_ids, title, message, urgent, url, tag } = body;

      if (!user_ids || !Array.isArray(user_ids) || user_ids.length === 0) {
        return new Response(
          JSON.stringify({ error: "user_ids required" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Get VAPID keys
      const { data: pubRow } = await supabase
        .from("system_config")
        .select("value")
        .eq("key", "vapid_public_key")
        .maybeSingle();
      const { data: privRow } = await supabase
        .from("system_config")
        .select("value")
        .eq("key", "vapid_private_key")
        .maybeSingle();

      if (!pubRow?.value || !privRow?.value) {
        return new Response(
          JSON.stringify({ error: "VAPID keys not configured. Call get-vapid-public-key first." }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Get subscriptions for these users
      const { data: subscriptions } = await supabase
        .from("push_subscriptions")
        .select("*")
        .in("user_id", user_ids);

      if (!subscriptions || subscriptions.length === 0) {
        return new Response(
          JSON.stringify({ sent: 0, message: "No push subscriptions found for these users" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const payload = JSON.stringify({
        title: title || "Storm Wellness Club",
        body: message || "",
        urgent: urgent || false,
        url: url || "/member/kids-care",
        tag: tag || "kids-care",
      });

      let sent = 0;
      let failed = 0;
      const errors: string[] = [];

      for (const sub of subscriptions) {
        try {
          await sendWebPush(
            { endpoint: sub.endpoint, p256dh: sub.p256dh, auth_key: sub.auth_key },
            payload,
            pubRow.value,
            privRow.value
          );
          sent++;
        } catch (err) {
          failed++;
          const errMsg = (err as Error).message;
          errors.push(`${sub.endpoint}: ${errMsg}`);
          // Remove invalid subscriptions (410 Gone)
          if (errMsg.includes("410")) {
            await supabase
              .from("push_subscriptions")
              .delete()
              .eq("id", sub.id);
          }
        }
      }

      return new Response(
        JSON.stringify({ sent, failed, errors: errors.slice(0, 5) }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ error: "Invalid action. Use 'get-vapid-public-key' or 'send'" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Push notification error:", err);
    return new Response(
      JSON.stringify({ error: (err as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
