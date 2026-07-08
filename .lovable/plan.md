## Why replies aren't reaching you

I traced the whole path. Here's what's actually happening:

1. Staff replies are sent from `admin@stormwellnessclub.com` (in `send-email` edge function), with **no `Reply-To` header**. So when a member hits Reply in their email client, the reply goes to `admin@stormwellnessclub.com`.
2. The MX records for `stormwellnessclub.com` currently point at **`mx10/20/30.antispam.mailspamprotection.com`** — a cPanel-style spam-filtered mailbox host, not Google Workspace, not Resend.
3. That means every reply is being dumped into a cPanel/webmail inbox behind a third-party spam filter. If nobody is logging into that mailbox (or the spam filter is eating messages), the replies simply vanish. Kristina Khanji's reply making it through is consistent with that — one message got past the filter, the rest didn't.
4. The app **already has a receive-email edge function** (`supabase/functions/receive-email/index.ts`) that parses Resend Inbound webhooks and drops the message straight into `email_conversations` / `email_messages` so it shows up in `/admin/emails` next to the original thread. **It has never been called** — 0 out of 584 member messages in the DB were ingested through it. All 584 member "messages" came from the in-app portal Support chat, not from email replies.

So this is not a bug in send-email or receive-email — the webhook is fine. The problem is that email replies never reach it, because MX points somewhere else and nobody's watching that mailbox.

## The fix (recommended)

Use a dedicated reply subdomain so we can send replies through the existing Resend setup and receive replies through Resend Inbound, without touching the existing `stormwellnessclub.com` MX (which some other tooling may still depend on).

### Steps

1. **Add a `reply.stormwellnessclub.com` subdomain in Resend and verify it for Inbound.** In Resend: create the domain, add its Inbound MX record at the DNS host (`10 inbound-smtp.resend.com` or whatever Resend prescribes), verify DKIM/SPF for that subdomain. (This is a DNS action you do at your registrar — I'll tell you exactly which records to add once we start; nothing to configure in code for this step.)

2. **Set up the Resend Inbound webhook to point at the existing `receive-email` edge function** at:
   `https://cqzmrdzwgsujgbjqpoxh.functions.supabase.co/receive-email`
   Resend will give a signing secret when you create the webhook.

3. **Save that signing secret as `RESEND_WEBHOOK_SECRET`.** The receive-email function already reads this env var and refuses to process unsigned payloads — right now it's likely missing, which would also explain silent failures if Resend ever did POST to it.

4. **Edit `send-email` (`supabase/functions/send-email/index.ts` line ~2953)** to set `reply_to: 'support@reply.stormwellnessclub.com'` on the send payload for `staff_reply` (and other conversational types like concierge/support). From address stays `admin@stormwellnessclub.com` so the branding is unchanged.

5. **Update the `receive-email` conversation-matching logic** (`supabase/functions/receive-email/index.ts`). Today it matches replies to an existing conversation by cleaning `Re:` off the subject and doing a string-equality lookup — that's fragile (members change subjects, forwards, etc.). Change to: also embed the `conversation_id` in a reply address like `reply+<conversation_id>@reply.stormwellnessclub.com` when we generate the staff reply's `reply_to`, and parse it out in receive-email. Fall back to subject match, then to "new conversation by email".

6. **Tell members in the `staff_reply` template it's OK to reply.** The current template says "reach out through your member portal" — I'll change that copy to "You can reply directly to this email or use the member portal."

7. **Retroactive:** for the members whose replies are stuck in the cPanel mailbox, we can't recover them from code — you'd need to log into that mailbox (webmail via mailspamprotection.com / your host's cPanel) once to sweep whatever's there. I'll flag this in the response but I won't touch mail hosting.

### Files touched

- `supabase/functions/send-email/index.ts` — add `reply_to` for `staff_reply`; tweak template copy.
- `supabase/functions/receive-email/index.ts` — parse `reply+<uuid>@…` addressing, fallback matching.
- No DB migration. No schema change.
- No changes to Lovable email domain settings (project has none — Resend is used directly).

### What I need from you before/while I build

- Confirm you want the reply subdomain approach (vs. changing the root MX to Resend, which would kill the existing cPanel mailbox).
- Once the code is in, you (or I with your help) will need to add the Resend domain + MX + webhook in the Resend dashboard and paste the signing secret when I request it via the secure secret form.

### Out of scope for this plan (mention only)

- The freeze/pause/annual-fee fixes from earlier are already merged into code — separate from this.
- Fixing the underlying `admin@stormwellnessclub.com` cPanel mailbox is a hosting task, not code.
