## Add milestone celebration to non-member portal

The Celestial Gold overlay currently mounts inside `MemberLayout` only. Non-members (class-pass holders, day-pass guests) use a separate `PortalLayout` at `src/components/portal/PortalLayout.tsx` and never see the celebration even though their completed bookings already award milestones in the same `user_class_achievements` table.

## Change

Mount `<MilestoneCelebrationHost />` at the bottom of `PortalLayout` the same way it's mounted in `MemberLayout`. No other code changes needed.

## Why this just works for non-members

- The host component reads `auth.uid()` via the existing hook — it doesn't care whether the signed-in user is a member or non-member.
- The existing `award_class_milestones` trigger already fires on any completed booking regardless of member status, so non-members already accumulate rows in `user_class_achievements`.
- The earlier backfill ran across the entire table, so every existing non-member with prior milestones already has their highest milestone marked uncelebrated — they will see exactly one catch-up celebration on first portal visit, no flood.

Result: a non-member who hits their 5th, 10th, 25th class pass visit sees the same gold celebration in their portal as members do, including a one-time catch-up for prior milestones.