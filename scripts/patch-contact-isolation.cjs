const fs = require("fs");
const path = require("path");

const filePath = path.join(process.cwd(), "app", "chat", "page.tsx");
const source = fs.readFileSync(filePath, "utf8");
let next = source;

// 1. Contacts on the private-chat home screen must only aggregate DIRECT conversations.
// Group conversations use the same conversation_members/messages tables, so they
// must be excluded before they can become private-chat contacts.
const membershipTarget = `      const conversationIds =
        myMemberships.map(
          (item) =>
            item.conversation_id
        );`;

const membershipReplacement = `      const conversationIds =
        myMemberships.map(
          (item) =>
            item.conversation_id
        );

      const { data: conversationRows, error: conversationRowsError } =
        await supabase
          .from("conversations")
          .select("id, type")
          .in("id", conversationIds);

      if (conversationRowsError) {
        console.error("Load conversation types error:", conversationRowsError);
        return;
      }

      const directConversationIds = new Set(
        (conversationRows || [])
          .filter((conversation) => conversation.type === "direct")
          .map((conversation) => conversation.id)
      );`;

if (!next.includes("const directConversationIds = new Set(") && next.includes(membershipTarget)) {
  next = next.replace(membershipTarget, membershipReplacement);
}

// 2. Only map members from direct conversations. Do not alter the existing
// contact creation/automatic-contact behavior for private chats.
const memberLoopMarker = `      allMembers?.forEach(
        (member) => {
          if (
            member.user_id !==
            authUserId
          ) {`;

const memberLoopReplacement = `      allMembers?.forEach(
        (member) => {
          if (!directConversationIds.has(member.conversation_id)) {
            return;
          }

          if (
            member.user_id !==
            authUserId
          ) {`;

if (!next.includes("!directConversationIds.has(") && next.includes(memberLoopMarker)) {
  next = next.replace(memberLoopMarker, memberLoopReplacement);
}

// 3. Realtime INSERT handling must ignore group messages when updating the
// private-chat contact list, while leaving group realtime handling untouched.
const realtimeMembersMarker = `            const {
              data: conversationMembers,
              error: conversationMembersError,
            } = await supabase
              .from("conversation_members")
              .select("user_id")
              .eq(
                "conversation_id",
                newMessage.conversation_id
              );`;

const realtimeMembersReplacement = `            const { data: conversationTypeRow, error: conversationTypeError } =
              await supabase
                .from("conversations")
                .select("type")
                .eq("id", newMessage.conversation_id)
                .maybeSingle();

            if (conversationTypeError) {
              console.error("Incoming conversation type error:", conversationTypeError);
              return;
            }

            // Group messages belong only to the group home. They must never
            // create/update a private-chat contact on /chat.
            if (conversationTypeRow?.type !== "direct") {
              return;
            }

            const {
              data: conversationMembers,
              error: conversationMembersError,
            } = await supabase
              .from("conversation_members")
              .select("user_id")
              .eq(
                "conversation_id",
                newMessage.conversation_id
              );`;

if (!next.includes("Incoming conversation type error:") && next.includes(realtimeMembersMarker)) {
  next = next.replace(realtimeMembersMarker, realtimeMembersReplacement);
}

// IMPORTANT: Do not mutate app/chat/grup/page.tsx from this private-contact
// patch. The group page already contains its working image upload, mobile
// layout, realtime, typing and group controls. Keeping it untouched prevents
// unrelated contact fixes from breaking the group page build/layout.

if (next !== source) {
  fs.writeFileSync(filePath, next, "utf8");
  console.log("Banda Chat: private contacts isolated from group conversations.");
} else {
  console.log("Banda Chat: private-contact filter already applied or source pattern not found.");
}
