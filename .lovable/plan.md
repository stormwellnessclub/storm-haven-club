

# Add 3 New Applicants

## Overview
Adding three new membership applications to the system. All applicants are interested in Silver Membership.

---

## Applicant 1: Alyssa Maley

| Field | Value |
|-------|-------|
| **Name** | Alyssa Maley |
| **Email** | alyssammaley5@gmail.com |
| **Phone** | 3133339545 |
| **DOB** | 1995-04-02 |
| **Address** | 6134 Huff St, Westland, MI 48185 |
| **Membership** | Silver Membership |
| **Founding Member** | Yes |
| **Gender** | Women (inferred) |

**Wellness Goals:** Weight Loss, Muscle Gain, Improved Flexibility, Stress Reduction, Holistic Health

**Services Interested:** Fitness Classes, Open Gym, Spa Services, Personal Training

**Previous Fitness Member:** Yes

**Motivation:** Luxurious amenities

---

## Applicant 2: Summer Daoud

| Field | Value |
|-------|-------|
| **Name** | Summer Daoud |
| **Email** | summerd1410@gmail.com |
| **Phone** | 3134728704 |
| **DOB** | 2001-04-06 |
| **Address** | 4800 Parkside Blvd, Allen Park, MI 48101 |
| **Membership** | Silver Membership |
| **Founding Member** | No |
| **Gender** | Women (inferred) |
| **Social Media** | Simplyysummer |

**Wellness Goals:** Weight Loss, Muscle Gain, Improved Flexibility, Stress Reduction

**Services Interested:** Fitness Classes, Open Gym, Spa Services

**Previous Fitness Member:** Yes (infrared sauna experience)

**Motivation:** Comprehensive wellness approach, Luxurious amenities

**Lifestyle:** "My name is Summer dude I've been into fitness ever since I was younger been an athlete growing up. My routine with fitness is very important on my daily schedule and I also became a Pilates instructor and I believe that being around the wellness brings me a lot of joy. I want to be able to use this wellness center. Anytime I feel to reduce my stress levels to relax and just get a good workout in."

**Holistic Wellness:** "Holistic wellness means caring for my body and mind together. It's not only about working out, but also about healthy habits like proper rest, nutrition, and taking care of my mental well-being so I can stay consistent and healthy long-term."

---

## Applicant 3: Siham Aoun

| Field | Value |
|-------|-------|
| **Name** | Siham Aoun |
| **Email** | saoun2425@gmail.com |
| **Phone** | 3133385262 |
| **DOB** | 1979-07-30 |
| **Address** | 24540 Emerson St *(city/state/zip had form errors - will use MI as state)* |
| **Membership** | Silver Membership |
| **Founding Member** | No |
| **Gender** | Women (inferred) |

> ⚠️ **Note:** The address form appears to have had an entry error where "24540 EMERSON ST" was entered in city, state, and zip fields. I'll set the address as "24540 Emerson St" with state "MI" and leave city/zip blank for manual correction later.

**Wellness Goals:** Weight Loss, Muscle Gain, Improved Flexibility, Stress Reduction

**Services Interested:** Fitness Classes, Spa Services, Personal Training, Nutritional Guidance

**Previous Fitness Member:** Yes

**Motivation:** Specific services (e.g., spa, personal training)

---

## Data Insert Summary

Three records will be added to `membership_applications`:

| # | Name | Email | Plan | Founding |
|---|------|-------|------|----------|
| 1 | Alyssa Maley | alyssammaley5@gmail.com | Silver | Yes |
| 2 | Summer Daoud | summerd1410@gmail.com | Silver | No |
| 3 | Siham Aoun | saoun2425@gmail.com | Silver | No |

## Payment Information Note

Card details will need to be added via the Stripe integration after applications are created:
1. Open each application in the admin dashboard
2. Use "Add Card" to securely add payment method via Stripe
3. Charge initiation fee or generate payment link

