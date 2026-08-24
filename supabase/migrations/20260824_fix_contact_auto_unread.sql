-- Banda Chat: ensure every member can read their own conversation memberships.
-- This makes the existing contact loader discover a newly-created direct conversation
-- after another user sends the first message. It does not change message/chat data.

alter table public.conversation_members enable row level security;

 drop policy if exists "conversation_members_select_own" on public.conversation_members;
 create policy "conversation_members_select_own"
 on public.conversation_members
 for select
 to authenticated
 using (user_id = auth.uid());
