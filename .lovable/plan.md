

## Full Admin Guest Pass Portal

### Current State
The page has KPI cards, a Quick Sale form, and a tabbed pass list (Today/Upcoming/All). The user wants a complete portal with four additional sections for operational and marketing use.

### New Layout

The page will be restructured with a top-level tab navigation to organize everything into logical sections:

```text
+---------------------------------------------------------------+
| Guest Passes                    [Revoke] [Send Promo]         |
+---------------------------------------------------------------+
| [Overview] [Passes] [Member Credits] [Follow-Up] [Marketing] |
+---------------------------------------------------------------+
```

### Tab Breakdown

**1. Overview Tab** (default)
- Existing KPI cards (Today's Guests, This Week Revenue, Active Passes, Total Revenue)
- New: Pie chart showing pass status distribution (Active / Checked In / Expired / No-Show)
- New: Conversion rate card (guests who became members vs total guests)
- New: Revenue trend -- bar chart of weekly guest pass revenue over last 8 weeks
- New: Busiest days chart -- which days of the week get the most guest visits

**2. Passes Tab**
- Existing Quick Sale form (left column)
- Existing tabbed pass list with Today/Upcoming/All sub-tabs (right column)
- No changes to existing functionality

**3. Member Credits Tab**
- Table showing all members who currently have guest pass credits
- Columns: Member Name, Email, Credits Remaining, Credits Total, Cycle Period, Expires, Status badge
- Filter: Show All / Has Credits / Used All
- Quick action: Click row to open member detail
- Summary cards at top: Total Credits Outstanding, Members With Credits, Credits Used This Month

**4. Follow-Up Queue Tab**
- List of guests who visited (status = exhausted/checked in) but are NOT current members
- Columns: Guest Name, Email, Phone, Visit Date, Referral Source, Days Since Visit, Follow-Up Status
- Follow-up status tracking: New / Contacted / Interested / Not Interested / Converted
- Action buttons: Send follow-up email, update status, add notes
- Filter by status and date range
- This requires a new `follow_up_status` column on the `guest_passes` table

**5. Marketing Tab**
- Houses the existing Send Guest Pass Promo and Revoke buttons (moved from header)
- Campaign history: log of when promos were sent, how many credits allocated
- Promo stats: credits allocated vs used ratio
- Future placeholder sections for email templates and outreach campaigns

### Database Changes

1. **Add `follow_up_status` column to `guest_passes` table**
   - Type: text, nullable, default null
   - Values: 'new', 'contacted', 'interested', 'not_interested', 'converted'

2. **Add `follow_up_notes` column to `guest_passes` table**
   - Type: text, nullable

3. **Add `promo_campaign_log` table** to track when promos were sent
   - `id` (uuid, PK)
   - `sent_by` (uuid, references auth.users)
   - `credits_allocated` (integer)
   - `members_skipped` (integer)
   - `members_errored` (integer)
   - `sent_at` (timestamptz, default now())
   - RLS: admin read/write only

### Technical Details

**File changes:**

| File | Change |
|------|--------|
| `src/pages/admin/GuestPasses.tsx` | Major restructure: wrap content in top-level Tabs, move existing content into "Passes" tab, add Overview/Member Credits/Follow-Up/Marketing tabs |
| `src/components/admin/GuestPassOverviewTab.tsx` | New: charts and analytics using Recharts (already installed) |
| `src/components/admin/GuestPassMemberCreditsTab.tsx` | New: member credits table with filters |
| `src/components/admin/GuestPassFollowUpTab.tsx` | New: follow-up queue with status management |
| `src/components/admin/GuestPassMarketingTab.tsx` | New: promo tools + campaign history |
| Database migration | Add columns + new table |

**Key implementation notes:**
- All chart components use Recharts (already a dependency)
- Member credits data comes from `member_credits` table filtered by `credit_type = 'guest_pass'`
- Follow-up queue filters `guest_passes` where `status = 'exhausted'` and cross-checks against `members` table to exclude existing members
- Campaign log gets a new row inserted each time the promo button is clicked (inside `handleSendPromo`)
- The promo/revoke buttons move from the page header into the Marketing tab
- All new components follow the existing AdminLayout pattern with Cards, Tables, and Badges

