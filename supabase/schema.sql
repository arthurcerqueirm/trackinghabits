-- =====================================================================
--  Hábitos — schema do Supabase
--  Cole TUDO no SQL Editor do Supabase e rode uma vez.
-- =====================================================================

create extension if not exists pgcrypto;

-- ---------- Perfis ----------
create table if not exists public.profiles (
  id uuid primary key references auth.users on delete cascade,
  name text,
  timezone text not null default 'America/Sao_Paulo',
  daily_reminder text default '09:00',          -- 'HH:MM' ou null
  notifications_enabled boolean not null default true,
  created_at timestamptz not null default now()
);

-- ---------- Hábitos ----------
create table if not exists public.habits (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  name text not null check (char_length(name) between 1 and 60),
  emoji text not null default '✨',
  color text not null default '#8b7cf6',
  target int not null default 1 check (target between 1 and 100),
  unit text,
  days smallint[] not null default '{0,1,2,3,4,5,6}',  -- 0 = domingo
  reminder_time text,                                   -- 'HH:MM' ou null
  archived boolean not null default false,
  position int not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists habits_user_idx on public.habits (user_id, position);

-- ---------- Check-ins ----------
create table if not exists public.checkins (
  habit_id uuid not null references public.habits on delete cascade,
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  day date not null,
  count int not null default 1 check (count >= 0),
  note text,
  updated_at timestamptz not null default now(),
  primary key (habit_id, day)
);
create index if not exists checkins_user_day_idx on public.checkins (user_id, day);

-- ---------- Push subscriptions ----------
create table if not exists public.push_subscriptions (
  endpoint text primary key,
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now()
);

-- ---------- Log de lembretes (só o servidor acessa) ----------
create table if not exists public.reminder_log (
  key text primary key,
  created_at timestamptz not null default now()
);

-- ---------- RLS ----------
alter table public.profiles           enable row level security;
alter table public.habits             enable row level security;
alter table public.checkins           enable row level security;
alter table public.push_subscriptions enable row level security;
alter table public.reminder_log       enable row level security;

drop policy if exists "own profile" on public.profiles;
create policy "own profile" on public.profiles
  for all using (auth.uid() = id) with check (auth.uid() = id);

drop policy if exists "own habits" on public.habits;
create policy "own habits" on public.habits
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "own checkins" on public.checkins;
create policy "own checkins" on public.checkins
  for all using (auth.uid() = user_id)
  with check (
    auth.uid() = user_id
    and exists (select 1 from public.habits h where h.id = habit_id and h.user_id = auth.uid())
  );

drop policy if exists "own subs" on public.push_subscriptions;
create policy "own subs" on public.push_subscriptions
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ---------- Cria perfil automaticamente no cadastro ----------
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, name)
  values (new.id, coalesce(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)))
  on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Limpa log antigo (opcional, roda junto com o cron)
create or replace function public.prune_reminder_log()
returns void language sql security definer set search_path = public as $$
  delete from public.reminder_log where created_at < now() - interval '3 days';
$$;
