-- patch2.sql 까지 실행한 뒤에 추가로 실행하세요.
-- 길드 이름: 서버 전체에서 하나뿐 (대소문자·앞뒤 공백 무시), 한 계정은 이름 하나
create table if not exists public.guild_names (
  name_key text primary key,
  name text not null,
  user_id uuid not null unique references auth.users(id) on delete cascade,
  updated_at timestamptz not null default now()
);
alter table public.guild_names enable row level security;  -- 정책 없음: 함수로만 접근

create or replace function public.guild_name_available(p_name text)
returns boolean language sql security definer set search_path = public as $$
  select not exists (
    select 1 from public.guild_names
    where name_key = lower(btrim(p_name)) and user_id <> auth.uid()
  );
$$;

-- 이름을 내 것으로 등록(이전 이름은 풀려남). 이미 다른 사람이 쓰고 있으면 false.
create or replace function public.claim_guild_name(p_name text)
returns boolean language plpgsql security definer set search_path = public as $$
declare k text := lower(btrim(p_name));
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  if char_length(k) < 2 or char_length(k) > 8 then return false; end if;
  if exists (select 1 from public.guild_names where name_key = k and user_id <> auth.uid()) then return false; end if;
  begin
    insert into public.guild_names(name_key, name, user_id) values (k, btrim(p_name), auth.uid())
      on conflict (user_id) do update set name_key = excluded.name_key, name = excluded.name, updated_at = now();
  exception when unique_violation then
    return false; -- 동시에 같은 이름을 잡은 경우
  end;
  return true;
end $$;
grant execute on function public.guild_name_available(text) to authenticated;
grant execute on function public.claim_guild_name(text) to authenticated;
