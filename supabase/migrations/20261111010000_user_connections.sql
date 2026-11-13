alter table public.users
  add column if not exists people_searchable boolean not null default false;

create table if not exists public.user_connections (
  connection_id uuid primary key default gen_random_uuid(),
  requester_id uuid not null references public.users(user_id) on delete cascade,
  recipient_id uuid not null references public.users(user_id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'accepted')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint user_connections_not_self check (requester_id <> recipient_id),
  constraint user_connections_unique_pair unique (requester_id, recipient_id)
);

create index if not exists user_connections_recipient_status_idx
  on public.user_connections (recipient_id, status);
create index if not exists user_connections_requester_status_idx
  on public.user_connections (requester_id, status);

alter table public.user_connections enable row level security;

create or replace function public.search_people(p_query text)
returns table (user_id uuid, username text, avatar_url text)
language sql
stable
security definer
set search_path = ''
as $$
  select u.user_id, u.username, u.avatar_url
  from public.users as u
  where auth.uid() is not null
    and u.user_id <> auth.uid()
    and u.people_searchable
    and length(trim(coalesce(p_query, ''))) >= 2
    and u.username ilike '%' || trim(p_query) || '%'
  order by u.username
  limit 25;
$$;

create or replace function public.get_user_connection_status(p_user_id uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when auth.uid() is null or p_user_id is null or p_user_id = auth.uid() then 'unavailable'
    when exists (
      select 1 from public.user_connections as c
      where c.status = 'accepted'
        and ((c.requester_id = auth.uid() and c.recipient_id = p_user_id)
          or (c.requester_id = p_user_id and c.recipient_id = auth.uid()))
    ) then 'connected'
    when exists (
      select 1 from public.user_connections as c
      where c.requester_id = auth.uid() and c.recipient_id = p_user_id and c.status = 'pending'
    ) then 'request_sent'
    when exists (
      select 1 from public.user_connections as c
      where c.requester_id = p_user_id and c.recipient_id = auth.uid() and c.status = 'pending'
    ) then 'request_received'
    when exists (
      select 1 from public.users as u where u.user_id = p_user_id and u.people_searchable
    ) then 'available'
    else 'unavailable'
  end;
$$;

create or replace function public.send_user_connection_request(p_recipient_id uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_status text;
begin
  if v_user_id is null then raise exception 'Sign in to connect with people.'; end if;
  if p_recipient_id is null or p_recipient_id = v_user_id then raise exception 'Choose another account.'; end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(least(v_user_id::text, p_recipient_id::text) || ':' || greatest(v_user_id::text, p_recipient_id::text), 0)
  );

  select public.get_user_connection_status(p_recipient_id) into v_status;
  if v_status = 'connected' then return 'connected'; end if;
  if v_status = 'request_sent' then return 'request_sent'; end if;
  if v_status = 'request_received' then
    update public.user_connections
      set status = 'accepted', updated_at = now()
      where requester_id = p_recipient_id and recipient_id = v_user_id and status = 'pending';
    return 'connected';
  end if;
  if v_status <> 'available' then raise exception 'This account is not accepting connection requests.'; end if;

  insert into public.user_connections (requester_id, recipient_id)
    values (v_user_id, p_recipient_id)
    on conflict (requester_id, recipient_id) do nothing;
  return 'request_sent';
end;
$$;

create or replace function public.respond_user_connection_request(p_requester_id uuid, p_accept boolean)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_count integer;
begin
  if v_user_id is null then raise exception 'Sign in to respond to connection requests.'; end if;
  if p_requester_id is null or p_requester_id = v_user_id then raise exception 'This request is no longer available.'; end if;
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(least(v_user_id::text, p_requester_id::text) || ':' || greatest(v_user_id::text, p_requester_id::text), 0)
  );
  if p_accept then
    update public.user_connections
      set status = 'accepted', updated_at = now()
      where requester_id = p_requester_id and recipient_id = v_user_id and status = 'pending';
    get diagnostics v_count = row_count;
    if v_count = 0 then raise exception 'This request is no longer available.'; end if;
    delete from public.user_connections
      where requester_id = v_user_id and recipient_id = p_requester_id and status = 'pending';
    return 'connected';
  end if;
  delete from public.user_connections
    where requester_id = p_requester_id and recipient_id = v_user_id and status = 'pending';
  get diagnostics v_count = row_count;
  if v_count = 0 then raise exception 'This request is no longer available.'; end if;
  return 'declined';
end;
$$;

create or replace function public.cancel_user_connection_request(p_recipient_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_count integer;
begin
  if v_user_id is null then raise exception 'Sign in to cancel connection requests.'; end if;
  delete from public.user_connections
    where requester_id = v_user_id and recipient_id = p_recipient_id and status = 'pending';
  get diagnostics v_count = row_count;
  return v_count > 0;
end;
$$;

create or replace function public.disconnect_user_connection(p_user_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_count integer;
begin
  if v_user_id is null then raise exception 'Sign in to manage connections.'; end if;
  delete from public.user_connections
    where status = 'accepted'
      and ((requester_id = v_user_id and recipient_id = p_user_id)
        or (requester_id = p_user_id and recipient_id = v_user_id));
  get diagnostics v_count = row_count;
  return v_count > 0;
end;
$$;

create or replace function public.get_connected_user_subscriptions(p_user_id uuid)
returns table (creator_id uuid, creator_name text, channel_link text)
language sql
stable
security definer
set search_path = ''
as $$
  select
    cc.creator_id,
    coalesce(nullif(trim(concat_ws(' ', cc.first_name, cc.last_name)), ''), 'YouTube creator'),
    cc.channel_link
  from public.user_connections as c
  join public.creator_follows as cf on cf.user_id = p_user_id
  join public.content_creators as cc on cc.creator_id = cf.creator_id
  where auth.uid() is not null
    and p_user_id <> auth.uid()
    and c.status = 'accepted'
    and ((c.requester_id = auth.uid() and c.recipient_id = p_user_id)
      or (c.requester_id = p_user_id and c.recipient_id = auth.uid()))
  order by cc.first_name, cc.last_name;
$$;

create or replace function public.get_my_user_connections()
returns table (user_id uuid, username text, avatar_url text, status text, direction text, created_at timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select
    case when c.requester_id = auth.uid() then recipient.user_id else requester.user_id end,
    case when c.requester_id = auth.uid() then recipient.username else requester.username end,
    case when c.requester_id = auth.uid() then recipient.avatar_url else requester.avatar_url end,
    c.status,
    case
      when c.status = 'accepted' then 'connected'
      when c.requester_id = auth.uid() then 'sent'
      else 'received'
    end,
    c.created_at
  from public.user_connections as c
  join public.users as requester on requester.user_id = c.requester_id
  join public.users as recipient on recipient.user_id = c.recipient_id
  where auth.uid() is not null
    and (c.requester_id = auth.uid() or c.recipient_id = auth.uid())
  order by c.created_at desc;
$$;

revoke all on table public.user_connections from public, anon, authenticated;
revoke all on function public.search_people(text) from public, anon;
revoke all on function public.get_user_connection_status(uuid) from public, anon;
revoke all on function public.send_user_connection_request(uuid) from public, anon;
revoke all on function public.respond_user_connection_request(uuid, boolean) from public, anon;
revoke all on function public.cancel_user_connection_request(uuid) from public, anon;
revoke all on function public.disconnect_user_connection(uuid) from public, anon;
revoke all on function public.get_connected_user_subscriptions(uuid) from public, anon;
revoke all on function public.get_my_user_connections() from public, anon;
grant execute on function public.search_people(text) to authenticated;
grant execute on function public.get_user_connection_status(uuid) to authenticated;
grant execute on function public.send_user_connection_request(uuid) to authenticated;
grant execute on function public.respond_user_connection_request(uuid, boolean) to authenticated;
grant execute on function public.cancel_user_connection_request(uuid) to authenticated;
grant execute on function public.disconnect_user_connection(uuid) to authenticated;
grant execute on function public.get_connected_user_subscriptions(uuid) to authenticated;
grant execute on function public.get_my_user_connections() to authenticated;
