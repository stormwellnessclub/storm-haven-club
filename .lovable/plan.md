

## Fix: Soft Launch Banner Visibility and Add "Send Hours Email" Button

### Problem 1: Banner disappears permanently after dismissal
Once a user clicks the X on the Soft Launch Hours banner, it sets `localStorage` and never shows again -- even on a new day. There's no way to bring it back.

### Problem 2: No admin UI to send the hours email
The `soft_launch_hours` email template exists in the backend but there's no button or interface to send it to members.

---

### Fix 1: Make Banner Dismissal Session-Based

Change the banner so it only stays hidden for the current browser session, not permanently. This way it reappears each time the member opens the app.

**File: `src/components/member/SoftLaunchHoursBanner.tsx`**

- Replace `localStorage` with `sessionStorage` so the dismissal resets when the browser is closed
- This ensures members see the hours reminder each time they visit during soft launch week

### Fix 2: Add "Send Hours Email" Button to Admin Dashboard

Add a quick action on the admin Dashboard (or Settings page) to send the soft launch hours email to all active members.

**File: `src/pages/admin/Dashboard.tsx`**

- Add a "Send Soft Launch Hours Email" button in the dashboard actions area
- On click, fetch all active members with emails and loop through sending the `soft_launch_hours` email via the `send-email` edge function
- Show a progress indicator and success/error toast
- Include a confirmation dialog before sending to prevent accidental mass emails

### Technical Details

**Banner fix** (SoftLaunchHoursBanner.tsx):
- Change `localStorage.getItem(STORAGE_KEY)` to `sessionStorage.getItem(STORAGE_KEY)`
- Change `localStorage.setItem(STORAGE_KEY, 'true')` to `sessionStorage.setItem(STORAGE_KEY, 'true')`

**Email send button** (Dashboard.tsx):
- Add a card or button in the dashboard quick actions section
- Query `members` table for `status = 'active'` with a valid email
- Loop and call `supabase.functions.invoke("send-email", { body: { type: "soft_launch_hours", to: email, data: { name } } })`
- Show progress (X of Y sent) and final toast with results
- Disable button while sending to prevent double-sends

