

## Plan: Update Final Notice Email Header

### Overview
Update the email header to show "Complete Initiation Payment" as the main title, with **Action Required** in bold below it.

---

### Current Header (Lines 984-991)
```
YOUR MEMBERSHIP AWAITS
Action Required
```

### New Header
```
COMPLETE INITIATION PAYMENT
**Action Required**
```

---

### Technical Changes

**File:** `supabase/functions/send-email/index.ts`

Update lines 984-991 to change:
- Main title from "YOUR MEMBERSHIP AWAITS" → "COMPLETE INITIATION PAYMENT"
- Make "Action Required" bold with `font-weight: 700` (currently 600)

```html
<!-- Updated Header -->
<div style="background: #DEDACE; padding: 30px 20px; text-align: center; border-bottom: 3px solid #B8A068;">
  <h1 style="color: #1C170F; font-size: 28px; font-weight: 500; margin: 0 0 8px 0; font-family: Georgia, 'Times New Roman', Times, serif; letter-spacing: 2px;">
    COMPLETE INITIATION PAYMENT
  </h1>
  <p style="color: #6C5D3E; font-size: 14px; font-weight: 700; margin: 0; font-family: Georgia, 'Times New Roman', Times, serif; letter-spacing: 1px;">
    <strong>Action Required</strong>
  </p>
</div>
```

---

### Visual Preview

| Element | Before | After |
|---------|--------|-------|
| Main Title | YOUR MEMBERSHIP AWAITS | COMPLETE INITIATION PAYMENT |
| Subtitle | Action Required (semi-bold) | **Action Required** (bold) |

