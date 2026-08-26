# Make the Intake Link Actually Land on the Form — Then Send the Sept 13 Emails

## I checked the link end-to-end. It works only if they're already signed in.

What works today:
- The email button points to `stormwellnessclub.com/portal/bookings?intake=<their appointment id>`.
- That page reads `?intake=`, finds the matching upcoming appointment, and the intake dialog opens automatically. Verified in the code.

Where it breaks:
- If the guest is **signed out** when they tap the button, the portal guard bounces them to
  `/auth?redirect=/portal` — a hardcoded destination that **throws away the `?intake=` part**.
  After signing in they land on the portal home, not the intake form.
- The member page has the same problem by a different route: its guard passes only the path,
  not the `?intake=` piece, so members lose the deep link too.

All four Sept 13 guests have accounts (created when they were booked) but almost certainly
aren't signed in on their phones, so today most of them would hit exactly that dead end.

## What the intake form asks today (no changes planned unless you want them)

Required: at least one focus area (tap-the-body diagram: head/scalp, neck,
shoulders, upper/mid/lower back, arms, hands, chest, abdomen, hips, glutes,
hamstrings, quads, calves, feet) and the consent checkbox.

Also collected: preferred pressure (light / medium / firm / deep tissue);
pain-or-tension level 0-10 with a free-text "where does it hurt / injuries"
box when above 0; health conditions (pregnancy, high/low blood pressure,
heart condition, blood thinners, diabetes, recent surgery under 6 months,
skin condition, allergies, varicose veins, fibromyalgia/chronic pain, cancer
history, other); allergies to oils/lotions/fragrances; current medications;
goals for the session; areas to avoid; prior massage experience (first time /
occasional / regular).

Consent line: "I confirm the information above is accurate and I consent to
receive treatment. I understand I should notify my therapist of any discomfort
during the session."

Therapists see the completed form on the appointment. Tell me anything you
want added or removed and I'll fold it into this same change.

## Fix before sending (small, two files)


1. `src/components/portal/ProtectedPortalRoute.tsx` — redirect to
   `/auth?redirect=<current path + query>` instead of the hardcoded `/portal`.
2. `src/components/member/ProtectedMemberRoute.tsx` — carry the query string along with the
   path so `?intake=` survives sign-in.

`Auth.tsx` already honors a `redirect` query param and only allows internal paths, so nothing
changes there.

After the fix: signed-in guest → intake form opens immediately. Signed-out guest → sign in, then
lands straight on the intake form.

## Then send the four confirmations

| Time | Guest | Email | Service | Therapist |
|---|---|---|---|---|
| 10:00 AM | Jessica Keep | keepjessica1@gmail.com | Prenatal Massage — 90 min | Teresa Tyler |
| 10:00 AM | Caroline Landry | ckeep@umich.edu | Storm Signature Massage — 90 min | Arleacia Parker |
| 11:50 AM | Suzanne Keep | suzkeep@gmail.com | Storm Signature Massage — 90 min | Arleacia Parker |
| 11:50 AM | Sarah Cottrell | sarahkcottrell@gmail.com | Deep Relief Massage — 90 min | Teresa Tyler |

None of them has an intake form yet, so all four get the intake section.

Subject: **Spa appointment confirmed — <their service>**

```text
Appointment Confirmed ✓

Looking forward to seeing you. Here are the details:

  Service    Storm Signature Massage — 90
  Date       Sunday, September 13, 2026
  Time       11:50 AM
  With       Arleacia Parker
  Duration   90 min

[ Arrival — gold box ]
Please arrive 10 minutes early to settle in.
Cancellations within 24 hours may incur a fee.

[ Before your session — intake form — green box ]
Please complete your intake form so your therapist can tailor the
session (focus areas, pressure, health notes). It only takes a
couple of minutes.
            [ Complete Intake Form ]

If the button doesn't work, sign in to your account dashboard and
open "My Bookings" — your appointment will show a
"Complete Intake Form" button right on it.

            [ View My Appointments ]


— The Storm Wellness Club Team
```

I'll send one email per guest with their own details, then report back sent/failed for each.
Their automatic 24-hour reminder will still go out separately and will nudge the intake form
again if it's still blank.

## Technical detail

Guard changes use `useLocation()` and build `/auth?redirect=${encodeURIComponent(pathname + search)}`.
Sends invoke the deployed `send-email` function with `type: 'spa_appointment_confirmation'` and
`{ service, date, time, provider, duration, bookingsPath: '/portal/bookings', needsIntake: true,
intakeUrlPath: '/portal/bookings?intake=<id>' }`. No database or schema changes.
