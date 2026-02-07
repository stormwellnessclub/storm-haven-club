
# Guest Pass Sign Waiver Step - Page Blinking/Flickering Fix

## Problem Summary
When navigating to the waiver signing step from the Guest Pass page, the page blinks on and off rapidly. This is caused by **multiple interconnected bugs** that create an unstable rendering loop.

---

## Root Causes Identified

### 1. Critical Bug: Wrong Column in Waiver Check Query (GuestPass.tsx)

**Location**: `src/pages/GuestPass.tsx` line 81

**Problem**: The waiver status check queries the wrong column:
```typescript
// WRONG - queries `id` column
.eq("id", user.id)

// CORRECT - should query `user_id` column  
.eq("user_id", user.id)
```

**Impact**: The query likely returns no data (or wrong data), causing `hasLiabilityWaiver` to always be `false`, which forces the user to repeatedly see the "Sign Waiver" alert even after signing.

---

### 2. Stale Closure Bug: AgreementPDFViewer (AgreementPDFViewer.tsx)

**Location**: `src/components/AgreementPDFViewer.tsx` lines 154-161

**Problem**: The `setTimeout` callback captures a stale `iframeLoaded` value:
```typescript
// Line 130 resets iframeLoaded to false
setIframeLoaded(false);

// Line 154-160: timeout callback captures the STALE false value
timeoutRef.current = setTimeout(() => {
  if (!iframeLoaded) {  // Always reads false (stale closure)
    setError("PDF preview unavailable");
    setLoading(false);
  }
}, 10000);
```

**Impact**: Even after the iframe loads successfully and `iframeLoaded` is set to `true`, the timeout still sees `false` and sets an error. This can cause the error state to flicker between `null` and `"PDF preview unavailable"`.

---

### 3. Race Condition: Rapid State Transitions

The combination of:
- Multiple `useAgreements` calls on the Waivers page (6 separate queries)
- `useUserProfile` query
- `useKidsCarePasses` query
- PDF preflight fetch calls
- iframe load/error handlers
- 10-second timeout watchers

Can create a cascade of state updates that cause the component to re-render rapidly, especially if any query returns quickly followed by cache invalidation.

---

## Fixes Required

### Fix 1: Correct the Column Name in GuestPass.tsx

Change line 81 from:
```typescript
.eq("id", user.id)
```
To:
```typescript
.eq("user_id", user.id)
```

---

### Fix 2: Use Ref for Stale Closure in AgreementPDFViewer.tsx

Replace the stale closure pattern with a ref that always has the current value:

```typescript
// Add a ref to track the current loaded state
const iframeLoadedRef = useRef(false);

// Update the ref when state changes
useEffect(() => {
  iframeLoadedRef.current = iframeLoaded;
}, [iframeLoaded]);

// In the timeout callback, use the ref instead of state
timeoutRef.current = setTimeout(() => {
  if (!iframeLoadedRef.current) {
    setError("PDF preview unavailable");
    setLoading(false);
  }
}, 10000);
```

---

### Fix 3: Stabilize handleIframeLoad with useCallback

Wrap the iframe handlers in `useCallback` to prevent unnecessary re-renders:

```typescript
const handleIframeLoad = useCallback(() => {
  console.log(`[PDF] Loaded successfully: ${currentPdf}`);
  setIframeLoaded(true);
  setLoading(false);
  setError(null);
  if (timeoutRef.current) {
    clearTimeout(timeoutRef.current);
  }
  onDocumentLoad?.();
}, [currentPdf, onDocumentLoad]);
```

---

## Files to Modify

| File | Change |
|------|--------|
| `src/pages/GuestPass.tsx` | Fix `.eq("id"` to `.eq("user_id"` |
| `src/components/AgreementPDFViewer.tsx` | Add ref for iframe loaded state, use `useCallback` for handlers |

---

## Technical Details

### GuestPass.tsx Change
- Line 81: Change column name from `id` to `user_id`
- This ensures the waiver status is correctly read from the user's profile

### AgreementPDFViewer.tsx Changes
1. Add `useRef` import and create `iframeLoadedRef`
2. Add effect to sync ref with state
3. Update timeout callback to read from ref
4. Wrap `handleIframeLoad` and `handleIframeError` in `useCallback`
5. Add proper dependencies to `useEffect`

---

## Testing After Fix

1. Navigate to `/guest-pass` as an authenticated user
2. Click "Sign Waiver" button
3. Verify the Waivers page loads smoothly without blinking
4. Sign the liability waiver
5. Navigate back to `/guest-pass`
6. Verify the waiver alert no longer appears
7. Complete a guest pass purchase to confirm the full flow works
