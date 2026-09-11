-- Daily scan quota. Run this once in the Supabase SQL editor on an existing
-- project; it is already part of schema.sql for fresh installs.
--
-- Guards the SHARED key only: a runaway loop on the deployment-wide key could
-- otherwise run up a large bill, whereas members scanning on their own key are
-- spending their own money and are left alone.
--
-- The counter is deliberately not writable by the client. Row-level security
-- allows a member to read their own usage (so Settings can display it) but
-- never to insert, update or delete it — the only way to change the number is
-- record_ai_scan(), which increments the caller's own row and nothing else.

create table if not exists ai_usage (
  user_id uuid not null references auth.users(id) on delete cascade,
  day date not null default (now() at time zone 'utc')::date,
  scans integer not null default 0,
  primary key (user_id, day)
);

alter table ai_usage enable row level security;

drop policy if exists own_ai_usage_read on ai_usage;
create policy own_ai_usage_read on ai_usage
  for select using (user_id = auth.uid());

-- Returns the caller's scan count for today, after counting this one.
-- Takes no limit argument on purpose: the ceiling is enforced by the server
-- against its own configuration, so a client calling this directly can only
-- increment its own counter, never raise its own allowance.
create or replace function record_ai_scan() returns integer
language plpgsql security definer set search_path = public as $$
declare
  v_count integer;
begin
  if auth.uid() is null then
    raise exception 'not signed in';
  end if;
  insert into ai_usage (user_id, day, scans)
    values (auth.uid(), (now() at time zone 'utc')::date, 1)
  on conflict (user_id, day) do update set scans = ai_usage.scans + 1
  returning scans into v_count;
  return v_count;
end;
$$;
