-- Run once in the Supabase SQL Editor after the initial schema script.

alter table public.reviews
add column if not exists uses_ai text
check (uses_ai in ('Yes', 'No', 'Unsure'));

grant insert on table public.reviews to anon;
grant usage, select on sequence public.reviews_review_id_seq to anon;

drop policy if exists "Anonymous visitors can create reviews" on public.reviews;

create policy "Anonymous visitors can create reviews"
on public.reviews
for insert
to anon
with check (user_id is null);
