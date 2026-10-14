# Text blasts: find the screen, reach consented people, send two announcements

## What I found
- **The text screens exist** under Admin → Marketing, as the **Targeted Texts** and **SMS Blast** tabs. On a phone they sit off to the right of a tab row you have to swipe. They also only show on the live site after Publish → Update, which hasn't happened since they were built.
- **Non-members who said yes to texts are being blocked.** 217 non-members agreed to texts when they made their account. The sending system only looks at a different consent box, which is ticked for just 8 of them. So 209 consented non-members can't be texted today.
- **Imported contacts:** 1,747 have a phone number. You've confirmed they agreed to texts in your old system, but that consent wasn't brought over in the import.
- **Members:** 114 active or frozen members have agreed to texts.

## Changes
1. **Make the text tabs easy to find.** Move Targeted Texts and SMS Blast to the front of the Marketing tab row, and add a "Send a text blast" button at the top of the Marketing page.
2. **Count non-member consent.** When a non-member agreed to texts on their non-member account, the system will treat them as opted in. Opting out still always wins: a STOP or an opt-out in either place blocks texts.
3. **One-time consent fix for non-members.** For the 209 non-members who agreed but are blocked, record their existing agreement, keeping the original date.
4. **Bring over consent for imported contacts.** Mark the 1,747 imported contacts with phone numbers as agreed to texts, noted as "consent from previous system, confirmed by owner" with today's date. Then make them selectable in Targeted Texts and SMS Blast. Anyone who is unsubscribed, blocked, or already a member is skipped, and duplicate phone numbers get only one text. A STOP reply always blocks future texts.
5. **Two ready-made blasts** in Targeted Texts, sent to everyone with text consent: members, non-members and imported contacts, never cancelled members.
   - **Subscription confirmation:** "Storm Wellness Club: You're subscribed to texts from us. Msg frequency varies. Msg & data rates may apply. Reply HELP for help, STOP to opt out."
   - **Save our number:** asks them to save this number as "Storm Wellness Club". It explains that this line only understands STOP, START and HELP, and that for anything else they should call the front desk or message through the member portal.
   You'll see each text and the full recipient list before sending. I'll send a test to your phone first, and nothing goes out until you click Send. Send the confirmation first so anyone who doesn't want texts can reply STOP right away.
6. **Publish** so all of this shows on stormwellnessclub.com.

## Technical details
- `send-sms`: `optedIn` = `profiles.sms_opt_in` OR `non_member_profiles.sms_opt_in` (no `sms_opt_out_at`) OR `marketing_contacts.opted_in_sms` (not unsubscribed), matched by user, email or phone. Opt-out in any of them blocks the text. No `bypassConsent`.
- Backfill non-members: `profiles.sms_opt_in = true` and a `sms_consent_log` row with source `non_member_signup` and the original `sms_opt_in_at`.
- Backfill imported contacts: `marketing_contacts.opted_in_sms = true` where a phone exists and the contact is not unsubscribed, plus a `sms_consent_log` row with source `prior_system_owner_attested`.
- Targeted Texts audiences add imported contacts, de-duplicated by normalized phone, and campaigns snapshot phone numbers for recipients without accounts.
- Add the two messages as preset templates. Exclude cancelled memberships.
- Reorder the Marketing tabs and add a shortcut button.
