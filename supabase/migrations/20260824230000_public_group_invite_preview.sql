-- Banda Chat: public preview for shared group invite links.
-- Anonymous visitors may see only the group's public preview data:
-- name, avatar and member count. No messages, profiles or private settings are exposed.

CREATE OR REPLACE FUNCTION public.get_banda_group_invite_preview(p_invite_code text)
RETURNS TABLE (
  id uuid,
  name text,
  group_avatar_url text,
  member_count bigint
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    c.id,
    c.name,
    c.group_avatar_url,
    (
      SELECT count(*)
      FROM public.conversation_members cm
      WHERE cm.conversation_id = c.id
    ) AS member_count
  FROM public.conversations c
  WHERE c.type = 'group'
    AND c.invite_code = trim(p_invite_code)
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.get_banda_group_invite_preview(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_banda_group_invite_preview(text) TO anon, authenticated;
