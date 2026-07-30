# Ozone Sauna — make it bookable

Ozone Sauna exists as an active Recovery service ($85) but has **zero availability windows**, so no time slots can ever be generated. It is also missing entirely from the member Wellness page. That is why there is nowhere to book it.

Timing: the treatment is **30 minutes**, plus a **15-minute cleanup**, so the calendar blocks 45 minutes. Public and member views show only "30 min" — the cleanup buffer is admin-side only.

## How it will work

**Members and public (self-serve): request only.**
Ozone is not instantly bookable — guests must be called first. Everywhere a member or visitor sees Ozone Sauna, the button says "Request Appointment" and opens a short form requiring **name, phone, and email**, plus preferred day/time and an optional note. Submitting logs a request for staff to follow up and confirms with an on-screen message.

**Admin and Front Desk: real booking.**
Staff can book Ozone directly for members and non-members from the existing spa booking tools, with real time slots generated from the hours below.

## Availability (30-min treatment + 15-min cleanup = 45-min block)

- Monday–Friday: 11:00 AM – 8:15 PM (last appointment 7:30 PM)
- Saturday–Sunday: 11:00 AM – 6:15 PM (last appointment 5:30 PM)
- Room: Spa Room 3 (or the closest existing room record), no therapist required

## Changes

1. **Database**
   - Add `phone` (text) and `preferred_time` (text, optional) to `spa_service_requests` so staff have a callback number.
   - Insert availability windows for the Ozone Sauna service on all 7 days per the hours above, tied to Spa Room 3.
   - Set the Ozone service to 30-minute duration with a 15-minute cleanup buffer, so slots start every 45 minutes but display as 30 min.

2. **Public spa page (`src/pages/Spa.tsx`)**
   - Recovery services currently all render "Book Now". Ozone becomes an exception: "Request Appointment", routed to the existing request modal.
   - Extend the request modal with a required phone field and a preferred day/time field, with validation.

3. **Member Wellness page (`src/pages/member/Wellness.tsx`)**
   - Add an Ozone Sauna card alongside Red Light and Dry Cryo, showing the member's ozone credit balance (the `ozone` credit type already exists).
   - Its action is "Request Appointment", using the same request form, prefilled with the member's name/email/phone on file.
   - Include ozone appointments in the "upcoming wellness appointments" filter so confirmed staff-booked sessions show up.

4. **Admin visibility**
   - Requests already land in the spa service requests admin view; it will now also display phone and preferred time.

## Technical notes

- Ozone service id: `fdd56b42-9a8c-47fc-9d29-0c657f9f5d34`, category `Recovery`.
- Slot generation uses `spa_service_availability` via `src/lib/spaAvailability.ts`; adding rows is what makes staff-side slots appear.
- Insert policy on `spa_service_requests` stays as-is; new columns are nullable with phone enforced client-side and by a validation trigger on ozone requests.
