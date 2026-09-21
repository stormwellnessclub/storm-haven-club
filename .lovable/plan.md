# A "this Sunday" reminder email for Under the Harvest Moon

A second, shorter email that reminds every active member the circle is this Sunday evening — whether or not they've already reserved. It sits beside the invitation controls you already have, and nothing goes out until you press send.

## What you'll see

On the Under the Harvest Moon page in the Events Portal, a second card appears: **Reminder email — this Sunday**, with the same three controls as the invitation:

1. **Preview** — see the finished email on screen exactly as it lands in an inbox.
2. **Send a test to me** — one copy to an address you type in.
3. **Send to members** — asks you to confirm, then sends one email per member. Anyone already sent this reminder is skipped if it's run twice, and it is tracked separately from the invitation, so having received the invitation does not exclude anyone.

## The wording (draft, editable after you preview)

Storm header, then:

> **THIS SUNDAY**
> **Under the Harvest Moon**
> *A Women's Release & Renewal Circle*
> Sunday, September 27 · 6:00 PM · Storm Wellness Club
> Included with your membership

Body, shorter than the invitation:

> Dear [first name],
>
> A gentle reminder that our Women's Release & Renewal Circle gathers this Sunday evening at six.
>
> An intimate, softly lit circle guided by Savannah Rae Alawieh — grounding guidance, intentional stillness, and a closing fire-cleansing ritual, inviting each guest to release what she is ready to leave behind.
>
> If you have already reserved, simply arrive a few minutes before six in comfortable clothing, with a water bottle. Everything else is provided.
>
> If you have not yet reserved, a few places remain.

Single gold button: **Reserve my place** (or, for those attending, it simply opens the event page with their reservation shown), linking to `https://stormwellnessclub.com/events/under-the-harvest-moon`.

Close: *By reservation · Seating intentionally limited* — "With warmth, The Storm Wellness Club Team."

No prices, no seat counts, no ticket language.

## Technical notes

- New edge function `send-harvest-moon-reminder`, cloned from `send-harvest-moon-blast`: `requireStaff(['admin','super_admin'])`, modes `preview`, `testEmail`, default blast; `FROM` and reply stay `admin@stormwellnessclub.com`.
- Idempotency key `email_type = 'harvest_moon_sep_27_2026_reminder'` (test key `..._reminder_test`) in `email_audit_log`, so it is independent of the invitation send.
- Recipients: `members` with `status in ('active','frozen')` and an email on file — cancelled members excluded, matching the invitation.
- New `HarvestMoonReminderControls.tsx` mirroring `HarvestMoonEmailControls.tsx`, rendered on `EventsPortalEventDetail.tsx` under the existing invitation card.
- No changes to event data, reservations, waitlist or eligibility.
