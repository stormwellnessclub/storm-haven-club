

## Split Support into In-Club and Regular Sections on Check-In Page with Sound Alerts

### What Changes

The current Check-In page has a single small "SupportAlertCard" banner that just shows a count and links to the emails page. This means staff have to navigate away to see what members need -- and tickets get missed.

This plan replaces that single banner with two dedicated, always-visible panels directly on the Check-In page:

1. **In-Club Requests** (concierge) -- Steam room, ice bed, red light therapy requests from members currently in the building. These are time-sensitive and need immediate attention.
2. **Support Tickets** -- General support messages that can be addressed between check-ins.

Both panels will show the actual ticket subjects, member names, timestamps, and quick-reply capability so staff never need to leave the page.

A **sound notification** will play whenever a new unread message arrives, so even if the staff isn't looking at the screen, they hear it.

### Detailed Changes

**1. New component: `CheckInSupportPanel.tsx`**

A new component that renders two collapsible cards side-by-side below the check-in area:

- **Left card: "In-Club Requests"** (orange/amber theme)
  - Filters conversations where `category = 'concierge'` and status is `open` or `in_progress`
  - Shows member name, request subject, time submitted
  - "Mark Done" button to resolve inline
  - Quick-reply text input for short responses

- **Right card: "Support Tickets"** (blue theme)
  - Filters conversations where `category = 'support'` and status is `open` or `in_progress`
  - Same layout: member name, subject, timestamp
  - "View Full" link to `/admin/emails` for longer conversations
  - Quick-reply capability

Both cards show a count badge in their header (e.g., "In-Club Requests (3)").

**2. Sound notification system**

- Add a small audio file (a soft chime) as a base64-encoded data URL or use the Web Audio API to generate a notification tone programmatically (no external file needed)
- In the `useAdminSupportNotifications` hook, track the previous unread count using a ref
- When the new unread count exceeds the previous count, play the sound
- This runs on the 30-second polling interval that already exists
- Staff can mute/unmute via a small speaker icon on the panel header

**3. Update CheckIn.tsx**

- Remove the existing `<SupportAlertCard />` line
- Add the new `<CheckInSupportPanel />` component between the check-in area and the stats/recent check-ins section
- The panel uses the existing `useAdminSupportNotifications` hook data plus a new query for the actual conversation list

**4. Update `useAdminSupportNotifications` hook**

- Add separate counts for concierge vs support categories
- Return `conciergeOpenCount`, `conciergeUnreadCount`, `supportOpenCount`, `supportUnreadCount`
- Keep the existing `totalActiveCount` for backward compatibility (used by sidebar badges)

### Technical Details

| File | Change |
|------|--------|
| `src/components/admin/CheckInSupportPanel.tsx` | **New file** -- Two-panel support display with inline quick-reply, mark-done, and sound alerts |
| `src/pages/admin/CheckIn.tsx` | Replace `<SupportAlertCard />` with `<CheckInSupportPanel />` |
| `src/hooks/useAdminSupportNotifications.ts` | Add category-split counts; add sound notification logic via a `useNewMessageSound` hook |

**Sound notification approach (Web Audio API -- no file needed):**

```typescript
function playNotificationChime() {
  const ctx = new AudioContext();
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.frequency.value = 880; // A5 note
  osc.type = "sine";
  gain.gain.value = 0.3;
  osc.start();
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);
  osc.stop(ctx.currentTime + 0.5);
}
```

**CheckInSupportPanel layout:**

```text
+----------------------------------+----------------------------------+
| In-Club Requests (2)        [mute] | Support Tickets (1)              |
|                                    |                                  |
| Jane D. - Steam Room Request       | Mike S. - Billing Question       |
| 10:32 AM  [Reply] [Mark Done]      | 9:15 AM  [Reply] [View Full]     |
|                                    |                                  |
| Tom R. - Red Light Therapy          |                                  |
| 10:45 AM  [Reply] [Mark Done]      |                                  |
+----------------------------------+----------------------------------+
```

**Query for panel data:**

```typescript
const { data: conversations } = useQuery({
  queryKey: ['checkin-support-conversations'],
  queryFn: async () => {
    const { data } = await supabase
      .from('email_conversations')
      .select('*, profiles:user_id(first_name, last_name)')
      .in('status', ['open', 'in_progress'])
      .order('last_message_at', { ascending: false })
      .limit(20);
    return data;
  },
  refetchInterval: 15000, // matches check-in polling
});

const conciergeItems = conversations?.filter(c => c.category === 'concierge');
const supportItems = conversations?.filter(c => c.category === 'support');
```
