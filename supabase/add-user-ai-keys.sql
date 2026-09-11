-- Per-user AI keys. Run this once in the Supabase SQL editor on an existing
-- project; it is already included in schema.sql for fresh installs.
--
-- Each member stores their own provider key, so scanning is billed to whoever
-- does it rather than to the person who deployed the app. Row-level security
-- scopes every read and write to the owning user, so one member can never see
-- or use another's key — including through the identification endpoint, which
-- queries this table with the caller's own token.

create table if not exists user_ai_keys (
  user_id uuid primary key references auth.users(id) on delete cascade,
  provider text not null check (provider in ('anthropic', 'openai')),
  api_key text not null,
  model text,
  -- Last few characters only, so the app can show which key is saved without
  -- ever reading the secret back into a browser.
  key_hint text,
  updated_at timestamptz not null default now()
);

alter table user_ai_keys enable row level security;

drop policy if exists own_ai_key on user_ai_keys;
create policy own_ai_key on user_ai_keys for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());
