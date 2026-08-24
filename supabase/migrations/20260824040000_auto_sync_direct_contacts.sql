-- Banda Chat: ensure direct-message conversations always contain both users.
-- This migration intentionally does not modify messages, storage, realtime, or UI.

create or replace function public.create_direct_conversation(p_other_user_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_me uuid := auth.uid();
  v_conversation_id uuid;
begin
  if v_me is null then
    raise exception 'Not authenticated';
  end if;

  if p_other_user_id is null or p_other_user_id = v_me then
    raise exception 'Invalid other user';
  end if;

  select c.id
    into v_conversation_id
  from public.conversations c
  where c.type = 'direct'
    and exists (
      select 1 from public.conversation_members m
      where m.conversation_id = c.id and m.user_id = v_me
    )
    and exists (
      select 1 from public.conversation_members m
      where m.conversation_id = c.id and m.user_id = p_other_user_id
    )
  order by c.created_at asc
  limit 1;

  if v_conversation_id is null then
    insert into public.conversations (type)
    values ('direct')
    returning id into v_conversation_id;
  end if;

  insert into public.conversation_members (conversation_id, user_id)
  values (v_conversation_id, v_me)
  on conflict do nothing;

  insert into public.conversation_members (conversation_id, user_id)
  values (v_conversation_id, p_other_user_id)
  on conflict do nothing;

  return v_conversation_id;
end;
$$;

revoke all on function public.create_direct_conversation(uuid) from public;
grant execute on function public.create_direct_conversation(uuid) to authenticated;
