

## Kids Care: Chat Tab, Booking Visibility & Launch Email Template

### What's happening now
- **Kids Care chat**: Exists in the member portal (`/member/support?tab=kids-care`) and on the admin Check-In page via `CheckInSupportPanel`. But it is **not** on the admin Childcare page (`/admin/childcare`), so you can't see parent messages from the Childcare dashboard.
- **Bookings tab**: Already shows booking cards with child name, parent, times, check-in/out actions. It works but is only visible when navigating to the Childcare page.
- **Email template**: No "Kids Care Now Open" template exists yet.

### Changes

#### 1. Add "Parent Chat" tab to admin Childcare page (`src/pages/admin/Childcare.tsx`)
- Add a new tab "Parent Chat" with a `MessageCircle` icon after "Hour Requests"
- Render a dedicated `KidsCareAdminChat` component that filters conversations to `category === "kids_care"` and provides reply/resolve actions (same pattern as `CheckInSupportPanel` but full-width, not a compact card)
- Show unread count badge on the tab

#### 2. New component: `src/components/admin/KidsCareAdminChat.tsx`
- Query `email_conversations` filtered to `category = 'kids_care'` and `status != 'resolved'`
- Join with `email_messages` for conversation threads
- List conversations on the left, message thread on the right (or stacked on mobile)
- Reply and "Mark Resolved" actions — reuse the same `email_messages` insert + `email_conversations` update pattern from `CheckInSupportPanel`

#### 3. Add "Kids Care Now Open" email template (database insert via migration)
- Insert a system template into `email_templates` with:
  - **Name**: "Kids Care Launch Announcement"
  - **Category**: "announcement"
  - **Subject**: "Kids Care is Now Open at Storm Haven!"
  - **Body**: Branded HTML announcing Kids Care is open with limited launch hours, explaining:
    - Two rooms: Little Stars (infants/toddlers) and Big Stars (preschool/school age)
    - Limited launch hours — schedule expanding as more families sign up
    - Pricing: $75/mo Member Pass (4 sessions) or $40 single session
    - How to book: sign waiver → complete service form → purchase pass → book
    - CTA button linking to `/kids-care`
  - **Merge fields**: `{{first_name}}`, `{{club_name}}`
  - **is_system**: true

### Technical Details
- The admin chat component follows the exact same data pattern as `CheckInSupportPanel` (queries `email_conversations` + `email_messages`, inserts replies as `sender_type: 'staff'`)
- The email template is inserted via a database migration so it appears immediately in the Marketing → Templates tab
- Template HTML will match the existing Storm Haven brand styling used in other system templates

