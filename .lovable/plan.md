# Close online café ordering (plus two queued items)

## 1. Turn café online ordering off — today

Right now there is no way to stop online café orders; the order UI is always live. This adds a simple on/off switch.

- Add an **Online ordering** toggle in the café admin/menu manager (admin + manager only).
- When it is off, the café page, member portal café page, and non-member portal café page show the menu as normal but with **no ordering controls at all** — no add-to-cart, no checkout, no notice or banner text. It simply reads as a menu.
- Front desk / kiosk POS is unaffected: staff can still ring up orders in person.
- Flip the switch off now, so no one can place an online order today. Turning it back on is one click.

## 2. Close out today's orders

Sweep any café orders still sitting in pending / preparing / ready from today and mark them completed so the queue and the front-desk banner are clear. (Checked just now: the active queue is currently empty, so this will likely close zero orders — the sweep still runs so nothing is left hanging.)

## Still queued from earlier (not started)

- Nightly job that finalizes leftover draft dues invoices when a freeze ends, with tracking of failed charges like Rola's.
- Report on Cancelled Members showing who carries a balance, the amounts, and next dues invoice dates.

## Technical notes

- Store the flag as a single row in `system_config` (key `cafe_online_ordering_enabled`) — public read, write restricted to admin/manager via RLS, so no new table is needed.
- New `useCafeOrderingEnabled()` hook reads the flag; `CafeOrderContent.tsx` hides cart, quantity steppers, add-on dialog trigger, and the checkout button when disabled, for the `public`, `member`, and `nonmember` variants. The POS path (`src/pages/admin/CafePOS.tsx`, front-desk and kiosk shells) ignores the flag.
- Server-side enforcement: `useCreateCafeOrder` order inserts are blocked by a `BEFORE INSERT` trigger on `cafe_orders` that rejects non-staff inserts while the flag is off, so hiding the button is not the only guard.
- Order sweep: one-time update setting `status = 'completed'` and `completed_at = now()` for orders created today (America/Detroit) still in pending/preparing/ready.
