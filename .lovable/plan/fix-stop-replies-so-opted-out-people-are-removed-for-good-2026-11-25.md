# Fix STOP replies so opted-out people are removed for good

## What I found (checked in the records)

You're mostly right, and it's important.

- **Our system has never received a single STOP reply.** Twilio is supposed to forward every text people send back to the club's number to the app. Zero replies have ever arrived, so the app never learned that those 83 people opted out.
- **The app kept trying to text them.** In the last 10 days there were **50 attempts to people who had already replied STOP**. Twilio blocked them itself, so none were delivered, but Twilio still logs and counts every attempt. Repeated tries to opted-out numbers, on top of the 426 filtered texts, are a red flag for them.
- The app's own STOP handling works. The problem is that Twilio was never set up to send the replies over (that setting lives in Twilio).
- No text went to anyone who opted out on the website or in their account. 202 of those were stopped correctly.

## The fix

1. **Make Twilio's block count as an opt-out.** When Twilio refuses a text because the person replied STOP, the app turns texts off for that phone number everywhere (member account, non-member account, imported contacts). It never tries that number again unless they text START.
2. **Mark everyone who already replied STOP as opted out now.** This covers the 50 blocked numbers found in the records, plus Twilio's full opt-out list (the CSV from the "Opt-outs and Spam Complaints" screen you showed me) if you send it.
3. **Connect STOP/START/HELP replies (one setting in Twilio, which you'll change).** I'll give you the exact address to paste under Phone Numbers → your club number → "A message comes in." After that, every STOP is recorded the moment it's sent.
4. **Show it to staff.** Campaign Studio's Results shows how many people opted out, so you can see it working.
5. **Write the Twilio support message.** It will explain what went wrong and what's fixed (STOP replies now honored automatically, the imported list removed from texting, fewer promotional texts).

Nothing is sent to clients during this work. Texts are only marked as off; no other customer details change.

## Technical details

- `send-sms`: on Twilio error 21610, call `set_phone_sms_consent(phone, false)`, update `profiles` matching the phone tail (`sms_opt_in=false`, `sms_opt_out_at`, source `twilio_21610`), and insert an `sms_consent_log` row with action `opt_out`. Before sending, also skip any phone with a prior 21610 failure as an extra guard.
- One-time data backfill: the same opt-out for every distinct phone in `sms_messages` with `error_code = 21610`, plus the uploaded Twilio CSV.
- Verify `twilio-inbound` accepts Twilio's form-post (signature check, public access) and returns TwiML, so it works once the webhook URL is set.
- Add an opt-out count to the Campaign Studio Results tab.
