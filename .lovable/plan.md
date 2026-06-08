## Why your second campaign FAILED

Twilio error **30909 — Call to Action / Message Flow rejected**. Your opt-in description is detailed, but Twilio's reviewer couldn't *verify* it because:

1. **Opt-in Message and Opt-in Keywords are blank** (the screenshot shows "-" for both). Reviewers expect at least one opt-in keyword (e.g. JOIN, START) OR a clear confirmation message users receive after opting in.
2. **No screenshot/proof of the consent checkbox** was attached, so reviewers can't see the actual CTA on `/apply`, `/auth`, or `/portal/profile`.
3. The signup pages may require login, so the reviewer literally cannot reach the consent checkbox to verify it.

This is a **Twilio submission problem**, not a code problem. No app code change will get the campaign approved — but I can make your signup pages reviewer-friendly so the resubmission passes.

## Plan

### 1. Make consent CTA publicly reviewable (code changes)
Create a dedicated public page `/sms-opt-in-proof` that shows:
- Screenshots/mockups of the exact consent checkbox shown on `/apply`, `/auth`, and `/portal/profile`
- The full disclosure text verbatim
- Frequency, STOP/HELP instructions, links to Terms + Privacy
- This gives Twilio reviewers one URL to verify everything without needing an account

### 2. Add a visible consent disclosure block on `/apply`
Right now the consent text may be small or buried. Add a clearly labeled, bordered consent box directly above the submit button on the public application form so a reviewer landing on `/apply` immediately sees it without logging in.

### 3. Auto-send opt-in confirmation SMS
When a user checks the SMS consent box and submits, send an immediate confirmation:
> "Storm Wellness Club: You're subscribed to account & class alerts. Msg freq varies. Msg&data rates may apply. Reply HELP for help, STOP to cancel."

This satisfies the "Opt-in Message" field Twilio flagged as blank.

### 4. Populate Opt-in Keyword
Add `START` and `JOIN` handling in the `twilio-inbound-sms` webhook so users texting these words get re-subscribed and a confirmation. Then you can fill the "Opt-in Keywords" field in Twilio with `START, JOIN`.

### 5. Resubmission checklist (you do in Twilio)
After the above ships, edit the rejected campaign with:
- **Opt-in Message**: paste the confirmation SMS text from step 3
- **Opt-in Keywords**: `START, JOIN`
- **Call-to-Action / Message Flow**: add the new `https://stormwellnessclub.com/sms-opt-in-proof` URL plus 2-3 screenshots of the checkbox on `/apply`
- **Sample messages**: 3 examples (class reminder, billing notice, waitlist alert)
- Resubmit

### 6. Save the rule
Record in project memory: A2P resubmissions require a public CTA-proof URL + filled Opt-in Message + Opt-in Keyword fields.

## What I will NOT do
- Touch the working approved campaign
- Change `send-sms` logic (the code is fine — the campaign approval is the blocker)
- Promise the resubmission will be approved (only Twilio's reviewer decides)