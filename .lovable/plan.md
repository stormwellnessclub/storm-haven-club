

## Two Changes: Fix service_id + Add Room Conflict Detection

### 1. service_id fix — Already done
The previous edit already changed `service_id: 0` to `service_id: selectedService.id` on line 181. No action needed.

### 2. Add room conflict check to `useCheckSpaAvailability`

**File: `src/hooks/useSpaBooking.ts`**

- Add `roomId?: string` to `CheckAvailabilityParams` interface
- After the existing therapist conflict query (lines 188-224), add a second independent query block for room conflicts:
  - Query `spa_appointments` where `room_id` matches, same date, status not in `['cancelled', 'no_show']`
  - Apply the same overlap logic already used for therapist conflicts
  - If room conflicts found, merge them into the return value

The return shape stays the same (`{ available, conflictingAppointments }`) — room conflicts are added to the conflicting array so existing UI renders them.

### 3. Pass roomId from AdminSpaBookingModal

**File: `src/components/admin/spa/AdminSpaBookingModal.tsx`**

- In `handleTimeSelect` (line 152-168), resolve the room the same way therapist is resolved: `const resolvedRoom = roomId !== "auto" ? roomId : matchingSlot?.room_id;`
- Pass `roomId: resolvedRoom` to `checkAvail.mutateAsync()`
- If room conflict is detected, show a room-specific message in `setConflict()`

### Scope
- No changes to booking form, availability generation, member search, waiver check, or any other logic
- Two files touched: `useSpaBooking.ts` (interface + query), `AdminSpaBookingModal.tsx` (pass roomId + display)

