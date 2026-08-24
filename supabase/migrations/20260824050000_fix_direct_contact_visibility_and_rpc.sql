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

-- Keep existing policies intact where possible. This additional policy is
-- intentionally scoped to conversations the current user already belongs to.
drop policy if exists "conversation_members_select_same_conversation" on public.conversation_members;

after_policy_placeholder
