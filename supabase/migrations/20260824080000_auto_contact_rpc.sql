-- Banda Chat: authoritative direct-contact query.
-- This bypasses conversation_members RLS safely and returns only
-- conversations where the authenticated user is a member.

create or replace function public.get_my_direct_contacts()
returns table (
  user_id uuid,
  conversation_id uuid,
  last_message text,
  last_message_at timestamptz,
  unread_count bigint
)
language sql
security definer
stable
set search_path = public
as $$
  select
    other.user_id,
    c.id,
    latest.content,
    latest.created_at,
    coalesce(unread.total, 0)::bigint
  from public.conversations c
  join public.conversation_members me
    on me.conversation_id = c.id
   and me.user_id = auth.uid()
  join public.conversation_members other
    on other.conversation_id = c.id
   and other.user_id <> auth.uid()
  left join lateral (
    select m.content, m.created_at
    from public.messages m
    where m.conversation_id = c.id
    order by m.created_at desc
    limit 1
  ) latest on true
  left join lateral (
    select count(*)::bigint as total
    from public.messages m
    where m.conversation_id = c.id
      and m.sender_id <> auth.uid()
      and m.read_at is null
  ) unread on true
  where c.type = 'direct'
  order by latest.created_at desc nulls last;
$$;

revoke all on function public.get_my_direct_contacts() from public;
grant execute on function public.get_my_direct_contacts() to authenticated;
