

# Track Payment Link Requests in Admin Dashboard

## Summary
Add a visual indicator in the admin applications dashboard to show when a payment link has been generated and emailed to an applicant, allowing you to keep track of who has been sent payment requests.

## Solution Overview

We'll add a new database column `payment_link_sent_at` to the `membership_applications` table that stores the timestamp when a payment link was generated. This enables:
- A visual icon/badge in the applications table showing "Link Sent"
- The date/time when the link was sent (hover tooltip)
- Easy filtering/identification of applicants awaiting payment

---

## Visual Design

### In the Applications Table
A new indicator will appear in the **Card** column (or as a separate small icon):

| Current | After Payment Link Sent |
|---------|------------------------|
| `None` badge | `None` badge + 🔗 **Link Sent** icon |
| `VISA •••• 1234` | `VISA •••• 1234` (no change - they already paid) |

**Icon appearance:**
- Small `Link2` icon (chain link) in amber/orange color
- Hover tooltip: "Payment link sent on Jan 15, 2026 at 3:45 PM"

### Example Row:
```
┌──────────────────────────────────────────────────────────────────────────┐
│ John Smith          │ Gold Membership │ None 🔗 │ Pending │ Pending │ ... │
│ john@email.com      │                 │  ↳ Link Sent                      │
└──────────────────────────────────────────────────────────────────────────┘
```

---

## Technical Implementation

### 1. Database Migration
Add a new column to track when payment links are sent:

```sql
ALTER TABLE membership_applications 
ADD COLUMN payment_link_sent_at TIMESTAMPTZ DEFAULT NULL;
```

### 2. Update Edge Function
Modify `stripe-payment/index.ts` to record the timestamp when generating a payment link:

```typescript
// After sending the email successfully
await supabaseClient
  .from("membership_applications")
  .update({ payment_link_sent_at: new Date().toISOString() })
  .eq("id", applicationId);
```

### 3. Update Application Type
Add the new field to the local `Application` type in `Applications.tsx`:

```typescript
type Application = {
  // ...existing fields...
  payment_link_sent_at: string | null;
};
```

### 4. Update Table Display
Add a visual indicator in the applications table row:

```tsx
<TableCell>
  <div className="flex items-center gap-2">
    {app.stripe_customer_id ? (
      <Badge>VISA •••• {app.card_last4}</Badge>
    ) : (
      <Badge variant="outline">None</Badge>
    )}
    
    {/* Payment link sent indicator */}
    {app.payment_link_sent_at && (
      <Tooltip>
        <TooltipTrigger>
          <div className="flex items-center gap-1 text-amber-600">
            <Link2 className="h-3.5 w-3.5" />
            <span className="text-xs">Sent</span>
          </div>
        </TooltipTrigger>
        <TooltipContent>
          Payment link sent on {format(new Date(app.payment_link_sent_at), "MMM d, yyyy 'at' h:mm a")}
        </TooltipContent>
      </Tooltip>
    )}
  </div>
</TableCell>
```

---

## Files to Modify

| File | Changes |
|------|---------|
| Database migration | Add `payment_link_sent_at` column |
| `supabase/functions/stripe-payment/index.ts` | Update application record when link is sent |
| `src/pages/admin/Applications.tsx` | Add `payment_link_sent_at` to type + display indicator |

---

## User Experience

**Before:**
- Admin generates payment link → dialog shows "Email sent" → closes dialog → no way to know later

**After:**
- Admin generates payment link → dialog shows "Email sent" → closes dialog
- Table row shows a 🔗 "Sent" indicator with timestamp on hover
- Easy to scan which applicants are waiting for payment

---

## Optional Enhancements (Future)

1. **Filter by "Link Sent"** - Add a filter to show only applications with pending payment links
2. **Resend Link** - Button to regenerate and resend the payment link
3. **Time-based alerts** - Highlight if link was sent more than 3 days ago (approaching policy deadline)

