
## Enhanced Admin Member Filtering Plan

### Problem Summary
The current member list filtering is too limited. When you navigate into a member's detail and return, filter selections are lost. Cancelled members are mixed with active ones. There are no filters for:
- Membership tier (Silver, Gold, Platinum, Diamond)
- Initiation fee status (paid vs. unpaid)
- Payment method status (card on file vs. no card)
- Subscription status (active subscription vs. no subscription)
- Gender
- Waiver status (signed vs. unsigned)

### Solution Overview
We will implement a comprehensive, URL-persisted filter system that:
1. Preserves filters when navigating to/from member details
2. Defaults to hiding cancelled/expired members (with easy toggle to show them)
3. Adds multiple new filter categories
4. Shows filter counts for quick reference
5. Allows quick filter clearing

---

### Part 1: URL-Persisted Filter State

**Current Problem:**
- Filters use `useState` which resets on navigation
- When you click a member, navigate to their detail page, then go back, all filters reset

**Solution:**
- Move all filter state to URL search params using `useSearchParams`
- When filters change, update the URL
- When the page loads, read filters from URL
- Back navigation will preserve filters automatically

**Example URL:**
```
/admin/members?status=active&tier=Gold&initiation=unpaid&hasCard=true
```

---

### Part 2: New Filter Categories

We will add these new filters:

| Filter | Options | Current Count |
|--------|---------|---------------|
| **Membership Tier** | All, Silver, Gold, Platinum, Diamond | 5 tiers |
| **Initiation Fee** | All, Paid, Unpaid | 101 paid, 32 unpaid |
| **Payment Method** | All, Has Card, No Card | 69 with card, 64 without |
| **Subscription** | All, Active, None | 33 active, 100 none |
| **Waiver Status** | All, Signed, Unsigned | - |
| **Gender** | All, Women, Men | - |

---

### Part 3: Quick Preset Filters

Add preset filter buttons for common workflows:

- **Active Members** - Status = Active, hide cancelled
- **Needs Attention** - Has billing issues OR no card OR no subscription
- **Pending Setup** - Status = Pending Activation
- **Payment Issues** - Failed payments or past due
- **Initiation Unpaid** - Initiation fee not paid
- **No Card on File** - Missing payment method
- **All Members** - Clear all filters, include cancelled

---

### Part 4: Default Behavior Change

**Current:** Shows all members including cancelled/expired

**New Default:**
- Exclude cancelled and expired members by default
- Add "Include Cancelled/Expired" toggle that is OFF by default
- This keeps the main list focused on members who need attention

---

### Part 5: UI/UX Improvements

**Filter Bar Layout:**
```
┌─────────────────────────────────────────────────────────────────────┐
│  [Search...]                                                        │
├─────────────────────────────────────────────────────────────────────┤
│  Quick Filters: [Active] [Needs Attention] [Pending] [Payment ⚠️]  │
├─────────────────────────────────────────────────────────────────────┤
│  Status: [▼ Active]  Tier: [▼ All]  Initiation: [▼ All]           │
│  Card: [▼ All]  Subscription: [▼ All]  Gender: [▼ All]            │
│  [ ] Show Cancelled/Expired                          [Clear Filters]│
└─────────────────────────────────────────────────────────────────────┘
```

**Active Filter Pills:**
When filters are applied, show them as dismissible pills:
```
Showing: [Status: Active ✕] [Initiation: Unpaid ✕] [Clear All]
```

---

### Part 6: Filter Counts

Show counts next to filter options where helpful:
- "Pending Activation (45)"
- "Initiation Unpaid (32)"
- "No Card (64)"
- "Issues Only (12)"

---

### Technical Implementation

**File:** `src/pages/admin/Members.tsx`

**Changes:**

1. **Replace useState with URL params:**
```typescript
// BEFORE
const [statusFilter, setStatusFilter] = useState<string>("all");

// AFTER
const [searchParams, setSearchParams] = useSearchParams();
const statusFilter = searchParams.get("status") || "active_only";
const setStatusFilter = (value: string) => {
  const params = new URLSearchParams(searchParams);
  if (value === "active_only") params.delete("status");
  else params.set("status", value);
  setSearchParams(params, { replace: true });
};
```

2. **Add new filter state readers:**
```typescript
const tierFilter = searchParams.get("tier") || "all";
const initiationFilter = searchParams.get("initiation") || "all";
const cardFilter = searchParams.get("card") || "all";
const subscriptionFilter = searchParams.get("subscription") || "all";
const genderFilter = searchParams.get("gender") || "all";
const showCancelled = searchParams.get("showCancelled") === "true";
```

3. **Update filter logic to include all new filters**

4. **Add clear filters button:**
```typescript
const clearAllFilters = () => {
  setSearchParams({}, { replace: true });
};
```

5. **Add Quick Filter buttons that set multiple params at once**

---

### Files to Modify

| File | Changes |
|------|---------|
| `src/pages/admin/Members.tsx` | Complete filter overhaul with URL persistence, new filters, presets |

---

### Expected Outcome

1. Filters persist when navigating to member details and back
2. Cancelled members hidden by default, reducing clutter
3. Quick access to common filter combinations
4. Easy identification of members needing attention (unpaid fees, missing cards, etc.)
5. Clear filter state visible at all times
6. One-click filter clearing
