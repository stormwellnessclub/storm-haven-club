-- Phase 2C.5B3 fix: a PT client is not always a club member. Requiring a member
-- record on the dunning row silently dropped failed PT installments for
-- non-member training clients, so they never reached the Failed & Past Due
-- centre and could not be retried. PT rows carry pt_pass_id instead.
ALTER TABLE public.payment_dunning_state ALTER COLUMN member_id DROP NOT NULL;

ALTER TABLE public.payment_dunning_state
  ADD CONSTRAINT payment_dunning_state_owner_present
  CHECK (member_id IS NOT NULL OR pt_pass_id IS NOT NULL) NOT VALID;