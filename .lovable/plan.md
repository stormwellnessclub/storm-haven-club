Fix two issues:

A) Charging a non-member who has a card on file says "no card on file"
- Root cause: `addToClassMutation` and `promoteMutation` (drop-in branch) in `src/pages/admin/ClassRoster.tsx` only call `stripe-payment` with `memberId`. Non-members have no `memberId`, so the flow either errors out ("No member on file") or falls through to "collect at desk" — even when they have a real saved card stored in `non_member_profiles.stripe_customer_id`.
- Fix: When `memberId` is null, look up `non_member_profiles` by `user_id`. If `stripe_customer_id` is present, invoke `stripe-payment` with action `charge_saved_card` and `stripeCustomerId` (the edge function already supports this path). Only show "no card on file" if neither a member record nor a non-member `stripe_customer_id` exists. Apply the same fix to the "Promote from waitlist" drop-in branch.

B) Wrongly issued pass cannot be deleted
- Root cause: `class_waitlist.pass_id` has a foreign key to `class_passes(id)` with no `ON DELETE` rule, so any waitlist row that referenced that pass blocks the delete. Other admin pass-delete paths hit the same wall whenever a `class_waitlist` row touched the pass.
- Fix (migration): alter `class_waitlist.pass_id` to `ON DELETE SET NULL`. Leave existing `kids_care_bookings` and `payment_reconciliations` foreign keys as-is (they already `SET NULL`). After the migration, admins (super_admin / admin / manager) will be able to delete passes from the existing Edit Class Pass dialog without orphan errors.

Verification:
- Reproduce: non-member with saved card on a waitlist, admin promotes them with drop-in pricing → card charges, booking created.
- Reproduce: admin opens a bad pass on a non-member, clicks Delete → pass removes successfully and any referencing waitlist row's `pass_id` becomes null (waitlist record itself is preserved).