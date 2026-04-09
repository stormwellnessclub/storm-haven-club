

# Fix Batul Bazzi's Missing Member Record

## Problem
Batul's application (f469ae29) has status `approved` but no corresponding member record was ever created in the `members` table. This means she won't show up in the members list or be able to access her membership.

The most likely cause: the approval may have been done outside the normal UI flow, or the member insert failed silently during approval.

## Plan

### Step 1: Create member record via database migration
Insert a member record for Batul using data from her approved application:

- **Name**: Batul Bazzi
- **Email**: bazzibatul@gmail.com
- **Phone**: 3138998647
- **Membership type**: Silver
- **Status**: pending_activation (she has `skip_tour_activate_immediately: true`, but since no subscription is set up yet, pending_activation is safer)
- **Stripe customer ID**: cus_UIDj3EV4UiW57Q
- **Gender**: Women
- **Founding member**: No
- **Annual fee paid**: Yes (annual_fee_status = 'paid')
- **Card info**: AMEX ending 2007, exp 3/2030
- **Activation deadline**: 7 days from now

### Step 2: Verify in admin
After the record is created, Batul should appear in the admin members list and be ready for activation/subscription setup.

## Technical Details
- Single SQL INSERT into `members` table
- No code changes needed — this is a data fix for a member record that should have been created during approval

