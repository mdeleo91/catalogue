-- Catalog — production schema. Run this once in the Supabase SQL editor.
--
-- Design: collections + members are relational; collection content tables
-- (items, locations, history, activity, wishlist) are document-style — the
-- app's row shape lives in a jsonb `data` column, keyed by the app's own ids.
-- All analytics/search happen client-side over the (small, family-sized)
-- collection, so this keeps the sync layer simple and schema drift painless.
-- Everything is protected by RLS: only members of a collection can touch it.

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- Collections & membership
-- ---------------------------------------------------------------------------

create table collections (
  id uuid primary key default gen_random_uuid(),
  name text not null default 'Our Collection',
  invite_code text not null unique,
  created_at timestamptz not null default now()
);

create table collection_members (
  collection_id uuid not null references collections(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'editor' check (role in ('owner', 'editor')),
  display_name text not null,
  created_at timestamptz not null default now(),
  primary key (collection_id, user_id)
);

-- ---------------------------------------------------------------------------
-- Collection content (document tables; `data` holds the app object)
-- ---------------------------------------------------------------------------

create table items (
  id text primary key,
  collection_id uuid not null references collections(id) on delete cascade,
  data jsonb not null,
  updated_at timestamptz not null default now()
);

create table locations (
  id text primary key,
  collection_id uuid not null references collections(id) on delete cascade,
  data jsonb not null,
  updated_at timestamptz not null default now()
);

create table location_history (
  id text primary key,
  collection_id uuid not null references collections(id) on delete cascade,
  data jsonb not null,
  updated_at timestamptz not null default now()
);

create table activity (
  id text primary key,
  collection_id uuid not null references collections(id) on delete cascade,
  data jsonb not null,
  updated_at timestamptz not null default now()
);

create table wishlist (
  id text primary key,
  collection_id uuid not null references collections(id) on delete cascade,
  data jsonb not null,
  updated_at timestamptz not null default now()
);

create index items_collection_idx on items(collection_id);
create index locations_collection_idx on locations(collection_id);
create index location_history_collection_idx on location_history(collection_id);
create index activity_collection_idx on activity(collection_id);
create index wishlist_collection_idx on wishlist(collection_id);

-- ---------------------------------------------------------------------------
-- Row-level security
-- ---------------------------------------------------------------------------

alter table collections enable row level security;
alter table collection_members enable row level security;
alter table items enable row level security;
alter table locations enable row level security;
alter table location_history enable row level security;
alter table activity enable row level security;
alter table wishlist enable row level security;

create or replace function is_member(cid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from collection_members
    where collection_id = cid and user_id = auth.uid()
  );
$$;

create policy member_read_collections on collections
  for select using (is_member(id));

create policy member_read_members on collection_members
  for select using (user_id = auth.uid() or is_member(collection_id));
create policy member_update_self on collection_members
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy member_all_items on items for all
  using (is_member(collection_id)) with check (is_member(collection_id));
create policy member_all_locations on locations for all
  using (is_member(collection_id)) with check (is_member(collection_id));
create policy member_all_history on location_history for all
  using (is_member(collection_id)) with check (is_member(collection_id));
create policy member_all_activity on activity for all
  using (is_member(collection_id)) with check (is_member(collection_id));
create policy member_all_wishlist on wishlist for all
  using (is_member(collection_id)) with check (is_member(collection_id));

-- ---------------------------------------------------------------------------
-- RPCs: create a collection, or join one with its invite code.
-- Both run as the signed-in user (security definer bypasses RLS for the
-- insert, auth.uid() ties the membership to the caller).
-- ---------------------------------------------------------------------------

create or replace function create_collection(p_name text, p_display_name text)
returns json
language plpgsql security definer set search_path = public as $$
declare
  v_id uuid;
  v_code text;
begin
  if auth.uid() is null then
    raise exception 'not signed in';
  end if;
  v_code := lower(substr(md5(gen_random_uuid()::text), 1, 8));
  insert into collections (name, invite_code)
    values (coalesce(nullif(trim(p_name), ''), 'Our Collection'), v_code)
    returning id into v_id;
  insert into collection_members (collection_id, user_id, role, display_name)
    values (v_id, auth.uid(), 'owner', coalesce(nullif(trim(p_display_name), ''), 'Collector'));
  return json_build_object('collection_id', v_id, 'invite_code', v_code);
end;
$$;

create or replace function join_collection(p_code text, p_display_name text)
returns json
language plpgsql security definer set search_path = public as $$
declare
  v_id uuid;
begin
  if auth.uid() is null then
    raise exception 'not signed in';
  end if;
  select id into v_id from collections where invite_code = lower(trim(p_code));
  if v_id is null then
    raise exception 'invalid invite code';
  end if;
  insert into collection_members (collection_id, user_id, role, display_name)
    values (v_id, auth.uid(), 'editor', coalesce(nullif(trim(p_display_name), ''), 'Collector'))
    on conflict (collection_id, user_id) do nothing;
  return json_build_object('collection_id', v_id);
end;
$$;

-- ---------------------------------------------------------------------------
-- Realtime: broadcast changes so other signed-in devices refresh live.
-- ---------------------------------------------------------------------------

alter publication supabase_realtime add table items;
alter publication supabase_realtime add table locations;
alter publication supabase_realtime add table location_history;
alter publication supabase_realtime add table activity;
alter publication supabase_realtime add table wishlist;
alter publication supabase_realtime add table collection_members;
