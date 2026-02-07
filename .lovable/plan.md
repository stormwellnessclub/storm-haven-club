

# Inline Waiver Gate for Guest Pass & Class Passes

## Your Approach - Why It's Better

Instead of navigating away to `/member/waivers` (which causes the full-page blinking), the user flow becomes:

```text
Guest Pass / Class Pass Page
         ↓
[Not signed in?] → Show "Create Account" section → Auth inline or redirect to /auth
         ↓
[Signed in but waiver not signed?] → Show inline waiver signing section
         ↓
[Waiver signed?] → Show purchase form
```

**Benefits:**
- No navigation = no route guard flickering
- Real-time status updates via React Query
- User stays focused on their goal
- Simpler, more predictable experience

---

## Implementation Overview

### Step-by-Step User Flow

1. **Not Signed In**: User sees a "Create an Account to Continue" section with a link to `/auth?redirect=/guest-pass`
2. **Signed In, Waiver Not Signed**: User sees an inline waiver signing section with:
   - The PDF viewer showing the liability waiver
   - An "I Agree - Sign Waiver" button
   - When clicked, waiver is signed via `useUserProfile().signWaiver()`
   - React Query invalidates and UI updates instantly
3. **Waiver Signed**: User sees the full purchase form

### Component Structure

Create a new reusable component: `InlineWaiverGate.tsx`

```text
<InlineWaiverGate 
  requiredWaivers={["liability"]}  // or ["liability", "guest_pass"]
  onAllSigned={() => void}         // Optional callback
>
  {/* Purchase form only renders when all waivers signed */}
  <GuestPassPurchaseForm />
</InlineWaiverGate>
```

---

## Files to Create/Modify

### 1. Create: `src/components/InlineWaiverGate.tsx`

A reusable gate component that:
- Uses `useUserProfile()` to check waiver status
- Uses `useAgreements()` to fetch the PDF URLs
- Shows a loading state while checking
- If waivers needed, shows the signing UI
- If all signed, renders children

**Key features:**
- Accordion layout (only one PDF loads at a time)
- Auto-expands the first unsigned waiver
- Uses existing `AgreementPDFViewer` component
- Calls existing `signWaiver()`, `signGuestPassAgreement()` etc. mutations

### 2. Modify: `src/pages/GuestPass.tsx`

**Remove:**
- The `hasLiabilityWaiver` state and manual check
- The Alert with "Sign Waiver" link
- The redirect logic to `/member/waivers`

**Add:**
- Import `InlineWaiverGate`
- Wrap the purchase form with the gate
- Add an auth check section for non-logged-in users

**New structure:**
```tsx
export default function GuestPass() {
  const { user, loading: authLoading } = useAuth();

  if (authLoading) return <LoadingSpinner />;

  // Not logged in - show account creation prompt
  if (!user) {
    return (
      <Layout>
        <AccountRequiredSection redirectTo="/guest-pass" />
      </Layout>
    );
  }

  // Logged in - check waivers inline
  return (
    <Layout>
      <InlineWaiverGate requiredWaivers={["liability", "guest_pass"]}>
        {/* Only renders when both waivers are signed */}
        <GuestPassForm />
      </InlineWaiverGate>
    </Layout>
  );
}
```

### 3. Modify: `src/pages/ClassPasses.tsx`

**Remove:**
- The redirect to `/member/waivers` for single class pass agreements
- The `needsAgreement` check that navigates away

**Add:**
- Import `InlineWaiverGate`
- For single class purchases, wrap with `InlineWaiverGate` checking `single_class_pass` agreement

### 4. Create: `src/components/AccountRequiredSection.tsx`

A simple component for non-authenticated users:
- Shows a message: "Create an account to purchase a guest pass"
- "Create Account" button → `/auth?redirect=/guest-pass`
- "Already have an account? Sign In" link

---

## Technical Details

### InlineWaiverGate Component

```tsx
interface InlineWaiverGateProps {
  requiredWaivers: ("liability" | "guest_pass" | "single_class_pass" | "kids_care")[];
  children: React.ReactNode;
  title?: string;
  description?: string;
}

export function InlineWaiverGate({ 
  requiredWaivers, 
  children, 
  title = "Sign Required Agreements",
  description = "Please review and sign the following agreements to continue."
}: InlineWaiverGateProps) {
  const { profile, isLoading, signWaiver, signGuestPassAgreement, ... } = useUserProfile();
  const { data: liabilityAgreements } = useAgreements("liability_waiver");
  const { data: guestPassAgreements } = useAgreements("guest_pass");
  // ... other agreement types as needed

  // Map waiver type to profile field and sign function
  const waiverConfig = {
    liability: {
      signed: profile?.waiver_signed,
      signFn: signWaiver,
      agreements: liabilityAgreements,
      title: "Liability Waiver"
    },
    guest_pass: {
      signed: profile?.guest_pass_agreement_signed,
      signFn: signGuestPassAgreement,
      agreements: guestPassAgreements,
      title: "Guest Pass Agreement"
    },
    // ... etc
  };

  const unsignedWaivers = requiredWaivers.filter(
    w => !waiverConfig[w].signed
  );

  // All signed - render children
  if (unsignedWaivers.length === 0) {
    return <>{children}</>;
  }

  // Show signing UI
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <Accordion type="single" collapsible defaultValue={unsignedWaivers[0]}>
          {unsignedWaivers.map(waiverType => {
            const config = waiverConfig[waiverType];
            return (
              <AccordionItem key={waiverType} value={waiverType}>
                <AccordionTrigger>
                  {config.title}
                  <Badge variant="outline">Required</Badge>
                </AccordionTrigger>
                <AccordionContent>
                  <AgreementPDFViewer 
                    pdfUrl={config.agreements?.map(a => a.pdf_url) || []}
                    height="400px"
                  />
                  <Button 
                    onClick={() => config.signFn()}
                    className="w-full mt-4"
                  >
                    I Agree - Sign {config.title}
                  </Button>
                </AccordionContent>
              </AccordionItem>
            );
          })}
        </Accordion>
      </CardContent>
    </Card>
  );
}
```

### Real-time Updates

When `signWaiver()` completes:
1. React Query invalidates `["user-profile", user?.id]`
2. `useUserProfile()` refetches
3. `profile.waiver_signed` becomes `true`
4. `InlineWaiverGate` re-renders
5. `unsignedWaivers` becomes empty
6. Children (purchase form) now render

This happens instantly with no navigation or page flicker.

---

## Summary of Changes

| File | Action |
|------|--------|
| `src/components/InlineWaiverGate.tsx` | **Create** - Reusable inline waiver signing gate |
| `src/components/AccountRequiredSection.tsx` | **Create** - Auth prompt for non-logged-in users |
| `src/pages/GuestPass.tsx` | **Modify** - Use inline gate instead of navigating away |
| `src/pages/ClassPasses.tsx` | **Modify** - Use inline gate for single class pass agreement |

**No changes needed to:**
- `useUserProfile.ts` (already has all sign functions)
- `useAgreements.ts` (already fetches PDFs)
- `AgreementPDFViewer.tsx` (already works)
- Any routing or protected route components

---

## Testing Plan

1. Sign out completely
2. Go to `/guest-pass`
3. **Expected**: See "Create Account" section, not redirected
4. Click "Create Account" → `/auth?redirect=/guest-pass`
5. Create account or sign in
6. **Expected**: Return to `/guest-pass`, see inline waiver section
7. Expand liability waiver, review PDF, click "I Agree"
8. **Expected**: UI updates instantly, shows guest pass form (or next required waiver)
9. Complete purchase
10. **Expected**: Smooth checkout redirect

Same test for `/class-passes` single class purchase.

