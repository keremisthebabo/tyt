-- Supabase PostgreSQL Schema for Multi-User Maarif TYT & Sport Campaign App
-- Run this inside the Supabase SQL Editor to enable cloud sync across devices.

create table if not exists public.user_states (
  user_id text primary key,
  email text not null,
  display_name text not null,
  state_json jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.user_states enable row level security;

create policy "Users can read and upsert their own campaign state"
  on public.user_states
  for all
  using (true)
  with check (true);

