
# Strategic Campaign System — IMPLEMENTED

## What Was Built

### 1. Campaign Playbooks (CampaignPlaybooks.tsx)
Goal-driven campaign cards replacing the generic "Compose Campaign" button:

**Guest Playbooks:**
- **Convert to Applicant** — targets past guests who haven't applied
- **Re-engage Lapsed Guests** — guests who visited 30+ days ago
- **Collect Feedback** — recent guests without feedback

**Member Playbooks:**
- **Prevent Churn** — members with past_due or frozen status
- **Upsell Tier** — active members on lower tiers
- **Referral Push** — active members with 0 referrals

Each card shows live audience count and a "Launch Campaign" button.

### 2. Smart Audience Builder (ComposeEmailDialog.tsx)
- Auto-queries the right segment when launched from a playbook
- Shows recipient count and name chips with ability to remove individuals
- Auto-loads matching email template based on goal type
- Merge field chips for quick personalization

### 3. Conversion Tracking (CampaignAnalytics.tsx)
- `goal_type` and `goal_metadata` columns added to email_campaigns
- Per-campaign conversion rates with 14-day attribution window
- Real conversion queries: guest→applicant, re-engagement, feedback, churn prevention, referrals
- Summary stats: total conversions, overall conversion rate

### Database Changes
- Added `goal_type TEXT` and `goal_metadata JSONB` to `email_campaigns` table
