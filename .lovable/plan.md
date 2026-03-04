

# Refer-a-Friend Email Template + Dedicated Marketing Tab

## What We're Building

1. **A pre-built "Refer a Friend" email template** — professionally designed HTML template seeded into the `email_templates` table via a database migration, with merge fields for `{name}`, `{referralCode}`, `{referralLink}`, and `{clubName}`

2. **A new "Referral Campaign" tab or section in the Marketing page** — a dedicated component that:
   - Fetches active, paid members (filters by `status = 'active'` and has `stripe_subscription_id` or `billing_type = 'cash'`)
   - Lets you send the referral template to **all paid active members** in bulk, or **individually** one by one
   - Auto-resolves each member's unique referral code from the `referral_codes` table and injects it into the template
   - Shows a live preview of the rendered email before sending

3. **Email template preview** — shown inline on the Marketing page so you can see exactly what the email looks like with sample data

## Email Template Design

The email will use Storm Wellness Club branding (Smoked Umber primary, Limestone Haze background, Cormorant Garamond headings, Montserrat body) and include:
- Branded header with club name
- Personal greeting: "Hi {name},"
- Value proposition: share wellness with friends, earn rewards (500 points per successful referral)
- Prominent CTA button linking to the referral page with their unique code
- Reward breakdown (Red Light Therapy, Class Credits, Dry Cryo, Guest Passes, Cafe Credits)
- Their unique referral code displayed prominently

## Technical Changes

### 1. Database Migration — Seed the referral email template
Insert a system template into `email_templates` with:
- `name`: "Refer a Friend"
- `category`: "referral"
- `is_system`: true
- `subject`: "{name}, Share the Storm — Earn Rewards"
- `body_html`: Full branded HTML template
- `merge_fields`: `["name", "referralCode", "referralLink", "clubName"]`

### 2. New Component: `ReferralCampaignTab.tsx`
Located at `src/components/admin/marketing/ReferralCampaignTab.tsx`:
- Fetches active paid members with their referral codes (join `members` + `referral_codes`)
- Displays member list with search/filter, each with a "Send" button for individual sends
- "Send to All Paid Members" bulk action
- Before sending, resolves each member's `referralCode` and builds `referralLink` as `https://stormwellnessclub.com/apply?ref={code}`
- Shows inline email preview with sample data
- Uses existing `send-email` edge function and `email_campaigns`/`email_campaign_recipients` logging

### 3. Add "Referrals" tab to Marketing page
Add a new tab to `src/pages/admin/Marketing.tsx` between Members and Templates:
- `<TabsTrigger value="referrals">Referrals</TabsTrigger>`
- `<TabsContent value="referrals"><ReferralCampaignTab /></TabsContent>`

### Files
| File | Action |
|------|--------|
| `src/components/admin/marketing/ReferralCampaignTab.tsx` | **New** — dedicated referral campaign UI |
| `src/pages/admin/Marketing.tsx` | Add Referrals tab |
| Database migration | Seed referral email template |

