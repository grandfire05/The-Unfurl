-- 모험가 길드 서버 스키마 (Supabase SQL Editor에 통째로 붙여넣고 Run)

-- 1) 세이브: 계정당 1줄
create table if not exists public.saves (
  user_id uuid primary key references auth.users(id) on delete cascade,
  data jsonb not null,
  version int not null default 1,
  updated_at timestamptz not null default now()
);
alter table public.saves enable row level security;
create policy "own save select" on public.saves for select using (auth.uid() = user_id);
create policy "own save insert" on public.saves for insert with check (auth.uid() = user_id);
create policy "own save update" on public.saves for update using (auth.uid() = user_id);

-- 2) 고유스킬 소유: 스킬 번호(0~499)가 기본키라 같은 스킬은 한 명만 가질 수 있다
create table if not exists public.skill_owners (
  skill int primary key check (skill between 0 and 499),
  user_id uuid not null references auth.users(id) on delete cascade,
  char_id text not null,
  acquired_at timestamptz not null default now()
);
alter table public.skill_owners enable row level security;
-- 누가 가졌는지는 전부 볼 수 있다(도감의 주인 있음/없음 표시용). 쓰기는 아래 함수로만.
create policy "skill owners readable" on public.skill_owners for select using (true);

-- 비어 있는 스킬 중 하나를 무작위로 뽑아 내 것으로 만든다. 없으면 null.
create or replace function public.acquire_random_skill(p_char_id text)
returns int language plpgsql security definer set search_path = public as $$
declare s int; tries int := 0;
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  loop
    select g into s from generate_series(0, 499) g
      where not exists (select 1 from public.skill_owners o where o.skill = g)
      order by random() limit 1;
    if s is null then return null; end if;
    begin
      insert into public.skill_owners(skill, user_id, char_id) values (s, auth.uid(), p_char_id);
      return s;
    exception when unique_violation then
      tries := tries + 1;
      if tries > 20 then return null; end if;
    end;
  end loop;
end $$;

-- 내 스킬을 놓아 준다(보유자가 죽었을 때)
create or replace function public.release_skill(p_skill int)
returns void language sql security definer set search_path = public as $$
  delete from public.skill_owners where skill = p_skill and user_id = auth.uid();
$$;

-- 3) 접속 유지용(무료 플랜은 7일 요청이 없으면 멈춘다): 아무 값도 안 바꾸는 가벼운 호출
create or replace function public.ping() returns text language sql as $$ select 'ok'::text; $$;
grant execute on function public.ping() to anon, authenticated;
grant execute on function public.acquire_random_skill(text) to authenticated;
grant execute on function public.release_skill(int) to authenticated;

-- 채팅은 표 없이 Realtime Broadcast만 쓴다(접속한 뒤 오는 메시지만 보임, 기록 저장 없음).
