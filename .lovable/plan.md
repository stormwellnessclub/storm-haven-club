# Safer promo texts (less carrier filtering)

Goal: once Twilio is back on, club promo texts are much less likely to be blocked by carriers (error 30007), without changing who is allowed to receive them.

## What changes for you
1. **One link per promo text.** Campaign Studio warns and blocks saving a text with more than one link, and suggests a shorter version.
2. **Gentle sending speed.** Big promo text sends go out in small batches spread over time (e.g. a few hundred per hour), instead of all at once.
3. **Promo text frequency cap.** Each person gets at most 1 promo text per 7 days. Booking confirmations, reminders and receipts are never capped.
4. **Wording check before sending.** Campaign Studio flags wording carriers often filter: ALL CAPS, many dollar amounts, "limited time/act now", repeated identical text to the same list within a week.
5. **First send after reactivation is small.** The first promo after Twilio is restored goes to engaged people only (members and recent clients) before any larger list.
6. **Results show filtering.** Campaign Studio Results shows how many texts carriers blocked per campaign, so a problem is caught after the first batch, not after thousands.

Nothing is sent as part of this work; your approval is still needed for every campaign.

## Technical details
- `campaign-studio`: validate SMS body (link count ≤ 1, length, flagged phrases) on save/send; enqueue recipients in throttled batches via a self-removing timer (no polling), per AGENTS.md.
- Frequency cap: check last promo `sms_messages` row per phone (campaign_id not null) within 7 days before calling `send-sms`; transactional templates exempt.
- `twilio-status`: store `error_code` 30007 on the message row; `admin_sms_optout_summary`/Results add a "filtered by carriers" count per campaign.
- Tests: link-count rule, 7-day cap, transactional exemption.
