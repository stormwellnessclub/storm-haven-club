

# Marketing Automation Hub with SMS & Contact Import

## What You're Getting

A science-backed marketing automation system that replaces the current manual email-only approach with:

1. **SMS Text Notifications** via Twilio -- reach people who don't check email
2. **Automated Engagement Sequences** -- trigger-based drip campaigns that fire automatically when someone signs up, goes dormant, or hits a milestone
3. **Contact List Import** -- upload your external email list CSV, auto-segment contacts into members vs. non-members vs. new leads
4. **Lifecycle Marketing Engine** -- scientifically structured campaigns based on behavioral psychology (the "hook model", loss aversion, social proof timing)

---

## Architecture Overview

### New Database Tables

**`marketing_contacts`** -- Unified contact list (imported + system contacts)
- email, phone, first_name, last_name, source (import, guest_pass, application, member), segment tags, opted_in_sms, opted_in_email, linked_member_id (nullable), created_at

**`marketing_sequences`** -- Automated drip campaign definitions
- name, trigger_type (signup, guest_visit, dormant_14d, dormant_30d, membership_anniversary, post_class), channel (email, sms, both), steps (JSON array of delays + template references), is_active

**`marketing_sequence_enrollments`** -- Tracks who's in which sequence
- contact_id, sequence_id, current_step, status (active, completed, cancelled), enrolled_at, next_step_at

**`sms_messages`** -- SMS send log (mirrors email_campaign_recipients for texts)
- contact_id, phone, message_body, status (queued, sent, failed, delivered), campaign_id, sent_at

### New Edge Function: `send-sms`
- Uses Twilio connector gateway to send texts
- Logs to `sms_messages` table
- Handles opt-out keywords (STOP)

### New Edge Function: `process-marketing-sequences`  
- Scheduled cron job (runs every hour)
- Checks `marketing_sequence_enrollments` for contacts whose `next_step_at` has passed
- Sends the next email or SMS in their sequence
- Advances to next step or marks complete

---

## Marketing Science Framework

Pre-built sequences based on proven engagement psychology:

**Sequence 1: New Guest Welcome (trigger: guest_pass_used)**
- Immediately: Thank-you SMS + feedback request link
- Day 2: Email with "here's what you missed" (class schedule highlights)
- Day 5: SMS with limited-time membership offer (scarcity principle)
- Day 14: Final "we'd love to see you again" email

**Sequence 2: New Member Onboarding (trigger: membership_activated)**
- Day 1: Welcome SMS with quick-start tips
- Day 3: Email highlighting underused amenities (spa, cafe, childcare)
- Day 7: SMS asking about first week experience
- Day 14: Email with class recommendations based on membership tier

**Sequence 3: Dormant Member Re-engagement (trigger: no check-in for 14 days)**
- Day 14: Friendly SMS "We miss you at Storm"
- Day 21: Email with new class schedule + what's changed
- Day 30: SMS with re-engagement incentive (guest pass credit, spa discount)
- Day 45: Personal outreach flag for staff

**Sequence 4: At-Risk Member Save (trigger: churn_risk > 60)**
- Immediate: Staff notification in Staff Hub
- Day 1: Personalized email from management
- Day 3: SMS with exclusive retention offer

**Sequence 5: Anniversary / Milestone (trigger: membership_anniversary)**
- Anniversary day: Celebratory SMS + email with loyalty perk

---

## Contact Import System

New tab in Marketing Portal: **"Contacts"**

- **CSV Upload**: Drag-and-drop CSV with columns: email, first_name, last_name, phone, tags
- **Auto-Segmentation**: On import, cross-references against `members` table and `non_member_profiles` to tag contacts as:
  - `existing_member` -- already paying
  - `past_guest` -- visited via guest pass
  - `applicant` -- has a membership application
  - `lead` -- new contact, never interacted
- **Duplicate Detection**: Matches on email, skips or merges duplicates
- **Segment View**: Filter contacts by segment, see counts per segment
- **Campaign Targeting**: Select segments when composing email or SMS campaigns

---

## UI Changes

### Marketing Portal gets 2 new tabs:
- **Contacts** -- Import lists, view segments, manage opt-ins
- **Automations** -- Create/manage drip sequences, view enrollment stats

### Compose Dialog gets SMS option:
- Toggle between Email / SMS / Both
- SMS character counter (160 char limit)
- Phone number validation
- Preview for both channels

### Dashboard Analytics additions:
- SMS sent count, delivery rate
- Sequence completion rates
- Contact growth over time
- Conversion funnel: Lead -> Guest -> Member

---

## Twilio Setup

Twilio is available as a connector. We'll connect it to enable SMS sending through the gateway. You'll need a Twilio account with a phone number capable of sending SMS.

---

## Files to Create/Modify

| File | Action |
|------|--------|
| Database migration | 4 new tables + realtime for sms_messages |
| `supabase/functions/send-sms/index.ts` | New edge function for Twilio SMS |
| `supabase/functions/process-marketing-sequences/index.ts` | New cron-based automation processor |
| `src/components/admin/marketing/ContactsTab.tsx` | New - CSV import, segments, contact list |
| `src/components/admin/marketing/AutomationsTab.tsx` | New - sequence builder and enrollment dashboard |
| `src/components/admin/marketing/ImportContactsDialog.tsx` | New - CSV upload and mapping |
| `src/components/admin/marketing/ComposeEmailDialog.tsx` | Modified - add SMS toggle, phone field |
| `src/pages/admin/Marketing.tsx` | Modified - add Contacts and Automations tabs |
| `src/components/admin/marketing/CampaignAnalytics.tsx` | Modified - add SMS metrics |

