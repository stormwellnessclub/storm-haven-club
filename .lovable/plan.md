
# Update Admin Dashboard and Reports with Real Data

## Problem Summary

The Admin Dashboard at `/admin` currently displays **hardcoded placeholder data** that was used during initial development:
- Fake stats: "1,284 Active Members", "89 Today's Check-Ins", etc.
- Fake recent check-ins with made-up names
- Fake upcoming appointments
- Fake pending applications
- Bottom row shows fake metrics ("98% Member Retention", "147 Currently In Club")

The Cash Flow and Revenue reports also use **incorrect pricing logic** that doesn't account for founding members paying annually upfront.

---

## Current State (Real Data)

From the database:
| Metric | Real Value |
|--------|------------|
| Total Members | 128 |
| Active Members | 1 |
| Founding Members | 45 |
| Regular Members | 83 |
| Pending Applications | 8 |
| Approved Applications | 116 |
| Today's Classes | 22 |
| Today's Spa Appointments | 0 |
| Check-in Activities | 0 (no check-ins logged yet) |

---

## Scope of Work

### 1. Admin Dashboard (Dashboard.tsx)

**Remove all hardcoded data and replace with real database queries:**

| Section | Current (Fake) | After (Real Data) |
|---------|----------------|-------------------|
| Active Members | "1,284" hardcoded | Query `members` table WHERE status = 'active' |
| Today's Check-Ins | "89" hardcoded | Query `member_activities` WHERE activity_type = 'check_in' AND DATE(created_at) = today |
| Appointments Today | "24" hardcoded | Query `spa_appointments` WHERE appointment_date = today |
| Pending Applications | "7" hardcoded | Query `membership_applications` WHERE status = 'pending' |
| Recent Check-Ins list | Fake names | Query latest check-ins joined with members |
| Upcoming Appointments | Fake data | Query today's spa_appointments joined with members |
| Pending Applications list | Fake names | Query pending applications |
| Bottom stats | "98%", "147", "18" | Remove or calculate real metrics |

**Implementation approach:**
- Add `useQuery` hooks to fetch real data from Supabase
- Handle loading states with skeletons
- Handle empty states gracefully (e.g., "No check-ins yet today")

### 2. Cash Flow Projection Report

**Fix pricing logic for founding vs regular members:**

Current (Wrong):
```text
All members treated as monthly payers
Founding members get "20% discount" (incorrect)
```

After (Correct):
```text
PRICING = {
  silver: { monthly: { women: 200, men: 120 }, annual: { women: 2400, men: 1440 } },
  gold: { monthly: { women: 250, men: 155 }, annual: { women: 3000, men: 1860 } },
  platinum: { monthly: { women: 350, men: 175 }, annual: { women: 4200, men: 2100 } },
  diamond: { monthly: { women: 500, men: null }, annual: { women: 6000, men: null } },
}

Founding Members:
  - Month 1: Full annual payment upfront
  - Months 2-12: $0 (already paid)

Regular Members:
  - All months: Monthly payment
```

### 3. Revenue Summary Report

**Fix to differentiate founding annual vs regular monthly:**

- Add `gender` field to query
- Calculate founding revenue using annual rates
- Calculate regular revenue using monthly rates
- Show breakdown by founding status

### 4. Founding Members Report

**Fix revenue calculations:**

- Change "Monthly Revenue" label to "Annual Revenue (Upfront)"
- Use annual pricing rates instead of monthly
- Include gender for accurate pricing

---

## Files to Modify

| File | Changes |
|------|---------|
| `src/pages/admin/Dashboard.tsx` | Replace hardcoded data with useQuery hooks |
| `src/components/admin/reports/reports/CashFlowProjectionReport.tsx` | Fix pricing logic, add gender field, handle founding annual payments |
| `src/components/admin/reports/reports/RevenueSummaryReport.tsx` | Fix pricing to differentiate founding vs regular |
| `src/components/admin/reports/reports/FoundingMembersReport.tsx` | Use annual pricing rates |

---

## Technical Details

### Dashboard.tsx - New Data Fetching

```typescript
// Replace static arrays with hooks
const { data: dashboardStats } = useQuery({
  queryKey: ['admin-dashboard-stats'],
  queryFn: async () => {
    // Fetch active members count
    const { count: activeMembers } = await supabase
      .from('members')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'active');
    
    // Fetch pending applications count
    const { count: pendingApps } = await supabase
      .from('membership_applications')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'pending');
    
    // Fetch today's check-ins
    const today = new Date().toISOString().split('T')[0];
    const { count: todayCheckins } = await supabase
      .from('member_activities')
      .select('*', { count: 'exact', head: true })
      .eq('activity_type', 'check_in')
      .gte('created_at', `${today}T00:00:00`)
      .lt('created_at', `${today}T23:59:59`);
    
    // Fetch today's appointments
    const { count: todayAppointments } = await supabase
      .from('spa_appointments')
      .select('*', { count: 'exact', head: true })
      .eq('appointment_date', today);
    
    // Fetch today's classes
    const { count: todayClasses } = await supabase
      .from('class_sessions')
      .select('*', { count: 'exact', head: true })
      .eq('session_date', today);
    
    return {
      activeMembers: activeMembers || 0,
      pendingApps: pendingApps || 0,
      todayCheckins: todayCheckins || 0,
      todayAppointments: todayAppointments || 0,
      todayClasses: todayClasses || 0,
    };
  },
});
```

### Report Pricing Constant (Shared)

```typescript
const PRICING = {
  silver: {
    monthly: { women: 200, men: 120 },
    annual: { women: 2400, men: 1440 },
  },
  gold: {
    monthly: { women: 250, men: 155 },
    annual: { women: 3000, men: 1860 },
  },
  platinum: {
    monthly: { women: 350, men: 175 },
    annual: { women: 4200, men: 2100 },
  },
  diamond: {
    monthly: { women: 500, men: null },
    annual: { women: 6000, men: null },
  },
};
```

### Cash Flow Calculation Logic

```typescript
// For each month in 12-month projection
for (let i = 0; i < 12; i++) {
  let monthlyRevenue = 0;
  
  filtered.forEach(member => {
    const tier = extractTier(member.membership_type);
    const gender = normalizeGender(member.gender); // 'women' | 'men'
    
    if (member.is_founding_member) {
      // Founding: Full annual amount in month 1 only
      if (i === 0) {
        monthlyRevenue += PRICING[tier].annual[gender] || 0;
      }
      // Months 2-12: $0 for founding (already paid)
    } else {
      // Regular: Monthly amount every month
      monthlyRevenue += PRICING[tier].monthly[gender] || 0;
    }
  });
  
  projections.push({ month, projected: monthlyRevenue, ... });
}
```

---

## Expected Outcome

**Dashboard:**
- Shows real member counts, application counts
- Recent check-ins from actual database (or "No recent check-ins" if empty)
- Today's appointments from spa_appointments table
- Pending applications with real applicant names

**Reports:**
- Cash Flow shows realistic projections with founding upfront spike in Month 1
- Revenue Summary correctly calculates annual revenue for founding members
- Founding Members Report shows accurate annual revenue totals

---

## Empty State Handling

Since some data (like check-ins) may be empty until launch:

```typescript
{recentCheckIns.length > 0 ? (
  // Render check-in list
) : (
  <p className="text-sm text-muted-foreground py-4 text-center">
    No check-ins yet today
  </p>
)}
```
