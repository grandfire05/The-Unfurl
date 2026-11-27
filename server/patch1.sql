-- schema.sql 을 이미 실행한 뒤에 추가로 실행하세요 (스킬을 번호로 직접 등록하는 함수)
create or replace function public.claim_skill(p_skill int, p_char_id text)
returns boolean language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  if p_skill < 0 or p_skill > 499 then return false; end if;
  insert into public.skill_owners(skill, user_id, char_id) values (p_skill, auth.uid(), p_char_id)
    on conflict (skill) do nothing;
  -- 방금 넣었거나, 이미 내 같은 모험가의 것이면 성공
  return exists (select 1 from public.skill_owners where skill = p_skill and user_id = auth.uid() and char_id = p_char_id);
end $$;
grant execute on function public.claim_skill(int, text) to authenticated;
