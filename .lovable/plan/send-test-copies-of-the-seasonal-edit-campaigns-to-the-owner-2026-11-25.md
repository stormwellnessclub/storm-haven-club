# Send test copies of the Seasonal Edit campaigns to the owner

## Where to see them
Admin → Campaign Studio → "Seasonal Edit week" tab (23 drafts by day). Round 3 drafts: Campaign Studio, "Seasonal Edit round 3".

## What will happen
1. Every Seasonal Edit week text draft (6) is sent as a test text to the owner's own phone only, each starting with "[TEST]" plus its day and who it's for.
2. Every Seasonal Edit week email draft (17) is sent as a test email to the owner's own email only, with "[TEST]" and the day and audience in the subject.
3. No client gets anything. Drafts stay drafts. Nothing is scheduled, and no draft or send record changes. Test sends are left out of Results.
4. Afterwards I'll tell you how many texts and emails went out, and whether any failed.

## Technical details
- Use the existing Campaign Studio test-send path. Test texts go to the caller's own phone, and test emails go only to the signed-in owner. No arbitrary recipients and no bypassConsent.
- If the test path only sends one draft at a time, loop over the drafts in order of day.
- Confirm the owner account has a phone number and email on file before sending.
