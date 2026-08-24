-- Banda Chat: final fix for automatic direct contacts.
-- The existing app/chat/page.tsx reads conversation_members directly.
-- It must be able to see the other member of conversations the current
-- authenticated user belongs to.

create or replace function public.banda_can_view_conversation_members(
  p_conversation_id uuid,
  p_user_id uuid
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
      and cm.user_id = p_user_id
  );
$$;

revoke all on function public.banda_can_view_conversation_members(uuid, uuid) from public;
grant execute on function public.banda_can_view_conversation_members(uuid, uuid) to authenticated;

alter table public.conversation_members enable row level security;

-- Remove policies created by earlier attempts. Dropping a missing policy is safe.
drop policy if exists "conversation_members_select_own" on public.conversation_members;
drop policy if exists "conversation_members_select_same_conversation" on public.conversation_members;
drop policy if exists "conversation_members_select_conversation" on public.conversation_members;

create policy "conversation_members_select_same_conversation"
on public.conversation_members
for select
to authenticated
using (
  public.banda_can_view_conversation_members(
    conversation_id,
    auth.uid()
  )
);
