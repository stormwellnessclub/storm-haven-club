create or replace function public.admin_seasonal_hot_list()
returns table (user_id uuid, first_name text, last_name text, phone text, email text, is_member boolean,
  reason_key text, reason text, trainer text, priority int, contacted_at timestamptz, bought_at timestamptz)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.has_any_role(auth.uid(), array['super_admin','admin','manager']::app_role[]) then
    raise exception 'Admin or manager role required';
  end if;
  return query
  with bought as (
    select p.user_id from pt_passes p where p.pack_name ilike 'Black Friday%' and p.purchased_at >= '2026-11-14'
    union select c.user_id from class_passes c where c.seasonal_offer_key is not null
    union select g.purchaser_user_id from gift_cards g where g.created_at >= '2026-11-14' and g.purchaser_user_id is not null
  ),
  last_trainer as (
    select distinct on (a.user_id) a.user_id, nullif(trim(coalesce(i.first_name,'')||' '||coalesce(i.last_name,'')),'') tname
    from pt_appointments a join instructors i on i.id = a.instructor_id
    where a.user_id is not null order by a.user_id, a.starts_at desc
  ),
  pt_low as (
    select p.user_id, 1 pri, 'pt_low'::text rk,
      format('PT package: %s of %s sessions left, ends %s', sum(p.sessions_remaining), sum(p.sessions_total), to_char(max(p.expires_at),'Mon FMDD')) why
    from pt_passes p where p.status='active' group by p.user_id
    having sum(p.sessions_remaining) <= 8 or max(p.expires_at) <= current_date + 45
  ),
  pt_unpaid as (
    select a.user_id, 2, 'pt_unpaid', format('%s PT sessions at single price (no package) in last 60 days', count(*))
    from pt_appointments a
    where a.payment_status='unpaid' and a.starts_at > now() - interval '60 days' and a.status in ('completed','scheduled','late_cancel','no_show')
      and not exists (select 1 from pt_passes p where p.user_id=a.user_id and p.status='active' and p.sessions_remaining>0)
    group by a.user_id
  ),
  member_recent as (
    select m.user_id, 3, 'member_recent', format('Member, %s visits in last 30 days', count(ci.id))
    from members m join check_ins ci on ci.member_id=m.id and ci.checked_in_at > now() - interval '30 days'
    where m.status='active' and m.user_id is not null group by m.user_id
  ),
  spa_recent as (
    select s.user_id, 4, 'spa_recent', format('Massage/spa client, last visit %s', to_char(max(s.appointment_date),'Mon FMDD'))
    from spa_appointments s where s.status='completed' and s.appointment_date > current_date - 180 and s.user_id is not null group by s.user_id
  ),
  class_nm as (
    select b.user_id, 5, 'class_non_member', format('Non-member, %s classes in last 60 days', count(*))
    from class_bookings b where b.checked_in_at > now() - interval '60 days' and b.user_id is not null
      and not exists (select 1 from members m where m.user_id=b.user_id and m.status in ('active','frozen'))
    group by b.user_id
  ),
  allr as (select * from pt_low union all select * from pt_unpaid union all select * from member_recent union all select * from spa_recent union all select * from class_nm),
  best as (select distinct on (a.user_id) a.* from allr a where a.user_id not in (select b.user_id from bought b where b.user_id is not null) order by a.user_id, a.pri)
  select b.user_id, pr.first_name, pr.last_name, pr.phone, pr.email,
    exists (select 1 from members m where m.user_id=b.user_id and m.status in ('active','frozen')),
    b.rk, b.why, lt.tname, b.pri, om.contacted_at, om.bought_at
  from best b
  join profiles pr on pr.user_id=b.user_id
  left join last_trainer lt on lt.user_id=b.user_id
  left join marketing_outreach_marks om on om.user_id=b.user_id
  where pr.merged_into_user_id is null
  order by b.pri, pr.first_name;
end $$;