# Apply your decisions on the 78 conflicts

Nothing is written until you approve the final counts.

## Step 1: Final counts and Sarah Hamze (read-only)
- Apply your decisions to the 78 conflicts on paper and report the counts:
  - 3 left untouched (Storm Durant, Sahar Durant, Susu Saad)
  - 1 merge: Fatima Abbas + Fatima Mirza, main email abbas_fatima@outlook.com
  - 3 typo records removed: the correct emails mariamfaraj00@gmail.com, amena1120@gmail.com and naydeano@gmail.com are kept
  - 5 family-email fixes: only that person gets their own email. The other family member's contact is left alone.
  - 1 held: Sarah Hamze
  - 63 same-person merges into one contact, each with the personal email chosen as main
  - Totals of contacts before and after, and records merged or removed
- For each of the 63 merges, a list showing the chosen main email and the emails folded in. Any merge with no personal email is flagged for you to decide.
- Sarah Hamze: both member records matching 313-492-6144 (name, email, member ID, status, start date), plus my read on whether this is one person with a duplicate or two people. Nothing changes and she is not added.

## Step 2: Run it (after your go)
- Every changed or removed row is backed up first and tagged wix_mindbody_2026_10, so it can be undone.
- During merges the main record keeps its data, and the other records only fill fields it's missing. Opt-outs always win: if any merged record unsubscribed, texted STOP or is blocked, the merged contact stays opted out.
- Member and account records are never changed by these merges. Only contacts are.
- No emails or texts are sent.
- You get a results file afterward.

## Technical details
- The source is `import-review/conflicts.csv` keyed by C-IDs. The personal-domain rule is gmail, yahoo, hotmail, outlook, icloud, aol, live or msn. .edu, work domains and privaterelay are never chosen as main.
- Merges go through `marketing_contacts` only. Before-rows are stored in `import_change_backup`.
