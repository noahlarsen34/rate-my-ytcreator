-- Step 1: preview every synthetic batch. This query is read-only.
select seed_batch_id, count(*) as synthetic_reviews
from public.reviews
where review_source = 'synthetic_demo'
group by seed_batch_id
order by seed_batch_id;

-- Step 2: after confirming the batch ID, uncomment and replace the value.
-- delete from public.reviews
-- where review_source = 'synthetic_demo'
--   and seed_batch_id = 'PASTE-BATCH-ID-HERE';
