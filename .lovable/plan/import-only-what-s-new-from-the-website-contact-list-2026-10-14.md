# Import only what's new from the website contact list

## What the check found (2,763 rows in the file)
- **2,574 are already in the system**, matched by any of their email addresses:
  - 104 are members.
  - 2,470 are non-members, imported contacts or website accounts.
- **23 of those existing people have no phone number on file**, but the new list has one for them.
- **19 rows have an email we don't have, but their phone number already belongs to someone in the system.** They're probably the same person under a second email.
- **169 people are completely new.** 100 of them have a phone number.
- 1 row repeats someone else in the same file.
- Everyone in the file is subscribed to email. 11 rows are marked "Never subscribed" for texts.

## What I'll do
1. **Add the 169 new people** as imported contacts, with their name, email and phone. They'll get your campaign emails.
2. **Fill in missing phone numbers** for the 23 existing people who have none on file, whether they're members, non-members or imported contacts. Anything already on file is never overwritten, including names, emails and existing phone numbers.
3. **Text consent:** the new people and the filled-in numbers are marked as agreed to texts from your previous system, the same way as the last list. The 11 people marked "Never subscribed" to texts are added for email only and won't be texted.
4. **The 19 possible duplicates:** I won't import these. They'll go in a review file showing the existing person each one matches, so you can decide.
5. **Skip** blocked people and anyone who unsubscribed here, even if the new list says subscribed.
6. **Give you a summary file** listing who was added, who got a phone number, and who was skipped and why.

Then I'll do the Mindbody list the same way, checking it against the system including this list.

## Technical details
- Matching is on lowercased Email 1/2/3 against `marketing_contacts`, `profiles`, `members`, `non_member_profiles` and `blocked_persons`. Phone matching uses the last 10 digits.
- New rows go into `marketing_contacts`: source `import`, `opted_in_email` true, `opted_in_sms` true except for "Never subscribed". Each one gets a `sms_consent_log` row with source `prior_system_owner_attested`.
- Phone fill uses update-only-if-empty on the matching record. That's `marketing_contacts.phone`, `non_member_profiles.phone`, `profiles.phone` or `members.phone`.
- Data changes only. No code changes.
