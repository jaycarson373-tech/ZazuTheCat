-- Dog Wif Shiesty X PFP bot state.
-- Paste this entire file into the Supabase SQL editor and run it once.

create table if not exists public.shiesty_bot_interactions (
  bot_project text not null,
  source_post_id text not null,
  author_id text not null,
  author_username text,
  source_created_at timestamptz,
  status text not null check (status in (
    'claimed', 'processing', 'posting', 'replied', 'dry_run', 'opted_out', 'skipped', 'failed'
  )),
  media_id text,
  reply_post_id text,
  error_code text,
  error_detail text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (bot_project, source_post_id),
  unique (reply_post_id)
);

create index if not exists shiesty_bot_interactions_status_idx
  on public.shiesty_bot_interactions (bot_project, status, updated_at desc);

create index if not exists shiesty_bot_interactions_author_idx
  on public.shiesty_bot_interactions (bot_project, author_id, updated_at desc);

create table if not exists public.shiesty_bot_opt_outs (
  bot_project text not null,
  author_id text not null,
  author_username text,
  source_post_id text not null,
  opted_out_at timestamptz not null default now(),
  primary key (bot_project, author_id)
);

create table if not exists public.shiesty_bot_cursors (
  bot_project text primary key,
  since_id text,
  updated_at timestamptz not null default now()
);

create or replace function public.shiesty_bot_set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists shiesty_bot_interactions_updated_at on public.shiesty_bot_interactions;
create trigger shiesty_bot_interactions_updated_at
before update on public.shiesty_bot_interactions
for each row execute function public.shiesty_bot_set_updated_at();

alter table public.shiesty_bot_interactions enable row level security;
alter table public.shiesty_bot_opt_outs enable row level security;
alter table public.shiesty_bot_cursors enable row level security;

revoke all on public.shiesty_bot_interactions from anon, authenticated;
revoke all on public.shiesty_bot_opt_outs from anon, authenticated;
revoke all on public.shiesty_bot_cursors from anon, authenticated;

grant select, insert, update on public.shiesty_bot_interactions to service_role;
grant select, insert, update on public.shiesty_bot_opt_outs to service_role;
grant select, insert, update on public.shiesty_bot_cursors to service_role;
