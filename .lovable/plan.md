

# Email Template Rename and Clarification

## Current Templates (to be renamed)

| Current Name | Proposed Name | Purpose |
|--------------|---------------|---------|
| `application_approved` | `approval_with_deadline` | Post-launch: includes 7-day deadline, "Choose Your Start Date" button |
| `application_approved_pre_launch` | `approval_letter` | Generic approval letter: clean, no deadlines, no links |
| `application_approved_personalized` | `approval_letter_personalized` | AI-generated custom letter wrapper |
| `activation_reminder_day3` | Keep as-is | Reminder: 4 days remaining to select date |
| `activation_reminder_day5` | Keep as-is | Reminder: 2 days remaining |
| `member_activation_setup` | `setup_instructions` | Card/agreement setup with Feb 9 opening |

## Updated Dropdown Options

The approval dropdown will use the new clearer names:

```text
┌───────────────────────────────────────────────────────┐
│  Approve ▼                                            │
├───────────────────────────────────────────────────────┤
│  ○ Approve (No Email)                                 │
│  ○ Approve + Approval Letter                          │  → uses 'approval_letter'
│  ○ Approve + AI Personalized Letter ✨                │  → uses 'approval_letter_personalized'
│  ─────────────────────────────────────────────────────│
│  ○ Approve + Deadline Email (7-Day Selection)         │  → uses 'approval_with_deadline'
│  ○ Approve + Setup Instructions                       │  → uses 'setup_instructions'
└───────────────────────────────────────────────────────┘
```

---

## Files to Modify

| File | Changes |
|------|---------|
| `supabase/functions/send-email/index.ts` | Rename template cases to new names |
| `src/pages/admin/Applications.tsx` | Update email type references and dropdown labels |
| `src/components/admin/PersonalizedLetterModal.tsx` | Update email type to `approval_letter_personalized` |

---

## Template Content Summary

### approval_letter (formerly application_approved_pre_launch)
- Subject: "Welcome to Storm Wellness Club - Application Approved!"
- Clean, warm approval confirmation
- Confirms membership tier
- "Keep an eye out for more emails..."
- No deadlines, no buttons

### approval_with_deadline (formerly application_approved)
- Subject: "Your Application to Storm Wellness Club is Approved"
- Yellow warning box with 7-day deadline
- "Choose Your Start Date" button
- Email matching instructions
- For post-launch when members need to actively select dates

### setup_instructions (formerly member_activation_setup)
- Focuses on adding card and signing agreement
- Mentions February 9, 2026 opening
- Deep links to payment setup and waiver signing

### approval_letter_personalized
- Wrapper for AI-generated custom content
- Rendered as branded HTML
- Subject and body fully editable by admin

---

## Technical Details

All changes are internal renames in the codebase. No external API changes required. The email audit log will record the new template names going forward.

