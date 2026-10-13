# Fix waivers showing "not signed" when people already signed

## What's wrong
People sign the waiver once, when they create an account, and that signature is saved correctly. 1,022 of 1,047 accounts have it, and 127 of 129 current members have it. The admin screens just look in the wrong place:

- **Members list:** it matches members to their accounts with the wrong ID, so it never finds anyone's signed waiver. Almost every member shows "not signed" even though they signed.
- **Non-member screens:** they check a second "signed" checkbox on the non-member record instead of the actual signature from signup. 247 non-members signed at signup but still show unsigned. The ones you fixed by hand only changed that second checkbox.

## The fix
1. **Members list:** match members to the right account so their real signed status and date show. The waiver filter and counts will be correct too.
2. **Non-member screens** (Non-Member Accounts, the non-member detail panel, People, and front desk): treat someone as signed if the signature from signup exists. This uses the same rule the club already uses elsewhere to check waivers.
3. **One-time cleanup:** copy the signup signature (and its date) onto the 247 non-member records that are missing it, so every screen agrees.
4. **From now on:** whenever someone signs, both records update together, so this can't drift apart again.

Nothing about the waiver itself or the signup flow changes. No emails are sent. Anyone who truly never signed will still show as unsigned.

## Technical details
- `src/pages/admin/Members.tsx`: query `profiles` by `user_id` (not `id`) and key the map by `user_id`. `profiles.id` never equals `user_id` (0 of 1,047 match).
- `effective_waiver_status` RPC: add `profiles.waiver_signed` / `waiver_signed_at` as an explicit source ahead of the inferred sources.
- People / `NonMemberDetailSheet` / front desk read the RPC (or profile flag) instead of `non_member_profiles.waiver_signed` alone.
- Data fix (run_sql): `UPDATE non_member_profiles n SET waiver_signed = true, waiver_signed_at = COALESCE(n.waiver_signed_at, p.waiver_signed_at) FROM profiles p WHERE p.user_id = n.user_id AND p.waiver_signed AND NOT COALESCE(n.waiver_signed, false)`.
- Trigger on `profiles` (after insert/update of `waiver_signed`): mirror it to the matching `non_member_profiles` row, and the reverse.
- Add a small test asserting that a profile-signed waiver makes the effective status "signed".
