I checked the current project file for **Admin → Freeze Requests**. The template code is present in the project, but your screenshot shows the table view before the reject dialog is opened. The scenario/template fields only appear after clicking a red **Reject** button.

That said, because you are not seeing the expected update on the live site, I will treat this as a release/visibility issue and make the change harder to miss.

Plan:

1. **Verify the route and modal behavior**
   - Confirm the live `/admin/freeze-requests` page is using the current built version.
   - Check whether clicking **Reject** opens the newer rejection dialog or an older/simple dialog.
   - If the backend/function deployment is stale, redeploy the email-related backend function as needed.

2. **Make the template visible immediately**
   - Update the reject flow so the dialog opens with a real template selected by default instead of blank custom mode.
   - For Brea-style cases, default to **Membership Not Yet Active** so the email template is visible right away.
   - Keep **Membership in Arrears** available for Mariam-style cases.

3. **Add an obvious confirmation label**
   - Add copy in the reject dialog that clearly says the email template applies only to the freeze rejection.
   - Keep the separate membership rescission/cancellation flow separate, as requested.

4. **Add a visible admin-page cue**
   - Add a small note near the table/actions explaining that rejection templates appear after clicking **Reject**.
   - This prevents the page from looking unchanged when you are still on the table view.

5. **Verify after implementation**
   - Build/check the app locally.
   - Inspect the live/published route after publish/deploy support is available.
   - Confirm the reject dialog shows: Scenario, Subject, Email Message, Send rejection email, and the firm arrears language including the May 9, 2026 collections deadline.

Technical details:

- Primary file: `src/pages/admin/FreezeRequests.tsx`
- Possible backend file if needed: the email-sending backend function used by freeze rejection emails
- No database changes are needed for this specific visibility/template issue.

Important: The separate good-standing logic that blocks ineligible members from requesting future freezes is still a separate planned backend/database guard and has not yet been implemented.