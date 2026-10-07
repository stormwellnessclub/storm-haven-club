# Cancelled members: right tab, out of active search, accurate count

## What I found
- You cancelled 12 members today (Mariam Atwi, Duha A, Sherene Albosaraj, Randa Turaani, Mariam Alsheeblawy, Yara Hamed, Malak Bazzi, Julud Bazzi, Rola Taleb, Layal Zreik, Zeinab Barakat, Amalie Aljahmi). All show as cancelled in the system and in Stripe.
- The Cancelled Members tab only lists people who went through its own "move to cancelled records" button. Members marked cancelled any other way never show up there. That's why these 12 are missing.
- 2 more members are still marked active here, but their Stripe billing is cancelled: Sahar Durant (stormfitnessllc@gmail.com, which looks like a staff or test account) and Wafaa Diab. I won't change them unless you tell me to.
- Right now the system has 117 active members with active billing, plus 5 who are past due and 1 sponsored.

## Changes
1. **Cancelled Members tab** will list every member marked cancelled, whatever way they were cancelled. Their records and history stay as they are. Nothing gets deleted.
2. **Admin member search and list** will hide cancelled members by default everywhere: the main list, quick search, and the pickers used for training, gift cards, the register and rosters. They can still be found from the Cancelled tab or by turning on "Show cancelled".
3. **Active member count** on the admin dashboard and Members page will count only active members. Frozen, pending, cancelled and expired members get their own separate numbers.
4. **Front desk** search will still find cancelled members, with a clear red **Cancelled member, do not check in** label. Check-in already blocks them. The scanner and kiosk will show "Membership cancelled" as the reason.
5. **Billing mismatch flag:** the Members page will show a small warning for anyone marked active whose Stripe billing is cancelled, like Sahar and Wafaa. That way you can decide what to do with each one.

## Technical details
- `CancelledMembers.tsx`: list `status = 'cancelled' OR records_cancelled_at IS NOT NULL`. Keep the existing records-cancel action and its fields.
- `Members.tsx`: keep the existing default filter, but drop the `records_cancelled_at IS NULL` restriction only for the Cancelled view. Base the headline count on `status = 'active'`.
- Admin pickers (`PTClientPicker`, `PersonSearch`, `POSCustomerSearch`, `GiftCardPersonSearch`, `useUnifiedCheckInSearch`): exclude cancelled and expired members from the member results.
- `frontdesk/Members.tsx` and the kiosk search: keep cancelled members in the results and show a "Cancelled member" badge.
- No database changes and no data edits.
