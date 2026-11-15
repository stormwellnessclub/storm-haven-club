# Get client PT session requests ready (still kept off)

Short answer: not ready yet. These pieces need to be built first. The "Request a Session" button stays greyed out as "Coming Soon" until you say to switch it on.

## What gets built
1. **Three-tab layout from your walkthrough:** Overview, Request Session, Requests + Upcoming. Billing and history stay on the page, under Overview.
2. **Overview cards:** active package, sessions left, expiration, next session, next autopay. These are cards, not lines.
3. **Request form (built but locked):** trainer preference, preferred date, preferred time, from–to window, a flexibility choice, optional notes, and a clear notice: "This is a request, not a confirmed booking."
4. **Requests + Upcoming:** pending requests show "Requested / Awaiting Confirmation" in their own section, separate from confirmed sessions. Any new time staff offer appears there for the client.
5. **Hide staff notes:** clients can no longer read staff notes on their requests or in the older dashboard training cards.
6. **Confirmation messages:** check that a text and an email go to the client when staff confirm a request or offer a new time. Add them if they're missing. Texts go through the normal consent-checked sender.

## Staying the same
- Clients never see trainer schedules, hours, time off or the waitlist.
- Nothing changes on the staff confirm or offer-a-new-time side.
- No real client is contacted or charged while testing. I'll use test bookings that get undone.

## Technical details
- Add window start/end and flexibility columns to the PT request table.
- Return request data to clients only through a client-safe read function, following the same pattern as `pt_my_portal()`.
- Switch the dashboard PT cards to client-safe fields.
- The submit action stays disabled behind one on/off switch.
