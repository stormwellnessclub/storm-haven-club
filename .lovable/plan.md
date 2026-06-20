## Copy refresh — Set B (Aman voice) + "YOU SHOWED UP" header

Wording only. No logic, schema, animation, or layout changes.

### Universal header

Replace "Milestone Unlocked" and "Achievement Unlocked" with:

> **YOU SHOWED UP**

Rendered in the existing small tracking-letter style above the badge on both the class-milestone overlay and the achievement overlay. Founding Member overlay keeps its own ornamental "Charter Recognition" header (it's a status, not a milestone).

### Class milestones — new copy

| Count | New line |
|---|---|
| 1 | One. |
| 5 | Five classes. A practice begins. |
| 10 | Ten. |
| 25 | Twenty-five classes. |
| 50 | Fifty. |
| 100 | One hundred. |
| 200 | Two hundred. |
| 500 | Five hundred. |

The "{n} Classes" line below the disc stays as-is.

### Achievements — new names and descriptions

`achievement_type` slugs do NOT change (triggers and routing key off them).

| Type | New name | New description |
|---|---|---|
| first_check_in | Arrival | Your first class. |
| century_club | One Hundred | One hundred classes. |
| month_master | A Full Month | Thirty days. Thirty classes. |
| week_warrior | Seven Days | Seven, consecutive. |
| early_bird | At Dawn | Before seven. |
| night_owl | At Dusk | After eight. |
| fitness_fanatic | Twenty-Five | Twenty-five workouts. |
| spa_enthusiast | Recovery | Five spa appointments. |
| class_explorer | Range | Five disciplines. |
| wellness_warrior | The Whole Club | Five amenities. |
| social_butterfly | Introduction | You brought someone in. |
| goal_crusher | Goal, Met | A goal completed. |
| habit_hero | Thirty Days | A habit, held. |
| perfect_week | A Full Week | Seven days. Every habit kept. |
| founding_member | Founding Member | Here from the beginning. |

### Implementation

1. **Data update (insert tool)** — `UPDATE` the `achievements` catalog (15 rows) with new names + descriptions. Then `UPDATE` `member_achievements` to retro-rename already-awarded rows so the Achievements page and the toast/overlay show the new copy for existing recipients. Keyed off `achievement_type`.
2. **DB function update (migration)** — patch `check_and_award_achievements` so the `INSERT INTO member_achievements` literals match the new names/descriptions. Logic, triggers, and tier mapping unchanged.
3. **Frontend copy** — update the three string tables:
   - `src/components/member/MilestoneUnlockOverlay.tsx` → `COPY` map (the 8 lines) + header label changes to "YOU SHOWED UP"
   - `src/components/member/AchievementOverlayBig.tsx` → header label changes to "YOU SHOWED UP"
   - `src/components/member/FoundingMemberOverlay.tsx` → swap the body line under "Founding Member" to "Here from the beginning." (keep "Charter Recognition" ornamental header)
4. **Tier mapping** — `AchievementCelebrationHost.tsx` keys off `achievement_type` slugs (unchanged), so Founding / Big-overlay / Small-toast routing keeps working with no edits.

### Out of scope

- Achievements page layout, icons, points, criteria
- Trigger logic, RPC math
- Any non-celebration UI strings
