-- Profiles
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  target_score int,
  test_date date,
  xp int not null default 0,
  streak int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.profiles enable row level security;
create policy "own_profile_select" on public.profiles for select using (auth.uid() = id);
create policy "own_profile_insert" on public.profiles for insert with check (auth.uid() = id);
create policy "own_profile_update" on public.profiles for update using (auth.uid() = id);
create policy "own_profile_delete" on public.profiles for delete using (auth.uid() = id);

-- Mistakes
create table public.mistakes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  section text not null,
  topic text not null,
  difficulty text not null,
  reason text not null,
  time_spent int not null default 0,
  prompt text not null,
  passage text,
  choices jsonb not null,
  correct_index int not null,
  user_choice int,
  explanation text,
  created_at timestamptz not null default now()
);
alter table public.mistakes enable row level security;
create policy "own_mistakes_select" on public.mistakes for select using (auth.uid() = user_id);
create policy "own_mistakes_insert" on public.mistakes for insert with check (auth.uid() = user_id);
create policy "own_mistakes_update" on public.mistakes for update using (auth.uid() = user_id);
create policy "own_mistakes_delete" on public.mistakes for delete using (auth.uid() = user_id);
create index mistakes_user_idx on public.mistakes(user_id, created_at desc);

-- Sessions
create table public.sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  mode text not null,
  score int not null,
  total int not null,
  duration_seconds int not null,
  xp_earned int not null default 0,
  created_at timestamptz not null default now()
);
alter table public.sessions enable row level security;
create policy "own_sessions_select" on public.sessions for select using (auth.uid() = user_id);
create policy "own_sessions_insert" on public.sessions for insert with check (auth.uid() = user_id);
create index sessions_user_idx on public.sessions(user_id, created_at desc);

-- Auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1)));
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- updated_at trigger
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;
create trigger profiles_touch before update on public.profiles
  for each row execute function public.touch_updated_at();