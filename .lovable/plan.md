

# Add "Membership Management" Section to Admin Sidebar

## Problem
Freeze Requests, Member Credits, and other membership-related items are currently buried in the Finance section. There's no dedicated "Membership Management" group, making these hard to find.

## Plan

### File: `src/components/admin/AdminSidebar.tsx`

Reorganize the `departments` array to add a new **"Membership Management"** section and move the relevant items into it:

**New "Membership Management" section** (placed after Operations):
- Applications (moved from Operations)
- Member Credits (moved from Finance)
- Freeze Requests (moved from Finance)
- Agreements (moved from Administration)
- Roles: `super_admin`, `admin`, `manager`, `front_desk`

**Items removed from their current sections:**
- "Applications" removed from Operations
- "Member Credits" and "Freeze Requests" removed from Finance
- "Agreements" removed from Administration

No other files need to change — this is a sidebar reorganization only.

