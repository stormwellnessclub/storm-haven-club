

## Plan: Approve Alise James — Sponsored Silver + bonus credits

### Approval details
- **Tier**: Silver Membership (active, sponsored)
- **Status**: `active`, `subscription_status: sponsored`
- **End date**: 2026-12-31
- **Stripe**: skip — no customer/subscription created
- **Bonus credits** (one-time, non-recurring):
  - 6 Red Light sessions, expires 2026-12-31 23:59:59
  - 6 Dry Cryo sessions, expires 2026-12-31 23:59:59
  - No class credits (Silver tier — à la carte only)

### Steps (data ops only, no code changes)
1. Look up Alise James in `membership_applications` — confirm email + applied tier (Platinum)
2. Create `members` row: Silver, sponsored, end date 2026-12-31, `original_tier_at_application: Platinum`
3. Insert 2 rows into `member_credits`: red_light × 6 and dry_cryo × 6, both expiring 2026-12-31
4. Update `membership_applications` row → `approved`, with note: "Sponsored Silver (applied Platinum). 6 RL + 6 DC bonus credits. Expires 2026-12-31."
5. Send approval email (draft below)
6. Auth account auto-links via existing email-match trigger

### Email draft (final)

> **Subject**: Welcome to Storm Wellness Club, Alise — Your Sponsored Membership is Active
>
> Hi Alise,
>
> Wonderful news — your Storm Wellness Club application has been **approved as a sponsored Silver Membership**, valid through **December 31, 2026**. All initiation fees and monthly dues are fully waived.
>
> **Your Silver membership includes:**
> - Full access to our state-of-the-art gym
> - Wet spa amenities: sauna, steam room, Himalayan salt room, cold plunge
> - Member pricing on classes (à la carte or via class passes)
>
> **As a welcome bonus, we've also added to your account:**
> - **6 Red Light Therapy sessions**
> - **6 Dry Cryo sessions**
>
> Both bonus credit packs are valid through **December 31, 2026** — use them anytime before then.
>
> **Next steps to activate your membership:**
> 1. Sign in to your member portal at stormwellnessclub.com
> 2. Sign your membership agreement and liability waiver
> 3. Upload a headshot photo for check-in
>
> Once those are complete, you're free to start enjoying the club.
>
> If you have any questions, just reply to this email or stop by the front desk.
>
> Welcome to the club,
> The Storm Wellness Club Team

### Files
None — pure data operation via DB tools + system approval email.

