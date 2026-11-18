do $$
begin
  if exists (
    select 1
    from public.reports
    where status in ('active', 'open') and creator_id is not null
    group by user_id, creator_id
    having count(*) > 1
  ) then
    raise exception 'Duplicate open creator reports exist; resolve them before applying this migration.';
  end if;

  if exists (
    select 1
    from public.reports
    where status in ('active', 'open') and review_id is not null
    group by user_id, review_id
    having count(*) > 1
  ) then
    raise exception 'Duplicate open review reports exist; resolve them before applying this migration.';
  end if;
end;
$$;

update public.reports
set status = 'open'
where status = 'active';

alter table public.reports
  alter column status set default 'open';

drop index if exists public.reports_one_active_creator_per_user_idx;
drop index if exists public.reports_one_active_review_per_user_idx;

create unique index reports_one_open_creator_per_user_idx
  on public.reports (user_id, creator_id)
  where status = 'open' and creator_id is not null;

create unique index reports_one_open_review_per_user_idx
  on public.reports (user_id, review_id)
  where status = 'open' and review_id is not null;

drop function if exists public.get_my_active_report_status(bigint);

create or replace function public.get_my_open_report_status(p_creator_id bigint)
returns table (creator_reported boolean, review_ids bigint[])
language sql
stable
security definer
set search_path = ''
as $$
  select
    exists (
      select 1
      from public.reports as r
      where r.user_id = auth.uid()
        and r.status = 'open'
        and r.creator_id = p_creator_id
    ) as creator_reported,
    coalesce((
      select array_agg(distinct r.review_id)
      from public.reports as r
      join public.reviews as review on review.review_id = r.review_id
      where r.user_id = auth.uid()
        and r.status = 'open'
        and review.creator_id = p_creator_id
    ), '{}'::bigint[]) as review_ids
  where auth.uid() is not null;
$$;

revoke all on function public.get_my_open_report_status(bigint) from public, anon;
grant execute on function public.get_my_open_report_status(bigint) to authenticated;
