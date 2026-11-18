-- Replaces only synthetic demo reviews. Genuine community reviews are preserved.
-- Each creator is filled to five total reviews, counting genuine reviews first.
-- Run this entire file once in the Supabase SQL Editor.

begin;

delete from public.reviews
where review_source = 'synthetic_demo';

create temporary table replacement_demo_batch (
  batch_id uuid not null
) on commit drop;

insert into replacement_demo_batch values (gen_random_uuid());

with community_counts as (
  select
    cc.creator_id,
    count(r.review_id)::integer as genuine_reviews
  from public.content_creators cc
  left join public.reviews r
    on r.creator_id = cc.creator_id
   and r.review_source = 'community'
  group by cc.creator_id
),
creator_profiles as (
  select
    cc.creator_id,
    coalesce(
      nullif(trim(concat_ws(' ', cc.first_name, cc.last_name)), ''),
      'This creator'
    ) as creator_name,
    lower(concat_ws(
      ' ',
      coalesce(cc.creator_description, ''),
      coalesce(ct.type_name, '')
    )) as profile_text,
    community_counts.genuine_reviews,
    greatest(0, 5 - community_counts.genuine_reviews) as reviews_needed
  from public.content_creators cc
  left join public.channel_types ct on ct.type_id = cc.type_id
  join community_counts on community_counts.creator_id = cc.creator_id
),
classified_creators as (
  select
    creator_profiles.*,
    case
      when profile_text ~ '(minecraft|roblox|gaming|gameplay|video game|gamer)' then 'gaming'
      when profile_text ~ '(child|children|kid|family|toy|nursery)' then 'family and kids'
      when profile_text ~ '(science|education|learn|history|math|engineering|documentary)' then 'educational'
      when profile_text ~ '(animation|animated|drawing|artist|artwork|illustration)' then 'animation and art'
      when profile_text ~ '(technology|tech|software|computer|coding|programming|gadget)' then 'technology'
      when profile_text ~ '(food|cooking|recipe|chef|baking|restaurant)' then 'food and cooking'
      when profile_text ~ '(makeup|beauty|fashion|style|skincare)' then 'beauty and lifestyle'
      when profile_text ~ '(fitness|workout|health|exercise|bodybuilding)' then 'fitness and wellness'
      when profile_text ~ '(football|basketball|baseball|soccer|sport|athlete)' then 'sports'
      when profile_text ~ '(travel|adventure|country|destination|explore)' then 'travel and adventure'
      when profile_text ~ '(music|song|singer|band|musician|official video)' then 'music'
      when profile_text ~ '(comedy|comedian|funny|humor|sketch)' then 'comedy and entertainment'
      when profile_text ~ '(news|commentary|analysis|interview|podcast|politic)' then 'commentary and discussion'
      when profile_text ~ '(diy|craft|build|maker|project)' then 'DIY and projects'
      else 'general entertainment'
    end as inferred_topic
  from creator_profiles
),
generated_reviews as (
  select
    classified_creators.*,
    generated.review_number,
    1 + mod(
      (classified_creators.creator_id * 7 + generated.review_number * 11)::bigint,
      20
    )::integer as template_number,
    1 + mod(
      (classified_creators.creator_id * 3 + generated.review_number * 7)::bigint,
      10
    )::integer as rating_number,
    1 + mod(
      (classified_creators.creator_id + generated.review_number * 5)::bigint,
      10
    )::integer as persona_number
  from classified_creators
  cross join lateral generate_series(1, classified_creators.reviews_needed)
    as generated(review_number)
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
  (array[2.5, 3.0, 3.5, 3.5, 4.0, 4.0, 4.0, 4.5, 4.5, 5.0])[generated_reviews.rating_number],
  null,
  null,
  case
    when generated_reviews.inferred_topic = 'family and kids' then 'All ages'
    when generated_reviews.inferred_topic = 'educational' then '8+'
    else '13+'
  end,
  case generated_reviews.template_number
    when 1 then generated_reviews.creator_name || ' may be worth exploring for viewers interested in ' || generated_reviews.inferred_topic || '. Checking several recent uploads is the best way to judge the channel''s current style.'
    when 2 then 'The public channel profile suggests that ' || generated_reviews.creator_name || ' focuses mainly on ' || generated_reviews.inferred_topic || '. Different uploads may appeal to different viewers.'
    when 3 then 'Viewers browsing ' || generated_reviews.inferred_topic || ' channels could add ' || generated_reviews.creator_name || ' to their list to sample. This demo entry does not evaluate every upload.'
    when 4 then generated_reviews.creator_name || ' appears positioned for an audience seeking ' || generated_reviews.inferred_topic || ' content. A few recent videos should provide a clearer sense of pacing and presentation.'
    when 5 then 'This sample review highlights ' || generated_reviews.creator_name || ' as a possible match for fans of ' || generated_reviews.inferred_topic || '. Individual preferences will depend on format and presentation.'
    when 6 then 'A potential reason to try ' || generated_reviews.creator_name || ' is the channel''s apparent emphasis on ' || generated_reviews.inferred_topic || '. New viewers may want to begin with a recent popular upload.'
    when 7 then generated_reviews.creator_name || ' could appeal to viewers who regularly watch ' || generated_reviews.inferred_topic || '. The available profile alone is not enough to assess every aspect of the channel.'
    when 8 then 'For someone comparing creators in ' || generated_reviews.inferred_topic || ', ' || generated_reviews.creator_name || ' offers another channel to consider. Recent uploads remain the most reliable preview.'
    when 9 then 'The topic and presentation shown in the public profile may make ' || generated_reviews.creator_name || ' interesting to ' || generated_reviews.inferred_topic || ' viewers. Suitability can vary by video.'
    when 10 then generated_reviews.creator_name || ' is included here as a ' || generated_reviews.inferred_topic || ' recommendation candidate. Viewers should sample the channel before deciding whether to subscribe.'
    when 11 then 'People looking for more ' || generated_reviews.inferred_topic || ' content might consider browsing ' || generated_reviews.creator_name || '. This controlled demo review avoids making claims about unexamined videos.'
    when 12 then 'The channel description gives ' || generated_reviews.creator_name || ' a general ' || generated_reviews.inferred_topic || ' focus. The tone, depth, and upload format may differ across the channel.'
    when 13 then generated_reviews.creator_name || ' may suit viewers who value variety within ' || generated_reviews.inferred_topic || '. Watching more than one upload would give a fairer impression.'
    when 14 then 'As a discovery option, ' || generated_reviews.creator_name || ' appears relevant to the ' || generated_reviews.inferred_topic || ' category. Viewer enjoyment will depend on personal taste.'
    when 15 then 'The available creator profile places ' || generated_reviews.creator_name || ' broadly within ' || generated_reviews.inferred_topic || '. It may be useful to compare the channel with similar creators.'
    when 16 then generated_reviews.creator_name || ' could be a useful starting point for viewers exploring ' || generated_reviews.inferred_topic || '. No safety characteristics were evaluated for this demo entry.'
    when 17 then 'This demonstration entry suggests exploring ' || generated_reviews.creator_name || ' for ' || generated_reviews.inferred_topic || ' content. It intentionally leaves unverified details unevaluated.'
    when 18 then 'Based on public profile information, ' || generated_reviews.creator_name || ' may offer content related to ' || generated_reviews.inferred_topic || '. Recent uploads can confirm whether that focus is still current.'
    when 19 then generated_reviews.creator_name || ' is one option for audiences browsing ' || generated_reviews.inferred_topic || '. Format and quality can vary, so this entry should be treated as a discovery prompt.'
    else 'A viewer interested in ' || generated_reviews.inferred_topic || ' may want to preview ' || generated_reviews.creator_name || '. This is synthetic classroom data rather than a firsthand viewer account.'
  end,
  '',
  'Unsure',
  'synthetic_demo',
  (array[
    'Demo Channel Explorer',
    'Demo Casual Viewer',
    'Demo Topic Browser',
    'Demo New Viewer',
    'Demo Family Researcher',
    'Demo Content Finder',
    'Demo Video Fan',
    'Demo Recommendation Tester',
    'Demo Student Reviewer',
    'Demo Community Sample'
  ])[generated_reviews.persona_number],
  replacement_demo_batch.batch_id,
  now() - (
    (generated_reviews.review_number * 3 + mod(generated_reviews.creator_id, 19))
    * interval '1 day'
  )
from generated_reviews
cross join replacement_demo_batch;

commit;

-- Return the new batch ID and an audit of the resulting review totals.
select
  seed_batch_id,
  count(*) as synthetic_reviews_created
from public.reviews
where review_source = 'synthetic_demo'
group by seed_batch_id
order by max(created_at) desc
limit 1;

select
  count(*) as total_creators,
  min(review_total) as minimum_reviews_on_a_creator,
  max(review_total) as maximum_reviews_on_a_creator,
  count(*) filter (where review_total < 5) as creators_below_five
from (
  select cc.creator_id, count(r.review_id)::integer as review_total
  from public.content_creators cc
  left join public.reviews r on r.creator_id = cc.creator_id
  group by cc.creator_id
) totals;
