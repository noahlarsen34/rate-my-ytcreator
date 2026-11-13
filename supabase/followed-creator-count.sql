-- Expose only the aggregate count used by the public home page metric.
create or replace function public.get_followed_creator_count()
returns bigint
language sql
stable
security definer
set search_path = public
as $$
  select count(distinct (user_id, creator_id))
  from public.creator_follows;
$$;

revoke all on function public.get_followed_creator_count() from public;
grant execute on function public.get_followed_creator_count() to anon, authenticated;
