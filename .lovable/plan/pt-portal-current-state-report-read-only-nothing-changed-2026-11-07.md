# PT Portal — Current State Report (read only, nothing changed)

Checked against the current code and the live database. Note: 7 backend functions the screens use are missing from the saved code history but exist in the live database (request confirm/update/convert, check-in, override, payment-plan schedule). They are treated as LIVE below. They still need to be saved back into code history.

## 1. PT admin routes (/admin/pt)
| Route | Status |
|---|---|
| Dashboard | LIVE |
| Schedule (day/week, drawer) | LIVE |
| Requests | LIVE |
| Clients | LIVE |
| Client detail (+ /billing) | LIVE |
| Packages (+ detail) | LIVE |
| Billing | LIVE |
| Reports | LIVE |
| Trainers | LIVE (availability editors are on old /admin/personal-training/trainers) |
| Programs | LIVE |
| Library | LIVE |
| Progress | LIVE |
| Reassessments | LIVE |
| Notes (/session-notes) | LIVE |
| Tasks | LIVE |
| Messages | PARTIAL: communication log only, no compose/inbox |
| Leads | LIVE |
| Settings | PARTIAL: read-only |
| Mobile /admin/pt/m/* (today, clients, session pre/live/post) | LIVE |

## 2. Scheduling
| Feature | Status |
|---|---|
| Request → confirmed appointment | LIVE (UI + database) |
| Appointment detail drawer | LIVE |
| Check-in | LIVE |
| Completion | LIVE |
| Reschedule / trainer change (with conflict check) | LIVE |
| Timely / late / staff / facility cancellation | LIVE |
| No-show | LIVE |
| Admin override (at cancel and afterwards) | LIVE |
| Unpaid-session handling | LIVE |
| Activity history | LIVE |
| Conflict protection | PARTIAL: trainer/room overlap, semi-private capacity, duplicate client. Does NOT check trainer availability or time off. No lock against two bookings at the same moment. |

Package-backed booking holds a session at booking; the hourly job completes past sessions.

## 3. Trainer availability
| Item | Exists? |
|---|---|
| Recurring availability | Yes (editor + database) |
| Recurring unavailable blocks | No |
| Date-specific extra availability | Editor yes; not used in open-time calculation |
| Date-specific blocks / time off | Yes |
| Room/location conflicts | Yes, PT appointments only |
| Trainer schedule view | Yes (trainer filter) |
| Bookable-time calculation | Partial: windows only, no duration slots, a partial block removes the whole window |
| Waitlist | Fields/display only, no queue |
| Opening notification/promotion | No (existing waitlist alerts are classes only) |

## 4. Identity
- Members, true non-members and former members all key on one account ID. Membership is separate from PT.
- New PT clients: existing account found by email first; otherwise account + contact + PT profile created.
- Old non-member profiles: contact fallback only.
- Duplicates: blocked by email lookup; no merge tool for existing duplicates.
- Member ↔ PT links: LIVE both ways.
- Inconsistency: the Clients list counts anyone with any membership row (including cancelled) as a member, unlike the shared rule.

## 5. Packages + billing
| Item | Status |
|---|---|
| Sell PT package (PT portal + member account) | LIVE |
| Pay in full | LIVE |
| Payment plans (2–24 month override) | LIVE |
| First autopay date | LIVE |
| Multiple plan options | LIVE |
| Different PT card | LIVE |
| Manage payment plan | LIVE |
| Failed payments / retries | LIVE |
| Refunds (money only) | LIVE |
| Invoices / receipts | PARTIAL: "Send" queues and marks sent; no confirmed delivery |
| Legacy package transfer | LIVE |
| Historical balance entry | LIVE |
| Apply package to past sessions | LIVE |
| Unpaid-session checkout | LIVE |
| Billing summary (staff) | LIVE |

## 6. Client side
| Feature | Member | Non-member |
|---|---|---|
| PT overview page | Not built | Not built |
| Upcoming appointments + cancel | Yes | Yes |
| Past appointments | Yes | Yes |
| Session balance / package info | Not shown | Yes (Passes page) |
| Billing / autopay / payment history | Not built | Not built |
| Programs / progress / messages / documents | Not built | Not built |
| Request appointment | Public request form only | Same |

## 7. Roadmap
- LAST COMPLETED PHASE: 2D.2 (2D.1 and 2D.2 live in UI and database)
- CURRENT PARTIAL PHASE: 2D.3 (editors exist; booking does not enforce them; no waitlist)
- NEXT LOGICAL PHASE: finish 2D.3, then 2D.4 verification
- Out of order: 2F core is built; 2E partly (booking email/text, no reminders); 2G fragments only.

## 8. Recent PT work
Newest migrations: 20260828084325 (invoices, refunds, communication queue), 20260828071733 (booking function), 20260827201825 (package sale finalize), 20260827034751 (session settlement), 20260827031906 (past-session eligibility), 20260826221908 (cancellation), 20260826221228 (session ledger, completion, no-show), 20260803043907 (conflict/capacity), 20260802080834 (availability).
Main parts: PTAppointmentDrawer, PTClientBillingWorkspace, PTPackageWorkflows, PTHistoricalReconciliation, PTSessionCheckoutDialog, MemberPTFinancialSummary; hooks usePTSchedule, usePTRequests, usePTFinancials, usePTBillingCenter, usePTClientBillingAccount; functions admin-create-pt-client, admin-create-pt-payment-plan, pt-manage-plan, pt-retry-installment, send-pt-booking-email, sync-pt-pack-plan-price.

## 9. Real gaps
1. 7 live database functions missing from code history (risk if rebuilt).
2. Availability/time off not enforced when booking.
3. Open-time calculation ignores extra days and drops whole windows.
4. No PT waitlist or opening alerts.
5. No PT reminder texts/emails.
6. Clients list treats cancelled members as members.
7. Invoice "Send" not confirmed delivered.
8. Settings "unpaid" shortcut goes to a page that doesn't exist (/personal-training/unpaid; real one is /payments).
9. No lock against two bookings at the same moment.
10. No client PT dashboard.

## 10. Summary
- PT CURRENT STATE: Full staff workspace and billing; clients see appointments only (plus sessions for non-members).
- LAST COMPLETED: 2D.2
- CURRENT PARTIAL: 2D.3
- NEXT RECOMMENDED: Save the 7 functions into code history, finish 2D.3 (enforce availability, real open slots, waitlist), then 2D.4.
- BLOCKERS: None outside our control.
- CLIENT PORTAL STATUS: Appointments and cancel for both; package balance for non-members only; no PT dashboard.
