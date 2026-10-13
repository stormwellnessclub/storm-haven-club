# Fix the non-member Body Roller email list and clean up duplicate non-member accounts

## What I found
- **All of your contacts were imported.** The contact list holds **2,435** emails, all from your import. Nothing was lost.
- **Why you saw only 1,000:** The non-member email campaign never reads that imported list. It reads only registered website accounts, and it stops at the first 1,000 rows it gets back. So imported contacts are skipped, and so is any account after the first 1,000.
- **Non-member portal accounts aren't connected to the list:** 687 people who made non-member accounts aren't in the contact list.
- **Duplicates:** 113 non-member accounts belong to people who also have a membership. **89** of those memberships are current (not cancelled). No two non-member accounts share the same email.

## What I'll change
1. **One combined non-member email list:** imported contacts + non-member portal accounts + other registered accounts. Each email is counted once, with no 1,000 cap. It leaves out anyone with a membership (current or cancelled), anyone on the block list, and anyone who unsubscribed.
2. **Recipient count before sending:** In Admin → Marketing → Body Roller Presale, the non-member emails will show the total and where it comes from (imported / portal accounts / other accounts), so you can check it before you send.
3. **Connect portal accounts to the contact list:** Every non-member account is added to the contact list, and new signups are added automatically from now on.
4. **Clean up duplicates:**
   - For the 89 people with a current membership, I'll move their non-member account details to the membership account. That includes saved card info, signed agreements, text-message consent, and passes or bookings. Then I'll remove the extra non-member account so they appear only as members. This uses the same "one account per person" approach as Elizabeth's merge.
   - For the 24 people whose membership was cancelled, I'll keep the non-member account. They can still buy as non-members, and the account will be marked "Former member."
   - The non-member account list will hide anyone with a current membership, so duplicates can't show up again.
5. **Before I change anything,** I'll send you the list of the 89 people so you can check it. No emails go out and no one is charged.

## Technical details
- `send-body-roller-presale-email` `nm_*` branch: page through `marketing_contacts`, `non_member_profiles`, and `profiles` using `.range()` loops, and exclude `members` emails (fetched with paging), `blocked_persons`, and unsubscribed contacts.
- Add a dry-run mode that returns counts by source for the admin preview.
- One-time backfill and an insert trigger on `non_member_profiles`: upsert into `marketing_contacts` (lowercased email).
- Merge: for each duplicate with a non-cancelled membership, re-point foreign-keyed rows (class_passes, bookings, pt, etc.) to the member's user_id when they are different accounts, copy card/agreement/SMS fields where the member's are missing, then delete the `non_member_profiles` row. Run only after you approve the list.
- Filter the admin and front-desk non-member lists to exclude user_ids or emails that have a non-cancelled membership.
