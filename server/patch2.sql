-- patch1.sql 까지 실행한 뒤에 추가로 실행하세요.

-- 1) 모험가 외모: 서버 전체에서 한 번에 한 명만 가진다(기본키라 동시에 눌러도 한쪽만 통과)
create table if not exists public.appearances (
  appearance_id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  char_id text not null,
  created_at timestamptz not null default now()
);
alter table public.appearances enable row level security;  -- 정책을 만들지 않으니 함수로만 접근 가능

create or replace function public.claim_appearance(p_id text, p_char_id text)
returns boolean language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  insert into public.appearances(appearance_id, user_id, char_id) values (p_id, auth.uid(), p_char_id)
    on conflict (appearance_id) do nothing;
  return exists (select 1 from public.appearances where appearance_id = p_id and user_id = auth.uid() and char_id = p_char_id);
end $$;

-- 여러 개를 한 번에 등록하고, 이미 다른 사람이 가진 외모의 모험가 id 목록을 돌려준다
create or replace function public.claim_appearances(p_ids text[], p_chars text[])
returns text[] language plpgsql security definer set search_path = public as $$
declare i int; bad text[] := '{}';
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  for i in 1 .. coalesce(array_length(p_ids, 1), 0) loop
    insert into public.appearances(appearance_id, user_id, char_id) values (p_ids[i], auth.uid(), p_chars[i])
      on conflict (appearance_id) do nothing;
    if not exists (select 1 from public.appearances where appearance_id = p_ids[i] and user_id = auth.uid() and char_id = p_chars[i]) then
      bad := bad || p_chars[i];
    end if;
  end loop;
  return bad;
end $$;
grant execute on function public.claim_appearance(text, text) to authenticated;
grant execute on function public.claim_appearances(text[], text[]) to authenticated;

-- 2) 마지막 접속 시각을 계정에 기록(어느 기기에서 접속해도 같은 사람의 접속으로 본다)
create table if not exists public.user_seen (
  user_id uuid primary key references auth.users(id) on delete cascade,
  last_seen timestamptz not null default now()
);
alter table public.user_seen enable row level security;

-- 접속 시각을 갱신하고, 직전 접속 이후 다른 길드가 얻은 고유스킬 수를 돌려준다
create or replace function public.touch_seen()
returns jsonb language plpgsql security definer set search_path = public as $$
declare prev timestamptz; n int := 0;
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  select last_seen into prev from public.user_seen where user_id = auth.uid();
  if prev is not null then
    select count(*) into n from public.skill_owners where acquired_at > prev and user_id <> auth.uid();
  end if;
  insert into public.user_seen(user_id, last_seen) values (auth.uid(), now())
    on conflict (user_id) do update set last_seen = now();
  return jsonb_build_object('prev', prev, 'away', n);
end $$;
grant execute on function public.touch_seen() to authenticated;
