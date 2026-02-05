

# Admin Class Management Workflow Fixes

## Issues Identified

### Critical: SelectItem Empty Value Error (CAUSING PAGE CRASHES)

The error message shows:
```
Error: A <Select.Item /> must have a value prop that is not an empty string.
```

This occurs in **3 files** where `<SelectItem value="">` is used for "No instructor assigned":

| File | Line | Code |
|------|------|------|
| `src/pages/admin/ClassSchedules.tsx` | 330 | `<SelectItem value="">No instructor assigned</SelectItem>` |
| `src/pages/admin/ClassTypes.tsx` | 546 | `<SelectItem value="">No instructor assigned</SelectItem>` |
| `src/pages/admin/ClassTypeDetail.tsx` | 726 | `<SelectItem value="">No instructor assigned</SelectItem>` |

**Fix**: Replace empty string values with a non-empty placeholder value (e.g., `"none"`), then handle conversion to `null` in the mutation logic.

---

### High: Missing Route Permissions

The `src/lib/permissions.ts` file is missing permission entries for these class-related routes:

| Route | Status |
|-------|--------|
| `/admin/class-types` | **MISSING** |
| `/admin/class-types/:id` | **MISSING** |
| `/admin/class-schedules` | **MISSING** |
| `/admin/instructors` | **MISSING** |

When `canAccessPage()` is called and the path isn't found, it returns `false` (line 61), which could cause access issues for non-super-admin users.

**Fix**: Add permission entries for all missing routes.

---

### Medium: Sidebar Navigation Gap

The sidebar (`AdminSidebar.tsx`) links to `/admin/class-schedules` via "Class Management" but that route exists separately from the Class Types page. The navigation structure should be streamlined:

| Current Sidebar Entry | Points To | Should Be |
|-----------------------|-----------|-----------|
| "Today's Classes" | `/admin/classes` | Keep as-is |
| "Class Management" | `/admin/class-types` | Keep as-is |
| Instructors | `/admin/instructors` | Keep as-is |
| (hidden) Class Schedules | `/admin/class-schedules` | Either add to sidebar or deprecate |

---

## Implementation Plan

### Phase 1: Fix SelectItem Empty Value Errors

**File: `src/pages/admin/ClassSchedules.tsx`**
- Change `<SelectItem value="">No instructor assigned</SelectItem>` to `<SelectItem value="none">No instructor assigned</SelectItem>`
- Update `setInstructorId` handling and mutation to convert "none" to `null`

**File: `src/pages/admin/ClassTypes.tsx`**  
- Same fix as above

**File: `src/pages/admin/ClassTypeDetail.tsx`**
- Same fix as above

### Phase 2: Add Missing Permission Entries

**File: `src/lib/permissions.ts`**
```typescript
// Add these entries to PAGE_PERMISSIONS:
'/admin/class-types': ['super_admin', 'admin', 'manager'],
'/admin/class-types/:id': ['super_admin', 'admin', 'manager'],
'/admin/class-schedules': ['super_admin', 'admin', 'manager'],
'/admin/instructors': ['super_admin', 'admin', 'manager'],
```

---

## Technical Details

### SelectItem Value Fix Pattern

**Before:**
```typescript
<Select value={instructorId} onValueChange={setInstructorId}>
  <SelectContent>
    <SelectItem value="">No instructor assigned</SelectItem>
    {instructors.map((i) => (
      <SelectItem key={i.id} value={i.id}>{i.first_name} {i.last_name}</SelectItem>
    ))}
  </SelectContent>
</Select>
```

**After:**
```typescript
<Select 
  value={instructorId || "none"} 
  onValueChange={(v) => setInstructorId(v === "none" ? "" : v)}
>
  <SelectContent>
    <SelectItem value="none">No instructor assigned</SelectItem>
    {instructors.map((i) => (
      <SelectItem key={i.id} value={i.id}>{i.first_name} {i.last_name}</SelectItem>
    ))}
  </SelectContent>
</Select>
```

Then in mutation:
```typescript
instructor_id: instructorId && instructorId !== "none" ? instructorId : null,
```

---

## Files to Modify

| File | Changes |
|------|---------|
| `src/pages/admin/ClassSchedules.tsx` | Fix SelectItem value for instructor |
| `src/pages/admin/ClassTypes.tsx` | Fix SelectItem value for instructor |
| `src/pages/admin/ClassTypeDetail.tsx` | Fix SelectItem value for instructor |
| `src/lib/permissions.ts` | Add missing route permissions |

---

## Expected Outcome

After these fixes:
1. Admin class pages will load without crashing
2. Instructor selection dropdowns will work correctly
3. All class-related routes will have proper permission enforcement
4. Non-super-admin users with correct roles can access class management pages

