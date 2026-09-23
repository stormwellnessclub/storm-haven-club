-- Phase 2C.6B: read-only reporting view over existing PT money records.
-- Creates NO new ledger and copies no rows; it only normalises what already exists.
create or replace view public.pt_cash_transactions
with (security_invoker = true) as
select
  'payment:' || p.id::text                        as transaction_key,
  p.id                                            as source_id,
  'pt_payments'::text                             as source_table,
  p.user_id                                       as user_id,
  p.paid_at                                       as occurred_at,
  'collected'::text                               as direction,
  p.amount_cents                                  as amount_cents,
  p.method                                        as method,
  p.payment_type                                  as payment_type,
  p.status                                        as status,
  coalesce(i.pass_id, inv.pass_id)                as pass_id,
  p.invoice_id                                    as invoice_id,
  i.id                                            as installment_id,
  p.stripe_payment_intent_id                      as stripe_payment_intent_id
from public.pt_payments p
left join public.pt_payment_plan_installments i
       on i.stripe_payment_intent_id is not null
      and i.stripe_payment_intent_id = p.stripe_payment_intent_id
left join public.pt_invoices inv
       on inv.id = p.invoice_id
where p.status = 'succeeded'
  and p.amount_cents > 0
  and coalesce(p.payment_type, '') not in ('waived', 'package_credit', 'credit')
union all
select
  'refund:' || r.id::text,
  r.id,
  'pt_refunds'::text,
  r.user_id,
  r.refunded_at,
  'refunded'::text,
  -r.amount_cents,
  r.method,
  'refund'::text,
  'succeeded'::text,
  r.pass_id,
  r.invoice_id,
  null::uuid,
  null::text
from public.pt_refunds r;

comment on view public.pt_cash_transactions is
  'Phase 2C.6B: normalised read-only view of successfully collected PT money and refunds. Integration point for club-wide financial reporting. Creates no new records; security_invoker keeps existing RLS on pt_payments/pt_refunds in force.';

grant select on public.pt_cash_transactions to authenticated;
grant select on public.pt_cash_transactions to service_role;