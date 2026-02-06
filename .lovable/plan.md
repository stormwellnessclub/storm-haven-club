

# Approval Letter Email Options with AI Personalization

## Overview

Add multiple explicit email options to the application approval workflow, including an AI-powered personalized letter generator that you can review and edit before sending.

---

## Email Options to Implement

### Option 1: Approve (No Email)
- Creates member record silently
- No email sent
- For cases where you want to manually handle communication

### Option 2: Approve + Approval Letter (Basic)
- Uses the current `application_approved_pre_launch` template
- Clean, no deadlines, no links
- The "standard" approval confirmation

### Option 3: Approve + 7-Day Selection Email
- Uses `application_approved` template
- Includes 7-day countdown and auto-start deadline
- For post-launch when members need to select start dates

### Option 4: Approve + Setup Required Email
- Uses `member_activation_setup` template
- Asks them to add card, sign agreement
- Mentions February 9, 2026 opening date

### Option 5: Approve + AI Personalized Letter (NEW)
- Pulls data from their application (wellness goals, lifestyle, holistic wellness answers)
- Uses Lovable AI to generate a personalized approval letter
- Opens a modal for you to review and edit before sending
- You control every word before it goes out

---

## AI Personalized Letter Flow

```text
┌─────────────────────────────────────────────────────────────────────┐
│  Generate Personalized Approval Letter                              │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  Applicant: Jennifer Meta                                           │
│  Tier: Silver Membership                                            │
│                                                                     │
│  Application Data Used:                                             │
│  • Wellness Goals: Muscle Gain, Improved Flexibility, Stress        │
│    Reduction, Holistic Health                                       │
│  • Lifestyle: "I live a pretty active but busy lifestyle..."        │
│  • Holistic Wellness: "Caring for my body and mind together..."     │
│                                                                     │
│  ┌───────────────────────────────────────────────────────────────┐  │
│  │  Subject: Welcome to Storm Wellness Club - Application        │  │
│  │           Approved!                                           │  │
│  ├───────────────────────────────────────────────────────────────┤  │
│  │  Dear Jennifer,                                               │  │
│  │                                                               │  │
│  │  We are delighted to inform you that your application to      │  │
│  │  Storm Wellness Club has been approved.                       │  │
│  │                                                               │  │
│  │  We were particularly inspired by your commitment to caring   │  │
│  │  for both body and mind together, rather than treating them   │  │
│  │  as separate. This philosophy aligns perfectly with the       │  │
│  │  foundation of Storm Wellness Club.                           │  │
│  │                                                               │  │
│  │  With your goals of building strength, improving flexibility, │  │
│  │  and managing stress, you'll find our integrated approach     │  │
│  │  to fitness and recovery especially valuable. Our reformer    │  │
│  │  pilates and spa recovery services are designed for busy      │  │
│  │  professionals like yourself who want meaningful results      │  │
│  │  without sacrificing balance.                                 │  │
│  │                                                               │  │
│  │  ✓ Your spot is secured as a Silver member.                   │  │
│  │                                                               │  │
│  │  Please keep an eye out for upcoming emails with              │  │
│  │  instructions on completing your membership setup.            │  │
│  │                                                               │  │
│  │  Warmly,                                                      │  │
│  │  Storm                                                        │  │
│  └───────────────────────────────────────────────────────────────┘  │
│                                                                     │
│  [ Regenerate ]              [ Cancel ]         [ Send Email ]      │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Technical Implementation

### Files to Create/Modify

| File | Change |
|------|--------|
| `supabase/functions/generate-approval-letter/index.ts` | New edge function using Lovable AI to generate personalized letter |
| `supabase/functions/send-email/index.ts` | Add `application_approved_personalized` email type |
| `src/pages/admin/Applications.tsx` | Add new dropdown options and AI letter modal |
| `src/components/admin/PersonalizedLetterModal.tsx` | New component for review/edit modal |
| Database migration | Create `email_audit_log` table for tracking |

### AI Letter Generation Edge Function

The new `generate-approval-letter` function will:
1. Accept applicant data (name, tier, wellness_goals, lifestyle_integration, holistic_wellness, services_interested)
2. Call Lovable AI with a prompt to generate a warm, personalized approval letter
3. Return the draft for admin review
4. Use the `google/gemini-2.5-flash` model for fast, quality generation

### AI Prompt Structure

```text
You are writing a personalized membership approval letter for Storm Wellness Club,
a luxury wellness facility focused on holistic health.

Applicant: {name}
Membership Tier: {tier}
Wellness Goals: {wellness_goals}
Services Interested In: {services_interested}
Their perspective on holistic wellness: "{holistic_wellness}"
Their lifestyle: "{lifestyle_integration}"

Write a warm, personalized approval letter that:
1. Opens with congratulations on their approval
2. References something specific from their application that resonated
3. Connects their goals to what Storm offers
4. Confirms their membership tier
5. Mentions they'll receive setup instructions soon
6. Closes warmly signed by Storm

Keep the tone elegant, personal, and concise (under 200 words for the body).
Do not include any links or buttons.
```

### Email Audit Logging

Every email sent will be logged to `email_audit_log` with:
- Email type
- Recipient
- Who triggered it (admin user ID)
- When sent
- Template data used (or custom content for personalized letters)

---

## Updated Dropdown Menu

```text
┌─────────────────────────────────────────────────┐
│  Approve ▼                                      │
├─────────────────────────────────────────────────┤
│  ○ Approve (No Email)                           │
│  ○ Approve + Send Approval Letter               │
│  ○ Approve + AI Personalized Letter ✨          │
│  ─────────────────────────────────────────────  │
│  ○ Approve + 7-Day Selection Email              │
│  ○ Approve + Setup Required Email               │
└─────────────────────────────────────────────────┘
```

---

## Complexity Assessment

This feature requires:
1. New edge function for AI generation
2. New modal component for review/edit
3. Updates to Applications.tsx dropdown
4. New email type in send-email
5. Email audit table (can be implemented together)

**Recommendation**: Implement in two phases:
- **Phase 1**: Basic approval letter option + dropdown restructure + audit logging
- **Phase 2**: AI personalized letter generation + review modal

This way you have the immediate fix (explicit email options with confirmation) while we build the AI personalization feature.

---

## Questions Before Implementation

1. **Do you want Phase 1 first (basic options + audit) then Phase 2 (AI)?**
2. **For the AI letter, should it always include the "keep an eye out for more emails" line, or should that be optional?**
3. **Should the AI letter modal allow editing the subject line too, or just the body?**

