
## Sound Bath Event — Member Vote

A time-boxed poll surfaced in the Member Portal and Non-Member Portal, with a one-time email blast to active members, live vote meter, and full admin tracking.

### 1. Database

New table `event_votes` (single-purpose, keyed by event slug so we can reuse the pattern later):

```
event_votes
  id uuid pk
  event_slug text        -- 'sound-bath-jul-2026'
  user_id uuid           -- auth.uid, unique per event_slug
  option_key text        -- 'friday_jul_24' | 'saturday_jul_25'
  voter_type text        -- 'member' | 'non_member' (audit only)
  created_at timestamptz
  updated_at timestamptz
  UNIQUE (event_slug, user_id)
```

- GRANT SELECT, INSERT, UPDATE on `event_votes` to `authenticated`; GRANT ALL to `service_role`. No anon.
- RLS:
  - SELECT: users see their own vote; admins see all.
  - INSERT/UPDATE: users can only insert/update rows where `user_id = auth.uid()`.
- Public tally view `event_vote_tallies` (`security_invoker`, GRANT SELECT to authenticated) that returns `event_slug, option_key, vote_count, total_votes, percentage` — no user_ids exposed.
- Votes are **changeable** until the vote closes (unique constraint + upsert). This is the most common member-vote pattern and keeps the tally honest.

### 2. Vote config (hardcoded constant, no admin UI needed for a one-off)

`src/lib/eventVote.ts`:
- `EVENT_SLUG = "sound-bath-jul-2026"`
- Title, description, pricing, options (Friday Jul 24 7PM / Saturday Jul 25 7PM), `closesAt` (e.g. Jul 20 2026 23:59 America/Chicago).

### 3. UI — Portal + Non-Member Portal

New component `src/components/events/EventVoteCard.tsx`:
- Header: "Member Vote — Sound Bath, Nervous System Reset & Guided Meditation".
- Full event description (breathwork → meditation → sound bath), pricing ($30 members / $40 non-members), what to bring.
- Two large option buttons (Fri / Sat), showing:
  - Live percentage bar (from `event_vote_tallies`)
  - Vote count
  - Check mark on the option the user picked
- "Change your vote until Jul 20" helper text.
- Hidden after `closesAt` with a "Voting closed — results coming soon" state.

Mounted on:
- `src/pages/member/*` dashboard (top of Member portal home)
- `src/pages/portal/Dashboard.tsx` (non-member portal home) — same component, `voterType="non_member"`.

### 4. Email blast (active members only, one-time)

- New app-email template `supabase/functions/_shared/transactional-email-templates/sound-bath-vote.tsx` with the exact copy from the request, brand styling, and two CTA buttons deep-linking to the vote card:
  - `https://stormwellnessclub.com/member?vote=sound-bath-jul-2026&choice=friday_jul_24`
  - `…&choice=saturday_jul_25`
  When the portal loads with `?vote=…&choice=…`, it pre-selects the option (user still confirms with one click — no drive-by votes from forwarded emails).
- One-off admin-triggered edge function `send-sound-bath-vote-blast`:
  - Admin-only (JWT + `has_any_role('admin','super_admin')`).
  - Selects active members with valid email.
  - Enqueues one send per member via `send-transactional-email` with idempotency key `sound-bath-vote-{memberId}` so re-running is safe.
  - Logs to `email_audit_log`.
- Trigger button lives in Admin → Settings → "Send Sound Bath vote email" with a confirmation dialog showing recipient count.

### 5. Admin tracking page

`/admin/event-votes/sound-bath-jul-2026` (linked from Admin sidebar → Marketing):
- Live totals: Friday count / Saturday count / total voters / % split.
- Bar chart of the two options.
- Breakdown: members vs non-members counts.
- Sortable table of individual votes (name, email, tier, choice, voted_at) with CSV export.
- "Email blast" panel: recipients queued, sent, bounced (from `email_audit_log` / `suppressed_emails`).

### 6. Files touched

Created:
- `supabase/migrations/*` — table, view, RLS, grants.
- `src/lib/eventVote.ts`
- `src/hooks/useEventVote.ts` (fetch tally + my vote, submit/upsert mutation)
- `src/components/events/EventVoteCard.tsx`
- `src/pages/admin/EventVoteTracking.tsx`
- `supabase/functions/_shared/transactional-email-templates/sound-bath-vote.tsx`
- `supabase/functions/send-sound-bath-vote-blast/index.ts`

Edited:
- `src/pages/portal/Dashboard.tsx` — mount EventVoteCard.
- `src/pages/member/*` home — mount EventVoteCard.
- `src/App.tsx` — admin route.
- Admin sidebar — link.
- Admin Settings — "Send vote email" button.
- Template registry.

### 7. Preview first

Before touching prod: I'll render a full HTML preview of both the portal vote card and the email in this chat (screenshot via Playwright against a local preview route) so you can approve copy, colors, and layout before I flip the email switch or send the blast.

### Technical notes
- RLS uses `auth.uid()` directly; no new security-definer helpers needed.
- The tally view uses `security_invoker=on` and only exposes aggregates — safe for both portals.
- Email blast reuses the existing queued `send-transactional-email` pipeline (no marketing/newsletter path), so unsubscribe footer and suppression list are honored automatically.
- No Stripe/purchase logic in this feature — ticket sales handled separately once the date is chosen.
