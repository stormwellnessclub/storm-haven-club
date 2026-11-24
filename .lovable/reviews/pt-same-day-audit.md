# Same-day PT audit

## Rule
Clients must be able to see and request today's remaining PT openings, or change a pending request to one. A request still requires staff confirmation. Past starts, trainer conflicts, time off and account restrictions remain enforced. The 24-hour cancellation policy is separate and unchanged.

## Database paths read
- `pt_client_request_options`, `pt_assert_client_request_allowed`: signed-in request-only gate, no next-day restriction.
- `pt_client_request_times_all`, `pt_client_request_times`: fixed to start today in Detroit; both use the shared open-slot check.
- `pt_client_slot_is_open`, `pt_client_slot_is_full`: fixed to permit future starts today and reject elapsed starts.
- `pt_request_create`: picked-slot path shares the corrected checker; legacy date/time path now accepts today and rejects elapsed starts.
- `pt_request_client_change`: reads ownership and pending state, then shares the corrected open-slot checker; same-day change covered by an isolated database test.
- `pt_waitlist_join`, `pt_waitlist_leave`, `pt_my_waitlist`: joining shares the corrected full-slot check; the client list includes today. Leaving does not select availability.
- `pt_request_confirm`, `pt_request_update`, `pt_request_convert_inquiry`: no next-day restriction; confirmation remains staff-controlled and uses the appointment conflict engine.
- `book_pt_appointment`, `pt_reschedule_appointment`: no tomorrow cutoff; staff permissions and conflict/override checks preserved.
- `pt_available_slots`: already includes future starts today using `t > now()`.
- `pt_check_slot`, `pt_check_slot_core`, `pt_trainer_day_windows`: evaluate the requested Detroit day and genuine clashes, not a minimum next-day date.
- `pt_schedule_pending_requests`, `pt_schedule_waitlist`, `pt_schedule_waitlist_entries`, `pt_waitlist_matches`, `pt_waitlist_promote`: staff-selected date ranges and dates, no tomorrow cutoff. Promotion remains a request, not an automatic appointment.
- `pt_my_requests`, `pt_my_portal`: no tomorrow cutoff for today's pending/confirmed items.
- `cancel_pt_appointment`: 24-hour cancellation policy, not booking notice; untouched.
- `pt_auto_consume_past_reservations`: operates only after appointment end, never hides future openings; unchanged.
- PT renewal follow-ups and payment jobs concern package/payment dates, not appointment visibility; unchanged.

## Verification and limits
## Screen and notification paths read
- Member and non-member `PersonalTraining.tsx` pages share `MyPersonalTraining`; their layouts add no PT date restriction. Non-member layout retains the required-phone prompt.
- `useMyPTPortal`, `useMyPTRequests`, `PTOpenTimes`, `ptRequestForm`: today is included; upcoming appointments compare actual start instants. Open times refresh every 30 seconds and on focus.
- `PTRequestSessionForm` single/multi-day request and waitlist paths pass selected server instants unchanged, still as requests.
- `MyPersonalTraining` change-time, requests/upcoming, alternate display and waitlist/leave paths have no tomorrow restriction. Alternate acceptance remains contact-with-staff, not instant booking.
- Public `TrainingRequestForm` accepts preferred-times text, including today, but remains an inquiry rather than a live opening list; unchanged.
- Staff `BookPTSessionDialog`, `PTAppointmentDrawer`, `usePTSchedule`, `usePTRequests`, `PTRequests` confirmation/window/alternate controls all accept today and rely on the shared server checks.
- Legacy `PersonalTrainingSchedule`, workspace `PTSchedule`, mobile `PTMRequests`, `PTQuickAddSheet`, `PTRequestPanel`, `PTWaitlistPanel`, and `ptSlots` do not exclude today.
- `PersonalTrainingTrainers` recurring hours, time off, extra hours and replacement windows accept today's effective date.
- `send-pt-request-update` and `send-pt-booking-email` have no next-day restriction. No test notifications were sent. The former's existing member-route link is an unrelated audience-routing issue, not a same-day cutoff; left unchanged.
- Edge-function reminder search found no PT appointment notice gate; spa/class reminders are separate. SQL auto-completion runs only after session end.
- `useCancelMyPTSession` and staff cancellation controls retain the separate 24-hour cancellation policy.

## Verification and limits (continued)
- 30 isolated tests pass, including same-day list, create, change, waitlist, elapsed-start rejection and conflict rejection. Practice tests never connect to the live database.
- Signed-in live availability reads returned 5 same-day Semi-Private slots and 5 One-on-One slots, with zero elapsed starts; Reformer and Mat returned none for today.
- Owner's live portal stops at its existing required-phone prompt. The complete visual portal journey could not be checked without changing the account; no phone data was invented or saved.
- No existing appointments, settled payments, messages, refunds, account settings or permissions were changed.