# Fix: Front desk can't deduct member credits

## What's happening

Credit changes have two code paths:

- Kiosk/PIN mode -> secure `kiosk_adjust_member_credits` function (allows front desk)
- Normal signed-in staff -> writes straight to the credits table

The database rules on the credits table only allow super admin, admin, and manager to change credits. Front desk staff also can't write to the credit history log (insert is admin/manager only).

So when a front desk person is signed into their own staff account (not the PIN kiosk), the deduction is silently rejected by the database, the balance never moves, and the history entry fails. This is confirmed: the credits table policy "Staff can manage credits" and the credit_adjustments insert policy both exclude `front_desk`, while the kiosk function's guard does include `front_desk`.

## The fix

Route every staff credit change through the same secure function, whether or not the device is in kiosk mode.

1. `src/components/admin/MemberCreditsPanel.tsx`
   - Adjust (+/-) and "book on behalf" (Red Light / Cryo) deductions: always call `kiosk_adjust_member_credits` instead of branching on kiosk mode. This keeps the audit log correct (the function writes the history row itself with the acting user).
   - Remove the now-dead direct table update + manual history insert, and the duplicated `if (logError) throw logError;` line.
2. `src/pages/admin/MemberCredits.tsx` (admin Credits page, also reachable by front desk)
   - Same change for the quick deduct/adjust action so it works for front desk too.
3. No schema change to who can *create* or *delete* credit records: granting new credit packs stays admin/manager only. Front desk gets deduct and add-back-with-reason only, which is what the secure function already enforces.

## Verification

- Sign in as a front desk staff account, deduct a Red Light credit from a test member, confirm the balance drops and a "Recent credit activity" row appears with their name.
- Repeat on a PIN kiosk device to confirm no regression.

## Technical notes

`kiosk_adjust_member_credits` is SECURITY DEFINER, guarded by `assert_kiosk_staff()` which requires an authenticated user holding one of super_admin/admin/manager/front_desk/cafe_staff/spa_staff/childcare_staff/class_instructor. It clamps the new balance to 0..total, writes the `credit_adjustments` row, and returns the previous/new balance, so the UI can show the real result instead of assuming success.
