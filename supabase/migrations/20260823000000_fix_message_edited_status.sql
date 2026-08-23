-- Fix Banda Chat message "diedit" status.
--
-- Problem:
-- updated_at was being populated when a message was INSERTed, so the
-- frontend interpreted every message as edited.
--
-- Desired behavior:
-- 1. New messages start with updated_at = NULL.
-- 2. updated_at is set only when message content is actually changed.
-- 3. Changes to read_at or other fields do not mark the message as edited.

ALTER TABLE public.messages
  ALTER COLUMN updated_at DROP DEFAULT;

ALTER TABLE public.messages
  ALTER COLUMN updated_at DROP NOT NULL;

-- Existing rows cannot reliably be distinguished as edited/un-edited because
-- the old schema stored an update timestamp at message creation. Clear that
-- ambiguous metadata so existing messages do not incorrectly show "diedit".
UPDATE public.messages
SET updated_at = NULL;

CREATE OR REPLACE FUNCTION public.set_message_updated_at_on_content_change()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.content IS DISTINCT FROM OLD.content THEN
    NEW.updated_at = now();
  ELSE
    NEW.updated_at = OLD.updated_at;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS set_message_updated_at ON public.messages;
DROP TRIGGER IF EXISTS messages_set_updated_at ON public.messages;
DROP TRIGGER IF EXISTS update_messages_updated_at ON public.messages;

CREATE TRIGGER set_message_updated_at
BEFORE UPDATE OF content ON public.messages
FOR EACH ROW
EXECUTE FUNCTION public.set_message_updated_at_on_content_change();
