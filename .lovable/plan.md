

## Export All Spa System Code

**Goal**: Create a single downloadable document containing all 14 spa-related source files.

**Files to include** (14 total):
- `src/pages/Spa.tsx` — public spa page
- `src/pages/admin/SpaManagement.tsx` — admin spa hub
- `src/components/admin/spa/AdminSpaBookingModal.tsx` — admin booking form
- `src/components/admin/spa/SpaAvailabilityTab.tsx` — availability + therapist schedule
- `src/components/admin/spa/SpaCompletionDialog.tsx` — checkout with tip
- `src/components/admin/spa/SpaServicesTab.tsx` — service management
- `src/components/admin/spa/SpaTherapistsTab.tsx` — therapist management
- `src/components/admin/spa/SpaRoomsTab.tsx` — room management
- `src/components/admin/spa/SpaAddonsTab.tsx` — add-on management
- `src/components/booking/SpaBookingModal.tsx` — member-facing booking
- `src/hooks/useSpaManagement.ts` — CRUD hooks for services/therapists/rooms
- `src/hooks/useSpaBooking.ts` — booking logic + conflict detection
- `src/hooks/useAdminSpaAppointments.ts` — admin appointment queries

**Output**: A single text file at `/mnt/documents/spa-system-full-code.txt` with each file clearly labeled and separated, ready for download.
