# Under the Harvest Moon — the members' invitation email

You'll see the email exactly as members would receive it before anything is sent. Nothing goes out until you press send yourself.

## How you'll review and send it

Inside the Events Portal, on the Under the Harvest Moon page, three quiet controls appear:

1. **Preview the invitation** — opens the finished email on screen, as it will look in an inbox.
2. **Send a test to me** — sends the real email to one address you type in (defaults to your club inbox), so you can see it on your phone.
3. **Send to members** — asks you to confirm, then sends one email per active member with an address on file. Cancelled members are never included. If it's run twice, anyone already sent is skipped.

## The wording

Storm Wellness Club header, then:

> **AN INVITATION**
> **Under the Harvest Moon**
> *A Women's Release & Renewal Circle*
> Sunday, September 27 · 6:00 PM · Storm Wellness Club
> An exclusive members-only evening, included with your membership

Then your approved copy, unchanged — "Step into an intimate, restorative space…" through "…leave feeling lighter, more grounded, and deeply connected to yourself." — followed by the facilitator line for Savannah Rae Alawieh, the note on what to bring, and a single gold button, **Reserve my place**, linking to the event page.

Closing: *By reservation · Seating intentionally limited* and "With warmth, The Storm Wellness Club Team."

No prices, no seat counts, no ticket language anywhere.

## The links

Only two links appear in the email, and both are checked before sending:

- **Reserve my place** (the gold button) and the small "View the invitation" line both go to `https://stormwellnessclub.com/events/under-the-harvest-moon` — the event's own page, which already exists publicly and opens straight to the full write-up with the reserve button.
- The footer email address opens a message to admin@stormwellnessclub.com.

Before you send, I'll open the live address in a browser and confirm it loads the event directly, signed in and signed out, on desktop and phone — no redirect to the events list, no sign-in wall, no missing-page state. A signed-out member landing there sees the invitation and is asked to sign in to reserve; she returns to the same event afterwards.

## Technical notes

- New edge function `send-harvest-moon-blast`, modelled on `send-sound-bath-event-blast`: `requireStaff(['admin','super_admin'])`, modes `preview` (returns HTML), `testEmail` (single send), default blast. Idempotent on `email_type = 'harvest_moon_sep_27_2026'` against the existing sent-email log; recipients are members with `status = 'active'` and an email on file.
- Sends through Resend with the existing Storm branded shell and `/storm-logo-gold.png`; CTA links to `https://stormwellnessclub.com/events/under-the-harvest-moon`.
- New `HarvestMoonEmailControls.tsx` (same shape as `EventEmailBlastControls.tsx`) rendered on `EventsPortalEventDetail.tsx` for the `under-the-harvest-moon` event, visible to Events Portal managers only.
- No changes to event data, reservations, waitlist or eligibility logic.
