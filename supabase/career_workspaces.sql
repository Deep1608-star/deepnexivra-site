-- Deep Nexivra optional encrypted cloud workspace storage
-- Run this in the Supabase SQL editor for the project used by the deployment.
-- Workspace contents are encrypted in the browser before upload. The database
-- stores ciphertext plus the salt/IV required for client-side decryption.

create table if not exists public.career_workspaces (
  user_id uuid primary key references auth.users(id) on delete cascade,
  encrypted_blob text not null,
  salt text not null,
  iv text not null,
  algorithm text not null default 'AES-256-GCM/PBKDF2-SHA256-250000',
  updated_at timestamptz not null default now()
);

alter table public.career_workspaces enable row level security;

drop policy if exists "Users can read own career workspace" on public.career_workspaces;
create policy "Users can read own career workspace"
on public.career_workspaces
for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "Users can insert own career workspace" on public.career_workspaces;
create policy "Users can insert own career workspace"
on public.career_workspaces
for insert
to authenticated
with check (auth.uid() = user_id);

drop policy if exists "Users can update own career workspace" on public.career_workspaces;
create policy "Users can update own career workspace"
on public.career_workspaces
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

revoke all on table public.career_workspaces from anon;
grant select, insert, update on table public.career_workspaces to authenticated;
