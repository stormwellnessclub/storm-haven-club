## Add Email Templates to Admin Sidebar

Add a single clickable entry in the admin sidebar so you can easily reach the email template previews without typing URLs.

### Changes

**1. New index page: `src/pages/admin/EmailTemplatesIndex.tsx`**
A simple list page at `/admin/email-templates` showing all preview templates as cards:
- **Payment Failed** — sent when recurring dues payments fail → links to `/admin/email-templates/payment-failed`
- **Applicant Card Declined** — sent when an approved applicant's initial card charge fails → links to `/admin/email-templates/card-declined`

Each card shows the template name, when it fires, and a "Preview" button. Easy to add more templates here later.

**2. Sidebar entry: `src/components/admin/AdminSidebar.tsx`**
Add one new item under the **Administration** section:
- `Email Templates` (Mail icon) → `/admin/email-templates`

**3. Route: `src/App.tsx`**
Register the new index route. The two existing preview routes (`/admin/email-templates/payment-failed`, `/admin/email-templates/card-declined`) stay as-is.

**4. Permissions: `src/lib/permissions.ts`**
Restrict `/admin/email-templates*` to `super_admin` and `admin` only (same as other Administration items).

### Result

In the sidebar you'll see **Administration → Email Templates**. Clicking it opens a small library page where you can click either template to see the live email preview rendered in-browser.
