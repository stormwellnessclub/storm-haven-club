# Body Wrap requests: day/time on the form, and easy for staff to find

## Where it is today
Your request (Detox Seaweed & Charcoal Wrap, 7:03 PM) was saved. Staff see it under **Admin → Spa Management → Requests**. Nothing tells them a new one came in. The form's day/time box is optional free text, so your request had no day or time.

## Changes
- **Request form:** the client must pick a **day** from a calendar and a **time** (for example, 10:00 AM). They can add a second-choice day and time if they want. Notes stay optional.
- **Appointment Requests:** requests stay in the Spa Management → Requests tab, the same place for admin and front desk. Each one shows the requested day and time. New requests go to the top.
- **New-request count:** a red number on the Spa Management menu item and the Requests tab until staff handle them. No emails go out.
- **Status:** New → Booked / Contacted / Declined, with a "Show handled" switch.
- **"Book this request" button:** opens the staff booking screen with the client, service, requested day/time and Room 6 already filled in. Once booked, the request is marked Booked.

## Technical details
- Add `requested_date`, `requested_time`, `alt_date`, `alt_time`, `status` (default 'new'), `handled_by`, `handled_at` and `appointment_id` to `spa_service_requests`. Staff-only update policy. The old `preferred_time` text stays for past requests.
- The count comes from a shared hook with a realtime listener, used by both the sidebar and the tab.
