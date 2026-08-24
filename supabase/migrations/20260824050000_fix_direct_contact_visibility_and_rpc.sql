-- Banda Chat: final repair for automatic direct contacts.
-- 1) Allows a logged-in member to read the other members of conversations
--    that they themselves belong to, without exposing unrelated conversations.
-- 2) Keeps create_direct_conversation parameter name aligned with the
--    frontend RPC call: target_user_id.

create or replace function public.banda_can_view_conversation_members(
  p_conversation_id uuid
)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1
    from public.conversation_members cm
    where cm.conversation_id = p_conversation_id
      and cm.user_id = auth.uid()
  );
$$;

revoke all on function public.banda_can_view_conversation_members(uuid) from public;
grant execute on function public.banda_can_view_conversation_members(uuid) to authenticated;

alter table public.conversation_members enable row level security;

-- Existing SELECT policies are intentionally left in place. PostgreSQL
-- combines permissive SELECT policies with OR, so this safely expands access
-- only for conversations in which the current user is already a member.
drop policy if exists "conversation_members_select_same_conversation" on public.conversation_members;

drop policy if exists "conversation_members_select_conversation" on public.conversation_members;

create policy "conversation_members_select_same_conversation"
on public.conversation_members
for select
to authenticated
using (
  public.banda_can_view_conversation_members(conversation_id)
);

-- Keep the RPC argument name exactly the same as the frontend call:
-- supabase.rpc("create_direct_conversation", { target_user_id: user.id })
create or replace function public.create_direct_conversation(
  target_user_id uuid
)
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

  if target_user_id is null or target_user_id = v_me then
    raise exception 'Invalid other user';
  end if;

  select c.id
    into v_conversation_id
  from public.conversations c
  where c.type = 'direct'
    and exists (
      select 1
      from public.conversation_members m
      where m.conversation_id = c.id
        and m.user_id = v_me
    )
    and exists (
      select 1
      from public.conversation_members m
      where m.conversation_id = c.id
        and m.user_id = target_user_id
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
  values (v_conversation_id, target_user_id)
  on conflict do nothing;

  return v_conversation_id;
end;
$$;

revoke all on function public.create_direct_conversation(uuid) from public;
grant execute on function public.create_direct_conversation(uuid) to authenticated;
