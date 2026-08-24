-- Banda Chat: fix group creation when pgcrypto/gen_random_bytes is unavailable
-- Do not change the existing group behavior. Only replace invite-code generation.

CREATE OR REPLACE FUNCTION public.create_banda_group(
  p_name text,
  p_description text DEFAULT NULL,
  p_members_can_post boolean DEFAULT true
)
RETURNS public.conversations
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_conversation public.conversations;
  v_code text;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Anda harus login.';
  END IF;

  IF trim(coalesce(p_name, '')) = '' THEN
    RAISE EXCEPTION 'Nama grup wajib diisi.';
  END IF;

  -- gen_random_uuid() is available in Supabase/PostgreSQL without requiring
  -- the pgcrypto gen_random_bytes() function. Removing gen_random_bytes()
  -- avoids the current "function gen_random_bytes(integer) does not exist" error.
  v_code := replace(gen_random_uuid()::text, '-', '');

  INSERT INTO public.conversations(
    type,
    name,
    created_by,
    invite_code,
    members_can_post,
    group_description
  )
  VALUES (
    'group',
    trim(p_name),
    v_uid,
    v_code,
    coalesce(p_members_can_post, true),
    nullif(trim(coalesce(p_description, '')), '')
  )
  RETURNING * INTO v_conversation;

  INSERT INTO public.conversation_members(conversation_id, user_id)
  VALUES (v_conversation.id, v_uid)
  ON CONFLICT DO NOTHING;

  RETURN v_conversation;
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_banda_group(text,text,boolean) TO authenticated;
