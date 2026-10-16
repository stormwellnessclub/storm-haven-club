# Make Body Wrap requests easy for staff to find

## Where it is today
Your request (Detox Seaweed & Charcoal Wrap, 7:03 PM) was saved. Staff can see it under **Admin → Spa Management → Requests** tab. Nothing tells them a new one came in, and there's no way to mark it as handled.

## Changes
- **Alert for new requests:** a red count on the Spa Management menu item and on the Requests tab, for both admin and front desk. A toast pops up when a new request arrives while staff are logged in.
- **Email to the spa inbox** for each new request, listing the name, phone, service and preferred time.
- **Request status:** New → Booked / Contacted / Declined, plus a "Show handled" switch so open requests stay on top.
- **"Book this request" button:** opens the staff booking screen with the client, service and Room 6 already filled in. Once booked, the request is marked Booked automatically.

## Technical details
- Add `status` (default 'new'), `handled_by`, `handled_at` and `appointment_id` to `spa_service_requests`. Staff-only update policy.
- The count query and realtime listener sit in a hook shared by the sidebar and the tab.
- The notification email goes through the existing transactional `send-email`, only to the club's own inbox. No client emails.
