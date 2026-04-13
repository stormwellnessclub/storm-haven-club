

## One-line fix in AdminSpaBookingModal.tsx

**Change**: Line in `bookMutation.mutationFn` where `service_id: 0` → `service_id: selectedService.id`

**Verification**: The guard `if (!selectedService || !appointmentTime) throw new Error("Missing required fields")` already exists at the top of the `mutationFn` (visible in the current code), so `selectedService` is guaranteed non-null at the insert call. No additional guard needed.

**File**: `src/components/admin/spa/AdminSpaBookingModal.tsx`  
**Scope**: One line change only. Nothing else touched.

