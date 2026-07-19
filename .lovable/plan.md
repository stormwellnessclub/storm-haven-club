## Plan

1. **Keep ticket purchase inside the app experience**
   - Replace the current Stripe redirect checkout for event tickets with an embedded card payment flow inside the Buy Tickets box.
   - Keep the buyer on the same Storm page/portal instead of sending them to a separate Stripe-hosted checkout page.

2. **Refine the Buy Tickets box layout**
   - Rework the desktop layout so the purchase summary, buyer fields, quantity, and payment area are aligned and readable.
   - Improve the iPhone layout so fields stack cleanly, buttons stay full-width, and the payment form does not feel squeezed.

3. **Show purchase success immediately**
   - After payment succeeds, replace the payment form with a clear “purchase successful” confirmation.
   - Show ticket details on-screen: event name, date/time, ticket count, buyer name/email, and a note that the ticket is saved in the portal when applicable.
   - Refresh the member/portal ticket list so the new ticket appears without needing to manually reload.

4. **Fix ticket finalization**
   - The latest ticket rows are still marked `pending`, which explains why the confirmation screen and ticket visibility did not behave correctly.
   - Update the event payment backend so successful embedded payments mark tickets as paid immediately and reliably.

5. **Fix confirmation email delivery**
   - The current confirmation email only fires after the old session verification path, and that path was not completing for the purchase you made.
   - Move confirmation sending into the successful payment finalization path so it sends right after the payment is confirmed.
   - Keep it idempotent so refreshing or retrying does not send duplicates.

6. **Verify end-to-end**
   - Test the event purchase function with the new payment flow shape.
   - Check function logs for payment finalization and email sending errors.
   - Verify the public page and portal use the same fixed Buy Tickets box.

## Technical notes

- I’ll update the shared event purchase component rather than fixing only one page, so the public website, member dashboard, and non-member portal use the same behavior.
- I’ll change the event ticket backend from “create checkout URL then verify session after redirect” to “create payment intent, confirm embedded payment, then finalize tickets.”
- I’ll keep existing event pricing rules: member vs non-member price is still decided by the backend, not the browser.