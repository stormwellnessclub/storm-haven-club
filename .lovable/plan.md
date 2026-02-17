

## Move Support Link Higher in Member Sidebar

Move the "Support" menu item from the bottom of the 15-item "My Account" section to a more prominent position, right after "My Bookings" (position 8), so mobile users can reach it without scrolling.

### Change

**File: `src/components/member/MemberSidebar.tsx`**

Reorder the `memberMenuItems` array to place the Support item (`{ title: "Support", url: "/member/support", icon: MessageCircle }`) after "My Bookings" (index 7), moving it from position 15 to position 8.

New order:
1. Dashboard
2. Member Entry
3. My Profile
4. My Credits
5. My Membership
6. Payment Methods
7. Payment History
8. My Bookings
9. **Support** (moved up from #15)
10. Book Classes
11. Buy Passes
12. Wellness Booking
13. Freeze Request
14. Register Guest
15. Waivers

