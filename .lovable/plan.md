

# Fix: Delete old cancelled record and update approval logic

## Steps

### 1. Delete Batul Bazzi's old cancelled member record
Use a data operation to remove the cancelled record (`id: 41c65b17-1fa0-4d5f-89c9-98b00580ec9d`, STM-000029).

### 2. Update approval logic in `src/pages/admin/Applications.tsx`
Change the existing-member check so that `cancelled` members don't block new applications:
- If an existing member is found with status `cancelled`, delete or ignore that old record and proceed with creating a new one
- Only skip creation if the existing member is `active` or `pending_activation`

This way the problem won't recur for any future re-applicants.

### Files changed
- `src/pages/admin/Applications.tsx` (approval logic update)
- One data operation (delete old record)

