-- Clopos Retention Academy: база данных для Supabase.
-- Как применить: Supabase → SQL Editor → New query → вставить весь файл → Run.
-- Почта администратора задана ниже в функции handle_new_user (lsona2422@gmail.com).

-- 1. Профили сотрудников
create table if not exists public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  email       text not null,
  full_name   text,
  role        text not null default 'pending' check (role in ('pending','intern','mentor','admin','blocked')),
  mentor_id   uuid references public.profiles(id) on delete set null,
  created_at  timestamptz not null default now()
);

-- 2. Прогресс обучения (одна строка на сотрудника)
create table if not exists public.progress (
  user_id     uuid primary key references public.profiles(id) on delete cascade,
  state       jsonb not null default '{}'::jsonb,
  updated_at  timestamptz not null default now()
);

-- 3. Вспомогательные функции для проверки роли текущего пользователя
create or replace function public.my_role() returns text
language sql stable security definer set search_path = public as $$
  select role from public.profiles where id = auth.uid()
$$;

-- 4. Профиль создаётся автоматически при регистрации
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, full_name, role)
  values (
    new.id,
    lower(new.email),
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    case when lower(new.email) = 'lsona2422@gmail.com' then 'admin' else 'pending' end
  )
  on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- 5. Назначение роли и наставника — только администратор
create or replace function public.admin_set_role(target uuid, new_role text, new_mentor uuid default null)
returns void language plpgsql security definer set search_path = public as $$
begin
  if public.my_role() is distinct from 'admin' then
    raise exception 'Только администратор может назначать роли';
  end if;
  if new_role not in ('pending','intern','mentor','admin','blocked') then
    raise exception 'Неизвестная роль';
  end if;
  update public.profiles
     set role = new_role,
         mentor_id = case when new_role = 'intern' then new_mentor else null end
   where id = target;
end $$;

-- 6. Права доступа (Row Level Security)
alter table public.profiles enable row level security;
alter table public.progress enable row level security;

drop policy if exists profiles_read_own on public.profiles;
create policy profiles_read_own on public.profiles
  for select using (id = auth.uid());

drop policy if exists profiles_read_admin on public.profiles;
create policy profiles_read_admin on public.profiles
  for select using (public.my_role() = 'admin');

drop policy if exists profiles_read_mentor on public.profiles;
create policy profiles_read_mentor on public.profiles
  for select using (public.my_role() = 'mentor' and (mentor_id = auth.uid() or role in ('mentor','admin')));

-- Менять роль и наставника напрямую нельзя: только через admin_set_role.
-- Пользователь может поменять только своё имя.
revoke update on public.profiles from anon, authenticated;
grant update (full_name) on public.profiles to authenticated;
drop policy if exists profiles_update_own_name on public.profiles;
create policy profiles_update_own_name on public.profiles
  for update using (id = auth.uid()) with check (id = auth.uid());

drop policy if exists progress_read_own on public.progress;
create policy progress_read_own on public.progress
  for select using (user_id = auth.uid());

drop policy if exists progress_read_admin on public.progress;
create policy progress_read_admin on public.progress
  for select using (public.my_role() = 'admin');

drop policy if exists progress_read_mentor on public.progress;
create policy progress_read_mentor on public.progress
  for select using (
    public.my_role() = 'mentor'
    and exists (select 1 from public.profiles p where p.id = progress.user_id and p.mentor_id = auth.uid())
  );

drop policy if exists progress_insert_own on public.progress;
create policy progress_insert_own on public.progress
  for insert with check (user_id = auth.uid() and public.my_role() in ('intern','mentor','admin'));

drop policy if exists progress_update_own on public.progress;
create policy progress_update_own on public.progress
  for update using (user_id = auth.uid()) with check (user_id = auth.uid() and public.my_role() in ('intern','mentor','admin'));

grant select on public.profiles to authenticated;
grant select, insert, update on public.progress to authenticated;
grant execute on function public.admin_set_role(uuid, text, uuid) to authenticated;
grant execute on function public.my_role() to authenticated;
