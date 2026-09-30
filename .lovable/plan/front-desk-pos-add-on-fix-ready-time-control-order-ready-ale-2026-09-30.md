# Front Desk POS: add-on fix, ready-time control, "order ready" alerts

## What's wrong today (confirmed in the code)
1. **Wrong item added (the bug you saw).** In the "Customize Shake" box, the "Pick shake" dropdown isn't connected to anything. The Add to Cart button always adds the first item in the list, whatever staff picked.
2. **Tapping an item in an add-on category does nothing.** Staff have to use the Customize box underneath instead, which isn't obvious.
3. **Add-ons don't show on the order.** They're added to the price, but the kitchen and the receipt only see the item name. Staff making the drink can't tell which add-ons were chosen.
4. **Two of the same item with different add-ons may merge into one line.** The cart groups lines by item only. This will be confirmed while building.
5. **No ready time.** Orders have a spot for an estimated ready time, and the member portal already shows "Ready around …". But the front desk has no way to set it or push it back.
6. **No "your order is ready" alert.** Marking an order Ready only changes the member's portal card. No text, email or phone notification goes out.

## What I'll build
**Ordering**
- The item staff pick in the dropdown is the one added. The Add button stays greyed out until a choice is made.
- Tapping an item in an add-on category opens the Customize box with that item already selected.
- Add-ons and flavor appear on the order line, e.g. "Protein Shake – Chocolate + Collagen", on the kitchen card, the receipt and in sales reports.
- Each different add-on combination is its own cart line.

**Ready time (front desk order list)**
- When the order is placed, staff pick a ready time: 5, 10, 15 or 20 minutes, or their own.
- Each open order has **+5 min** and **+10 min** buttons and a "Set time" option to push it back. The new time shows on the order and in the member's portal right away.
- An order shows **Running late** if its ready time has passed and it isn't marked Ready.

**"Order ready" alert to the customer** (sent when staff tap Ready, and only once per order)
- **Text message** through your existing Storm Wellness texting, only to people who agreed to receive texts. Example: "Storm Wellness Club: your order is ready at the café."
- **Phone notification** if they've turned on notifications in the app.
- If the ready time is pushed back, they can optionally get one short "a few more minutes" text.
- The member portal card keeps working as it does now.
- Walk-in orders with no customer attached can't be notified. For those, staff can type a phone number at checkout.

## Question for you
- For the ready alert, is **text plus phone notification** right? Or would you like email too?

## Technical details
- `CafePOSMenu.tsx`: store the dropdown choice per category in state, pass it to `handleAddProteinShake`, add the flavor/add-ons to the item name, and use a cart key of itemId plus sorted add-on ids plus flavor.
- `FrontDeskPOS.tsx` / `CafePOS.tsx`: carry add-on names into `orderItems` and receipt `lineItems`; add a ready-time chooser at checkout and optional walk-in phone.
- Migration (additive): `cafe_orders.notify_phone text`, `ready_notified_at timestamptz`, `delay_notified_at timestamptz`.
- Staff RPC `staff_update_cafe_ready_time(order_id, minutes | timestamp)`, with the kiosk-staff check.
- New edge function `notify-cafe-order-ready`: called when status becomes ready. It checks SMS consent (existing consent log) and sends through the existing Twilio direct path and `send-push-notification`. It is idempotent via `ready_notified_at` and never runs for test/internal orders.
- Timezone: America/Detroit for every displayed time.
