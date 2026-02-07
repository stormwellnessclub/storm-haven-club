

# Fix Remaining Agreement Filenames

## Database Update

Normalize the 3 remaining agreement types to use simple filenames matching the `pdfMap` keys:

| Agreement Type | Current `pdf_url` | New `pdf_url` |
|----------------|-------------------|---------------|
| kids_care | `/assets/agreements/kids-care-agreement.pdf` | `kids-care-agreement.pdf` |
| membership_agreement | `/assets/agreements/membership-agreement.pdf` | `membership-agreement.pdf` |
| private_event | `/assets/agreements/private-event-agreement.pdf` | `private-event-agreement.pdf` |

## SQL to Execute

```sql
UPDATE public.agreements 
SET pdf_url = 'kids-care-agreement.pdf'
WHERE agreement_type = 'kids_care';

UPDATE public.agreements 
SET pdf_url = 'membership-agreement.pdf'
WHERE agreement_type = 'membership_agreement';

UPDATE public.agreements 
SET pdf_url = 'private-event-agreement.pdf'
WHERE agreement_type = 'private_event';
```

## Result

All 6 agreement types will use simple filenames that directly match the bundled asset keys in `AgreementPDFViewer`, ensuring PDFs load reliably across all environments.

