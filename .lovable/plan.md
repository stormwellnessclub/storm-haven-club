

## Remove Temp Class Schedule from Website & Member Portal

### Changes

#### 1. Website Navigation (`src/components/Navigation.tsx`)
- Remove `{ href: "/schedule", label: "Class Schedule" }` from `navLinks` array (line 11)

#### 2. Website Router (`src/App.tsx`)
- Remove the `/schedule` route (line 142) and its import

#### 3. Member Portal Sidebar (`src/components/member/MemberSidebar.tsx`)
- Remove `{ title: "Book Classes", url: "/member/schedule", icon: CalendarPlus }` from `mainItems` (line 64)

#### 4. Member Bottom Nav (`src/components/member/MemberBottomNav.tsx`)
- Remove `{ label: "Book", icon: CalendarPlus, path: "/member/schedule" }` from `tabs` (line 8)

#### 5. Portal (Non-Member) Sidebar (`src/components/portal/PortalSidebar.tsx`)
- Remove `{ title: "Book Classes", url: "/schedule", icon: CalendarPlus }` from `portalMenuItems` (line 43)

#### 6. Schedule Banner (`src/components/ClassScheduleBanner.tsx`)
- Delete this file — it links to `/schedule` and is no longer needed

#### 7. Member Schedule Page (`src/pages/member/Schedule.tsx`)
- Delete this file and remove its route from the member routes

#### 8. Public Schedule Page (`src/pages/Schedule.tsx`)
- Delete this file

### Not Touched
- Admin soft-launch management (still uses TempClassSchedule internally for admin)
- The `TempClassSchedule` component itself stays (used by admin)
- Email templates and SEO prerender links to `/schedule` — these can be updated separately if needed

