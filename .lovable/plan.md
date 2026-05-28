# Fix: "Resolve" on failed payments does nothing

## Root cause

`payment_attempts` has **only SELECT policies** — no UPDATE policy exists for any role.

When an admin clicks **Resolve**, the frontend runs:
```ts
UPDATE payment_attempts SET resolved_at = now(), resolved_by = ..., resolution_note = ... WHERE id = ...
```

With RLS enabled and no matching UPDATE policy, PostgREST returns HTTP 200 but **0 rows are actually updated**. No error is thrown, the toast says "Marked as resolved", queries are invalidated — but the row reloads with `resolved_at = NULL`, so it stays in the **Open** tab and never appears in **Resolved**.

This affects every resolve action on this table:
- Per-member Confirmed Payment Issues → Mark resolved / Unresolve (`useMemberConfirmedIssues.ts`)
- Admin → Failed Payments History → single Resolve + bulk Auto-resolve (`FailedPaymentsHistory.tsx`)

## Fix

Single migration adding an UPDATE policy scoped to staff roles already used elsewhere in the project (`super_admin`, `admin`, `manager`, `front_desk`):

```sql
CREATE POLICY "Staff can update payment attempts"
ON public.payment_attempts
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_roles.user_id = auth.uid()
      AND user_roles.role = ANY (ARRAY['super_admin','admin','manager','front_desk']::app_role[])
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_roles.user_id = auth.uid()
      AND user_roles.role = ANY (ARRAY['super_admin','admin','manager','front_desk']::app_role[])
  )
);
```

(Mirrors the existing "Staff can view all payment attempts" SELECT policy so the same staff who can see issues can resolve them.)

## Verification

1. Open a member with a failed payment → click **Mark resolved** → enter a note → confirm.
2. Row disappears from **Open** tab and appears in **Resolved · N** tab with timestamp + resolver email.
3. Click **Unresolve** → row returns to **Open**.
4. Admin → Failed Payments → Auto-resolve bulk action moves classified rows out of **Unresolved**.

## Out of scope

- No frontend changes required — existing mutations already write the correct columns.
- No edge-function changes.
- No changes to the front-desk role's scope beyond what they can already see today.
