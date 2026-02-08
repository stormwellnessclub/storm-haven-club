

## Plan: Admin Support Center with Notifications

### Overview
Build a dedicated **Support** page in the admin portal with real-time notification indicators. Staff will be able to view all member support conversations, reply to messages, and mark conversations as resolved/closed.

---

### What You'll Get

1. **Rename "Emails" to "Support"** in the admin sidebar for clarity
2. **Support notification badge** in the header showing unread/open conversation count
3. **Clicking the notification bell** takes you directly to the Support page
4. **Clear status workflow**: Open → In Progress → Resolved → Closed
5. **Visual indicators** for unread messages and open tickets

---

### Technical Implementation

#### 1. Update Admin Sidebar (`src/components/admin/AdminSidebar.tsx`)
- Rename "Emails" menu item to "Support" 
- Keep the route at `/admin/emails` (renamed in UI only to avoid route changes)
- Add `MessageSquare` icon instead of `Mail` icon for better clarity

#### 2. Create Support Notification Hook (`src/hooks/useAdminSupportNotifications.ts`)
A new hook to fetch open/unread support tickets count:
- Query `email_conversations` for status = 'open' or 'in_progress'
- Count unread messages (where `is_read = false` AND `sender_type = 'member'`)
- Auto-refresh every 30 seconds to keep count current

#### 3. Update Admin Layout Header (`src/components/admin/AdminLayout.tsx`)
- Replace static "3" badge with real data from the notification hook
- Make the bell icon clickable - navigates to `/admin/emails` (Support page)
- Show badge only when there are open/unread items

#### 4. Enhance Email Management Page (`src/pages/admin/EmailManagement.tsx`)
- Update page title from "Email Management" to "Member Support"
- Add "Mark as Resolved" quick action button
- Add confirmation when closing a ticket
- Highlight unread conversations with a visual indicator
- Add summary stats at top: Open | In Progress | Resolved Today

#### 5. Add Read Tracking for Staff
- When staff opens a conversation, mark member messages as read
- This feeds into the notification count

---

### File Changes Summary

| File | Change |
|------|--------|
| `src/hooks/useAdminSupportNotifications.ts` | **NEW** - Hook for notification count |
| `src/components/admin/AdminLayout.tsx` | Update bell to show real count + link to support |
| `src/components/admin/AdminSidebar.tsx` | Rename "Emails" to "Support" |
| `src/pages/admin/EmailManagement.tsx` | Enhance UI with quick actions and better UX |

---

### User Experience Flow

```text
Staff logs into Admin Portal
       │
       ▼
┌─────────────────────────────────────────┐
│  Header shows bell icon with badge      │
│  showing "3" (number of open tickets)   │
└─────────────────────────────────────────┘
       │
       ▼ (clicks bell OR clicks "Support" in sidebar)
       │
┌─────────────────────────────────────────┐
│  SUPPORT PAGE                           │
│  ┌─────────────┐ ┌───────────────────┐  │
│  │ Ticket List │ │ Conversation View │  │
│  │ [Open: 3]   │ │                   │  │
│  │ - Ticket 1  │ │ Messages here...  │  │
│  │ - Ticket 2  │ │                   │  │
│  │ - Ticket 3  │ │ [Reply box]       │  │
│  └─────────────┘ │ [Mark Resolved]   │  │
│                  └───────────────────┘  │
└─────────────────────────────────────────┘
       │
       ▼ (staff replies and marks resolved)
       │
┌─────────────────────────────────────────┐
│  Notification count decreases           │
│  Ticket moves to "Resolved" status      │
└─────────────────────────────────────────┘
```

---

### Status Workflow
- **Open**: New message from member (default)
- **In Progress**: Staff has replied but not resolved
- **Resolved**: Issue addressed (staff marks this)
- **Closed**: Conversation archived (optional final state)

