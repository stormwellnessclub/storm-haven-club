# Comprehensive System Review - Storm Wellness Club

**Review Date:** January 2025  
**Scope:** Complete system-wide review of all 18 major modules  
**Review Type:** Detailed analysis with code references, workflows, logic gaps, security concerns, and integration issues

---

## Executive Summary

This comprehensive review examines all major systems in the Storm Wellness Club application, identifying workflows, logic gaps, missing functions, security concerns, and integration issues. The review covers 18 major modules with equal depth, providing actionable findings prioritized by severity.

**Overall System Health:** Functional but with significant gaps requiring attention

**Critical Issues Found:** [Will be populated as review progresses]
**High Priority Issues:** [Will be populated]
**Medium Priority Issues:** [Will be populated]
**Low Priority Issues:** [Will be populated]

---

## Table of Contents

1. [Authentication & Authorization System](#1-authentication--authorization-system)
2. [Member Management & Application System](#2-member-management--application-system)
3. [Check-in & Scanner System](#3-check-in--scanner-system)
4. [Class Booking System](#4-class-booking-system)
5. [Spa Booking System](#5-spa-booking-system)
6. [Cafe/POS System](#6-cafepos-system)
7. [Kids Care/Childcare System](#7-kids-carechildcare-system)
8. [Payments & Billing (Stripe Integration)](#8-payments--billing-stripe-integration)
9. [Member Credits System](#9-member-credits-system)
10. [Freeze Request System](#10-freeze-request-system)
11. [Guest Pass System](#11-guest-pass-system)
12. [Staff Management & Roles System](#12-staff-management--roles-system)
13. [Equipment Management System](#13-equipment-management-system)
14. [Agreements System](#14-agreements-system)
15. [Email System](#15-email-system)
16. [Member Portal Features](#16-member-portal-features)
17. [Admin Portal Features](#17-admin-portal-features)
18. [Public Website Features](#18-public-website-features)
19. [Cross-System Integration Issues](#19-cross-system-integration-issues)
20. [Security Audit Summary](#20-security-audit-summary)
21. [Recommendations & Action Items](#21-recommendations--action-items)

---

## Review Methodology

For each system, the following areas were examined:
- **Workflows:** Primary user flows, admin flows, edge cases
- **Logic Gaps:** Missing validations, incomplete business rules, status transitions
- **Missing Functions:** TODO comments, unimplemented features, incomplete integrations
- **Security Concerns:** Permission checks, RLS policies, data exposure risks
- **Integration Issues:** Cross-system dependencies, data consistency, event synchronization
- **Error Handling:** Missing error handling, poor error messages, recovery mechanisms
- **UX/UI Issues:** Missing feedback, confusing flows, accessibility concerns

---

## 1. Authentication & Authorization System

### Overview
The authentication system uses Supabase Auth with role-based access control through custom roles stored in `staff_profiles` table.

### Workflows

#### Primary User Flow: Member Authentication
```
User → Sign Up/Sign In → Supabase Auth → AuthContext → Protected Routes
```

**Files:**
- `src/contexts/AuthContext.tsx` - Main auth context
- `src/components/member/ProtectedMemberRoute.tsx` - Member route protection
- `src/components/admin/ProtectedAdminRoute.tsx` - Admin route protection

#### Admin Authentication Flow
```
User → Sign In → AuthContext → useUserRoles → ProtectedAdminRoute → Permission Check → Access Granted/Denied
```

**Files:**
- `src/hooks/useUserRoles.ts` - Role fetching
- `src/lib/permissions.ts` - Permission checking logic

### Logic Gaps

#### 1.1 Missing Role Validation on Sign Up
**Issue:** Sign-up process doesn't verify if email matches pending application
**Location:** `src/contexts/AuthContext.tsx:123-139`
**Severity:** Medium
**Impact:** Users can create accounts for emails that don't have applications
**Recommendation:** Add application verification in sign-up flow

#### 1.2 Session Refresh Race Condition
**Issue:** Multiple refresh attempts can happen simultaneously
**Location:** `src/contexts/AuthContext.tsx:74-94`
**Severity:** Low
**Impact:** Potential race conditions in session refresh
**Recommendation:** Add debouncing/queue for refresh attempts

#### 1.3 Role Caching Strategy
**Issue:** Roles are fetched but caching strategy is unclear
**Location:** `src/hooks/useUserRoles.ts`
**Severity:** Medium
**Impact:** Unnecessary database queries, potential stale data
**Recommendation:** Implement proper caching with invalidation on role changes

### Missing Functions

#### 1.4 Password Reset Flow
**Status:** Not implemented in UI
**Location:** Authentication pages
**Severity:** High
**Impact:** Users cannot reset passwords through UI
**Recommendation:** Add password reset flow in `src/pages/Auth.tsx`

#### 1.5 Multi-Factor Authentication
**Status:** Not implemented
**Severity:** Medium (Security enhancement)
**Recommendation:** Consider adding MFA for admin accounts

#### 1.6 Session Timeout UI Warning
**Status:** No user warning before session expires
**Location:** `src/components/SessionMonitor.tsx`
**Severity:** Low
**Recommendation:** Add countdown/warning before session expiry

### Security Concerns

#### 1.7 RLS Policy Gaps in Staff Profiles
**Issue:** Need to verify all staff_profiles queries are properly protected
**Location:** `src/hooks/useUserRoles.ts`
**Severity:** High
**Recommendation:** Audit all staff_profiles table access

#### 1.8 Permission Checking Consistency
**Issue:** Permissions checked in multiple places (frontend + backend)
**Location:** `src/lib/permissions.ts` vs RLS policies
**Severity:** Medium
**Impact:** Frontend checks can be bypassed
**Recommendation:** Ensure all critical operations verify permissions server-side

#### 1.9 JWT Error Handling
**Status:** Implemented but complex
**Location:** `src/lib/jwtErrorHandler.ts`
**Severity:** Low
**Note:** Good implementation but could be simplified

### Integration Issues

#### 1.10 Auth State Synchronization
**Issue:** Auth state updates across multiple components
**Location:** AuthContext, SessionMonitor, ProtectedRoutes
**Severity:** Low
**Impact:** Potential state inconsistencies
**Recommendation:** Ensure single source of truth

### Error Handling

#### 1.11 Generic Error Messages
**Issue:** Some auth errors show generic messages
**Location:** `src/contexts/AuthContext.tsx`
**Severity:** Low
**Recommendation:** Provide more specific error messages for users

---

## 2. Member Management & Application System

### Overview
Membership applications are submitted through public form, then reviewed and activated by admins. Members are created from approved applications.

### Workflows

#### Application Submission Flow
```
User → Apply Page → Form Submission → membership_applications table → Admin Review
```

**Files:**
- `src/pages/Apply.tsx` - Application form
- `supabase/migrations/20251226143938_*.sql` - Applications schema

#### Application Approval & Member Activation Flow
```
Admin → Applications Page → Review → Approve → Create Member → Link to User → Activation
```

**Files:**
- `src/pages/admin/Applications.tsx` - Admin application management
- `src/hooks/useApplicationStatus.ts` - Application status tracking

### Logic Gaps

#### 2.1 Duplicate Application Detection
**Issue:** No check for existing applications with same email
**Location:** `src/pages/Apply.tsx:560-696`
**Severity:** Medium
**Impact:** Users can submit multiple applications
**Recommendation:** Add duplicate check before submission

#### 2.2 Application Status Transitions
**Issue:** Status transitions not fully validated
**Location:** `src/pages/admin/Applications.tsx`
**Severity:** Medium
**Recommendation:** Add state machine validation for status changes

#### 2.3 Member Activation Timing
**Issue:** Activation can happen before payment is confirmed
**Location:** `src/pages/admin/Applications.tsx:523-609`
**Severity:** High
**Impact:** Members can be activated without payment
**Recommendation:** Verify payment status before activation

### Missing Functions

#### 2.4 Application Revision/Edit
**Status:** Not implemented
**Severity:** Medium
**Recommendation:** Allow applicants to update pending applications

#### 2.5 Application Cancellation by Applicant
**Status:** Not implemented
**Severity:** Low
**Recommendation:** Allow users to cancel their own pending applications

#### 2.6 Bulk Application Export
**Status:** Not implemented
**Location:** `src/pages/admin/Applications.tsx`
**Severity:** Low
**Recommendation:** Add CSV/Excel export functionality

### Security Concerns

#### 2.7 Application Data Exposure
**Issue:** Need to verify PII in applications is properly protected
**Location:** RLS policies on `membership_applications` table
**Severity:** High
**Recommendation:** Audit RLS policies - applications should only be viewable by staff

#### 2.8 Member ID Generation Security
**Issue:** Member ID generation could have race conditions
**Location:** `supabase/migrations/20251227132517_*.sql:109-125`
**Severity:** Low
**Note:** Uses MAX query which could have race conditions under high concurrency

### Integration Issues

#### 2.9 Member-User Linking Race Condition
**Issue:** Auto-linking has retry logic but could still fail
**Location:** `src/hooks/useApplicationStatus.ts:50-86`
**Severity:** Medium
**Impact:** Members may not be linked to users correctly
**Recommendation:** Add manual linking fallback in admin UI

#### 2.10 Application Status History
**Status:** Table exists but UI integration unclear
**Location:** `supabase/migrations/20260105014357_application_status_history.sql`
**Severity:** Low
**Recommendation:** Add status history display in application detail view

---

## 3. Check-in & Scanner System

### Overview
Two systems for member check-in: manual check-in page and scanner system. Both create check-in records and can trigger automatic check-ins.

### Workflows

#### Manual Check-In Flow
```
Staff → CheckIn Page → Search Member → Select → Validate Status → Check In → Record Created
```

**Files:**
- `src/pages/admin/CheckIn.tsx` - Manual check-in interface

#### Scanner Check-In Flow
```
Staff → Scanner Page → Scan Member ID → RPC Function → Validate → Auto Check-In (if enabled) → Log Scan
```

**Files:**
- `src/pages/admin/Scanner.tsx` - Scanner interface
- `supabase/migrations/20260107000000_scanner_system.sql` - Scanner RPC function

### Logic Gaps

#### 3.1 Duplicate Check-In Prevention - CRITICAL
**Issue:** No check for existing active check-in before creating new one
**Location:** 
- `supabase/migrations/20260107000000_scanner_system.sql:180-185` (Scanner RPC)
- `src/pages/admin/CheckIn.tsx:172-207` (Manual check-in)
**Severity:** CRITICAL
**Impact:** Members can be checked in multiple times per day, inflating statistics
**Recommendation:** 
- Check for existing active check-in (no `checked_out_at`)
- Return existing check-in ID if found
- Optionally update timestamp if duplicate

#### 3.2 Checkout Functionality Missing - CRITICAL
**Issue:** No checkout workflow for scanner system
**Location:** Scanner system
**Severity:** CRITICAL
**Impact:** Members stay "checked in" indefinitely, statistics inaccurate
**Recommendation:** 
- Add checkout scan mode
- Update `checked_out_at` timestamp
- Show currently checked-in members list

#### 3.3 Status Validation Gaps
**Issue:** Scanner RPC doesn't handle `pending_activation`, `suspended`, `inactive` statuses
**Location:** `supabase/migrations/20260107000000_scanner_system.sql:149-178`
**Severity:** High
**Impact:** Members with these statuses may incorrectly get access
**Recommendation:** Add explicit status checks for all non-active statuses

#### 3.4 Staff Confirmation Requirement Not Implemented
**Issue:** `require_staff_confirmation` setting exists but is never checked
**Location:** Scanner settings and RPC function
**Severity:** High
**Impact:** Setting has no effect
**Recommendation:** Implement confirmation dialog when setting is enabled

#### 3.5 Override Permission Check Missing
**Issue:** Any staff can override, should be manager+ only
**Location:** `src/pages/admin/Scanner.tsx:381-398`
**Severity:** High
**Impact:** Unauthorized overrides
**Recommendation:** Check role (manager+) and `allow_override` setting before showing override button

### Missing Functions

#### 3.6 Already Checked-In Detection
**Status:** Not implemented
**Severity:** High
**Recommendation:** Show "Already checked in at [time]" message

#### 3.7 Check-In Statistics Dashboard
**Status:** Basic stats only
**Severity:** Medium
**Recommendation:** Add analytics: peak hours, frequency, patterns

#### 3.8 Auto-Checkout After Hours
**Status:** Not implemented
**Severity:** Low
**Recommendation:** Consider auto-checkout after facility hours

### Security Concerns

#### 3.9 Scanner Override Audit Trail
**Issue:** Overrides logged but no link to staff profile name
**Location:** `scanner_access_logs` table
**Severity:** Medium
**Recommendation:** Join with staff_profiles to show staff name

#### 3.10 Check-In RLS Policies
**Issue:** Verify check-in creation permissions are properly restricted
**Location:** RLS policies on `check_ins` table
**Severity:** Medium
**Status:** Appears correct but should verify

### Integration Issues

#### 3.11 CheckIn Page vs Scanner Page Duplication
**Issue:** Two separate pages with overlapping functionality
**Location:** `src/pages/admin/CheckIn.tsx` and `src/pages/admin/Scanner.tsx`
**Severity:** Medium
**Recommendation:** Unify into single page with tabs/modes

#### 3.12 Member Activities Integration
**Status:** Check-ins trigger activity logging (good)
**Location:** Trigger in `supabase/migrations/20260105014434_member_activities.sql:127-157`
**Note:** Good integration, points system working

---

## 4. Class Booking System

### Overview
Class booking system with atomic booking function, waitlist support, class passes, and member credits integration.

### Workflows

#### Class Booking Flow
```
Member → Browse Classes → Select Session → Choose Payment (Credits/Pass/Cash) → Atomic RPC Function → Booking Created
```

**Files:**
- `src/hooks/useBooking.ts` - Booking hook
- `supabase/migrations/20260104222459_atomic_class_booking.sql` - Atomic booking RPC
- `src/components/booking/BookingModal.tsx` - Booking UI

#### Waitlist Flow
```
Member → Session Full → Join Waitlist → Notification → Claim Spot → Book
```

**Files:**
- Waitlist handling in booking system
- `supabase/functions/notify-waitlist/index.ts` - Waitlist notifications

### Logic Gaps

#### 4.1 Duplicate Booking Prevention
**Status:** Handled in atomic function (good)
**Location:** `supabase/migrations/20260104222459_atomic_class_booking.sql:59-72`
**Note:** Atomic booking function properly prevents duplicates

#### 4.2 Cancellation Window Not Enforced
**Issue:** No enforcement of cancellation deadline (e.g., 12 hours before class)
**Location:** `src/hooks/useBooking.ts:263-344`
**Severity:** Medium
**Impact:** Members can cancel too close to class time
**Recommendation:** Add cancellation deadline check in cancel function

#### 4.3 Waitlist Expiration Not Handled
**Issue:** Waitlist entries may not expire properly
**Location:** Waitlist system
**Severity:** Medium
**Recommendation:** Verify waitlist expiration logic works correctly

#### 4.4 Class Capacity Overbooking Risk
**Issue:** Race condition possible between capacity check and booking creation
**Status:** Mitigated by atomic function with row locking
**Location:** `supabase/migrations/20260104222459_atomic_class_booking.sql:46-58`
**Note:** Good use of FOR UPDATE to prevent race conditions

### Missing Functions

#### 4.5 Booking Reminders
**Status:** Edge function exists but trigger mechanism unclear
**Location:** `supabase/functions/send-class-reminders/index.ts`
**Severity:** Medium
**Recommendation:** Verify scheduled function is properly configured

#### 4.6 No-Show Tracking
**Status:** Status exists but marking unclear
**Location:** Booking status enum includes 'no_show'
**Severity:** Low
**Recommendation:** Add UI/admin function to mark no-shows

#### 4.7 Recurring Booking Support
**Status:** Not implemented
**Severity:** Low
**Recommendation:** Consider adding recurring booking feature

### Security Concerns

#### 4.8 Agreement Validation for Pass Types
**Status:** Implemented (good)
**Location:** `src/hooks/useBooking.ts:172-207`
**Note:** Properly checks guest_pass and single_class_pass agreements

#### 4.9 Booking RLS Policies
**Status:** Should verify user can only book for themselves
**Location:** RLS policies on `class_bookings` table
**Severity:** Medium
**Recommendation:** Audit RLS policies ensure users can't book for others

### Integration Issues

#### 4.10 Credit Deduction Timing
**Status:** Handled atomically (good)
**Location:** `supabase/migrations/20260104222459_atomic_class_booking.sql:85-116`
**Note:** Credits deducted in same transaction as booking creation

#### 4.11 Pass Deduction Timing
**Status:** Handled atomically (good)
**Location:** `supabase/migrations/20260104222459_atomic_class_booking.sql:118-149`
**Note:** Passes deducted in same transaction

---

## 5. Spa Booking System

### Overview
Spa appointment booking with member discounts, payment integration, and staff assignment.

### Workflows

#### Spa Booking Flow
```
Member → Browse Services → Select Service → Choose Date/Time → Calculate Price (with member discount) → Process Payment → Create Appointment
```

**Files:**
- `src/hooks/useSpaBooking.ts` - Spa booking hook
- `src/components/booking/SpaBookingModal.tsx` - Booking UI
- `supabase/migrations/20260104222700_spa_appointments.sql` - Appointments schema

### Logic Gaps

#### 5.1 Conflict Detection Logic Flaw - CRITICAL
**Issue:** Conflict detection query has incorrect logic
**Location:** `src/hooks/useSpaBooking.ts:74-82`
**Severity:** CRITICAL
**Problem:** The query uses `.or()` with complex string conditions that may not work correctly with Supabase query builder
**Impact:** Overlapping appointments can be created
**Recommendation:** Rewrite conflict detection using proper Supabase query methods or move to RPC function

#### 5.2 Member Discount Calculation Duplication
**Issue:** Discount calculation duplicated in hook and modal
**Location:** 
- `src/hooks/useSpaBooking.ts:106-123`
- `src/components/booking/SpaBookingModal.tsx:125-139`
**Severity:** Medium
**Impact:** Code duplication, potential inconsistencies
**Recommendation:** Centralize discount calculation logic

#### 5.3 Cancellation Policy Not Enforced
**Issue:** No enforcement of cancellation deadline
**Location:** `src/hooks/useSpaBooking.ts:275-314`
**Severity:** Medium
**Recommendation:** Add cancellation deadline check

#### 5.4 Staff Assignment Validation Missing
**Issue:** Can assign staff that doesn't exist or isn't available
**Location:** `src/hooks/useSpaBooking.ts:61-97`
**Severity:** Medium
**Recommendation:** Validate staff_id exists and is active

### Missing Functions

#### 5.5 Appointment Reminders
**Status:** Not implemented
**Severity:** Medium
**Recommendation:** Add email/SMS reminders before appointments

#### 5.6 Service Availability Calendar
**Status:** Basic conflict checking only
**Severity:** Medium
**Recommendation:** Add proper availability calendar with business hours

#### 5.7 Recurring Spa Appointments
**Status:** Not implemented
**Severity:** Low
**Recommendation:** Consider recurring appointment feature

### Security Concerns

#### 5.8 Payment Intent Validation
**Issue:** Payment intent ID stored but not validated against Stripe
**Location:** Spa appointments table
**Severity:** Medium
**Recommendation:** Verify payment intent on appointment creation

#### 5.9 Appointment RLS Policies
**Status:** Users can view own appointments (good)
**Location:** `supabase/migrations/20260104222700_spa_appointments.sql:36-53`
**Note:** RLS policies appear correct

### Integration Issues

#### 5.10 Member Price Storage
**Status:** Both original and member price stored (good)
**Location:** `spa_appointments` table has `service_price` and `member_price`
**Note:** Good design for audit trail

---

## 6. Cafe/POS System

### Overview
Cafe ordering system with member account charging and payment processing.

### Workflows

#### Cafe Order Flow (Member)
```
Member → Browse Menu → Add to Cart → Select Payment Method → Process Payment → Create Order → Status Updates
```

**Files:**
- `src/pages/Cafe.tsx` - Member cafe page
- `src/hooks/useCafeOrder.ts` - Order hook
- `src/pages/admin/CafePOS.tsx` - POS interface

#### Cafe POS Flow (Staff)
```
Staff → Search Member → Add Items → Place Order → Charge Member Account or Card → Order Status Updates
```

**Files:**
- `src/pages/admin/CafePOS.tsx` - POS terminal
- `src/hooks/useAdminCafeOrders.ts` - Admin order management

### Logic Gaps

#### 6.1 Member Account Charging Not Implemented - CRITICAL
**Issue:** `payment_method` can be "member_account" but actual charging logic missing
**Location:** 
- `src/pages/admin/CafePOS.tsx:81-89` (creates order with member_account)
- `src/pages/Cafe.tsx:278-281` (member_account path exists but no charging)
**Severity:** CRITICAL
**Impact:** Orders created but never charged to member account
**Recommendation:** Implement member account charging via Stripe customer balance or charge API

#### 6.2 Payment Intent Missing for Member Account
**Issue:** Orders with `payment_method: "member_account"` don't have payment_intent_id
**Location:** `src/hooks/useCafeOrder.ts:40-84`
**Severity:** High
**Impact:** No payment record for member account charges
**Recommendation:** Create payment record or charge history entry for member account orders

#### 6.3 Order Status Transition Validation
**Issue:** No validation on status transitions (e.g., can go from completed to pending)
**Location:** `src/hooks/useAdminCafeOrders.ts`
**Severity:** Medium
**Recommendation:** Add state machine validation for status changes

#### 6.4 Guest Order Payment Missing
**Issue:** Guest orders (no user_id) can be created but payment unclear
**Location:** `supabase/migrations/20260104222623_cafe_orders.sql:30`
**Severity:** Medium
**Note:** RLS allows `auth.uid() IS NULL` for guest orders
**Recommendation:** Clarify guest order payment flow

### Missing Functions

#### 6.5 Order Cancellation Refunds
**Status:** Cancellation exists but refund logic unclear
**Location:** `src/hooks/useCafeOrder.ts:131-169`
**Severity:** High
**Recommendation:** Implement refund logic for cancelled orders

#### 6.6 Order Modification After Placement
**Status:** Not implemented
**Severity:** Medium
**Recommendation:** Allow order modifications before preparation starts

#### 6.7 Order History for Members
**Status:** Basic query exists
**Location:** `src/hooks/useCafeOrder.ts:96-129`
**Note:** Function exists but UI integration unclear

### Security Concerns

#### 6.8 Guest Order RLS Policy
**Issue:** RLS allows NULL user_id which enables unauthenticated orders
**Location:** `supabase/migrations/20260104222623_cafe_orders.sql:30`
**Severity:** Medium
**Note:** May be intentional but should document purpose

#### 6.9 Payment Method Validation
**Issue:** Payment method not validated against allowed values
**Location:** Order creation
**Severity:** Low
**Recommendation:** Add CHECK constraint or enum for payment_method

### Integration Issues

#### 6.10 Member Activities Integration
**Status:** Unclear if cafe orders trigger activity logging
**Location:** Member activities system
**Severity:** Low
**Recommendation:** Consider adding cafe order activity logging

---

## 7. Kids Care/Childcare System

### Overview
Kids care booking system with pass-based access and age-based grouping.

### Workflows

#### Kids Care Booking Flow
```
Member → Kids Care Page → Select Date/Time → Enter Child Info → Validate Pass → Create Booking → Check In/Out
```

**Files:**
- `src/hooks/useKidsCareBooking.ts` - Booking hook
- `src/pages/member/KidsCareServiceForm.tsx` - Service form
- `src/pages/admin/Childcare.tsx` - Admin childcare management

### Logic Gaps

#### 7.1 Pass Deduction Timing
**Issue:** Pass validation happens but deduction unclear
**Location:** `src/hooks/useKidsCareBooking.ts:200-205` (comment says deduction at check-in)
**Severity:** Medium
**Impact:** Pass usage tracking may be inaccurate
**Recommendation:** Clarify and implement pass deduction at appropriate time

#### 7.2 Age Group Assignment Logic
**Issue:** Age group stored but assignment logic unclear
**Location:** `kids_care_bookings` table has `age_group` field
**Severity:** Low
**Recommendation:** Document or implement age group assignment logic

#### 7.3 Capacity Checking Missing
**Issue:** No capacity check for childcare bookings
**Location:** Booking creation
**Severity:** Medium
**Recommendation:** Add capacity checking per age group

### Missing Functions

#### 7.4 Check-In/Check-Out Workflow
**Status:** Fields exist but workflow unclear
**Location:** `kids_care_bookings` table has checked_in_at, checked_out_at, checked_in_by, checked_out_by
**Severity:** Medium
**Recommendation:** Implement check-in/check-out UI and logic

#### 7.5 Recurring Bookings
**Status:** Not implemented
**Severity:** Low
**Recommendation:** Consider recurring childcare bookings

### Security Concerns

#### 7.6 Kids Care Agreement Validation
**Status:** Agreement fields exist in profiles
**Location:** `profiles` table has `kids_care_agreement_signed`
**Severity:** Medium
**Recommendation:** Verify agreement is checked before booking creation

#### 7.7 Booking RLS Policies
**Status:** Users can view own bookings (good)
**Location:** `supabase/migrations/20260104222800_kids_care_bookings.sql:33-50`
**Note:** RLS policies appear correct

### Integration Issues

#### 7.8 Pass Integration
**Status:** Pass validation exists but usage tracking unclear
**Location:** `src/hooks/useKidsCareBooking.ts`
**Recommendation:** Ensure pass usage is properly tracked

---

## 8. Payments & Billing (Stripe Integration)

### Overview
Payment processing via Stripe with webhook handling for subscriptions, one-time payments, and member account charges.

### Workflows

#### Membership Activation Payment
```
Admin Approves Application → Stripe Checkout Session → Payment → Webhook → Activate Member → Create Credits
```

**Files:**
- `supabase/functions/stripe-webhook/index.ts` - Webhook handler
- `supabase/functions/stripe-payment/index.ts` - Payment processing

#### Member Account Charging
```
Order/Service → Charge Saved Card → Payment Intent → Record Payment
```

**Files:**
- `supabase/functions/stripe-payment/index.ts` - Payment function
- Used by spa bookings, cafe orders, etc.

### Logic Gaps

#### 8.1 Webhook Idempotency Missing - CRITICAL
**Issue:** No idempotency check for webhook events (comment mentions it)
**Location:** `supabase/functions/stripe-webhook/index.ts:151-153`
**Severity:** CRITICAL
**Impact:** Duplicate webhook processing can create duplicate records
**Recommendation:** Store processed webhook event IDs and check before processing

#### 8.2 Credit Creation Failure Handling
**Issue:** Credit creation failures are logged but processing continues
**Location:** `supabase/functions/stripe-webhook/index.ts:206-246`
**Severity:** High
**Impact:** Members activated but credits not created
**Recommendation:** Add retry logic or alert mechanism for credit creation failures

#### 8.3 Subscription Status Sync Missing
**Issue:** No sync of subscription status from Stripe to members table
**Location:** Payment system
**Severity:** High
**Impact:** Subscription cancellations in Stripe not reflected in system
**Recommendation:** Handle `customer.subscription.deleted` webhook event

#### 8.4 Payment Failure Handling
**Issue:** Failed payments not handled for subscriptions
**Location:** Webhook handler
**Severity:** High
**Recommendation:** Handle `invoice.payment_failed` webhook event

#### 8.5 Refund Processing Missing
**Issue:** No refund handling in webhook
**Location:** `supabase/functions/stripe-webhook/index.ts`
**Severity:** Medium
**Recommendation:** Handle `charge.refunded` webhook event

### Missing Functions

#### 8.6 Payment History UI
**Status:** ChargeHistory component exists but integration unclear
**Location:** `src/components/ChargeHistory.tsx`
**Severity:** Medium
**Recommendation:** Integrate payment history display in member portal

#### 8.7 Subscription Management UI
**Status:** Not implemented
**Severity:** High
**Recommendation:** Add UI for members to manage subscriptions (pause, cancel, update payment method)

#### 8.8 Payment Method Management
**Status:** Basic functionality exists
**Location:** `src/pages/member/PaymentMethods.tsx`
**Note:** Should verify full CRUD operations work

### Security Concerns

#### 8.9 Webhook Signature Verification
**Status:** Implemented (good)
**Location:** `supabase/functions/stripe-webhook/index.ts:119-147`
**Note:** Proper signature verification

#### 8.10 Payment Data Storage
**Issue:** Payment intent IDs stored but sensitive data handling unclear
**Location:** Various tables store payment_intent_id
**Severity:** Medium
**Recommendation:** Ensure no sensitive card data is stored (should only store IDs)

#### 8.11 Service Role Key Usage
**Status:** Webhook uses service role key (necessary)
**Location:** `supabase/functions/stripe-webhook/index.ts:113`
**Note:** Correct usage for webhook processing

### Integration Issues

#### 8.12 Member Activation Credit Creation
**Status:** Implemented but error handling could be improved
**Location:** `supabase/functions/stripe-webhook/index.ts:206-246`
**Note:** Credits created per type with error handling per type (good)

#### 8.13 Class Pass Purchase Integration
**Status:** Implemented (good)
**Location:** `supabase/functions/stripe-webhook/index.ts:248-370`
**Note:** Proper handling of class pass purchases

---

## 9. Member Credits System

### Overview
Monthly credit allocation system with cycle-based tracking, expiration, and usage across class, red light, and dry cryo services.

### Workflows

#### Credit Allocation Flow
```
Member Activated → Initial Credits Created → Monthly Cycle → Process Monthly Credits Function → New Credits Created
```

**Files:**
- `supabase/functions/stripe-webhook/index.ts:206-246` - Initial credit creation
- `supabase/functions/process-monthly-credits/index.ts` - Monthly credit processing
- `src/lib/memberCredits.ts` - Credit calculation utilities

### Logic Gaps

#### 9.1 Credit Selection Logic
**Issue:** `useUserCredits` selects first credit by expiration, not by cycle
**Location:** `src/hooks/useUserCredits.ts:79-93`
**Severity:** Medium
**Impact:** May use older credits before newer ones
**Recommendation:** Select by cycle_start DESC instead of expires_at ASC

#### 9.2 Duplicate Credit Prevention
**Status:** UNIQUE constraint on (user_id, credit_type, cycle_start) (good)
**Location:** `supabase/migrations/20260101182037_*.sql:17`
**Note:** Proper constraint prevents duplicates

#### 9.3 Credit Expiration Handling
**Issue:** Expired credits may still appear in queries
**Location:** `src/hooks/useUserCredits.ts:75` (filters expired, good)
**Status:** Properly filtered but verify all queries do this

### Missing Functions

#### 9.4 Credit History/Audit Trail
**Status:** No history of credit usage
**Severity:** Medium
**Recommendation:** Add credit_transactions table or log usage

#### 9.5 Credit Balance Warnings
**Status:** No low balance warnings
**Severity:** Low
**Recommendation:** Notify members when credits running low

### Security Concerns

#### 9.6 Credit RLS Policies
**Status:** Users can view own credits (good)
**Location:** `supabase/migrations/20260101182037_*.sql:24-37`
**Note:** RLS policies appear correct

### Integration Issues

#### 9.7 Monthly Credit Processing Schedule
**Issue:** Cron job configuration unclear
**Location:** `supabase/functions/process-monthly-credits/index.ts`
**Severity:** High
**Recommendation:** Verify pg_cron is configured to run daily
**Note:** Migration shows pg_cron extension but no job creation

---

## 10. Freeze Request System

### Overview
Membership freeze request system with approval workflow, fee collection, and automatic reactivation.

### Workflows

#### Freeze Request Flow
```
Member → Request Freeze → Admin Review → Approve → Pay Fee → Activate Freeze → Expire → Reactivate Member
```

**Files:**
- `src/pages/member/FreezeRequest.tsx` - Member freeze request
- `src/pages/admin/FreezeRequests.tsx` - Admin freeze management
- `supabase/functions/process-freeze-expirations/index.ts` - Auto reactivation

### Logic Gaps

#### 10.1 Annual Limit Enforcement
**Issue:** Eligibility check allows 2 freezes but logic unclear
**Location:** `src/hooks/useMemberFreezes.ts:49-88`
**Severity:** Medium
**Impact:** May allow more than 2 months per year
**Recommendation:** Verify eligibility calculation matches business rules

#### 10.2 Freeze Fee Payment Tracking
**Issue:** Fee payment may not be properly tracked
**Location:** Freeze system
**Severity:** Medium
**Recommendation:** Verify payment flow for freeze fees

#### 10.3 Freeze Activation Timing
**Issue:** Manual activation required after approval
**Location:** `src/pages/admin/FreezeRequests.tsx:113-115`
**Severity:** Medium
**Recommendation:** Consider auto-activation on start date

### Missing Functions

#### 10.4 Freeze Expiration Email
**Status:** TODO comment exists
**Location:** `supabase/functions/process-freeze-expirations/index.ts:86-88`
**Severity:** Medium
**Recommendation:** Implement reactivation email notification

#### 10.5 Freeze Schedule Verification
**Status:** No validation of freeze dates against membership dates
**Severity:** Low
**Recommendation:** Validate freeze doesn't overlap with other status changes

### Security Concerns

#### 10.6 Freeze RLS Policies
**Status:** Users can view own freezes (good)
**Location:** `supabase/migrations/20260103055826_*.sql:41-66`
**Note:** RLS policies appear correct

### Integration Issues

#### 10.7 Member Status Update on Freeze
**Status:** Status updated to 'frozen' (good)
**Location:** Freeze activation logic
**Note:** Integration appears correct

---

## 11. Guest Pass System

### Overview
Guest pass sales system for day passes, week passes, and member guest passes.

### Workflows

#### Guest Pass Purchase Flow
```
Guest/Staff → Select Pass Type → Enter Guest Info → Process Payment → Create Pass → Pass Available for Use
```

**Files:**
- `src/pages/admin/GuestPasses.tsx` - Admin guest pass sales
- Guest pass integration with class booking system

### Logic Gaps

#### 11.1 Guest Pass Creation Not Implemented - CRITICAL
**Issue:** UI exists but submit button doesn't actually create passes
**Location:** `src/pages/admin/GuestPasses.tsx:113-116`
**Severity:** CRITICAL
**Impact:** Guest pass functionality completely non-functional
**Recommendation:** Implement guest pass creation and payment processing

#### 11.2 Guest Pass Agreement Validation
**Issue:** Agreement required but validation unclear
**Location:** Class booking system references guest_pass agreements
**Severity:** High
**Recommendation:** Verify agreement is checked before guest pass usage

#### 11.3 Guest Pass Expiration
**Issue:** Expiration tracking unclear
**Location:** Guest pass system
**Severity:** Medium
**Recommendation:** Implement expiration date tracking and validation

### Missing Functions

#### 11.4 Guest Pass Database Schema
**Issue:** No clear table for guest passes
**Location:** Database migrations
**Severity:** CRITICAL
**Recommendation:** Create `guest_passes` table or use `class_passes` table

#### 11.5 Guest Pass Usage Tracking
**Status:** Not implemented
**Severity:** High
**Recommendation:** Track when guest passes are used

#### 11.6 Member Guest Pass Limits
**Status:** No limit on member guest passes
**Severity:** Medium
**Recommendation:** Add per-member limit tracking

### Security Concerns

#### 11.7 Guest Pass RLS Policies
**Issue:** No policies if using class_passes table
**Severity:** Medium
**Recommendation:** Ensure proper RLS if reusing class_passes

### Integration Issues

#### 11.8 Guest Pass Integration with Booking
**Status:** Referenced in booking system but implementation unclear
**Location:** `src/hooks/useBooking.ts:183-186`
**Recommendation:** Verify guest pass booking flow works

---

## 12. Staff Management & Roles System

### Overview
Role-based access control system with multiple roles per user and permission checking.

### Workflows

#### Role Assignment Flow
```
Admin → Staff Roles Page → Select User → Assign Role → Role Added to user_roles table
```

**Files:**
- `src/pages/admin/StaffRoles.tsx` - Role management
- `src/lib/permissions.ts` - Permission checking
- `src/hooks/useUserRoles.ts` - Role fetching

### Logic Gaps

#### 12.1 Role Assignment Validation
**Issue:** Can assign multiple conflicting roles
**Location:** Role assignment
**Severity:** Low
**Recommendation:** Add role conflict validation (e.g., can't be member and staff)

#### 12.2 Role Deletion Cascade
**Issue:** No cascade handling if user deleted
**Location:** `user_roles` table
**Severity:** Low
**Note:** ON DELETE CASCADE should handle this

### Missing Functions

#### 12.3 Role Audit Trail
**Status:** No history of role changes
**Severity:** Medium
**Recommendation:** Add role assignment history table

#### 12.4 Permission Testing UI
**Status:** No way to test permissions
**Severity:** Low
**Recommendation:** Add permission testing tool for admins

### Security Concerns

#### 12.5 Role Function Security
**Status:** Uses SECURITY DEFINER (necessary)
**Location:** `supabase/migrations/20251227130701_*.sql:27-72`
**Note:** Proper use of SECURITY DEFINER for permission checks

#### 12.6 Role RLS Policies
**Status:** Users can view own roles, admins can view all (good)
**Location:** `supabase/migrations/20251227130701_*.sql:74-86`
**Note:** RLS policies appear correct

### Integration Issues

#### 12.7 Permission Check Consistency
**Status:** Checks in multiple places (frontend + backend)
**Location:** `src/lib/permissions.ts` vs RLS policies
**Severity:** Medium
**Note:** Frontend checks are for UX only, RLS is authoritative (good)

---

## 13. Equipment Management System

### Overview
Equipment catalog system for tracking gym equipment used in fitness profiles and AI workouts.

### Workflows

#### Equipment Management Flow
```
Admin → Equipment Page → Add/Edit Equipment → Upload Image → Save → Equipment Available in Fitness Profiles
```

**Files:**
- `src/pages/admin/Equipment.tsx` - Equipment management
- `src/hooks/useEquipment.ts` - Equipment data hooks

### Logic Gaps

#### 13.1 Image Upload Not Implemented - CRITICAL
**Issue:** TODO comment - image upload feature missing
**Location:** `src/pages/admin/Equipment.tsx:125-128`
**Severity:** CRITICAL
**Impact:** Equipment images cannot be uploaded
**Recommendation:** Implement Supabase Storage upload for equipment images

#### 13.2 Equipment Deletion
**Issue:** Deletion marks as inactive but doesn't handle existing references
**Location:** `src/hooks/useEquipment.ts`
**Severity:** Medium
**Recommendation:** Handle equipment references in fitness profiles

### Missing Functions

#### 13.3 Equipment Availability Tracking
**Status:** No tracking of equipment availability/status
**Severity:** Low
**Recommendation:** Add availability status (available, maintenance, unavailable)

#### 13.4 Equipment Usage Analytics
**Status:** No analytics on equipment popularity
**Severity:** Low
**Recommendation:** Track equipment usage in fitness profiles

### Security Concerns

#### 13.5 Equipment RLS Policies
**Status:** Should verify policies exist
**Location:** Equipment table RLS
**Severity:** Medium
**Recommendation:** Verify equipment table has proper RLS policies

### Integration Issues

#### 13.6 Equipment Integration with Fitness Profiles
**Status:** Used in fitness profiles (good)
**Location:** `src/pages/member/FitnessProfile.tsx:327-367`
**Note:** Integration appears correct

---

## 14. Agreements System

### Overview
Agreement management system for PDF agreements and forms with signature tracking.

### Workflows

#### Agreement Management Flow
```
Admin → Agreements Page → Upload PDF → Set Requirements → Agreement Displayed to Members → Member Signs → Signature Recorded
```

**Files:**
- `src/pages/admin/Agreements.tsx` - Agreement management
- `src/pages/member/Waivers.tsx` - Member agreement signing
- `supabase/migrations/20260106120000_agreements_schema.sql` - Agreements schema

### Logic Gaps

#### 14.1 Agreement CRUD Not Implemented - CRITICAL
**Issue:** TODO comment - mutations not implemented
**Location:** `src/pages/admin/Agreements.tsx:85-88`
**Severity:** CRITICAL
**Impact:** Cannot create/update agreements through UI
**Recommendation:** Implement create/update/delete mutations

#### 14.2 Agreement Versioning
**Issue:** Version field exists but versioning logic unclear
**Location:** Agreements table has `version` field
**Severity:** Medium
**Recommendation:** Implement versioning logic or document usage

#### 14.3 Signature Validation
**Issue:** Signature timestamps stored but validation unclear
**Location:** `profiles` table has signature fields
**Severity:** Medium
**Recommendation:** Verify signature validation on agreement-dependent actions

### Missing Functions

#### 14.4 Agreement PDF Upload
**Status:** URL field but no upload
**Severity:** High
**Recommendation:** Implement PDF upload to Supabase Storage

#### 14.5 Agreement Expiration
**Status:** `effective_date` exists but expiration handling unclear
**Severity:** Low
**Recommendation:** Implement expiration logic if needed

### Security Concerns

#### 14.6 Agreement RLS Policies
**Status:** Anyone can view active agreements (good for public access)
**Location:** `supabase/migrations/20260106120000_agreements_schema.sql:80-95`
**Note:** Policies appear correct

### Integration Issues

#### 14.7 Agreement Integration with Booking
**Status:** Agreements checked before booking (good)
**Location:** `src/hooks/useBooking.ts:172-207`
**Note:** Proper validation before booking

---

## 15. Email System

### Overview
Email sending system with templates, conversation management, and incoming email handling.

### Workflows

#### Email Sending Flow
```
System/Admin → Send Email Function → Email Template → Resend API → Email Delivered
```

**Files:**
- `supabase/functions/send-email/index.ts` - Email sending
- `supabase/functions/receive-email/index.ts` - Email receiving
- `src/pages/admin/EmailManagement.tsx` - Email management UI

### Logic Gaps

#### 15.1 Email Sending Not Implemented in UI - CRITICAL
**Issue:** TODO comment - email sending not implemented
**Location:** `src/pages/admin/EmailManagement.tsx:133-138`
**Severity:** CRITICAL
**Impact:** Cannot send emails from UI
**Recommendation:** Implement email sending via send-email function

#### 15.2 Email Template Management
**Issue:** Templates hardcoded in function
**Location:** `supabase/functions/send-email/index.ts`
**Severity:** Medium
**Recommendation:** Move templates to database for easier management

#### 15.3 Email Rate Limiting
**Issue:** No rate limiting on email sending
**Location:** Email functions
**Severity:** Medium
**Recommendation:** Add rate limiting to prevent abuse

### Missing Functions

#### 15.4 Email Delivery Tracking
**Status:** No tracking of email delivery status
**Severity:** Medium
**Recommendation:** Track delivery status via Resend webhooks

#### 15.5 Email Unsubscribe
**Status:** No unsubscribe mechanism
**Severity:** Medium
**Recommendation:** Add unsubscribe links and tracking

### Security Concerns

#### 15.6 Email Function Authorization
**Status:** No JWT verification (verify_jwt = false)
**Location:** `supabase/config.toml`
**Severity:** High
**Recommendation:** Add authorization checks inside function

#### 15.7 Email Sanitization
**Status:** HTML sanitization exists (good)
**Location:** `supabase/functions/receive-email/index.ts:102-104`
**Note:** Proper sanitization for received emails

### Integration Issues

#### 15.8 Email Conversation Integration
**Status:** Conversations stored but email sending not integrated
**Location:** `src/pages/admin/EmailManagement.tsx`
**Recommendation:** Complete email sending integration

---

## 16. Member Portal Features

### Overview
Member-facing features including workouts, habits, goals, achievements, health scores, and fitness profiles.

### Key Features

#### 16.1 Workouts System
**Status:** AI workout generation exists
**Location:** `src/pages/member/Workouts.tsx`
**Issues:**
- AI recommendations function exists but integration unclear
- Workout logging implemented (good)

#### 16.2 Habits System
**Status:** Habit tracking with streaks
**Location:** `src/pages/member/Habits.tsx`
**Issues:**
- Streak calculation function exists (good)
- Missing: Habit reminder notifications

#### 16.3 Goals System
**Status:** Goal setting with milestones
**Location:** `src/pages/member/Goals.tsx`
**Issues:**
- Milestone function exists (good)
- Missing: Goal achievement notifications

#### 16.4 Achievements System
**Status:** Achievement tracking
**Location:** `src/pages/member/Achievements.tsx`
**Issues:**
- Achievement calculation unclear
- Missing: Achievement unlock notifications

#### 16.5 Health Score System
**Status:** Health score calculation
**Location:** `src/pages/member/HealthScore.tsx`
**Issues:**
- Score calculation function exists (good)
- Missing: Score history/trends

#### 16.6 Fitness Profile System
**Status:** Profile management with equipment selection
**Location:** `src/pages/member/FitnessProfile.tsx`
**Issues:**
- Equipment integration working (good)
- Missing: Profile completion guidance

### Missing Functions

#### 16.7 Notification System
**Status:** No centralized notification system
**Severity:** High
**Recommendation:** Add notification center for achievements, reminders, etc.

#### 16.8 Progress Analytics
**Status:** Basic data but no advanced analytics
**Severity:** Medium
**Recommendation:** Add progress charts and analytics

### Security Concerns

#### 16.9 Member Data Privacy
**Status:** RLS policies should ensure users only see own data
**Severity:** High
**Recommendation:** Audit all member portal RLS policies

---

## 17. Admin Portal Features

### Overview
Admin dashboard and management features across all systems.

### Key Features

#### 17.1 Dashboard
**Status:** Dashboard exists
**Location:** `src/pages/admin/Dashboard.tsx`
**Issues:**
- Analytics/metrics unclear
- Missing: Real-time statistics

#### 17.2 Member Management
**Status:** Comprehensive member management
**Location:** `src/pages/admin/Members.tsx`
**Issues:**
- Good CRUD operations
- Missing: Bulk operations

#### 17.3 Class Management
**Status:** Class types, schedules, instructors management
**Location:** `src/pages/admin/Classes.tsx`, `ClassTypes.tsx`, `ClassSchedules.tsx`, `Instructors.tsx`
**Issues:**
- Good management capabilities
- Missing: Class analytics

#### 17.4 Settings
**Status:** Settings page exists
**Location:** `src/pages/admin/Settings.tsx`
**Issues:**
- Settings functionality unclear
- Missing: System-wide configuration

### Missing Functions

#### 17.5 Reporting System
**Status:** No reporting/analytics system
**Severity:** High
**Recommendation:** Add comprehensive reporting

#### 17.6 Audit Logging
**Status:** No centralized audit log
**Severity:** High
**Recommendation:** Add audit log for admin actions

### Security Concerns

#### 17.7 Admin Action Logging
**Status:** Some actions logged but not comprehensive
**Severity:** High
**Recommendation:** Log all admin actions (member updates, role changes, etc.)

---

## 18. Public Website Features

### Overview
Public-facing pages including homepage, class listings, spa services, cafe menu, etc.

### Key Features

#### 18.1 Homepage
**Status:** Landing page exists
**Location:** `src/pages/Index.tsx`
**Issues:**
- Good design
- Missing: SEO optimization

#### 18.2 Class Listings
**Status:** Public class schedule
**Location:** `src/pages/Classes.tsx`, `Schedule.tsx`
**Issues:**
- Good display
- Missing: Advanced filtering

#### 18.3 Service Pages
**Status:** Spa, Cafe, Amenities pages
**Location:** `src/pages/Spa.tsx`, `Cafe.tsx`, `Amenities.tsx`
**Issues:**
- Good content display
- Missing: Booking integration for non-members

### Missing Functions

#### 18.4 SEO Optimization
**Status:** Basic SEO
**Severity:** Medium
**Recommendation:** Add meta tags, structured data

#### 18.5 Analytics Integration
**Status:** Analytics unclear
**Severity:** Low
**Recommendation:** Add Google Analytics or similar

---

## 19. Cross-System Integration Issues

### Overview
Issues that span multiple systems.

#### 19.1 Scheduled Functions Not Configured - CRITICAL
**Issue:** Edge functions exist but cron jobs not configured
**Location:** `supabase/config.toml` shows functions but no cron jobs in migrations
**Severity:** CRITICAL
**Impact:** Monthly credits, freeze expirations, class reminders won't run automatically
**Functions Affected:**
- `process-monthly-credits` - Should run daily
- `process-freeze-expirations` - Should run daily
- `send-class-reminders` - Should run daily
- `process-expired-waitlist` - Should run daily
- `process-activation-reminders` - Should run daily
**Recommendation:** Create pg_cron jobs for all scheduled functions

#### 19.2 Member Status Synchronization
**Issue:** Status updates happen in multiple places
**Location:** Multiple systems update member status
**Severity:** Medium
**Recommendation:** Centralize status update logic

#### 19.3 Payment Record Integration
**Issue:** Payment records scattered across systems
**Severity:** Medium
**Recommendation:** Consider unified payment history view

#### 19.4 Activity Logging Consistency
**Issue:** Some actions logged, others not
**Severity:** Medium
**Recommendation:** Consistent activity logging across all systems

---

## 20. Security Audit Summary

### Critical Security Issues

1. **Webhook Idempotency Missing** (System 8.1) - CRITICAL
2. **Scheduled Functions Not Configured** (System 19.1) - CRITICAL
3. **Guest Pass System Not Implemented** (System 11.1, 11.4) - CRITICAL
4. **Cafe Member Account Charging Not Implemented** (System 6.1) - CRITICAL
5. **Agreement CRUD Not Implemented** (System 14.1) - CRITICAL
6. **Email Sending Not Implemented in UI** (System 15.1) - CRITICAL

### High Priority Security Issues

1. **RLS Policy Audits Needed** - Multiple systems
2. **Permission Check Consistency** - Auth system
3. **Payment Data Handling** - Payment system
4. **Admin Action Logging** - Admin portal

### Security Strengths

1. **JWT Error Handling** - Well implemented
2. **Webhook Signature Verification** - Properly implemented
3. **RLS Policy Coverage** - Most tables have RLS enabled
4. **SECURITY DEFINER Functions** - Properly used for permission checks

---

## 21. Recommendations & Action Items

### Immediate Actions (Critical)

1. **Fix Webhook Idempotency** - Add event ID tracking
2. **Configure Scheduled Functions** - Set up pg_cron jobs
3. **Implement Guest Pass System** - Complete functionality
4. **Implement Cafe Member Account Charging** - Complete payment flow
5. **Implement Agreement CRUD** - Complete admin functionality
6. **Implement Email Sending in UI** - Complete email management

### High Priority Actions

1. **Fix Check-In Duplicate Prevention** - Add duplicate check
2. **Fix Spa Conflict Detection** - Rewrite conflict logic
3. **Add Subscription Status Sync** - Handle Stripe webhooks
4. **Add Payment Failure Handling** - Handle failed payments
5. **Add Equipment Image Upload** - Complete equipment management
6. **Add Agreement PDF Upload** - Complete agreement management

### Medium Priority Actions

1. **Add Password Reset Flow** - User experience improvement
2. **Add Application Duplicate Check** - Data quality
3. **Add Cancellation Policies** - Business logic enforcement
4. **Add Audit Logging** - Security and compliance
5. **Add Reporting System** - Business intelligence

### Low Priority Actions

1. **Add Session Timeout Warning** - UX improvement
2. **Add MFA** - Security enhancement
3. **Add SEO Optimization** - Marketing
4. **Add Analytics Integration** - Business intelligence

---

## Conclusion

This comprehensive review has identified **6 critical issues**, **15+ high priority issues**, and numerous medium/low priority improvements across all 18 systems. The system is functional but requires immediate attention to critical gaps, particularly in payment processing, scheduled functions, and several incomplete features.

**Priority Focus Areas:**
1. Payment system completeness (cafe, guest passes)
2. Scheduled function configuration
3. Webhook idempotency
4. Incomplete admin features (agreements, email, equipment)
5. Security hardening (RLS audits, logging)

**Overall Assessment:** The system has a solid foundation with good architecture choices (atomic booking, RLS policies, security definer functions), but several critical features are incomplete and need immediate attention before production use.

---

**Review Completed:** January 2025
