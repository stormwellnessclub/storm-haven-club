

## Problem

The marketing portal is a glorified email blaster. "Compose Campaign" opens a blank form — there is no strategy, no conversion goals, no funnel tracking, no way to measure if a campaign actually did anything. The analytics tab just counts emails sent, with `guestConversions` hardcoded to `0`.

The database infrastructure is already robust: `email_campaigns`, `email_campaign_recipients`, `marketing_contacts` (with segment tags, opt-in flags), `marketing_sequences` (with steps JSONB, trigger types), and `marketing_sequence_enrollments`. But none of this is surfaced in the UI.

## Solution: Strategic Campaign System

### 1. Campaign Playbooks (replace "Compose Campaign" button)

Replace the generic compose button with **goal-driven campaign cards**, each with a defined conversion metric:

**Guest Playbooks:**
- **Convert to Applicant** — targets past guests who haven't applied. Goal: application submitted. Tracked by matching guest email to `applications` table.
- **Re-engage Lapsed Guests** — guests who visited 30+ days ago, no return. Goal: new guest pass booked.
- **Collect Feedback** — recent guests without feedback. Goal: feedback submission.

**Member Playbooks:**
- **Prevent Churn** — members with status `past_due` or `frozen`. Goal: status returns to `active`.
- **Upsell Tier** — active members on lower tiers. Goal: tier upgrade.
- **Referral Push** — active members with 0 referrals. Goal: referral submitted.
- **Custom Campaign** — blank compose for power users.

Each card shows: name, description, audience count (auto-calculated), and a "Launch" button that opens the compose dialog pre-filled with the matching template and audience pre-segmented.

### 2. Conversion Tracking on Analytics Tab

Replace the placeholder analytics with real conversion attribution:

- **Add `goal_type` and `goal_target_count` columns** to `email_campaigns` table (e.g., `goal_type = 'guest_to_applicant'`)
- **Conversion query logic**: after a campaign is sent, check if recipients took the target action within 14 days (configurable attribution window)
  - `guest_to_applicant`: recipient email appears in `applications` table after campaign sent date
  - `re_engage_guest`: recipient has a new `guest_passes` entry after campaign
  - `prevent_churn`: recipient member status changed from `past_due`/`frozen` to `active`
  - `referral_push`: recipient has new entry in `member_referrals`
- **Analytics dashboard** shows per-campaign: sent count, delivery rate, conversion count, conversion rate, and ROI indicator

### 3. Smart Audience Builder

Update `ComposeEmailDialog` to show a filtered audience preview when launched from a playbook:
- Auto-query the right segment (e.g., guests with no application, members with `past_due` status)
- Show recipient count and sample names before sending
- Allow removing individual recipients

### Files

**Database migration:**
- Add `goal_type TEXT`, `goal_metadata JSONB` to `email_campaigns`

**Create:**
- `src/components/admin/marketing/CampaignPlaybooks.tsx` — the playbook card grid with audience counting logic

**Modify:**
- `src/components/admin/marketing/GuestMarketingTab.tsx` — replace "Compose Campaign" with guest playbook cards, keep individual email buttons
- `src/components/admin/marketing/MemberMarketingTab.tsx` — replace "Compose Campaign" with member playbook cards
- `src/components/admin/marketing/ComposeEmailDialog.tsx` — accept `goalType`, `audienceQuery` props; show audience preview with count; auto-load matching template
- `src/components/admin/marketing/CampaignAnalytics.tsx` — add conversion tracking queries, per-campaign conversion rates, funnel visualization

