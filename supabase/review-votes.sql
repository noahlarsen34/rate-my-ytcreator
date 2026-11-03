-- Run after creating public.review_votes.
-- review_id is bigint (int8), matching public.reviews.review_id.

begin;

alter table public.review_votes enable row level security;

revoke all on table public.review_votes from anon;
grant select, insert, update, delete on table public.review_votes to authenticated;

drop policy if exists "Users can read their own review votes" on public.review_votes;
create policy "Users can read their own review votes"
on public.review_votes for select to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "Users can create their own review votes" on public.review_votes;
create policy "Users can create their own review votes"
on public.review_votes for insert to authenticated
with check ((select auth.uid()) = user_id);

drop policy if exists "Users can update their own review votes" on public.review_votes;
create policy "Users can update their own review votes"
on public.review_votes for update to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

drop policy if exists "Users can delete their own review votes" on public.review_votes;
create policy "Users can delete their own review votes"
on public.review_votes for delete to authenticated
using ((select auth.uid()) = user_id);

create or replace function public.get_review_vote_counts(p_review_ids bigint[])
returns table (review_id bigint, upvotes bigint, downvotes bigint)
language sql
stable
security definer
set search_path = ''
as $$
  select
    rv.review_id,
    count(*) filter (where rv.vote = 1) as upvotes,
    count(*) filter (where rv.vote = -1) as downvotes
  from public.review_votes as rv
  where rv.review_id = any(p_review_ids)
  group by rv.review_id;
$$;

revoke all on function public.get_review_vote_counts(bigint[]) from public;
grant execute on function public.get_review_vote_counts(bigint[]) to anon, authenticated;

commit;
