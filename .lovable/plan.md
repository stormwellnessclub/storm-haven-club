
## Fix: Insert Missing Class Passes + Frozen Member Booking Access

### Current State After Investigation

**Pass inventory confirmed:**

| Member | Status | Passes in DB | Needed |
|--------|--------|-------------|--------|
| Asmaa Abdel-Salam | Frozen | 0 | Aerobics 10-pack (non-member price) + Pilates/Cycling 10-pack (non-member price) |
| Lauren Anderson | Active | 0 | Pilates/Cycling 10-pack (member price) |
| Kinda Turaani-Imam | Active | 0 | Pilates/Cycling 10-pack (member price) |
| Amal Hachem | Active | 0 | Pilates/Cycling 10-pack (member price) |
| Farah Hakim | Active | 2 already inserted | Already correct — no action needed |

The previous plan's SQL inserts were presented but never executed. All 5 members (except Farah) still have zero passes.

---

### The Two Policy Rules to Implement

**Rule 1 — Asmaa's passes are non-member priced**
She purchased before becoming a member (or at non-member rates). Her passes must be inserted with `is_member_price: false`.

**Rule 2 — Frozen members can use existing passes to book**
Currently, `useUserCredits.ts` only checks `status = 'active'` when querying `members` to establish whether the user "is a member." Class passes are fetched separately by `user_id` regardless of status — so **frozen members can already see and use their class passes in the booking modal**. This part works correctly already. No code change needed here.

**Rule 3 — Frozen members buying NEW passes pay non-member price**
`ClassPasses.tsx` line 385: `isMember = membership?.status === 'active'`. Since Asmaa (and any frozen member) has `status = 'frozen'`, this evaluates to `false` — they already see and get charged non-member pricing. This is also already correct. No code change needed.

---

### What Needs to Change

**Only one thing requires action: inserting the missing pass records.**

There are no code changes needed. The policy for frozen members is already correctly enforced by the existing code. The only gap is the missing database records.

---

### Technical Plan: 5 Database Inserts

**Settings for Asmaa (non-member price, frozen member):**
- `is_member_price: false`
- Expiry extended to 6 months from today to account for freeze period
- Both aerobics and pilates/cycling 10-packs

**Settings for Lauren, Kinda, Amal (active members, member price):**
- `is_member_price: true`
- Expiry: 2 months from today (standard 10-pack validity)

**SQL to execute:**

```sql
-- Asmaa Abdel-Salam: Aerobics 10-pack (non-member price)
INSERT INTO class_passes (user_id, category, pass_type, classes_total, classes_remaining, expires_at, status, is_member_price)
VALUES ('ae727a47-5fb0-4126-8fba-697bc2262119', 'aerobics', '10-pack', 10, 10, '2026-08-20 23:59:59+00', 'active', false);

-- Asmaa Abdel-Salam: Pilates/Cycling 10-pack (non-member price)
INSERT INTO class_passes (user_id, category, pass_type, classes_total, classes_remaining, expires_at, status, is_member_price)
VALUES ('ae727a47-5fb0-4126-8fba-697bc2262119', 'pilates_cycling', '10-pack', 10, 10, '2026-08-20 23:59:59+00', 'active', false);

-- Lauren Anderson: Pilates/Cycling 10-pack (member price)
INSERT INTO class_passes (user_id, category, pass_type, classes_total, classes_remaining, expires_at, status, is_member_price)
VALUES ('58bd34f6-26ca-4e4e-8b29-6c2d4f614c63', 'pilates_cycling', '10-pack', 10, 10, '2026-08-20 23:59:59+00', 'active', true);

-- Kinda Turaani-Imam: Pilates/Cycling 10-pack (member price)
INSERT INTO class_passes (user_id, category, pass_type, classes_total, classes_remaining, expires_at, status, is_member_price)
VALUES ('62b480dc-db0d-45e3-a5ef-879fc8bc3d32', 'pilates_cycling', '10-pack', 10, 10, '2026-08-20 23:59:59+00', 'active', true);

-- Amal Hachem: Pilates/Cycling 10-pack (member price)
INSERT INTO class_passes (user_id, category, pass_type, classes_total, classes_remaining, expires_at, status, is_member_price)
VALUES ('25d71d58-fda2-431b-a3f5-3a6ea61c97db', 'pilates_cycling', '10-pack', 10, 10, '2026-08-20 23:59:59+00', 'active', true);
```

**After these inserts:**
- Lauren, Kinda, and Amal will immediately see their 10-pack in the booking modal and can book any pilates or cycling class
- Asmaa will see both her aerobics and pilates/cycling passes — and when her freeze is lifted, she'll be able to book immediately
- Asmaa's passes correctly reflect non-member pricing in the pass record for reporting accuracy
- No code changes are required — the frozen member booking and pricing policies are already handled correctly by the existing system

---

### One Note on Asmaa Booking While Frozen

Even though Asmaa's passes will be visible to her in the portal, she won't be able to complete a booking while frozen because the booking confirmation requires an active (non-frozen) session. This is the correct behavior — her passes are ready and waiting, and the moment her freeze ends (or an admin unfreezes her), she can book. The expiry is set 6 months out to give her plenty of time.
