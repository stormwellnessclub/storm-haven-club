

## Fix Support Tickets Display and Add Concierge Time Notice

### Problem 1: Support tickets show count but not actual ticket details

The `CheckInSupportPanel` on the check-in page shows "2 tickets pending" as badge counts, but the actual ticket content inside the collapsible sections may not be rendering because conversations are being filtered by `category`. Looking at the data:
- 1 conversation has `category: "concierge"` (open)
- 1 has `category: "support"` (in_progress)

The panel code filters `category === "concierge"` for in-club and `category !== "concierge"` for support -- this is correct. The items should render. The likely issue is either:
- The collapsible sections are collapsed by default and the user doesn't realize they need to click to expand, OR
- The conversations load but the `ConversationItem` component doesn't show enough detail (only subject line, no message preview)

**Fix**: Make the collapsible sections default to open (already set), and add the latest message preview to each conversation item so staff can see what the member actually wrote without clicking "View Full". Also ensure the panel is more visually prominent with a heading.

### Problem 2: In-club concierge requests need to "pop up" on check-in page

Currently the `CheckInSupportPanel` renders at the top of the check-in page but it's a collapsible card that can be easy to miss. To make concierge requests more noticeable:

**Fix**: When there are concierge requests, show them with a more prominent alert-style banner that can't be missed. Add a pulsing indicator or stronger visual treatment for new/unread concierge requests.

### Problem 3: Add 15-30 minute prep time notice to member concierge tab

Members need to know that concierge requests take 15-30 minutes to fulfill.

**Fix**: Add an info notice/alert at the top of the `ClubConciergeTab` component telling members: "Please allow 15-30 minutes for our team to prepare your request. We recommend submitting your request upon arrival or before heading to the club."

---

### File Changes

| File | Change |
|------|--------|
| `src/components/member/ClubConciergeTab.tsx` | Add an info alert at the top with the 15-30 minute prep time notice |
| `src/components/admin/CheckInSupportPanel.tsx` | Fetch and show the latest message preview for each conversation; add stronger visual treatment for concierge requests; ensure items are clearly visible |

### Technical Details

**ClubConciergeTab.tsx**:
- Import `Alert`, `AlertTitle`, `AlertDescription` from ui/alert
- Import `Clock` icon from lucide-react
- Add an alert box before the service cards grid:
```
Please allow 15-30 minutes for our concierge team to prepare your request. 
We recommend submitting your request when you arrive or shortly before.
```

**CheckInSupportPanel.tsx**:
- Fetch the latest message for each conversation by querying `email_messages` for each conversation ID, ordered by `created_at desc`, limit 1
- Display a truncated message preview (first ~80 characters) below the subject line in each `ConversationItem`
- For concierge items, use a more prominent amber background to make them stand out
- Remove the "hide when empty" check on individual panels so staff always sees the sections even if one category is empty (the overall panel still hides when there are zero total conversations)
