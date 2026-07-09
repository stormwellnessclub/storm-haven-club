## Plan: make class reviews submit reliably

### Problem

Members are still hitting a class review failure after the first RLS fix. The current backend function exists and the client calls it, but the submit function still depends on values passed from the browser and can still be blocked by table RLS because the function owner may not bypass RLS unless explicitly configured. The UI also still shows the review button for any non-cancelled past booking, not only bookings the backend will accept.

### Fix

1. **Replace the submit RPC with a more defensive version**
   - Use the booking id as the source of truth.
   - Ignore browser-sent `classTypeId` and `sessionId` for the insert; derive both from the booking/session in the database.
   - Validate the caller owns the booking.
   - Allow statuses `confirmed`, `completed`, and `no_show`.
   - Validate the class has ended using `America/Chicago`.
   - Insert the review server-side.
   - Add `ALTER FUNCTION ... SET row_security = off` / function configuration so the function does not get blocked by the table's INSERT RLS while still doing its own ownership checks.
   - Revoke anonymous execute on `submit_class_review`; grant only authenticated execute.
   - Notify/reload the API schema cache so the live app sees the current function signature.

2. **Update the client submit hook**
   - Keep calling `submit_class_review`.
   - Remove reliance on browser-provided class/session identifiers where possible.
   - Improve error handling to show the RPC's exact message.
   - Add a safe console diagnostic containing only non-sensitive booking/session ids and backend error code/message if the submit fails.

3. **Align review button visibility with backend eligibility**
   - In member bookings and non-member portal bookings, only show/auto-prompt review when:
     - status is `confirmed`, `completed`, or `no_show`
     - the session has ended according to existing `hasSessionEnded`
     - the booking has a class type id
     - there is no existing review, unless editing an existing one
   - This prevents members from opening the dialog for bookings the backend will reject.

4. **Verify after implementation**
   - Query the live backend function privileges/config and class review policies.
   - Confirm no remaining direct new-review insert path to `class_reviews` exists outside update/admin flows.
   - Mark only the relevant work done; no unrelated security findings or features.

### Expected result

Members should be able to submit a class review for eligible past classes, and if a booking is genuinely ineligible they will see a specific explanation instead of an RLS failure.