-- Banda Chat: group contact metadata, per-user group unread state, and group avatar

ALTER TABLE public.conversations
  ADD COLUMN IF NOT EXISTS group_avatar_url text;

CREATE TABLE IF NOT EXISTS public.group_message_reads (
  message_id uuid NOT NULL REFERENCES public.messages(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  read_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (message_id, user_id)
);

CREATE INDEX IF NOT EXISTS group_message_reads_user_message_idx
  ON public.group_message_reads(user_id, message_id);

ALTER TABLE public.group_message_reads ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "group_message_reads_select_own" ON public.group_message_reads;
CREATE POLICY "group_message_reads_select_own"
  ON public.group_message_reads
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "group_message_reads_insert_own" ON public.group_message_reads;
CREATE POLICY "group_message_reads_insert_own"
  ON public.group_message_reads
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.mark_banda_group_read(p_conversation_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_count integer := 0;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Anda harus login.';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.conversations c
    JOIN public.conversation_members cm ON cm.conversation_id = c.id
    WHERE c.id = p_conversation_id
      AND c.type = 'group'
      AND cm.user_id = v_uid
  ) THEN
    RAISE EXCEPTION 'Anda bukan anggota grup ini.';
  END IF;

  INSERT INTO public.group_message_reads(message_id, user_id, read_at)
  SELECT m.id, v_uid, now()
  FROM public.messages m
  WHERE m.conversation_id = p_conversation_id
    AND m.sender_id <> v_uid
  ON CONFLICT (message_id, user_id)
  DO UPDATE SET read_at = EXCLUDED.read_at;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_banda_group_unread_counts()
RETURNS TABLE(conversation_id uuid, unread_count bigint)
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT
    cm.conversation_id,
    count(m.id)::bigint AS unread_count
  FROM public.conversation_members cm
  JOIN public.conversations c
    ON c.id = cm.conversation_id
   AND c.type = 'group'
  JOIN public.messages m
    ON m.conversation_id = cm.conversation_id
   AND m.sender_id <> auth.uid()
  LEFT JOIN public.group_message_reads r
    ON r.message_id = m.id
   AND r.user_id = auth.uid()
  WHERE cm.user_id = auth.uid()
    AND r.message_id IS NULL
  GROUP BY cm.conversation_id;
$$;

CREATE OR REPLACE FUNCTION public.update_banda_group(
  p_conversation_id uuid,
  p_name text,
  p_description text DEFAULT NULL,
  p_avatar_url text DEFAULT NULL
)
RETURNS public.conversations
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_group public.conversations;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Anda harus login.';
  END IF;

  IF trim(coalesce(p_name, '')) = '' THEN
    RAISE EXCEPTION 'Nama grup wajib diisi.';
  END IF;

  UPDATE public.conversations
  SET
    name = trim(p_name),
    group_description = nullif(trim(coalesce(p_description, '')), ''),
    group_avatar_url = nullif(trim(coalesce(p_avatar_url, '')), '')
  WHERE id = p_conversation_id
    AND type = 'group'
    AND created_by = v_uid
  RETURNING * INTO v_group;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Hanya admin grup yang dapat mengedit grup.';
  END IF;

  RETURN v_group;
END;
$$;

GRANT EXECUTE ON FUNCTION public.mark_banda_group_read(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_banda_group_unread_counts() TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_banda_group(uuid,text,text,text) TO authenticated;

-- Public group-avatar bucket. The database RPC above remains the authority
-- that decides which user may actually attach an uploaded URL to a group.
INSERT INTO storage.buckets (id, name, public)
VALUES ('group-avatars', 'group-avatars', true)
ON CONFLICT (id) DO UPDATE SET public = true;

DROP POLICY IF EXISTS "group_avatars_public_read" ON storage.objects;
CREATE POLICY "group_avatars_public_read"
  ON storage.objects
  FOR SELECT
  USING (bucket_id = 'group-avatars');

DROP POLICY IF EXISTS "group_avatars_authenticated_upload" ON storage.objects;
CREATE POLICY "group_avatars_authenticated_upload"
  ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'group-avatars');

DROP POLICY IF EXISTS "group_avatars_authenticated_update" ON storage.objects;
CREATE POLICY "group_avatars_authenticated_update"
  ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'group-avatars')
  WITH CHECK (bucket_id = 'group-avatars');
