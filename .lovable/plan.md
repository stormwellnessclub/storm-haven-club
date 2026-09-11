# Private Events: Requests, Planning, Billing

A complete private-event system: a public request page, an admin planning hub, deposit and balance invoicing, to-do lists, and time blocking. Separate from the existing ticketed Events area.

## 1. Public request page (`/private-events`)

- Short, branded page describing private event hosting at Storm.
- Request form: name, email, phone, event type (free text plus common picks: birthday, bridal, baby shower, corporate, spa party, buyout, other), preferred date and time, guest count, spaces wanted, budget range, notes.
- Submitting creates an inquiry in the admin hub and sends a confirmation email to the requester plus a notification to staff.
- Requests appear immediately in the admin inbox with a "New" badge.

## 2. Admin hub (`/admin/private-events`)

Master-detail layout, consistent with the rest of the admin.

**Left:** pipeline list filtered by stage — Inquiry, Quoted, Deposit Sent, Booked, Completed, Lost — with date, client, guest count, and balance owed.

**Right (tabs for the selected event):**

- **Overview** — client contact, event type, date/time, spaces, guest count, stage, internal notes. Buttons to advance stage.
- **Quote** — line items (room fee, per-guest food, staff hours, add-ons) each with quantity and price; automatic 6% Michigan sales tax and optional processing-fee pass-through; a manual flat-total override when you'd rather just name a price. Deposit amount (fixed dollar or percent) and balance due date.
- **Billing** — send deposit invoice, then balance invoice. Two ways to collect: email a secure pay link to any client, or charge a member's card on file directly. Each invoice shows status (Draft, Sent, Paid, Overdue) with paid date and amount. Records refunds/manual payments (cash, check) too.
- **To-do** — checklist per event with assignee, due date, and done state. Optional starter checklist templates per event type so a new booking starts pre-populated.
- **Timeline** — running log: request received, quote sent, deposit paid, emails sent, stage changes.

**Calendar view** — month/week view of all booked private events, color-coded by stage, so you can see the season at a glance.

## 3. Time blocking

When an event reaches Booked (or when you manually block earlier):

- It appears on the private events calendar and the admin day view.
- The chosen spaces are blocked for the window, so class scheduling and spa booking will not offer conflicting slots in those rooms, and a conflict warning shows if something is already booked there.
- Blocks are released automatically if the event is cancelled.

## 4. Emails

Storm-branded templates: request received, quote/proposal, deposit invoice, deposit received, balance invoice, balance received, event reminder (a few days out). Every send is previewable before it goes out.

## Technical notes

- New tables: `private_event_requests`, `private_events`, `private_event_line_items`, `private_event_invoices`, `private_event_tasks`, `private_event_blocks`, `private_event_activity`. Each gets explicit GRANTs; RLS allows anonymous insert on requests only, staff read/write via `has_any_role`, and no member-side read access.
- Public request insert is anon-insert with strict column defaults; the server stamps stage and timestamps.
- Invoicing uses the existing Stripe integration and its secret key — no new payment provider. Email pay links use a Stripe Checkout session in `payment` mode with an event-scoped token; saved-card charges reuse the current `stripe-payment` charge path with the member's default payment method, including the existing no-card-on-file handling.
- Money: amounts in cents, 6% MI sales tax, existing gross-up processing-fee formula reused from `src/lib/processingFee.ts`.
- All dates render in `America/Detroit`.
- Room blocking reuses the existing schedule/spa conflict checks by adding private-event blocks as a busy source, mirroring how `get_spa_busy_slots` is consumed.
- New edge functions: `private-event-request` (public submit + notify), `private-event-invoice` (create/send invoice, pay link, saved-card charge), `private-event-invoice-confirm` (finalize on payment).
- Sidebar: "Private Events" under Events, with a badge for new requests and unpaid invoices.
