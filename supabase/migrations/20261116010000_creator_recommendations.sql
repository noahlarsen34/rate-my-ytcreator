create table if not exists public.creator_views (
  user_id uuid not null references auth.users(id) on delete cascade,
  creator_id bigint not null references public.content_creators(creator_id) on delete cascade,
  view_count integer not null default 1 check (view_count > 0),
  last_viewed_at timestamptz not null default now(),
  primary key (user_id, creator_id)
);

create index if not exists creator_views_user_recent_idx
  on public.creator_views (user_id, last_viewed_at desc);

alter table public.creator_views enable row level security;

drop policy if exists "Users can read their own creator views" on public.creator_views;
create policy "Users can read their own creator views"
  on public.creator_views for select to authenticated
  using (auth.uid() = user_id);

create or replace function public.record_creator_view(p_creator_id bigint)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then return; end if;
  if not exists (select 1 from public.content_creators where creator_id = p_creator_id) then return; end if;

  insert into public.creator_views (user_id, creator_id)
    values (v_user_id, p_creator_id)
  on conflict (user_id, creator_id) do update
    set view_count = case
          when public.creator_views.last_viewed_at < now() - interval '12 hours'
            then public.creator_views.view_count + 1
          else public.creator_views.view_count
        end,
        last_viewed_at = now();
end;
$$;

create or replace function public.get_creator_recommendations(p_limit integer default 6)
returns table (creator_id bigint, recommendation_score numeric, reason text)
language sql
stable
security definer
set search_path = ''
as $$
  with category_signals as (
    select cc.type_id, sum(least(cv.view_count, 5))::numeric as weight
    from public.creator_views cv
    join public.content_creators cc on cc.creator_id = cv.creator_id
    where cv.user_id = auth.uid()
    group by cc.type_id

    union all

    select cc.type_id, sum(r.overall_rating * 2)::numeric
    from public.reviews r
    join public.content_creators cc on cc.creator_id = r.creator_id
    where r.user_id = auth.uid() and r.overall_rating >= 3.5
    group by cc.type_id

    union all

    select cc.type_id, count(*)::numeric * 8
    from public.creator_follows cf
    join public.content_creators cc on cc.creator_id = cf.creator_id
    where cf.user_id = auth.uid()
    group by cc.type_id
  ),
  category_preferences as (
    select type_id, sum(weight) as weight
    from category_signals
    group by type_id
  ),
  review_scores as (
    select creator_id, avg(overall_rating)::numeric as average_rating
    from public.reviews
    group by creator_id
  ),
  follow_scores as (
    select creator_id, count(*)::numeric as followers
    from public.creator_follows
    group by creator_id
  ),
  candidates as (
    select
      cc.creator_id,
      coalesce(cp.weight, 0) * 10
        + coalesce(rs.average_rating, 0)
        + least(coalesce(fs.followers, 0), 20) * 0.1 as score,
      case
        when cp.weight is not null then 'Because you viewed or liked ' || coalesce(ct.type_name, 'similar') || ' creators'
        else 'Popular with the Rate My Creator community'
      end as recommendation_reason
    from public.content_creators cc
    left join category_preferences cp on cp.type_id = cc.type_id
    left join public.channel_types ct on ct.type_id = cc.type_id
    left join review_scores rs on rs.creator_id = cc.creator_id
    left join follow_scores fs on fs.creator_id = cc.creator_id
    where auth.uid() is not null
      and not exists (select 1 from public.creator_views cv where cv.user_id = auth.uid() and cv.creator_id = cc.creator_id)
      and not exists (select 1 from public.reviews r where r.user_id = auth.uid() and r.creator_id = cc.creator_id)
      and not exists (select 1 from public.creator_follows cf where cf.user_id = auth.uid() and cf.creator_id = cc.creator_id)
  )
  select candidates.creator_id, candidates.score, candidates.recommendation_reason
  from candidates
  order by candidates.score desc, candidates.creator_id
  limit greatest(1, least(coalesce(p_limit, 6), 20));
$$;

revoke all on function public.record_creator_view(bigint) from public;
revoke all on function public.get_creator_recommendations(integer) from public;
grant execute on function public.record_creator_view(bigint) to authenticated;
grant execute on function public.get_creator_recommendations(integer) to authenticated;
