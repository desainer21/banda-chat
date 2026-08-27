-- Banda Chat: allow the group owner/admin to clear every message in their group.
CREATE OR REPLACE FUNCTION public.clear_banda_group_messages(
  p_conversation_id uuid
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_owner uuid;
  v_type text;
  v_deleted integer;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Anda harus login.';
  END IF;

  SELECT created_by, type
    INTO v_owner, v_type
  FROM public.conversations
  WHERE id = p_conversation_id;

  IF v_type IS DISTINCT FROM 'group' THEN
    RAISE EXCEPTION 'Grup tidak ditemukan.';
  END IF;

  IF v_uid IS DISTINCT FROM v_owner THEN
    RAISE EXCEPTION 'Hanya admin grup yang dapat menghapus semua pesan.';
  END IF;

  DELETE FROM public.messages
  WHERE conversation_id = p_conversation_id;

  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RETURN v_deleted;
END;
$$;

GRANT EXECUTE ON FUNCTION public.clear_banda_group_messages(uuid) TO authenticated;
