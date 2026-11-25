# Re-send the Seasonal Edit week test emails

## Background
Yesterday all 17 Seasonal Edit week emails went to storm@stormwellnessclub.com as [TEST] copies. A separate email listed the words of the 6 texts. Some may have landed in spam or Promotions.

## What I'll do
1. Load the current, latest version of all 17 email drafts and the 6 text drafts from Campaign Studio. This includes the newest copy, the offer picker and the gift reveal card.
2. Email each one to **storm@stormwellnessclub.com** only. The subject starts with "[TEST]" and includes the day and audience, for example "[TEST] Fri Nov 27 · Members · Massage gifts".
3. Send one more email that lists all 6 texts word for word, in day order.
4. Send a short final email titled "[TEST] Index". It lists every campaign sent, so you can confirm nothing is missing.

## What will not happen
- No client, member or imported contact gets anything.
- Drafts stay drafts. Nothing is scheduled.
- Test sends don't count toward Results.
- No texts go out, because Twilio is still inactive.

## After sending
I'll confirm how many arrived at the email service. If you can't find them, search your inbox, spam and Promotions for "[TEST]".

## Technical details
Same test path as the previous send: the campaign-studio test action, recipient locked to the signed-in admin's own email, and excluded from marketing_email_events results.
