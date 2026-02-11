

## Support Alerts and Club Concierge System

This plan adds two major enhancements: (1) live support notification alerts on the Admin Dashboard and Check-In pages, and (2) a new "Club Concierge" request system on the member Support page with pre-built service options.

---

### Part 1: Support Alerts on Dashboard and Check-In

**Problem**: Staff only see support notifications via the bell icon in the header. Since Dashboard and Check-In are the most-used pages, unread support tickets can be missed.

**Solution**: Add a compact alert card to both pages that shows the count of open tickets and unread messages, with a direct link to the email management page.

**Files to modify**:
- `src/pages/admin/Dashboard.tsx` -- Add a support alert card (similar to the existing failed payments alert) near the top of the page. Uses the existing `useAdminSupportNotifications` hook.
- `src/pages/admin/CheckIn.tsx` -- Add the same compact support alert card above the search panel.

The alert will show:
- Number of open/in-progress conversations
- Number of unread member messages
- A "View Messages" button linking to `/admin/emails`
- Only appears when there are unread messages or open tickets

---

### Part 2: Club Concierge Request System (Member Side)

**Problem**: The current Support page is a single generic messaging system. Members need a way to make specific concierge-style requests like "activate the steam room" or "request ice bed access."

**Solution**: Split the member Support page into two tabs: **Support** (existing messaging) and **Club Concierge** (new pre-built service request cards).

**Database change**: Add a `category` column to `email_conversations` to distinguish between `support` and `concierge` requests.

```sql
ALTER TABLE email_conversations ADD COLUMN category text NOT NULL DEFAULT 'support';
```

**Concierge request types with descriptions**:

| Request | Description |
|---------|-------------|
| Steam Room | Please let us know 20-30 minutes before you'd like to use the steam room so we can prep it for you. |
| Ice Bed (ZeroBody Cryo) | Available for Platinum and Diamond members via credits. If you don't have credits, you can purchase an ice bed pass. |
| Red Light Therapy | Available for Gold, Platinum, and Diamond members via credits. If you don't have credits, you can purchase a session pass. |
| Other | Write your own custom concierge request. |

**Files to modify**:
- `src/pages/member/Support.tsx` -- Add Tabs (Support / Club Concierge). The Concierge tab shows pre-built request cards. Each card has a description, and clicking it opens a dialog pre-filled with the subject. The "Other" card has a free-text subject and message field. All concierge requests create an `email_conversation` with `category: 'concierge'`.

**Files to modify (admin side)**:
- `src/pages/admin/EmailManagement.tsx` -- Add a filter option for `category` (support vs concierge) so staff can quickly see concierge requests.
- `src/hooks/useAdminSupportNotifications.ts` -- No changes needed; it already counts all open conversations.

**Member sidebar**: No changes needed; the existing "Support" link covers both tabs.

---

### Technical Details

1. **Migration**: Single `ALTER TABLE` to add the `category` column with default `'support'` so existing conversations are unaffected.

2. **Concierge cards**: Each card will show:
   - Service icon (Steam/Snowflake/Sun/Pencil)
   - Title and description text
   - A "Request" button that opens a dialog with the subject pre-filled
   - Optional additional notes field

3. **Credit-awareness**: The Ice Bed and Red Light cards will check the member's credits (via the existing `useUserCredits` hook) and display whether they have available credits or need to purchase a pass.

4. **Admin view**: A small category badge ("Support" / "Concierge") next to each conversation in the email management list, plus a filter dropdown.

