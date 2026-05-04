## Problem

`send-sms` edge function fails immediately with:
```
TypeError: userClient.auth.getClaims is not a function
```

Cause: the function imports `@supabase/supabase-js@2.45.0`, which does not expose `auth.getClaims()`. That method only exists on newer SDK versions. Every SMS send (test, admin one-off, blast, playbook) is currently broken at the auth gate before Twilio is ever called.

## Fix

In `supabase/functions/send-sms/index.ts`, replace the `getClaims` call with `getUser(token)`, which exists in 2.45.0 and returns the same `sub`/email info we need.

Change roughly lines 121–134 from:

```ts
const userClient = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY")!, {
  global: { headers: { Authorization: authHeader } },
});
const { data: claims } = await userClient.auth.getClaims(authHeader.replace("Bearer ", ""));
if (!claims?.claims) { ...401... }
const callerUserId = (claims.claims as any).sub as string;
```

to:

```ts
const userClient = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY")!, {
  global: { headers: { Authorization: authHeader } },
});
const { data: userData, error: userErr } = await userClient.auth.getUser(
  authHeader.replace("Bearer ", "")
);
if (userErr || !userData?.user) { ...401... }
const callerUserId = userData.user.id;
```

No other logic changes — the rest of the function (admin role lookup, idempotency, Twilio call, logging) keeps working as-is.

## Verification

1. Deploy `send-sms`.
2. From admin → member detail → Send SMS, send a test message to a known phone.
3. Confirm: HTTP 200, `twilio_sid` returned, message arrives, no `getClaims` error in edge logs.
4. Spot-check a marketing blast (1 recipient) to confirm the same auth path works for `ComposeSmsDialog`.

## Out of scope

- No SDK version bump (would risk breaking other functions sharing patterns).
- No template, consent, or Twilio config changes.
