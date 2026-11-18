-- Read-only preview. This does not insert or change any data.
with review_counts as (
  select cc.creator_id, count(r.review_id)::integer as existing_reviews
  from public.content_creators cc
  left join public.reviews r on r.creator_id = cc.creator_id
  group by cc.creator_id
)
select
  count(*) filter (where existing_reviews < 4) as creators_to_seed,
  coalesce(sum(greatest(0, 4 - existing_reviews)), 0) as reviews_to_create,
  count(*) filter (where existing_reviews >= 4) as creators_already_populated
from review_counts;
