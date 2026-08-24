-- Banda Chat: repair missing profile rows and keep group unread state separate from direct-chat unread badges.

-- 1) Repair accounts that exist in auth.users but do not yet have a profiles row.
--    This fixes the profile editor's single-row error for accounts created before
--    the profile upsert completed successfully.
INSERT INTO public.profiles (id, full_name, username, avatar_url)
SELECT
  u.id,
  COALESCE(NULLIF(trim(u.raw_user_meta_data ->> 'full_name'), ''), split_part(u.email, '@', 1), 'Pengguna'),
  NULL,
  NULL
FROM auth.users u
WHERE NOT EXISTS (
  SELECT 1
  FROM public.profiles p
  WHERE p.id = u.id
);

-- 2) Group messages must not participate in the legacy direct-chat unread
--    calculation, because group unread is tracked per member by
--    public.group_message_reads.
CREATE OR REPLACE FUNCTION public.banda_group_messages_are_already_read()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.conversations c
    WHERE c.id = NEW.conversation_id
      AND c.type = 'group'
  ) THEN
    NEW.read_at := COALESCE(NEW.read_at, NEW.created_at, now());
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS banda_group_messages_read_marker ON public.messages;
CREATE TRIGGER banda_group_messages_read_marker
BEFORE INSERT ON public.messages
FOR EACH ROW
EXECUTE FUNCTION public.banda_group_messages_are_already_read();

-- Repair existing group messages so they no longer appear as unread in the
-- direct-chat contact calculation. The dedicated group unread RPC remains
-- independent and continues to use group_message_reads per user.
UPDATE public.messages m
SET read_at = COALESCE(m.read_at, m.created_at, now())
FROM public.conversations c
WHERE c.id = m.conversation_id
  AND c.type = 'group'
  AND m.read_at IS NULL;
