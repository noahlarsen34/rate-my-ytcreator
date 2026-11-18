alter table public.content_creators
  add column if not exists ai_category_confidence numeric,
  add column if not exists ai_category_reason text,
  add column if not exists ai_review_summary text,
  add column if not exists ai_summary_review_count integer default 0,
  add column if not exists ai_summary_updated_at timestamptz;