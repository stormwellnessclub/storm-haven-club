
## Goal
Notify all active members about Thursday, July 23 maintenance: late opening at 7:30 AM and a partial locker room closure between 2–4 PM.

## 1. Member Portal Banner

Add a new dismissible info banner component `MaintenanceJuly23Banner.tsx` (styled like `MemorialDayHoursBanner`) mounted in `MemberLayout.tsx` and `PortalLayout.tsx`. Auto-hides after end of day July 23 (America/Detroit).

**Banner copy:**

> **Thursday, July 23 — Scheduled Maintenance**
> We'll open at **7:30 AM** for required interior maintenance. A second maintenance window runs **2–4 PM** requiring ~1 hour of limited access to one locker room. All other amenities and the facility remain fully open. Thank you for your patience.

## 2. Email Blast

New admin-triggered edge function `send-july-23-maintenance-blast` (modeled on `send-sound-bath-event-blast`), plus a preview/test/send control on the Admin Marketing or EventsHub page using the existing `EventEmailBlastControls` pattern.

Sends to all `members` with `status = 'active'` and an email on file. Idempotent via `email_send_log` message_id `july-23-maintenance-<member_id>`.

**Subject:** Heads up: Thursday 7/23 opening at 7:30 AM (brief maintenance)

**Email body:**

> Hi {{first_name}},
>
> A quick heads up about **Thursday, July 23**:
>
> - **We'll open at 7:30 AM** instead of our usual time so our team can complete required interior maintenance before members arrive.
> - **Between 2:00 PM and 4:00 PM**, we'll need approximately **one hour of limited access to one of the locker rooms** to finish a second maintenance task. The rest of the facility and all amenities will remain fully available during that window.
>
> Everything else runs on the normal schedule — classes, recovery, spa, cafe, and the studios are all open as usual once we unlock the doors at 7:30 AM.
>
> Thank you for your patience as we keep the club in top shape for you.
>
> — The Storm Wellness Club Team

## Technical Notes

- Banner: pure frontend, dismissal stored in `localStorage` key `maint_july23_dismissed`, auto-suppressed after `2026-07-24 00:00 America/Detroit`.
- Edge function reuses existing Lovable Emails infrastructure (`enqueue_email` → `transactional_emails` queue). Adds one `_shared/transactional-email-templates/july-23-maintenance.tsx` React Email template registered in `registry.ts`.
- Admin trigger UI added to `EventsHub.tsx` (or Marketing page — confirm which you'd prefer).

## Please confirm before I build
1. Copy above looks good?
2. Put the admin "Send blast" button on **Marketing** page or **EventsHub**?
