REVOKE ALL ON public.gift_pass_claim_tokens FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.gift_pass_claim_tokens TO service_role;