alter table public.reviews
  alter column overall_rating type numeric(2, 1)
  using overall_rating::numeric(2, 1);
