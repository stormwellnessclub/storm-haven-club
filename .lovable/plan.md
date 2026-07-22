
# Personal Training Admin Expansion

Builds a scheduling portal for trainers, a notes system, legacy-session grants, and per-item visibility toggles — all admin-only until you flip individual items public.

## 1. Trainer scheduling portal

New admin page: `/admin/personal-training/trainers` (link from PT Schedule header, next to "Customers & Packs").

Per trainer (uses existing `instructors` rows flagged as PT):
- **Weekly availability** — recurring day + start/end time blocks (e.g. Mon 8:00a–12:00p).
- **Date overrides** — block out dates or add extra one-off windows (time off, extra hours).
- **Per-format eligibility** — checkboxes for `one_on_one`, `reformer_one_on_one`, `semi_private`.
- **Public visibility toggle** — `is_public_pt` per trainer. Hidden trainers never appear in public booking or "Any trainer" pickers on public surfaces; still bookable from admin.

Existing `BookPTSessionDialog` gets a light change: when picking trainer, filter by format eligibility and warn if the chosen time falls outside availability (soft warning, not a block, so admin can still override).

## 2. Notes

- **Shared PT board** on the trainers page (top card) — free-form notes list, add/edit/delete, timestamped with author name.
- **Per-trainer notes** — notes tab inside each trainer's detail sheet on the same page.

Both admin-only. Reuses the same visual pattern as the existing NotesBoard used elsewhere in admin.

## 3. Legacy sessions from old location

New button on `/admin/personal-training/passes` → "Grant legacy pack".

Form:
- Member search (same picker as SellPT)
- Format (1:1 / Reformer 1:1 / Semi-Private)
- Pack name (defaults to "Legacy — Old Location")
- Sessions remaining
- Expiration date (defaults to +6 months)
- Notes

Creates a row in `pt_passes` with `payment_method = 'legacy'`, `price_cents_charged = 0`, `stripe_payment_intent_id = null`, and a `sold_by_admin_id` set to the current admin. No charge, no Stripe touch. Shows up in the member's pass list identically to a purchased pack.

## 4. Public visibility (per item, now)

Everything stays hidden from public/member surfaces until toggled:
- `pt_packs.is_public` already exists — public PT pages and member-facing pickers will now respect it strictly.
- New `instructors.is_public_pt` — trainer only appears publicly when true.
- Add a small "PT Publishing" summary card on the trainers page showing counts of public vs hidden packs and trainers, so you can see at a glance what's live.

No global master switch — you turn on packs and trainers individually when ready.

## Technical notes

### Schema (single migration)
- `pt_trainer_availability` — `id`, `instructor_id`, `weekday` (0–6), `start_time`, `end_time`, timestamps. RLS: admin-manage, authenticated read.
- `pt_trainer_overrides` — `id`, `instructor_id`, `date`, `kind` ('block' | 'extra'), `start_time?`, `end_time?`, `note`, timestamps.
- `pt_trainer_formats` — `instructor_id`, `format`, PK(instructor_id, format).
- `pt_notes` — `id`, `scope` ('shared' | 'trainer'), `instructor_id?` (null when shared), `body`, `created_by`, timestamps.
- `instructors.is_public_pt boolean default false` (additive column).
- `pt_passes.payment_method` already exists — legacy grants use `'legacy'`.
- All new tables: GRANT block per policy scope, RLS enabled, admin-write policies via `has_any_role`, authenticated read for availability/formats/overrides (so future public booking works without another migration).

### Frontend
- New page `src/pages/admin/PersonalTrainingTrainers.tsx` with sections: PT Publishing summary → Shared notes → Trainer list → per-trainer detail sheet (availability, overrides, formats, visibility toggle, notes).
- New dialog `src/components/admin/GrantLegacyPtPackDialog.tsx` opened from the passes page.
- Small tweak to `BookPTSessionDialog` to filter trainers by format and show an "outside availability" warning.
- Register route in `src/App.tsx`; add link on `PersonalTrainingSchedule` header.

### Out of scope (call out if you want later)
- Public trainer booking UI on the marketing site.
- Auto-enforcing availability as a hard block (currently a soft warning only).
- Backfilling old session dates into a usage log.
