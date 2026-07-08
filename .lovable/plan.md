## Status

Code side is done and deployed (`send-email` sets `reply_to: reply+<conversation_id>@reply.stormwellnessclub.com`, `receive-email` verifies Svix + routes to conversations). What's missing is the mail plumbing outside the app. I verified today:

- `reply.stormwellnessclub.com` — no MX record exists
- `stormwellnessclub.com` MX — still `mailspamprotection.com` (where Kristina's reply went)
- `receive-email` endpoint — returns 500 (webhook signing secret not set)
- `email_messages` — 0 rows ever ingested from an email reply

So replies keep going to the cPanel mailbox and never reach the app. Nothing else in the code is broken.

## What needs to happen (external, not code)

1. **In Resend → Domains → Add Domain:** add `reply.stormwellnessclub.com` and enable Inbound on it. Resend will give you a set of DNS records (MX for inbound, plus DKIM/SPF for that subdomain).
2. **At your DNS host** (wherever `stormwellnessclub.com` is managed): add the records exactly as Resend lists them. This does NOT change the root `stormwellnessclub.com` MX — the existing cPanel mailbox stays untouched. Only `reply.stormwellnessclub.com` gets the new MX.
3. **In Resend → Webhooks:** create an Inbound webhook pointing to
   `https://cqzmrdzwgsujgbjqpoxh.functions.supabase.co/receive-email`
   subscribed to the `email.received` event. Copy the signing secret Resend shows you.
4. **Save that signing secret** — I'll open the secure form for `RESEND_WEBHOOK_SECRET` as soon as you have the value. The function already reads that env var; the moment it's set, verified webhooks will start ingesting.
5. **Verify** — reply to any staff email from a member address; a new row should appear in `email_messages` and thread into `/admin/emails` under the original conversation.

## Retroactive

Kristina's actual email reply is sitting in the cPanel mailbox at `mailspamprotection.com` (or whatever webmail your host uses for `admin@stormwellnessclub.com`). It can't be pulled into the app from code — someone has to log into that mailbox once and forward or paste the message into the conversation. Same for any other replies stuck there from the past few weeks.

## What I will do next turn (once you confirm)

- Nothing until step 1–3 are done on your side. There's nothing to build.
- When you have the signing secret from step 3, tell me and I'll open the secure form to save `RESEND_WEBHOOK_SECRET`.
- After that I'll re-probe the endpoint and confirm ingestion works end-to-end.

## Not doing

- Not changing the root `stormwellnessclub.com` MX (would break the existing cPanel mailbox and anything else that depends on it).
- Not editing `send-email` or `receive-email` again — they're already correct.
- Not writing any DB migration.
