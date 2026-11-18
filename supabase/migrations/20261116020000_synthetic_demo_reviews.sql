alter table public.reviews
  add column if not exists review_source text not null default 'community',
  add column if not exists seed_author_name text,
  add column if not exists seed_batch_id uuid;

alter table public.reviews
  alter column user_id drop not null,
  alter column profanity drop not null,
  alter column substance_use drop not null;

alter table public.reviews
  drop constraint if exists reviews_review_source_check,
  drop constraint if exists reviews_source_identity_check;

alter table public.reviews
  add constraint reviews_review_source_check
    check (review_source in ('community', 'synthetic_demo')),
  add constraint reviews_source_identity_check
    check (
      (review_source = 'community' and user_id is not null and seed_author_name is null and seed_batch_id is null)
      or
      (review_source = 'synthetic_demo' and user_id is null and seed_author_name is not null and seed_batch_id is not null)
    );

create index if not exists reviews_seed_batch_idx
  on public.reviews (seed_batch_id)
  where seed_batch_id is not null;
