# Personal Training Portal — Product Quality Audit

## 1. Passed
- All 27 PT routes resolve; no dead `<Link>`/`navigate()` targets remain.
- Appointment records, KPIs, client profiles, packages and reports all read live Supabase data (no static/placeholder records or fake charts).
- Booking conflict detection (trainer + room) enforced server-side in `book_pt_appointment`, with explicit "Book anyway" override.
- Package deduction is atomic: `pt_complete_session` and `pt_set_package_deduction` move balance, usage history and appointment state together; restore path re-credits.
- Destructive appointment actions (complete / no-show / cancel) require confirmation.
- Notes save + reload; internal notes stay in `internal_notes` and are role-gated.
- Day/week/trainer/location schedule views share one query source; timezone normalized to America/Detroit.
- RLS is role-scoped (super_admin / trainer / front_desk); front desk cannot see financial or staff data.
- Mobile shell: safe-area aware, no horizontal overflow, draft autosave + recovery on pre/post session.
- Post-session and progress mutations all disable while pending (no duplicate submits).

## 2. Fixed this pass
| Area | Issue | Fix |
|---|---|---|
| Data integrity | `usePTDashboard` and `usePTReportData` discarded Supabase `error`, rendering failures as zeros | Errors now thrown; red retry banner on Dashboard and Reports |
| Mobile | Today + action lists showed "All clear" on failed fetch | Error state with Retry, worded so it isn't mistaken for an empty day |
| Live session | "Attach photo" was a no-op toast | Real compressed upload to `pt-progress-photos` + `pt_progress_photos` row |
| Performance | Full-resolution phone photos uploaded raw | New `src/lib/imageCompress.ts` (max 1600px, JPEG q0.82) used by live session and progress uploads |
| Live session | Bottom tab bar allowed leaving an in-progress session, bypassing the exit guard | `hideNav` on live screen; back still routes through confirm |
| Destructive actions | Delete program / remove workout day / remove exercise ran instantly | `PTConfirmDialog` on all three |
| Consistency | `cancelled` rendered red on mobile, neutral on desktop; `default` tone used for cancelled in client detail | Unified to the `STATUS_TONE` map (completed=green, no_show=red, cancelled=neutral) |
| Routing | `/admin/personal-training/availability` 404'd from Trainers and Settings | Repointed to the real trainers/availability page |
| A11y | Icon-only prev/next and close buttons unlabeled | `aria-label` on schedule day nav, task month nav, trainer drawer close |
| A11y | Mobile inputs used `outline-none` with no focus ring | `focus:border-pt-gold` + gold focus ring on client search, progress, profile inputs; focus ring on accordion headers |
| Mobile | Set steppers / remove / complete buttons were 32–40px | Raised to 44px |
| Performance | Dashboard and task board refetched on every mount/focus | `staleTime` added (30s) |

## 3. Remaining (non-blocking)
- **Pagination:** Reports (5k rows), Trainers (5k), Packages (1k), Session Notes (300) fetch-and-render flat. Fine at current volume; needs windowing past ~1k rows.
- **`bg-white` literals** (~185 across 24 files) instead of a `pt-cream`/`pt-surface` token. Renders correctly and matches the mockups, so left alone per "don't redesign what isn't broken" — but it should become a token before any theme change.
- **Ad-hoc `text-[13px]/[15px]/[16px]`** instead of a shared type scale.
- **Label/input association:** several `PTClientDetail` fields have visual labels without `htmlFor`/`id` pairing.
- **`pt-muted` on cream** measures ~4.4:1 — passes AA for ≥14px bold / ≥18px regular, borderline for the 13px usages.
- **Program builder writes** insert day/exercise rows in a loop rather than one batched insert (save-time only).

## 4. Recommended next
1. Batch program-builder inserts into single multi-row calls.
2. Introduce `pt-surface` token and codemod the `bg-white` literals.
3. Server-side pagination for Reports and Trainers.
4. Formal contrast pass, raising `pt-muted` lightness for sub-14px text.
5. Playwright smoke suite over book → live → post → package-balance.
