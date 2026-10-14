# Text blasts: find the screen, reach consented non-members, send two announcements

## What I found
- **The text screens exist** under Admin → Marketing, as the **Targeted Texts** and **SMS Blast** tabs. On a phone they sit off to the right of a tab row you have to swipe. They also only show on the live site after Publish → Update, which hasn't happened since they were built.
- **Non-members who said yes to texts are being blocked.** 217 non-members agreed to texts when they made their account. The sending system only looks at a different consent box, which is ticked for just 8 of them. So 209 consented non-members can't be texted today.
- **The imported lists have no text consent on record.** 1,747 imported contacts have a phone number, but none of them has "agreed to texts" recorded. Carriers require proof of consent, so they stay out of every text unless you can show they opted in to texts, for example on a sign-up form from your old system.
- Members with text consent: 114 active or frozen members.

## Changes
1. **Make the text tabs easy to find.** Move Targeted Texts and SMS Blast to the front of the Marketing tab row, and add a "Send a text blast" button at the top of the Marketing page.
2. **Count non-member consent.** When a non-member agreed to texts on their non-member account, the system will treat them as opted in. Opting out still always wins: a STOP or an opt-out in either place blocks texts. This applies to blasts, targeted texts and automatic texts.
3. **One-time consent fix.** For the 209 non-members who agreed but are blocked, record their existing agreement in the system's consent record, keeping the original date and source. No one is newly opted in.
4. **Two ready-made blasts** in Targeted Texts, sent to everyone with text consent (members and non-members, never cancelled members):
   - **Subscription confirmation:** "Storm Wellness Club: You're subscribed to texts from us. Msg frequency varies. Msg & data rates may apply. Reply HELP for help, STOP to opt out."
   - **Save our number:** asks them to save this number as "Storm Wellness Club". It explains that this line only understands STOP, START and HELP, and that for anything else they should call the front desk or message through the member portal.
   You'll see each text and the full recipient list before sending. I'll send a test to your phone first, and nothing goes out until you click Send.
5. **Publish** so all of this shows on stormwellnessclub.com.

## Decision for you
If your old system did collect text consent for the imported list, send me that export with the consent column. I'll import only the people who said yes. Until then, imported contacts can still get emails but not texts.

## Technical details
- `send-sms`: `optedIn` = `profiles.sms_opt_in` OR (`non_member_profiles.sms_opt_in` and no `sms_opt_out_at`), matched by user/email. Opt-out in either place blocks the text. No `bypassConsent`.
- Backfill: set `profiles.sms_opt_in = true` for the matching profiles, plus a `sms_consent_log` row with source `non_member_signup` and the original `sms_opt_in_at`.
- Add the two messages as preset templates in Targeted Texts. The audience comes from `admin_person_activity()`, excluding cancelled memberships.
- Reorder the Marketing tabs and add a shortcut button.
