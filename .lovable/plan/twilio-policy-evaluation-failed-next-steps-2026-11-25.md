# Twilio: "policy evaluation failed" — next steps

## What it means
That message comes from Twilio, not the club app. It shows up when an account is **suspended**: Twilio blocks setting changes (like the reply address) until the account is turned back on. Nothing in the app needs fixing for this.

## What you do (on Twilio's website)
1. Open console.twilio.com, click the **?** (Help) at the top, then **Contact support** / **Create a ticket**.
2. Paste the support message I already wrote (I'll put the full text in chat so you can copy it). It explains:
   - the 14% filtered texts and 83 STOP replies
   - that the app wasn't receiving STOP replies, which is why some people who opted out were sent texts again
   - that this is now fixed: all 38 opted-out numbers are blocked from every club text, and any carrier block now counts as an opt-out automatically
   - your opt-in proof page: stormwellnessclub.com/sms-opt-in-proof
3. Mention the error "policy evaluation failed" when you tried to save the incoming-message setting.

## After Twilio turns the account back on
1. Campaign Studio → Results → **Copy Twilio reply address**, then paste it under your club number's **"A message comes in"** setting (Webhook, HTTP POST). Now STOP replies reach the app.
2. I send **one test text to your phone only** to confirm it works.
3. No texts go to clients until you approve.

## Technical details
- No code or database changes in this plan.
- Support message source: `.lovable/reviews/twilio-support.md` (shared in chat, unchanged).
