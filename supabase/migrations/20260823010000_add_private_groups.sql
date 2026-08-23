-- Banda Chat: private WhatsApp-style groups
ALTER TABLE public.conversations
  ADD COLUMN IF NOT EXISTS invite_code text,
  ADD COLUMN IF NOT EXISTS members_can_post boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS group_description text;

CREATE UNIQUE INDEX IF NOT EXISTS conversations_invite_code_key
  ON public.conversations(invite_code)
  WHERE invite_code IS NOT NULL;

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
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Anda harus login.'; END IF;
  IF trim(coalesce(p_name, '')) = '' THEN RAISE EXCEPTION 'Nama grup wajib diisi.'; END IF;
  v_code := encode(gen_random_bytes(12), 'hex');

  INSERT INTO public.conversations(type, name, created_by, invite_code, members_can_post, group_description)
  VALUES ('group', trim(p_name), v_uid, v_code, coalesce(p_members_can_post, true), nullif(trim(coalesce(p_description, '')), ''))
  RETURNING * INTO v_conversation;

  INSERT INTO public.conversation_members(conversation_id, user_id)
  VALUES (v_conversation.id, v_uid)
  ON CONFLICT DO NOTHING;

  RETURN v_conversation;
END;
$$;

CREATE OR REPLACE FUNCTION public.add_banda_group_member(
  p_conversation_id uuid,
  p_user_id uuid
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_uid uuid := auth.uid(); v_owner uuid; v_type text;
BEGIN
  SELECT created_by, type INTO v_owner, v_type FROM public.conversations WHERE id = p_conversation_id;
  IF v_uid IS NULL OR v_owner IS NULL OR v_uid <> v_owner OR v_type <> 'group' THEN RAISE EXCEPTION 'Hanya admin grup yang dapat menambah anggota.'; END IF;
  IF p_user_id IS NULL OR p_user_id = v_uid THEN RETURN true; END IF;
  INSERT INTO public.conversation_members(conversation_id, user_id) VALUES (p_conversation_id, p_user_id) ON CONFLICT DO NOTHING;
  RETURN true;
END;
$$;

CREATE OR REPLACE FUNCTION public.remove_banda_group_member(
  p_conversation_id uuid,
  p_user_id uuid
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_uid uuid := auth.uid(); v_owner uuid; v_type text;
BEGIN
  SELECT created_by, type INTO v_owner, v_type FROM public.conversations WHERE id = p_conversation_id;
  IF v_uid IS NULL OR v_owner IS NULL OR v_uid <> v_owner OR v_type <> 'group' THEN RAISE EXCEPTION 'Hanya admin grup yang dapat mengeluarkan anggota.'; END IF;
  IF p_user_id = v_owner THEN RAISE EXCEPTION 'Admin/pemilik grup tidak dapat dikeluarkan.'; END IF;
  DELETE FROM public.conversation_members WHERE conversation_id = p_conversation_id AND user_id = p_user_id;
  RETURN true;
END;
$$;

CREATE OR REPLACE FUNCTION public.set_banda_group_post_permission(
  p_conversation_id uuid,
  p_allowed boolean
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_uid uuid := auth.uid(); v_owner uuid;
BEGIN
  SELECT created_by INTO v_owner FROM public.conversations WHERE id = p_conversation_id AND type = 'group';
  IF v_uid IS NULL OR v_uid <> v_owner THEN RAISE EXCEPTION 'Hanya admin grup yang dapat mengubah pengaturan.'; END IF;
  UPDATE public.conversations SET members_can_post = coalesce(p_allowed, true) WHERE id = p_conversation_id;
  RETURN true;
END;
$$;

CREATE OR REPLACE FUNCTION public.join_banda_group_by_invite(p_invite_code text)
RETURNS public.conversations
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_uid uuid := auth.uid(); v_conversation public.conversations;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Anda harus login.'; END IF;
  SELECT * INTO v_conversation FROM public.conversations WHERE type = 'group' AND invite_code = trim(p_invite_code) LIMIT 1;
  IF NOT FOUND THEN RAISE EXCEPTION 'Link undangan grup tidak valid atau sudah tidak tersedia.'; END IF;
  INSERT INTO public.conversation_members(conversation_id, user_id) VALUES (v_conversation.id, v_uid) ON CONFLICT DO NOTHING;
  RETURN v_conversation;
END;
$$;

CREATE OR REPLACE FUNCTION public.send_banda_group_message(
  p_conversation_id uuid,
  p_content text
)
RETURNS public.messages
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_uid uuid := auth.uid(); v_owner uuid; v_allowed boolean; v_message public.messages;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Anda harus login.'; END IF;
  SELECT created_by, members_can_post INTO v_owner, v_allowed FROM public.conversations WHERE id = p_conversation_id AND type = 'group';
  IF NOT FOUND THEN RAISE EXCEPTION 'Grup tidak ditemukan.'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.conversation_members WHERE conversation_id = p_conversation_id AND user_id = v_uid) THEN RAISE EXCEPTION 'Anda bukan anggota grup ini.'; END IF;
  IF v_uid <> v_owner AND coalesce(v_allowed, true) = false THEN RAISE EXCEPTION 'Admin sedang membatasi postingan anggota.'; END IF;
  IF trim(coalesce(p_content, '')) = '' THEN RAISE EXCEPTION 'Pesan tidak boleh kosong.'; END IF;
  INSERT INTO public.messages(conversation_id, sender_id, content)
  VALUES (p_conversation_id, v_uid, p_content)
  RETURNING * INTO v_message;
  RETURN v_message;
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_banda_group(text,text,boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.add_banda_group_member(uuid,uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.remove_banda_group_member(uuid,uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_banda_group_post_permission(uuid,boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.join_banda_group_by_invite(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.send_banda_group_message(uuid,text) TO authenticated;
