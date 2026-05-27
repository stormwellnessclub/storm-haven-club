## Answers first

**Q: When you cancel a class, does everyone signed up get a cancellation email?**
Yes. The admin "Cancel Class" button in `/admin/classes` calls `admin_cancel_class_session`, which:
- Automatically restores credits (member credits) and pass uses (`classes_remaining + 1`, status → active) for every confirmed booking on that session.
- Flips the booking status to `cancelled` with reason "Class cancelled by admin".
- Marks the session itself cancelled.

The Classes page then loops every cancelled booking from that action and sends the **`class_cancelled_by_admin`** template via `send-email` — that includes Mallak, Mariam, and anyone else booked. Nothing manual required for the rest of the roster.

**Mallak & Mariam status confirmed**
- Both booked the 11am Signature Flow on Tue May 27 (session `fdca3021…`).
- Both used a pass; both passes currently show `classes_remaining = 0` and expire **2026-06-01**.
- Cancelling the session via the RPC will auto-restore each to `classes_remaining = 1` and reactivate the pass.

---

## What I'll do (after you approve the email copy)

1. **Cancel the session** via the existing admin RPC — this auto-refunds passes AND auto-emails every booked attendee with the standard cancellation notice.
2. **Extend both passes by +7 days** (Mallak's pass `7d148585…` and Mariam's pass `cffb711f…`) — new expiration **2026-06-08 00:14 UTC**.
3. **Send a personalized email** to Mallak (`mallakmak07@gmail.com`) and Mariam (`mariammakled1@gmail.com`) — sent individually, not as a bulk send — that explains the cancellation, confirms the credit is already back on the pass, and notes the +1 week extension. (This is in addition to the standard auto-cancellation email they'll also receive from step 1. If you'd rather skip the standard one for them, say so and I'll suppress.)

---

## Email template — please review before I send

**Subject:** Tomorrow's 11 AM Signature Flow — Cancelled (credit restored + 1 week added)

**Body (HTML, branded with the standard club header/footer):**

> Hi {Mallak / Mariam},
>
> We're sorry to let you know that **Signature Flow on Tuesday, May 27 at 11:00 AM** has been cancelled.
>
> Here's what we've already done for you:
>
> - ✓ **Your class credit has been refunded** back to your pass — it's ready to use on any upcoming class.
> - ✓ **We've added an extra week** to your pass expiration as a thank-you for your patience. Your pass now expires **June 8, 2026** (was June 1).
>
> You can rebook anytime from your portal: **[Book a class →](https://stormwellnessclub.com/portal/book/class)**
>
> Thank you for being part of the Storm Wellness Club family. If you have any questions, just reply to this email or text us.
>
> Warmly,
> The Storm Wellness Club Team

---

## Files / tools I'll touch

- `supabase.rpc('admin_cancel_class_session', { _session_id: 'fdca3021…', _is_hidden: false, _cancellation_reason: 'Class cancelled' })` — via supabase--insert (RPC call).
- `UPDATE class_passes SET expires_at = expires_at + INTERVAL '7 days' WHERE id IN ('7d148585…','cffb711f…')` — via supabase--insert.
- `supabase.functions.invoke('send-email', { type: 'staff_reply', ... })` × 2 with the custom HTML above (uses the existing branded shell — no new template, no edge function changes).

Approve the copy (or tell me what to tweak) and I'll run it.
