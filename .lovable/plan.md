# Tiers + Founding Breakdown

Build `members_summary_v4.xlsx` adding a tier × founding-status breakdown on top of the existing v3 sheets.

## Source of truth
- Same query as v3 (`members` where `approved_at IS NOT NULL`, status in `active / past_due / frozen / pending_activation / suspended`)
- Normalize case on `membership_type` (DB has mixed `Silver` / `silver` / `Silver Membership` → all roll into Silver, same for Gold)
- `is_founding_member` boolean splits each tier into Founding vs Standard
- Same monthly rates for both (Silver $200, Gold $250, Platinum $350, Diamond $500) — founding just prepays the year

## Sheets

**1. Tier × Founding (counts + MRR)** — new
| Tier | Founding | Standard | Total | Monthly Rate | Founding MRR | Standard MRR | Total MRR |
| Silver | 8 | 65 | 73 | $200 | $1,600 | $13,000 | $14,600 |
| Gold | 5 | 29 | 34 | $250 | $1,250 | $7,250 | $8,500 |
| Platinum | 0 | 0 | 0 | $350 | $0 | $0 | $0 |
| Diamond | 1 | 7 | 8 | $500 | $500 | $3,500 | $4,000 |
| **Total** | **14** | **101** | **115** | — | **$3,350** | **$23,750** | **$27,100** |

**2. Founding Roster** — every founding member with tier, status, sub status, signup date, annual fee paid date, Stripe sub ID

**3. Standard Roster** — same columns for non-founding active members

**4–7. Carry over from v3** — Summary (Feb–May), By Tier Counts, By Tier MRR, Roster EOM May (kept as-is)

## Notes
- MRR matches v3 total ($27,100) — founding doesn't change recurring revenue, only billing cadence
- Founding annual prepayment (≈ rate × 12) is collected separately on the dues sub and isn't double-counted in MRR
- Will write the script under `/tmp/build_v4.py`, output to `/mnt/documents/members_summary_v4.xlsx`

Switch to build mode and I'll generate it.