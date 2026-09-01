-- Catalog — production schema for Supabase (PostgreSQL + RLS).
-- The MVP front end runs on an on-device store with the same shape; this
-- schema is the target for the shared, synced backend described in the PRD.

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- Collections & membership (one shared collection, multiple users)
-- ---------------------------------------------------------------------------

create table collections (
  id uuid primary key default gen_random_uuid(),
  name text not null default 'Our Collection',
  created_at timestamptz not null default now()
);

create table collection_members (
  collection_id uuid not null references collections(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'editor' check (role in ('owner', 'editor')),
  display_name text not null,
  primary key (collection_id, user_id)
);

-- ---------------------------------------------------------------------------
-- Structured locations: house → room → area → shelf → container (a tree)
-- ---------------------------------------------------------------------------

create table locations (
  id uuid primary key default gen_random_uuid(),
  collection_id uuid not null references collections(id) on delete cascade,
  parent_id uuid references locations(id) on delete restrict,
  name text not null,
  kind text not null check (kind in ('house', 'room', 'area', 'shelf', 'container')),
  container_type text,
  qr_code text unique,
  photo_url text,
  created_at timestamptz not null default now()
);

create index locations_parent_idx on locations(parent_id);
create index locations_collection_idx on locations(collection_id);

-- ---------------------------------------------------------------------------
-- Items: physical artifacts. Items reference structured locations, never a
-- free-text location string. temp_status covers On Loan / In Transit / etc.
-- ---------------------------------------------------------------------------

create table items (
  id uuid primary key default gen_random_uuid(),
  collection_id uuid not null references collections(id) on delete cascade,
  type text not null check (type in ('game', 'magazine', 'guide', 'manual', 'box', 'console', 'accessory')),
  title text not null,
  platform text,
  publisher text,
  developer text,
  release_year int,
  region text,
  edition text,
  genre text,
  franchise text,
  issue_number int,
  publication_date date,
  isbn text,
  author text,
  model text,
  serial_number text,
  working_status text,
  condition text check (condition in ('Mint', 'Near Mint', 'Excellent', 'Very Good', 'Good', 'Fair', 'Poor')),
  completeness text,
  location_id uuid references locations(id) on delete set null,
  temp_status text,
  acquisition_method text,
  source text,
  purchase_date date,
  purchase_price numeric(10, 2),
  notes text,
  -- Per-field AI confidence at identification time, e.g. {"title": 0.99}
  ai_confidence jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index items_collection_idx on items(collection_id);
create index items_location_idx on items(location_id);
create index items_title_idx on items using gin (to_tsvector('english', title));

-- Physical components of an item (cartridge, box, manual, map, …).
-- Completeness % is derived from present/missing components.
create table item_components (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references items(id) on delete cascade,
  name text not null,
  present boolean not null default true,
  condition text,
  sort_order int not null default 0
);

create index item_components_item_idx on item_components(item_id);

-- Photographs live in Supabase Storage; rows reference the stored object.
create table item_images (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references items(id) on delete cascade,
  storage_path text not null,
  kind text default 'photo',
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Location history: append-only; never destroyed when an item moves.
-- Subject is an item or a location (container moves).
-- ---------------------------------------------------------------------------

create table location_history (
  id uuid primary key default gen_random_uuid(),
  collection_id uuid not null references collections(id) on delete cascade,
  subject_type text not null check (subject_type in ('item', 'location')),
  subject_id uuid not null,
  location_id uuid references locations(id) on delete set null,
  temp_status text,
  path_snapshot text not null,
  moved_at timestamptz not null default now(),
  moved_by uuid references auth.users(id)
);

create index location_history_subject_idx on location_history(subject_type, subject_id, moved_at desc);

-- ---------------------------------------------------------------------------
-- Valuations: estimated value over time (source-labeled estimates).
-- ---------------------------------------------------------------------------

create table valuations (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references items(id) on delete cascade,
  estimated_value numeric(10, 2) not null,
  source text not null default 'manual',
  as_of date not null default current_date,
  created_at timestamptz not null default now()
);

create index valuations_item_idx on valuations(item_id, as_of desc);

-- ---------------------------------------------------------------------------
-- Wishlist & activity
-- ---------------------------------------------------------------------------

create table wishlist (
  id uuid primary key default gen_random_uuid(),
  collection_id uuid not null references collections(id) on delete cascade,
  title text not null,
  platform text,
  desired_condition text,
  desired_completeness text,
  target_price numeric(10, 2),
  priority text not null default 'Medium' check (priority in ('High', 'Medium', 'Low')),
  notes text,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

create table activity (
  id uuid primary key default gen_random_uuid(),
  collection_id uuid not null references collections(id) on delete cascade,
  user_id uuid references auth.users(id),
  action text not null,
  subject text not null,
  item_id uuid references items(id) on delete set null,
  location_id uuid references locations(id) on delete set null,
  created_at timestamptz not null default now()
);

create index activity_collection_idx on activity(collection_id, created_at desc);

-- ---------------------------------------------------------------------------
-- Row-level security: members of a collection can read and write it.
-- ---------------------------------------------------------------------------

alter table collections enable row level security;
alter table collection_members enable row level security;
alter table locations enable row level security;
alter table items enable row level security;
alter table item_components enable row level security;
alter table item_images enable row level security;
alter table location_history enable row level security;
alter table valuations enable row level security;
alter table wishlist enable row level security;
alter table activity enable row level security;

create or replace function is_member(cid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from collection_members
    where collection_id = cid and user_id = auth.uid()
  );
$$;

create policy member_read on collections for select using (is_member(id));
create policy members_self on collection_members for select using (user_id = auth.uid() or is_member(collection_id));

create policy member_all_locations on locations for all
  using (is_member(collection_id)) with check (is_member(collection_id));
create policy member_all_items on items for all
  using (is_member(collection_id)) with check (is_member(collection_id));
create policy member_all_components on item_components for all
  using (exists (select 1 from items i where i.id = item_id and is_member(i.collection_id)))
  with check (exists (select 1 from items i where i.id = item_id and is_member(i.collection_id)));
create policy member_all_images on item_images for all
  using (exists (select 1 from items i where i.id = item_id and is_member(i.collection_id)))
  with check (exists (select 1 from items i where i.id = item_id and is_member(i.collection_id)));
create policy member_all_history on location_history for all
  using (is_member(collection_id)) with check (is_member(collection_id));
create policy member_all_valuations on valuations for all
  using (exists (select 1 from items i where i.id = item_id and is_member(i.collection_id)))
  with check (exists (select 1 from items i where i.id = item_id and is_member(i.collection_id)));
create policy member_all_wishlist on wishlist for all
  using (is_member(collection_id)) with check (is_member(collection_id));
create policy member_all_activity on activity for all
  using (is_member(collection_id)) with check (is_member(collection_id));
