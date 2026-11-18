create or replace function public.search_people(p_query text)
returns table (user_id uuid, username text, avatar_url text)
language sql
stable
security definer
set search_path = ''
as $$
  select u.user_id, u.username, u.avatar_url
  from public.users as u
  where auth.uid() is not null
    and u.user_id <> auth.uid()
    and u.people_searchable
  order by lower(coalesce(u.username, ''));
$$;
