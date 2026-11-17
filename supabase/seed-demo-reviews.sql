-- Superseded by replace-demo-reviews.sql. Keep this file for migration history.
-- Run only after 20261116020000_synthetic_demo_reviews.sql.
-- This safely fills each creator to four total reviews. Running it again does
-- not add more reviews to creators that already have four or more.

begin;

create temporary table current_demo_seed_batch (batch_id uuid not null) on commit drop;
insert into current_demo_seed_batch values (gen_random_uuid());

with review_counts as (
  select cc.creator_id, count(r.review_id)::integer as existing_reviews
  from public.content_creators cc
  left join public.reviews r on r.creator_id = cc.creator_id
  group by cc.creator_id
),
eligible_creators as (
  select
    cc.creator_id,
    coalesce(nullif(trim(concat_ws(' ', cc.first_name, cc.last_name)), ''), 'This creator') as creator_name,
    coalesce(nullif(trim(ct.type_name), ''), 'YouTube content') as category_name,
    review_counts.existing_reviews,
    greatest(0, 4 - review_counts.existing_reviews) as reviews_needed
  from public.content_creators cc
  left join public.channel_types ct on ct.type_id = cc.type_id
  join review_counts on review_counts.creator_id = cc.creator_id
  where review_counts.existing_reviews < 4
),
generated_reviews as (
  select
    ec.*,
    generated.review_number,
    mod(ec.creator_id + generated.review_number, 6) as persona_number,
    mod(ec.creator_id + generated.review_number, 4) as rating_number
  from eligible_creators ec
  cross join lateral generate_series(1, ec.reviews_needed) as generated(review_number)
)
insert into public.reviews (
  user_id,
  creator_id,
  overall_rating,
  profanity,
  substance_use,
  age_level,
  review_text,
  bias_text,
  uses_ai,
  review_source,
  seed_author_name,
  seed_batch_id,
  created_at
)
select
  null,
  generated_reviews.creator_id,
  case generated_reviews.rating_number
    when 0 then 3.5
    when 1 then 4.0
    when 2 then 4.0
    else 4.5
  end,
  null,
  null,
  case
    when lower(generated_reviews.category_name) similar to '%(kids|family|children)%' then 'All ages'
    when lower(generated_reviews.category_name) similar to '%(education|science|diy|learning)%' then '8+'
    else '13+'
  end,
  case mod(generated_reviews.review_number + generated_reviews.creator_id, 4)
    when 0 then generated_reviews.creator_name || ' is listed in the ' || generated_reviews.category_name || ' category. Viewers interested in this topic may want to sample a few recent uploads to see whether the channel fits their preferences.'
    when 1 then 'Based on the available channel profile, ' || generated_reviews.creator_name || ' focuses on ' || generated_reviews.category_name || ' content. The individual style and suitability may vary between uploads, so recent videos are the best guide.'
    when 2 then 'This demonstration review highlights ' || generated_reviews.creator_name || ' for viewers exploring ' || generated_reviews.category_name || ' creators. The available profile provides a useful starting point, while community feedback can add more detail over time.'
    else 'Viewers looking for ' || generated_reviews.category_name || ' content may consider exploring ' || generated_reviews.creator_name || '. Sampling recent uploads is recommended because the available profile does not establish details for every video.'
  end,
  '',
  'Unsure',
  'synthetic_demo',
  case generated_reviews.persona_number
    when 0 then 'Demo Family Viewer'
    when 1 then 'Demo Casual Viewer'
    when 2 then 'Demo Topic Explorer'
    when 3 then 'Demo New Subscriber'
    when 4 then 'Demo Parent Reviewer'
    else 'Demo Community Member'
  end,
  current_demo_seed_batch.batch_id,
  now() - ((generated_reviews.review_number + mod(generated_reviews.creator_id, 5)) * interval '1 day')
from generated_reviews
cross join current_demo_seed_batch;

select
  current_demo_seed_batch.batch_id as seed_batch_id,
  count(public.reviews.review_id) as reviews_created
from current_demo_seed_batch
left join public.reviews on public.reviews.seed_batch_id = current_demo_seed_batch.batch_id
group by current_demo_seed_batch.batch_id;

commit;

-- Cleanup preview:
-- select seed_batch_id, count(*) from public.reviews
-- where review_source = 'synthetic_demo' group by seed_batch_id order by seed_batch_id;
--
-- Delete one batch after reviewing the preview:
-- delete from public.reviews where seed_batch_id = 'PASTE-BATCH-ID-HERE';
