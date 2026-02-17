
# Comprehensive Marketing Portal for Guests and Members

## Overview

Build a dedicated **Marketing Hub** as a standalone admin page (`/admin/marketing`) with full tools for both guest and member outreach, replacing the placeholder "coming soon" section in the current Guest Pass Marketing tab.

## What Gets Built

### 1. New Admin Page: `/admin/marketing`
A full marketing portal with tabs for:

**Guests Tab**
- Guest feedback collection via a clickable rating/review form (replacing the current "reply to this email" approach)
- Bulk email campaigns to past guests (re-engagement, special offers)
- Individual guest outreach (send specific emails)
- Guest-to-member conversion tracking
- Campaign history and analytics

**Members Tab**
- Bulk email campaigns to members (announcements, promotions, wellness tips)
- Individual member outreach
- Segmented sends (by tier, by status, by activity level)
- Campaign history and analytics

**Templates Tab**
- Pre-built email templates (guest feedback request, member promo, re-engagement, seasonal offers, referral incentive)
- Template preview before sending
- Custom template creation (subject + body with merge fields like `{name}`, `{visitDate}`)

**Analytics Tab**
- Emails sent over time
- Campaign performance (sent, opened -- basic tracking)
- Guest conversion rate (visited -> became member)

### 2. Fix Guest Feedback Email
Replace the current "reply to this email" approach with a clickable feedback form:
- The `guest_visit_feedback` email template will include a link to a public feedback page
- New public page: `/guest-feedback?token={unique_token}` where guests rate their experience (1-5 stars) and leave comments
- Feedback stored in a new `guest_feedback` table
- Admin can view all feedback from the Marketing portal

### 3. Database Changes

**New table: `email_campaigns`**
- `id`, `campaign_name`, `campaign_type` (guest/member), `audience_filter` (jsonb), `template_id`, `subject`, `body_html`, `sent_count`, `created_by`, `sent_at`, `created_at`

**New table: `email_campaign_recipients`**
- `id`, `campaign_id`, `email`, `recipient_name`, `recipient_type` (guest/member), `status` (sent/failed), `sent_at`

**New table: `email_templates`**
- `id`, `name`, `category` (guest_outreach/member_promo/feedback_request/announcement), `subject`, `body_html`, `merge_fields` (text[]), `is_system` (bool), `created_by`, `created_at`

**New table: `guest_feedback`**
- `id`, `guest_pass_id`, `guest_email`, `guest_name`, `rating` (1-5), `comment`, `feedback_token`, `submitted_at`, `created_at`

### 4. Navigation
- Add "Marketing" to AdminSidebar under Management section
- Keep the existing Guest Pass Marketing tab but link it to the new portal ("Open Full Marketing Portal" button)

### 5. Files Changed/Created

**New files:**
- `src/pages/admin/Marketing.tsx` -- Main marketing portal page with tabs
- `src/components/admin/marketing/GuestMarketingTab.tsx` -- Guest outreach tools
- `src/components/admin/marketing/MemberMarketingTab.tsx` -- Member outreach tools  
- `src/components/admin/marketing/TemplatesTab.tsx` -- Email template management
- `src/components/admin/marketing/CampaignAnalytics.tsx` -- Analytics dashboard
- `src/components/admin/marketing/ComposeEmailDialog.tsx` -- Email composer with template selection + preview
- `src/pages/GuestFeedback.tsx` -- Public feedback form page

**Modified files:**
- `src/App.tsx` -- Add routes for `/admin/marketing` and `/guest-feedback`
- `src/components/admin/AdminSidebar.tsx` -- Add Marketing nav item
- `supabase/functions/send-email/index.ts` -- Update `guest_visit_feedback` template to include feedback link instead of "reply to this email"
- `src/components/admin/GuestPassMarketingTab.tsx` -- Add link to full marketing portal

**Database migration:**
- Create `email_campaigns`, `email_campaign_recipients`, `email_templates`, and `guest_feedback` tables
- Seed default templates (guest feedback request, member promo, re-engagement, referral)
- RLS policies: staff roles for campaigns/templates, public insert for guest_feedback (token-validated)

## Technical Details

### Guest Feedback Flow
```
1. Guest visits club -> checked in -> status = 'exhausted'
2. Next day: process-guest-feedback-emails runs
3. Email sent with link: /guest-feedback?token={unique_token}
4. Guest clicks link -> sees branded rating form (1-5 stars + comment box)
5. Guest submits -> stored in guest_feedback table
6. Admin views feedback in Marketing portal
```

### Campaign Send Flow
```
1. Admin selects audience (all guests / all members / filtered segment)
2. Picks or creates a template
3. Previews the email with merge fields filled
4. Clicks "Send Campaign"
5. Edge function processes batch send via Resend
6. Results logged in email_campaign_recipients
7. Campaign summary shown in analytics
```

### Email Template Merge Fields
- `{name}` -- recipient first name
- `{visitDate}` -- guest visit date
- `{membershipTier}` -- member tier
- `{clubName}` -- Storm Wellness Club
- `{feedbackUrl}` -- feedback form link (guest only)

### RLS Policies
- `email_campaigns`: staff roles (super_admin, admin, manager) for all operations
- `email_campaign_recipients`: same as campaigns
- `email_templates`: staff roles for CRUD, system templates cannot be deleted
- `guest_feedback`: public INSERT (with token validation in code), staff SELECT
