## Memorial Day Hours Email — Bulk Send

Build a Memorial Day hours announcement that you can preview and bulk-send to all active members from the existing Marketing Portal, using the same send pipeline as the Refer-a-Friend campaign.

### 1. Email template (branded HTML)

Match the existing club email style (Georgia serif, `#DEDACE` cream header, `#1C170F` ink, gold `#B8A068` accent rule — same shell as `CardDeclinedEmailPreview`).

Content:
- Subject: **"Memorial Day Weekend Hours — Storm Wellness Club"**
- Greeting: "Dear {firstName},"
- Short intro honoring Memorial Day
- Hours block (boxed, centered):
  - **Sunday, May 24** — 8:00 AM – 5:00 PM
  - **Monday, May 25 (Memorial Day)** — 7:00 AM – 5:00 PM
- Note: regular hours resume Tuesday 5/26
- Sign-off: "The Storm Wellness Club Team"
- Footer matching existing templates

### 2. New Marketing tab: "Announcements"

Add a new tab in `src/pages/admin/Marketing.tsx` called **Announcements** (between Members and Contacts).

Component: `src/components/admin/marketing/AnnouncementsTab.tsx` modeled directly on `ReferralCampaignTab`:
- Loads all active members with an email (same query pattern)
- Shows live HTML preview (sample first name "Sarah")
- "Send to All (N)" button with confirm dialog
- Per-member "Send" button for one-off testing/resending
- Logs the send via `email_campaigns` + `email_campaign_recipients` (same as referrals) so it shows in Analytics
- Uses `supabase.functions.invoke("send-email", { body: { type: "staff_reply", to, data: { name, subject, content } } })` — the exact path the referral tab uses

For now, hardcode the Memorial Day template inline in the component (no DB template row needed — fastest path, matches `CardDeclinedEmailPreview` pattern). If you later want it editable from the Templates tab, we can promote it to an `email_templates` row.

### 3. Recipient scope

Default to: `status = 'active'` AND `email IS NOT NULL`. This matches how the Refer-a-Friend tab defines "paid active members" minus the paid filter (operational notices go to all active members, not just paying ones). Add a small toggle: "Active members only" vs "Active + frozen" (frozen members still need to know hours).

### 4. What's NOT in scope

- No new DB tables or migrations
- No changes to the member portal banner (already built)
- No SMS — email only
- No scheduled send (sends immediately when you click)

### Technical details

- New file: `src/components/admin/marketing/AnnouncementsTab.tsx`
- Edit: `src/pages/admin/Marketing.tsx` — add `<TabsTrigger value="announcements">` and `<TabsContent>`
- Uses existing `send-email` edge function — no edge function changes
- Uses existing `email_campaigns` / `email_campaign_recipients` tables for logging
- Sends are sequential (same as referral bulk) — for ~hundreds of members this takes a minute or two; acceptable for a one-time announcement

### Preview-first workflow

When you open the tab, you'll see the rendered email immediately. Nothing sends until you click "Send to All" and confirm the count.
