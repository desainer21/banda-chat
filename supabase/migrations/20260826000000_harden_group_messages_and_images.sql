-- Banda Chat: harden group message persistence and image-message support.
-- Safe to run more than once.

ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS image_url text;

-- Keep the existing group send RPC, but explicitly return the inserted row
-- after the insert so text messages remain persisted even when message
-- metadata columns evolve.
CREATE OR REPLACE FUNCTION public.send_banda_group_message(
  p_conversation_id uuid,
  p_content text
)
RETURNS public.messages
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_owner uuid;
  v_allowed boolean;
  v_message public.messages;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Anda harus login.';
  END IF;

  SELECT created_by, members_can_post
    INTO v_owner, v_allowed
  FROM public.conversations
  WHERE id = p_conversation_id
    AND type = 'group';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Grup tidak ditemukan.';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.conversation_members
    WHERE conversation_id = p_conversation_id
      AND user_id = v_uid
  ) THEN
    RAISE EXCEPTION 'Anda bukan anggota grup ini.';
  END IF;

  IF v_uid <> v_owner AND coalesce(v_allowed, true) = false THEN
    RAISE EXCEPTION 'Admin sedang membatasi postingan anggota.';
  END IF;

  IF trim(coalesce(p_content, '')) = '' THEN
    RAISE EXCEPTION 'Pesan tidak boleh kosong.';
  END IF;

  INSERT INTO public.messages(conversation_id, sender_id, content)
  VALUES (p_conversation_id, v_uid, trim(p_content))
  RETURNING * INTO v_message;

  RETURN v_message;
END;
$$;

GRANT EXECUTE ON FUNCTION public.send_banda_group_message(uuid,text) TO authenticated;

-- Ensure the existing group image bucket is available without changing
-- the application's layout or message UI.
INSERT INTO storage.buckets (id, name, public)
VALUES ('group-images', 'group-images', true)
ON CONFLICT (id) DO UPDATE SET public = true;

DROP POLICY IF EXISTS "group_images_public_read" ON storage.objects;
CREATE POLICY "group_images_public_read"
  ON storage.objects
  FOR SELECT
  USING (bucket_id = 'group-images');

DROP POLICY IF EXISTS "group_images_authenticated_upload" ON storage.objects;
CREATE POLICY "group_images_authenticated_upload"
  ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'group-images');
