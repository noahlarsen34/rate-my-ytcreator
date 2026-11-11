alter table public.users
  add column if not exists reviews_public boolean not null default true,
  add column if not exists following_public boolean not null default false;

create or replace function public.get_public_review_authors(p_user_ids uuid[])
returns table (user_id uuid, username text, avatar_url text)
language sql
stable
security definer
set search_path = ''
as $$
  select u.user_id, u.username, u.avatar_url
  from public.users as u
  where u.user_id = any(coalesce(p_user_ids, '{}'::uuid[]));
$$;

create or replace function public.get_public_user_profile(p_user_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'user_id', u.user_id,
    'username', u.username,
    'avatar_url', u.avatar_url,
    'reviews_public', u.reviews_public,
    'following_public', u.following_public,
    'reviews', case when u.reviews_public then coalesce((
      select jsonb_agg(jsonb_build_object(
        'review_id', r.review_id,
        'creator_id', r.creator_id,
        'creator_name', coalesce(nullif(trim(concat_ws(' ', cc.first_name, cc.last_name)), ''), 'YouTube creator'),
        'overall_rating', r.overall_rating,
        'review_text', r.review_text,
        'created_at', r.created_at
      ) order by r.created_at desc)
      from public.reviews as r
      left join public.content_creators as cc on cc.creator_id = r.creator_id
      where r.user_id = u.user_id
    ), '[]'::jsonb) else '[]'::jsonb end,
    'following', case when u.following_public then coalesce((
      select jsonb_agg(jsonb_build_object(
        'creator_id', cc.creator_id,
        'creator_name', coalesce(nullif(trim(concat_ws(' ', cc.first_name, cc.last_name)), ''), 'YouTube creator'),
        'channel_link', cc.channel_link
      ) order by cc.first_name, cc.last_name)
      from public.creator_follows as cf
      join public.content_creators as cc on cc.creator_id = cf.creator_id
      where cf.user_id = u.user_id
    ), '[]'::jsonb) else '[]'::jsonb end
  )
  from public.users as u
  where u.user_id = p_user_id;
$$;

revoke all on function public.get_public_review_authors(uuid[]) from public;
revoke all on function public.get_public_user_profile(uuid) from public;
grant execute on function public.get_public_review_authors(uuid[]) to anon, authenticated;
grant execute on function public.get_public_user_profile(uuid) to anon, authenticated;
