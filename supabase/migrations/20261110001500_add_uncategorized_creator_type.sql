do $$
declare
  uncategorized_type_id bigint;
  diy_type_id bigint;
begin
  select type_id into uncategorized_type_id
  from public.channel_types
  where lower(type_name) = 'uncategorized'
  limit 1;

  if uncategorized_type_id is null then
    insert into public.channel_types (type_name, type_description)
    values ('Uncategorized', 'Imported creators that have not been categorized yet.')
    returning type_id into uncategorized_type_id;
  end if;

  select type_id into diy_type_id
  from public.channel_types
  where lower(type_name) = 'diy'
  limit 1;

  if diy_type_id is not null then
    update public.content_creators
    set type_id = uncategorized_type_id,
        updated_at = now()
    where youtube_channel_id is not null
      and type_id = diy_type_id;
  end if;
end $$;
