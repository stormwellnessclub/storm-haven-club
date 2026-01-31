
# Import New Applications from CSV

## Summary
You want to import new applications from the CSV file - specifically from **Nicolette Juncaj (Dec 27, 2025 @ 4:16 PM)** up to **Wafaa Diab (Jan 31, 2026)**. Based on my analysis:

- **Applications to import**: 18 records (CSV lines 2-19)
- **Already migrated cutoff**: Amal Hachem (Dec 27, 2025 @ 3:00 PM) - line 20 and below
- **No deletions** - existing applications remain untouched

## Applications to Import

| # | Name | Email | Membership | Date |
|---|------|-------|------------|------|
| 1 | Wafaa Diab | wafdiab@gmail.com | Silver | Jan 31, 2026 |
| 2 | Deanna Beydoun | dbeydoun44@gmail.com | Silver | Jan 31, 2026 |
| 3 | Afifa Seblini | afifa.seblini@gmail.com | Silver | Jan 29, 2026 |
| 4 | Sherene Albosaraj | albosarajsherene@gmail.com | Gold | Jan 18, 2026 |
| 5 | Tiara Foster | facebytiaramona@gmail.com | Gold | Jan 18, 2026 |
| 6 | Faten Saad | fatensaad1986@gmail.com | Gold | Jan 17, 2026 |
| 7 | Jeniffer Meta | jennameta11@icloud.com | Silver | Jan 14, 2026 |
| 8 | Sarah Hamze | sarahhamze15@gmail.com | Gold | Jan 7, 2026 |
| 9 | Naydean Beydoun | naydeano@gmail.comn | Silver | Jan 3, 2026 |
| 10 | Yara Hamed | yarah12405@gmail.com | Gold | Jan 1, 2026 |
| 11 | Nadine Atoui | nadine.a.atoui@gmail.com | Silver | Dec 30, 2025 |
| 12 | Deja Pryor | dejampryor@gmail.com | Gold | Dec 29, 2025 |
| 13 | Deja Pryor (duplicate) | dejampryor@gmail.com | Gold | Dec 29, 2025 |
| 14 | Zahraa Jaber | zkjaber76@gmail.com | Platinum | Dec 28, 2025 |
| 15 | Jacklyn Gougeon | jackiemgougeon@gmail.com | Gold | Dec 28, 2025 |
| 16 | Nicolette Juncaj | lettagj@gmail.com | Silver | Dec 27, 2025 |

**Note**: There appear to be 2 entries for Deja Pryor - I'll handle duplicates by checking email before inserting.

## Implementation Plan

### Step 1: Parse CSV Data
Create a migration script that parses the CSV and maps fields to database columns:

```text
CSV Field                    → Database Column
─────────────────────────────────────────────
Submission Time              → created_at
Full Name                    → full_name, first_name, last_name
Date of Birth                → date_of_birth
Address fields               → address, city, state, zip_code, country
Email Address                → email
Phone Number                 → phone
Membership Plan              → membership_plan
Would you like founding...   → founding_member
Referred by member?          → referred_by_member
Services interested          → services_interested
Wellness goals               → wellness_goals
Lifestyle integration        → lifestyle_integration
Holistic wellness            → holistic_wellness
Previous member              → previous_member
Gender                       → gender (will need to be inferred or set to 'Not Specified')
```

### Step 2: Data Transformation
For each record:
1. Split full name into first_name and last_name
2. Parse date of birth from MM/DD/YYYY format
3. Convert submission time to ISO timestamp
4. Map membership plan text to database values
5. Set default values for required fields
6. Handle gender (not in CSV - will set to 'Not Specified')

### Step 3: Duplicate Check
Before inserting, check if email already exists in the database to prevent duplicates.

### Step 4: Insert Applications
Insert new records with status = 'pending'

## Technical Details

### Database Insert Structure
```sql
INSERT INTO membership_applications (
  full_name, first_name, last_name, email, phone,
  date_of_birth, address, city, state, zip_code, country,
  membership_plan, founding_member, referred_by_member,
  wellness_goals, services_interested, lifestyle_integration,
  holistic_wellness, previous_member, gender, status,
  auth_acknowledgment, credit_card_auth, membership_agreement_signed,
  one_year_commitment, submission_confirmation, created_at
) VALUES (...)
```

### Files to Create/Modify
| File | Action |
|------|--------|
| `src/pages/admin/Applications.tsx` | Add import functionality with file upload |
| OR create migration SQL | Direct database insert via migration tool |

## Recommended Approach
I recommend using the **database migration tool** to directly insert these 18 applications. This is:
- Faster than building a UI
- One-time operation
- Can include duplicate checking
- Preserves original submission timestamps

Would you like me to proceed with this approach?
