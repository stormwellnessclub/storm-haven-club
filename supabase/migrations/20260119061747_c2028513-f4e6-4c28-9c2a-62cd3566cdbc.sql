-- Update membership agreement to use public path
UPDATE public.agreements 
SET pdf_url = '/agreements/membership-agreement.pdf' 
WHERE agreement_type = 'membership_agreement';