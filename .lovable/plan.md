
## Update Credits Page: Always-Visible Guest Pass Section with Purchase Option

### What Changes

One file updated: `src/pages/member/Credits.tsx` (lines 65-71)

The Guest Pass section will always be visible to members instead of being hidden when credits are 0.

### Behavior

| Scenario | What Member Sees |
|----------|-----------------|
| **Has guest pass credits (remaining > 0)** | The registration form to enter guest info (no change from today) |
| **No credits (0 or no record)** | A card with "No Guest Pass Credits" message and a "Buy a Guest Pass -- $60" button linking to `/guest-pass` plus a note about asking staff for complimentary credits |

### Admin-Granted Credits Confirmation

When an admin grants a guest pass credit to a specific member (via Member Detail > Adjust Credits), a `member_credits` record is created with `credit_type = 'guest_pass'` and `credits_remaining = 1`. The member's Credits page automatically picks this up and shows the full registration form where they can enter their guest's first name, last name, email, phone, and visit date. No additional work is needed for this -- it already works.

### Technical Details

**File: `src/pages/member/Credits.tsx`**

Replace the conditional block at lines 65-71:

```tsx
// FROM:
{credits?.guestPassCredits && credits.guestPassCredits.credits_remaining > 0 && (
  <GuestPassRegistrationCard
    credit={credits.guestPassCredits}
    memberId={credits.memberId!}
  />
)}

// TO:
{credits?.isMember && (
  credits?.guestPassCredits && credits.guestPassCredits.credits_remaining > 0 ? (
    <GuestPassRegistrationCard
      credit={credits.guestPassCredits}
      memberId={credits.memberId!}
    />
  ) : (
    <Card className="border-accent/30">
      <CardHeader>
        <div className="flex items-center gap-2">
          <Gift className="h-5 w-5 text-accent" />
          <CardTitle>Complimentary Guest Pass</CardTitle>
        </div>
        <CardDescription>Invite a guest to experience the club</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="text-center py-6">
          <Gift className="h-12 w-12 mx-auto mb-3 text-muted-foreground opacity-50" />
          <p className="text-muted-foreground mb-4">
            You don't have any guest pass credits right now.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Button asChild>
              <Link to="/guest-pass">Buy a Guest Pass — $60</Link>
            </Button>
          </div>
          <p className="text-xs text-muted-foreground mt-3">
            Or ask staff about complimentary guest pass credits
          </p>
        </div>
      </CardContent>
    </Card>
  )
)}
```

No database changes needed. No new files. One block replaced in one file.
