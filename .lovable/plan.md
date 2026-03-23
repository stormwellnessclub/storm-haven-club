

## Update Activation Email CTA to Redirect to Membership Setup

### Change

**File: `supabase/functions/send-email/index.ts`** (line 1257)

Update the main CTA button link from `/auth` to `/auth?redirect=/member/membership` so that after signing in, new members land directly on their membership setup checklist instead of the default dashboard.

**Current:**
```html
<a href="${BASE_URL}/auth" style="...">Complete Your Setup</a>
```

**Updated:**
```html
<a href="${BASE_URL}/auth?redirect=/member/membership" style="...">Complete Your Setup</a>
```

That's the only change. The edge function will need to be redeployed after.

