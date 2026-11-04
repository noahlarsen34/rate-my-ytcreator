-- Run in the Supabase SQL Editor to require a signed-in account for review inserts.

alter table public.reviews
add column if not exists uses_ai text
check (uses_ai in ('Yes', 'No', 'Unsure'));

drop policy if exists "Anonymous visitors can create reviews" on public.reviews;
drop policy if exists "Authenticated users can create reviews" on public.reviews;

revoke insert on table public.reviews from anon;
revoke usage, select on sequence public.reviews_review_id_seq from anon;

grant insert on table public.reviews to authenticated;
grant usage, select on sequence public.reviews_review_id_seq to authenticated;

create policy "Authenticated users can create reviews"
on public.reviews
for insert
to authenticated
with check (auth.uid() = user_id);
