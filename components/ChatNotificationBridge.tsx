"use client";

import { useEffect } from "react";
import { supabase } from "@/lib/supabase";

/**
 * Handles navigation from a private-chat notification without modifying the
 * existing chat page. It uses the same conversation id that the notification
 * already knows, then dispatches a browser event for the chat page to handle.
 */
export default function ChatNotificationBridge() {
  useEffect(() => {
    if (window.location.pathname !== "/chat") return;

    const params = new URLSearchParams(window.location.search);
    const conversationId = params.get("conversation");
    const senderId = params.get("user");
    if (!conversationId && !senderId) return;

    let cancelled = false;

    const openConversation = async () => {
      let resolvedConversationId = conversationId;

      // Older notification links may contain only the sender id. Resolve the
      // direct conversation from the existing membership data when possible.
      if (!resolvedConversationId && senderId) {
        const { data: sessionData } = await supabase.auth.getSession();
        const currentUserId = sessionData.session?.user?.id;
        if (!currentUserId) return;

        const { data: mine } = await supabase
          .from("conversation_members")
          .select("conversation_id")
          .eq("user_id", currentUserId);

        const myConversationIds = (mine || []).map(
          (row: { conversation_id: string }) => row.conversation_id,
        );

        if (!myConversationIds.length) return;

        const { data: theirs } = await supabase
          .from("conversation_members")
          .select("conversation_id")
          .eq("user_id", senderId)
          .in("conversation_id", myConversationIds);

        if (theirs?.length) {
          resolvedConversationId = theirs[0].conversation_id;
        }
      }

      if (cancelled || !resolvedConversationId) return;

      // The existing chat page owns the actual conversation-opening logic.
      // Ask it to open the exact conversation instead of trying to locate a
      // sidebar button by name/text.
      window.dispatchEvent(
        new CustomEvent("banda-open-conversation", {
          detail: {
            conversationId: resolvedConversationId,
            senderId: senderId || null,
          },
        }),
      );

      // Give the chat page a short opportunity to process the event before
      // removing the notification query parameters.
      window.setTimeout(() => {
        if (!cancelled) window.history.replaceState({}, "", "/chat");
      }, 500);
    };

    void openConversation();

    return () => {
      cancelled = true;
    };
  }, []);

  return null;
}
