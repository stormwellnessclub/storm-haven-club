# One-day wet spa pass with non-member 10-packs, and launched-classes-only marketing

## 1. Marketing only promotes what's open
- Save to memory: Reformer and aerobics/studio classes are open; cycling and yoga are not yet launched.
- Update the class campaign brief and the competitor report ideas so ads only promote Reformer and aerobics/studio classes for now. Cycling and yoga ideas are kept for later, marked "after launch".

## 2. Included one-day wet spa pass
- When a non-member buys any 10-pack (Reformer or aerobics/studio), they get **one** one-day facility pass that covers wet spa access. It's one pass, not one per class.
- Members don't get it, since membership already includes wet spa access.
- The pass is valid for 60 days, the same as the pack.
- It appears in their portal next to their passes, with a short note that it's included with the 10-pack. Front desk check-in accepts it like any other guest day pass.
- The purchase confirmation email mentions it. The wording says the pass is "included" and never uses "free".
- Class pass pages and the booking screen show "Includes one day of wet spa access" on the non-member 10-pack.
- Past buyers: no non-member 10-packs are active today (only 6 member packs), so nobody needs it added now. The same safe step will still run once at launch so no active pack is missed.

## Technical details
- New column `class_passes.included_guest_pass_id` and a database function `grant_ten_pack_day_pass(pass_id)`. It is idempotent, inserts one `guest_passes` row (user_id, guest_email, price_paid 0, expires_at = pack expiry, admin_notes "Included with 10-pack"), and only runs for `pass_type='10-pack'` and `is_member_price=false`. An insert trigger on `class_passes` calls it, so the webhook, reconcile, Mother's Day pack and staff grants are all covered.
- Revenue stays unchanged ($0 line, not in revenue_ledger).
- Copy updates in the class pass purchase UI, BookingModal pack option, `send-class-pass-confirmation`, and seo-prerender/serve-static text (also removes cycling and yoga as launched classes there).
- Test for the rule: a non-member 10-pack gets exactly one pass expiring with the pack; members and single classes get none.
- Memory: launched-classes rule plus the 10-pack day-pass rule.
