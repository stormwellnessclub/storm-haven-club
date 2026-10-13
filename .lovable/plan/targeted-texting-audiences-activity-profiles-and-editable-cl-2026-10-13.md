# Targeted Texting: audiences, activity profiles, and editable class texts

## What's wrong today
- SMS Blast only loads members (first 1,000), filtered by status and tier. Non-members can't be reached.
- There's no view of what each person actually does (classes, massages, café, recovery), so you can't target.
- Class confirmation and reminder texts use one fixed wording for every class, with no preview or per-class editing.

## What you'll get

### 1. One audience for members and non-members
- SMS Blast reaches everyone with a phone number: members, non-member accounts, and imported contacts. Each phone counted once, no 1,000 limit.
- Cancelled members count as non-members. Blocked people are always left out.
- Only people who agreed to texts are sent to (carrier rule). The screen shows how many are reachable and how many are skipped for no consent.

### 2. Activity profile for every person
A summary per person, kept up to date automatically:
- Classes: total booked, last class date, favorite class types (Reformer, Cycling, etc.)
- Spa: massages and other services, last visit
- Recovery: Red Light, Cryo, Body Roller, Salt Room use
- Café: number of orders, total spent, last order
- PT: active package or not, last session
- Guest passes and visits, last check-in

Shown as a card on the member and non-member detail pages (admin and front desk).

### 3. Audience builder with saved segments
Combine filters, see the live count, view and download the list:
- Who: members / non-members / both, tier, status
- Did: took a class type, booked a massage, used café, used recovery, has PT
- When: in the last 7/30/90 days, or has NOT done it in X days (win-back)
- Spend: café spend over $X, etc.
- Save segments by name (for example "Reformer regulars, inactive 30 days") and reuse them.
- The same segments work for group emails too.

### 4. Targeted text campaigns
- Write the text, use name and class placeholders, see a phone-style preview with segment count and cost.
- Send now or schedule (Detroit time), same as the Body Roller emails.
- Results per campaign: sent, delivered, failed, opted out.

### 5. Editable class texts by class type
- Confirmation, 24-hour reminder, waitlist opening and cancellation texts each have a default wording.
- Add a custom version per class type (for example a Reformer reminder asking people to arrive 10 minutes early).
- Live preview with a sample class, plus "Send test to my phone".
- If a class type has no custom version, the default is used.

## What stays the same
- The consent requirement stays. Texts only go to people who opted in.
- Every text starts with "Storm Wellness Club:" and includes STOP wording.
- Nothing is sent while building. You approve wording before anything goes out.

## Questions to confirm while building
- Should imported contacts with phones but no recorded text consent be included? By default they are not reachable until they opt in.

## Technical details
- New view/function `person_activity_summary` keyed by lowercased email + user_id, aggregating class_bookings, spa_appointments, cafe_orders, pt_appointments, amenity_usage_logs, guest_passes, check_ins, body_roller_presale_purchases; admin-only via has_any_role.
- New tables: `audience_segments` (name, filter JSON, created_by), `sms_campaigns` extended with segment_id + scheduled_at (one-time timer per send, matching the existing scheduled-email pattern), `sms_class_template_overrides` (template_key, class_type_id, body, published).
- RPC `resolve_audience(filters jsonb)` paging all sources, de-duping by phone last-10, excluding blocked and cancelled-as-member logic.
- `send-sms` looks up a class-type override before the global override for class templates; `send-class-reminders` and booking confirmation callers pass class_type_id.
- New `send-sms-campaign` edge function (staff-only) sending in batches, honoring sms_opt_in, logging to sms_campaign_recipients.
- UI: rebuild SmsBlastTab around the audience builder; add Activity card component reused in member/non-member detail; add per-class-type section to SmsTemplatesTab.
