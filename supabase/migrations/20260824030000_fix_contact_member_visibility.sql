-- Banda Chat: allow a logged-in user to read all members of conversations they belong to.
-- This is required by app/chat/page.tsx when it resolves the other participant
-- for the contact list. It intentionally does not expose memberships for
-- conversations the current user does not belong to.

CREATE OR REPLACE FUNCTION public.banda_is_conversation_member(
  p_conversation_id uuid,
  p_user_id uuid
)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.conversation_members cm
    WHERE cm.conversation_id = p_conversation_id
      AND cm.user_id = p_user_id
  );
$$;

GRANT EXECUTE ON FUNCTION public.banda_is_conversation_member(uuid, uuid)
TO authenticated;

ALTER TABLE public.conversation_members ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "conversation_members_select_own"
ON public.conversation_members;

DROP POLICY IF EXISTS "conversation_members_select_same_conversation"
ON public.conversation_members;

CREATE POLICY "conversation_members_select_same_conversation"
ON public.conversation_members
FOR SELECT
TO authenticated
USING (
  public.banda_is_conversation_member(
    conversation_id,
    auth.uid()
  )
);
