
# Redirect to Member Portal for Missing Waivers

## Problem Summary

Currently, when a user tries to purchase a service that requires a waiver they haven't signed:
1. The `InlineWaiverGate` blocks them with an inline signing experience
2. This causes UI issues (shaking, loading states)
3. Users must sign waivers repeatedly in-context instead of managing them centrally

## Solution

Instead of blocking with inline signing, show a friendly message directing users to the member portal `/member/waivers` page to sign the relevant waiver. This:
- Creates a cleaner separation of concerns
- Eliminates the "shaking" UI issue from inline waiver components
- Centralizes all agreement management in one place
- Makes the flow more intuitive for users

## Architecture Change

### Current Flow
```text
User tries to purchase → InlineWaiverGate checks waivers → 
Shows inline signing UI (causes loading/shaking) → User signs inline → 
Form appears
```

### New Flow
```text
User tries to purchase → Check if waiver signed → 
If missing: Show friendly alert with link to /member/waivers → 
User signs in portal → Returns to purchase → Form ready
```

## Technical Changes

### 1. Create `WaiverRequiredAlert` Component

A new component that shows a friendly message when a required waiver is missing:

```typescript
interface WaiverRequiredAlertProps {
  waiverType: WaiverType;
  serviceName: string;  // e.g., "Guest Pass", "Kids Care"
  onNavigate?: () => void;
}
```

Features:
- Shows which waiver is needed
- Provides a link to `/member/waivers` page
- Can optionally preserve the return URL

### 2. Simplify `InlineWaiverGate` 

Update to show the redirect alert instead of the inline signing UI:
- Remove the complex accordion-based inline signing
- Replace with `WaiverRequiredAlert` that links to portal
- Keep the same `requiredWaivers` prop interface for backwards compatibility

### 3. Update All Purchase Flows

Each purchase page should check waivers and show the alert:

| Service | Required Waiver | File |
|---------|-----------------|------|
| Guest Pass | `guest_pass` | `GuestPass.tsx` |
| Class Passes (Single) | `single_class_pass` | `ClassPasses.tsx` |
| Kids Care | `kids_care` | `KidsCareBookingModal.tsx` |
| Private Events | `private_event` | (if exists) |

### 4. Enhance Member Waivers Page

Update `/member/waivers` to:
- Show which waivers are "needed for" which services
- Display clear status (signed/unsigned) 
- Remember the return URL so users can go back to their purchase

## UI Design

### Purchase Page Alert (when waiver missing)
```text
+------------------------------------------------------------+
|  ⚠ Agreement Required                                       |
|  --------------------------------------------------------  |
|                                                             |
|  To purchase a Guest Pass, you need to sign our            |
|  Guest Pass Agreement first.                                |
|                                                             |
|  [Go to Waivers & Agreements →]                             |
|                                                             |
|  This only needs to be done once.                           |
+------------------------------------------------------------+
```

### After signing, user can return to purchase flow and form loads immediately.

## Files to Change

| File | Change |
|------|--------|
| `src/components/WaiverRequiredAlert.tsx` | **NEW** - Alert component with portal link |
| `src/components/InlineWaiverGate.tsx` | Simplify to show redirect alert instead of inline signing |
| `src/pages/GuestPass.tsx` | Use simplified waiver check |
| `src/pages/ClassPasses.tsx` | Already has similar logic, ensure consistent |
| `src/components/booking/KidsCareBookingModal.tsx` | Already redirects, ensure consistent messaging |

## Implementation Details

### WaiverRequiredAlert.tsx

```typescript
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { AlertCircle, ArrowRight } from "lucide-react";
import { Link, useLocation } from "react-router-dom";

const WAIVER_DISPLAY_NAMES: Record<string, string> = {
  liability: "Liability Waiver",
  guest_pass: "Guest Pass Agreement",
  single_class_pass: "Single Class Pass Agreement", 
  kids_care: "Kids Care Agreement",
  membership: "Membership Agreement",
  class_package: "Class Package Agreement",
  private_event: "Private Event Agreement",
};

interface WaiverRequiredAlertProps {
  waiverType: string;
  serviceName: string;
}

export function WaiverRequiredAlert({ waiverType, serviceName }: WaiverRequiredAlertProps) {
  const location = useLocation();
  const returnUrl = encodeURIComponent(location.pathname + location.search);
  
  return (
    <Alert className="border-accent/50 bg-accent/5">
      <AlertCircle className="h-4 w-4 text-accent" />
      <AlertTitle>Agreement Required</AlertTitle>
      <AlertDescription className="mt-2">
        <p className="mb-4">
          To purchase {serviceName}, please sign our {WAIVER_DISPLAY_NAMES[waiverType] || waiverType} first.
        </p>
        <Button asChild>
          <Link to={`/member/waivers?return=${returnUrl}`}>
            Go to Waivers & Agreements
            <ArrowRight className="ml-2 h-4 w-4" />
          </Link>
        </Button>
        <p className="text-xs text-muted-foreground mt-3">
          This only needs to be done once.
        </p>
      </AlertDescription>
    </Alert>
  );
}
```

### Updated InlineWaiverGate.tsx

Simplify to use the redirect pattern:

```typescript
export function InlineWaiverGate({
  requiredWaivers,
  children,
  serviceName = "this service",
}: InlineWaiverGateProps) {
  // ... existing profile/agreement checks ...

  // Find first unsigned waiver
  const unsignedWaiver = requiredWaivers.find(w => {
    const config = waiverConfigs[w];
    return config.agreements.length > 0 && !config.signed;
  });

  // If any required waiver is missing, show redirect alert
  if (unsignedWaiver) {
    return (
      <WaiverRequiredAlert 
        waiverType={unsignedWaiver} 
        serviceName={serviceName}
      />
    );
  }

  // All waivers signed, show children
  return <>{children}</>;
}
```

## Benefits

1. **No more shaking UI** - No inline loading states for agreement fetching/signing
2. **Centralized management** - All waivers managed in one place (`/member/waivers`)
3. **One-time signing** - Clear messaging that this only needs to be done once
4. **Consistent UX** - Same pattern across all purchase flows
5. **Simpler code** - Remove complex inline signing logic
6. **Return URL support** - Users return to their purchase after signing

## Edge Cases

1. **Non-authenticated users**: Show login prompt first, then check waivers after auth
2. **Already signed**: Form appears immediately (no alert shown)
3. **Multiple missing waivers**: Show alert for first missing one; after signing, they return and see next (rare case)
4. **Deep linking**: Return URL preserves query params for proper navigation back
