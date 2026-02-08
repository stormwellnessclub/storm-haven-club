

## Plan: Kids Care Soft Launch Mode with Interest Waitlist

### Overview
Update the Kids Care page for soft launch mode with:
1. Correct future hours (Mon-Thu: 8am-8pm, Fri-Sun: 8am-5pm)
2. Soft launch banner with disabled booking
3. Interest waitlist for gauging demand
4. Two-room structure with correct capacities

---

### Updated Hours Configuration

| Days | Regular Hours |
|------|--------------|
| Monday - Thursday | 8:00 AM - 8:00 PM |
| Friday - Sunday | 8:00 AM - 5:00 PM |

**Note:** For soft launch, actual hours will be shared later. We'll display a "Soft launch hours will be shared soon" message.

---

### Two-Room Structure

| Room | Age Groups | Capacity |
|------|-----------|----------|
| **Little Stars Room** | Infants (3mo - 1yr) + Toddlers (1-3 yrs) | 8 kids |
| **Big Stars Room** | Preschool (3-5 yrs) + School Age (5-10 yrs) | 6 kids |

---

### Database Changes

**New Table: `kids_care_interest_waitlist`**

Track potential demand for Kids Care before soft launch:

```sql
CREATE TABLE kids_care_interest_waitlist (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  email TEXT NOT NULL,
  first_name TEXT,
  last_name TEXT,
  phone TEXT,
  children_count INTEGER DEFAULT 1,
  children_ages TEXT, -- e.g., "2, 4" or "infant, toddler"
  notes TEXT,
  status TEXT DEFAULT 'waiting', -- waiting, contacted, converted
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

### UI Changes

#### 1. KidsCare.tsx - Public Page

**Changes:**
- Add `isSoftLaunch = true` flag (mirrors Schedule.tsx pattern)
- Add soft launch banner at top
- Update hours display to show future regular hours with soft launch note
- Update age groups to show two-room structure
- Disable booking button (grayed out, "Booking opens soon")
- Replace booking section with "Join Interest Waitlist" form

**Soft Launch Banner:**
```text
┌────────────────────────────────────────────────┐
│ 🌙 Coming Soon                                 │
│ Kids Care booking will open soon. Soft launch │
│ hours will be shared this week.               │
│                                                │
│ [ Join Interest Waitlist ]                     │
└────────────────────────────────────────────────┘
```

**Interest Waitlist Form Fields:**
- First Name
- Last Name  
- Email
- Phone (optional)
- Number of children
- Children's ages (text field: "2, 4, 6")
- Any notes (optional)

#### 2. Hours Section Update

Display future regular hours but with soft launch note:

```text
Hours of Operation
──────────────────────────────────────
Monday - Thursday    8:00 AM - 8:00 PM
Friday - Sunday      8:00 AM - 5:00 PM
──────────────────────────────────────
* Soft launch hours may vary. Check back for updates.
```

#### 3. Age Groups / Rooms Section

Update to show two-room layout:

```text
Our Two Rooms
──────────────────────────────────────
🍼 Little Stars Room
   Infants (3 months - 1 year)
   Toddlers (1 - 3 years)
   Capacity: 8 children
   
🌟 Big Stars Room
   Preschool (3 - 5 years)
   School Age (5 - 10 years)
   Capacity: 6 children
```

#### 4. Booking Section → Interest Waitlist

When `isSoftLaunch = true`:
- Hide "Book Kids Care Session" button
- Show interest waitlist form
- Add note: "Each Kids Care Pass covers one child only"

---

### Files to Create/Modify

| File | Changes |
|------|---------|
| `src/pages/KidsCare.tsx` | Add soft launch mode, update hours, rooms, add interest form |
| `src/hooks/useKidsCareInterest.ts` | New hook for interest waitlist submission |
| `src/pages/admin/Childcare.tsx` | Add tab to view interest waitlist entries |
| **Database** | Create `kids_care_interest_waitlist` table |

---

### Technical Implementation

#### KidsCare.tsx Key Changes

```typescript
// Soft launch mode
const isSoftLaunch = true;

// Updated hours for display
const hours = [
  { day: "Monday - Thursday", time: "8:00 AM - 8:00 PM" },
  { day: "Friday - Sunday", time: "8:00 AM - 5:00 PM" },
];

// Two-room structure
const rooms = [
  {
    name: "Little Stars Room",
    icon: "🍼",
    ageGroups: [
      { name: "Infants", range: "3 months - 1 year" },
      { name: "Toddlers", range: "1 - 3 years" },
    ],
    capacity: 8,
  },
  {
    name: "Big Stars Room", 
    icon: "🌟",
    ageGroups: [
      { name: "Preschool", range: "3 - 5 years" },
      { name: "School Age", range: "5 - 10 years" },
    ],
    capacity: 6,
  },
];
```

#### Interest Waitlist Hook

```typescript
// useKidsCareInterest.ts
export function useJoinKidsCareInterest() {
  return useMutation({
    mutationFn: async (data: {
      email: string;
      firstName?: string;
      lastName?: string;
      phone?: string;
      childrenCount: number;
      childrenAges: string;
      notes?: string;
    }) => {
      const { data: result, error } = await supabase
        .from("kids_care_interest_waitlist")
        .insert({
          user_id: user?.id || null,
          email: data.email,
          first_name: data.firstName,
          last_name: data.lastName,
          phone: data.phone,
          children_count: data.childrenCount,
          children_ages: data.childrenAges,
          notes: data.notes,
        })
        .select()
        .single();
      
      if (error) throw error;
      return result;
    },
    onSuccess: () => {
      toast.success("You've been added to our interest list!");
    },
  });
}
```

---

### Admin View

Add a new section in `/admin/childcare` to view interest waitlist:

```text
Interest Waitlist (12 families)
─────────────────────────────────────────────
Name          Email              Children  Signed Up
Sarah M.      sarah@...          2 (ages   Feb 7
                                 2, 4)
John D.       john@...           1 (age 6) Feb 6
...
```

---

### Policy Note Addition

Add to policies section:
- "Each Kids Care Pass is valid for one child only. Separate passes required for multiple children."

