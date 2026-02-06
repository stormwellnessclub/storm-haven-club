
# Add Farah Hakim's Membership Application

## Applicant Information Summary

| Field | Value |
|-------|-------|
| **Name** | Farah Hakim |
| **Date of Birth** | November 6, 1978 |
| **Email** | Farah21@hotmail.com |
| **Phone** | 313-231-1492 |
| **Address** | 9 Woodbridge Ct, Dearborn, MI 48124, USA |
| **Membership Plan** | Silver ($200/month) |
| **Founding Member** | Yes |

## Wellness Profile
- **Goals**: Weight Loss, Stress Reduction
- **Services Interested**: Fitness Classes, Open Gym, Spa Services, Personal Training
- **Previous Member**: Yes
- **Motivations**: Comprehensive wellness approach, Luxurious amenities, Community and support, Specific services

## Personal Statement
> "Single mother of a 6 year old boy. Juggling work and after school activities. I realized how important balance and health is. Which is why I need to put myself first above everything else"

---

## Implementation

### Database Migration
Insert a new record into the `membership_applications` table with:
- Status: `pending` (awaiting admin review)
- Annual Fee Status: `not_started`
- Payment Info: Not yet provided (card details will be entered securely via Stripe)
- All agreement checkboxes marked as accepted

### Important Notes
1. **Card details** - The provided card information will NOT be stored directly in the database. Once the application is approved, the admin can use the "Add Card" feature to securely collect payment via Stripe.
2. **Gender** - Set to "women" for correct pricing ($200/month Silver, $300 initiation fee)
3. **Founding Member** - Marked as "Yes" per the application

---

## Next Steps After Approval
1. Review the application in the Admin Portal
2. Add payment method via "Add Card" button (uses Stripe for secure handling)
3. Approve the application
4. Member receives welcome email with activation instructions
