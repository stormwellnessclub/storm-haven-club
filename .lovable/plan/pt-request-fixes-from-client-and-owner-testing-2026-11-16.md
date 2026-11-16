# PT request fixes from client and owner testing

Several fixes you asked for earlier (the time window, multiple days, automatic refresh) are built in the preview, but they aren't on the live app yet because they haven't been published. The plan covers what is still missing, plus your client's scrolling problem.

## 1. Tapping by accident while scrolling (client feedback)
- When a client scrolls through the times, a tap can pick a time they didn't mean to choose.
- Fix: a time only counts as picked on a real tap, not when the finger moves to scroll. The picked time is also highlighted more clearly, and they can tap it again to undo.

## 2. A "confirm your request" pop-up after tapping a time
- When a client taps a time, a pop-up opens with:
  - Day, time, session and trainer
  - Availability Window (from–to) and Flexibility (Flexible within my window / Only at my preferred time)
  - Notes
  - The line "This is a request, not a confirmed booking"
  - **Confirm request** and **Back** buttons
- With "Multiple days," each picked day gets its own pop-up, and a summary lists every day before they send.
- After sending, a clear "Request sent — here's what you asked for" screen lists each request, then takes them to Requests + Upcoming.

## 3. Texts when you decline or offer another time
- Declined: a consent-checked text and email such as "Your PT request for Tue Nov 17, 4:30 PM couldn't be scheduled. Reply or open the app to request another time."
- Offered another time: a text and email with the new time.
- Confirmed: stays as it is today.
- Each message sends only once per request.

## 4. A refresh button inside the app
- A **Refresh** button at the top of the PT page, plus pull-down-to-refresh on phones.
- The automatic refresh (on reopen and every 30 seconds) stays.

## 5. Tapping a request on the admin calendar
- Tapping a "Requested" block on the PT schedule calendar opens that request's details right there on the calendar, with Confirm, Offer another time and Decline, instead of jumping to the Requests list.

## Then
- Test on a phone-sized screen without sending real texts, then ask you to publish so clients see everything.

## Technical notes
- Time buttons: ignore pointer moves of more than about 10px, and use click only (no pointer-down selection).
- Pop-up: a bottom sheet on phones that reuses the existing window, flexibility and note fields from PTRequestSessionForm.
- Decline and alternate messages: send-pt-booking-email (or a sibling request-notice function) calls send-sms without bypassConsent, invoked from the staff decline and alternate actions, with request-level deduplication.
- PTSchedule: the pending-hold click opens an inline side panel that reuses the PTRequests detail and action component.
