# Spa Add-Ons + Itemized Receipts

Today there is no way to attach an add-on (CBD, aromatherapy, hot stones, etc.) to a spa appointment: the add-on table exists in the database but it is empty, no admin screen creates them, and the checkout dialog only charges the service price plus tip. Spa checkouts also send no receipt email at all.

## What gets built

### 1. Manage add-ons (Admin → Spa)
A new "Add-Ons" tab where you create and edit add-ons: name, price, optional extra minutes, which service categories it applies to (massage, facial, recovery...), and active/inactive. Seeded with CBD so it's usable immediately; you add the rest.

### 2. Add-ons at checkout
In the spa completion / "Edit Payment" dialog:
- A list of add-ons valid for that service, each with a checkbox and price.
- Running breakdown: Service, each Add-on, Tip, Total.
- Tip percentages calculate on service + add-ons (the full service value), not service alone.
- Works for both live checkout and retroactive edits, so Jamila's CBD can be added to today's appointment and re-charged/adjusted.

Selected add-ons are saved on the appointment so they show in history, the therapist payroll view, and reporting.

### 3. Itemized spa receipt email
A new spa receipt email sent when an appointment is completed or a payment is recorded, showing:

```text
Massage — 60 min            $120.00
CBD add-on                   $20.00
                          ----------
Subtotal                    $140.00
Tip                          $28.00
Total charged               $168.00
```

Plus therapist name, date/time (Detroit time), and payment method (card •••• 4242 / cash / other). A "Send receipt" checkbox in the dialog is on by default, so you can skip it when needed. No-charge appointments send nothing.

## Technical notes

- Migration: add `addons jsonb default '[]'` and `addons_total numeric default 0` to `spa_appointments` (snapshot of name/price at time of sale so later price changes don't rewrite history). No new table needed; `spa_service_addons` already exists with hooks (`useSpaAddons`, create/update/delete).
- Seed row in `spa_service_addons` for CBD.
- New `SpaAddonsTab` component using the existing hooks, mounted in the spa admin page next to Availability.
- `SpaCompletionDialog.tsx`: add-on selection state, totals derived from service + add-ons, Stripe charge amount and description updated to include add-ons, `addons`/`addons_total` written on update.
- New `spa_receipt` case in `supabase/functions/send-email/index.ts` following the existing `pos_charge_receipt` styling, invoked from the completion dialog after a successful save.
- Backfill Jamila's appointment is done through the UI (Edit Payment → add CBD → resend receipt), not via SQL.
