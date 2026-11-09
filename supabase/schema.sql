-- Clopos Retention Academy: база данных для Supabase.
-- Как применить: Supabase → SQL Editor → New query → вставить весь файл → Run.
-- Владелец (главный администратор) — lsona2422@gmail.com. Его роль всегда admin, удалить или понизить его нельзя.
-- Любой новый пользователь сразу получает роль intern (стажёр) и может проходить курс.

-- 1. Профили сотрудников
create table if not exists public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  email       text not null,
  full_name   text,
  role        text not null default 'intern' check (role in ('pending','intern','mentor','admin','blocked')),
  mentor_id   uuid references public.profiles(id) on delete set null,
  created_at  timestamptz not null default now()
);

alter table public.profiles alter column role set default 'intern';

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

create or replace function public.owner_email() returns text
language sql immutable as $$ select 'lsona2422@gmail.com'::text $$;

create or replace function public.is_owner(uid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = uid and lower(email) = public.owner_email())
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
    case when lower(new.email) = public.owner_email() then 'admin' else 'intern' end
  )
  on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- 5. Владелец всегда администратор (защита на уровне базы)
create or replace function public.keep_owner_admin() returns trigger
language plpgsql set search_path = public as $$
begin
  if lower(new.email) = public.owner_email() then
    new.role := 'admin';
    new.mentor_id := null;
  end if;
  return new;
end $$;

drop trigger if exists profiles_keep_owner on public.profiles;
create trigger profiles_keep_owner
  before insert or update on public.profiles
  for each row execute function public.keep_owner_admin();

-- 6. Действия администратора с пользователями
create or replace function public.require_admin() returns void
language plpgsql stable security definer set search_path = public as $$
begin
  if public.my_role() is distinct from 'admin' then
    raise exception 'Только администратор может это делать';
  end if;
end $$;

-- Роль и наставник
create or replace function public.admin_set_role(target uuid, new_role text, new_mentor uuid default null)
returns void language plpgsql security definer set search_path = public as $$
begin
  perform public.require_admin();
  if new_role not in ('intern','mentor','admin','blocked') then
    raise exception 'Неизвестная роль';
  end if;
  if public.is_owner(target) then
    raise exception 'Роль владельца изменить нельзя';
  end if;
  if target = auth.uid() then
    raise exception 'Свою роль изменить нельзя';
  end if;
  update public.profiles
     set role = new_role,
         mentor_id = case when new_role = 'intern' then new_mentor else null end
   where id = target;
end $$;

-- Имя сотрудника
create or replace function public.admin_set_name(target uuid, new_name text)
returns void language plpgsql security definer set search_path = public as $$
begin
  perform public.require_admin();
  update public.profiles set full_name = left(trim(coalesce(new_name,'')), 120) where id = target;
end $$;

-- Сброс прогресса: весь курс (stage = null) или один день/тест (stage = 'day-3', 'exam-1' …)
create or replace function public.admin_reset_progress(target uuid, stage text default null)
returns void language plpgsql security definer set search_path = public as $$
begin
  perform public.require_admin();
  if stage is null then
    delete from public.progress where user_id = target;
  else
    update public.progress
       set state = jsonb_set(state, '{res}', coalesce(state->'res','{}'::jsonb) - stage),
           updated_at = now()
     where user_id = target;
  end if;
end $$;

-- Удаление пользователя вместе с аккаунтом и прогрессом
create or replace function public.admin_delete_user(target uuid)
returns void language plpgsql security definer set search_path = public, auth as $$
begin
  perform public.require_admin();
  if public.is_owner(target) then
    raise exception 'Владельца удалить нельзя';
  end if;
  if target = auth.uid() then
    raise exception 'Нельзя удалить самого себя';
  end if;
  delete from auth.users where id = target;
end $$;


-- Пароль сотруднику задаёт администратор (без писем). Заодно подтверждает почту.
create or replace function public.admin_set_password(target uuid, new_password text)
returns void language plpgsql security definer set search_path = public, extensions, auth as $$
begin
  perform public.require_admin();
  if length(coalesce(new_password,'')) < 6 then
    raise exception 'Пароль должен быть не короче 6 символов';
  end if;
  if public.is_owner(target) and target is distinct from auth.uid() then
    raise exception 'Пароль владельца может менять только сам владелец';
  end if;
  update auth.users
     set encrypted_password = extensions.crypt(new_password, extensions.gen_salt('bf')),
         email_confirmed_at = coalesce(email_confirmed_at, now()),
         updated_at = now()
   where id = target;
end $$;

-- Подтвердить почту сотрудника вручную (если письмо не пришло)
create or replace function public.admin_confirm_email(target uuid)
returns void language plpgsql security definer set search_path = public, auth as $$
begin
  perform public.require_admin();
  update auth.users set email_confirmed_at = coalesce(email_confirmed_at, now()), updated_at = now() where id = target;
end $$;

-- Статус аккаунтов для панели администратора: почта подтверждена, последний вход
create or replace function public.admin_user_status()
returns table(id uuid, confirmed boolean, last_sign_in timestamptz)
language plpgsql stable security definer set search_path = public, auth as $$
begin
  perform public.require_admin();
  return query select u.id, u.email_confirmed_at is not null, u.last_sign_in_at from auth.users u;
end $$;

-- 7. Права доступа (Row Level Security)
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

-- Менять роль и наставника напрямую нельзя: только через функции администратора.
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
grant execute on function public.admin_set_name(uuid, text) to authenticated;
grant execute on function public.admin_reset_progress(uuid, text) to authenticated;
grant execute on function public.admin_delete_user(uuid) to authenticated;
grant execute on function public.admin_set_password(uuid, text) to authenticated;
grant execute on function public.admin_confirm_email(uuid) to authenticated;
grant execute on function public.admin_user_status() to authenticated;
revoke execute on function public.admin_set_password(uuid, text) from anon;
revoke execute on function public.admin_confirm_email(uuid) from anon;
revoke execute on function public.admin_user_status() from anon;
revoke execute on function public.require_admin() from anon;
grant execute on function public.my_role() to authenticated;

-- 8. Переход на новую логику: все, кто ждал доступа, становятся стажёрами; владелец — администратор
update public.profiles set role = 'intern' where role = 'pending';
update public.profiles set role = 'admin', mentor_id = null where lower(email) = public.owner_email();
insert into public.profiles (id, email, full_name, role)
  select u.id, lower(u.email), coalesce(u.raw_user_meta_data->>'full_name',''),
         case when lower(u.email) = public.owner_email() then 'admin' else 'intern' end
    from auth.users u
   where not exists (select 1 from public.profiles p where p.id = u.id);
