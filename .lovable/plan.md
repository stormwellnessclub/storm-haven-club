
# Bank Financial Package — Storm Wellness Club

## Deliverables

Three Excel workbooks plus one PDF cover summary, written to `/mnt/documents/`:

1. **`Storm_Wellness_Q1_2026_Financials.xlsx`** — Q1 2026 actuals as captured in the system (revenue side only; expense side flagged as "CPA to populate"). Note: app does not store payroll, rent, utilities, etc., so this serves as a CPA-ready revenue worksheet, not a full CPA-prepared statement.
2. **`Storm_Wellness_2026_PL_Projection.xlsx`** — full-year 2026 P&L by month with totals, split into Revenue / COGS / Operating Expenses / EBITDA / Net Income.
3. **`Storm_Wellness_13_Week_Cash_Flow.xlsx`** — 13 weeks starting Monday Apr 6, 2026 (week-of Q2 start). Standard SBA-style format: Beginning Cash → Receipts → Disbursements → Net Change → Ending Cash.
4. **`Storm_Wellness_Bank_Package_Summary.pdf`** — 2-3 page cover for the bank summarizing membership base, growth strategy, key assumptions, and where each number comes from.

## Data Sources (Pulled from Lovable Cloud DB)

Confirmed available on the backend:

- **Active members**: 107 total (14 founding, 93 paying). Mix by tier:
  - Silver: 62 paying / 8 founding → $12,400/mo dues
  - Gold: 24 paying / 5 founding → $6,000/mo dues
  - Diamond: 7 paying / 1 founding → $3,500/mo dues
  - **Baseline recurring dues: ~$21,900/mo**
- **Manual charges (Q1+April actuals)**: ~$8.1k Jan, $18.3k Feb, $8.5k Mar, $13.2k Apr (initiation fees, annual fees, class passes, spa, etc.)
- **Cafe + merch + payment_attempts**: minor volumes (cafe ~$73 Apr, merch ~$70 Mar, payment_attempts $1.5k Apr)
- **Founding annual renewals**: pulled from `annual_fee_paid_at` + 12 months
- **Next billing dates**: from `members.next_billing_date` for dues timing in 13-week cash flow

## What I Need From You (Expense Inputs)

The app does not track operating expenses. To make projections meaningful I'll insert clearly-marked **placeholder rows** with **yellow-highlighted assumption cells** that you (or your CPA) overwrite. Categories included:

- Payroll & contractor (instructors, front desk, spa therapists, mgmt)
- Rent & CAM
- Utilities
- Insurance
- Loan / SBA debt service
- Marketing
- Software / SaaS
- Cleaning, supplies, repairs
- Cafe COGS
- Merchandise COGS
- Owner draws / distributions

Each formula will reference these assumption cells so when you plug numbers in, every downstream total auto-recalculates.

## Workbook 1 — Q1 2026 Actuals

Sheet: `Q1_Actuals`
- Columns: Jan / Feb / Mar / Q1 Total
- Revenue lines (from DB): Membership Dues, Initiation/Annual Fees, Class Passes, Spa, Cafe, Merch, Other
- Expense lines: blank rows with "Source: CPA" notes for you to fill in or hand to the CPA
- Net income formula at bottom

Sheet: `Revenue_Detail` — itemized list of every manual_charge / order in Q1 with date, member, description, amount (audit trail for the CPA).

## Workbook 2 — 2026 P&L Projection by Month

Sheet: `Projection_2026`
- Columns: Jan (actual) … Apr (actual) … May–Dec (projected) … FY Total
- **Revenue model**:
  - Recurring dues = current $21,900/mo baseline × monthly growth assumption (default **+3 net new paying members/month**, weighted-average ~$235/mo). Growth rate is editable in `Assumptions` sheet.
  - Annual fees / initiation: blended $300 women / $175 men × new joins
  - Founding annual renewals: scheduled by `annual_fee_paid_at + 12mo` (calendared to actual due months)
  - Ancillary (class passes, spa, cafe, merch, kids care): trailing-3-month run rate × seasonality factor
- **Expenses**: assumption-driven, fixed + variable
- **Outputs**: Gross Profit, Operating Income, EBITDA, Net Income — all formulas

Sheet: `Assumptions` (yellow cells)
- Net new members/month, churn %, average tier mix, expense category amounts, growth ramp
- Changing any cell flows through entire model

Sheet: `Member_Roster_Snapshot` — current 107 members with tier, gender, founding flag, monthly value (audit basis for the projection).

## Workbook 3 — 13-Week Cash Flow (Apr 6 – Jul 5, 2026)

Sheet: `13_Week_CF`

```
                    W1   W2   W3   W4 ...  W13   Total
Beginning Cash      [in] =E…  =F…  =G…       
RECEIPTS
  Membership dues    
  Annual fee renewals
  Initiation fees
  Class pass sales   
  Spa revenue        
  Cafe / Merch       
  Other              
Total Receipts       
DISBURSEMENTS
  Payroll            
  Rent               
  Utilities          
  Insurance          
  Loan payment       
  Marketing          
  Software           
  Supplies / cleaning
  COGS - Cafe        
  COGS - Merch       
  Owner draws        
  Other              
Total Disbursements  
Net Cash Flow        
Ending Cash          
```

- **Receipt timing**: dues hit on members' actual `next_billing_date` (DB-driven, distributed across 13 weeks). Annual renewals on founding members' renewal dates that fall in window.
- **Disbursement timing**: bi-weekly payroll, monthly rent on the 1st, etc. — editable on `Assumptions` sheet.
- Yellow cells: starting cash balance + all expense assumptions.
- Conditional formatting: ending cash turns red if negative.

## Workbook 4 — Bank Summary PDF

2-3 pages, cover-letter style:
1. **Page 1**: business overview, membership snapshot (107 active, $21.9k recurring MRR), Q1 highlights
2. **Page 2**: growth strategy bullets (expand membership, ancillary revenue, founding renewals), key assumptions
3. **Page 3**: list of attached workbooks + how to read them

Generated with reportlab, branded with Storm Wellness colors.

## Process

1. Build a Python script that queries the DB for all the actuals/membership data
2. Generate three .xlsx files via openpyxl (formulas, not hardcoded values; yellow assumption cells)
3. Run `recalculate_formulas.py` on each — verify zero #REF/#DIV/0
4. Generate PDF summary
5. Render Workbook 2 first sheet + PDF to images for visual QA
6. Drop all four files in `/mnt/documents/` and emit `<lov-artifact>` tags

## Caveats

- The "CPA-prepared Q1 financials" deliverable per se requires your CPA — the DB only contains revenue activity. I'll produce a Q1 revenue workbook that the CPA can drop expense numbers into, plus the projection and cash flow which you can complete yourself and send.
- Default expense assumptions in the projections will be conservative placeholders ($0 where unknown) so the bank reviewer immediately sees what still needs your input — preferable to fabricated numbers.
