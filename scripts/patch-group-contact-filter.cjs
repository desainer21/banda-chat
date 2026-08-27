const fs = require("fs");
const path = require("path");

const filePath = path.join(process.cwd(), "app", "chat", "page.tsx");
let source = fs.readFileSync(filePath, "utf8");
let next = source;

// 1. The private-chat contact list must only aggregate DIRECT conversations.
// Group conversations use the same conversation_members/messages tables, so
// they must be excluded before they can become sidebar/home contacts.
const membershipMarker = `      const conversationIds =
        myMemberships.map(
          (item) =>
            item.conversation_id
        );

      const {
        data: allMembers,`;

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
        console.error(
          "Load conversation types error:",
          conversationRowsError
        );
        return;
      }

      const directConversationIds = new Set(
        (conversationRows || [])
          .filter((conversation) => conversation.type === "direct")
          .map((conversation) => conversation.id)
      );

      const {
        data: allMembers,`;

if (
  !next.includes("const directConversationIds = new Set(") &&
  next.includes(membershipMarker)
) {
  next = next.replace(membershipMarker, membershipReplacement);
}

// Only map members from direct conversations. This preserves the existing
// private-chat automatic-contact behavior while completely ignoring groups.
const memberLoopMarker = `      allMembers?.forEach(
        (member) => {
          if (
            member.user_id !==
            authUserId
          ) {`;

const memberLoopReplacement = `      allMembers?.forEach(
        (member) => {
          if (
            !directConversationIds.has(
              member.conversation_id
            )
          ) {
            return;
          }

          if (
            member.user_id !==
            authUserId
          ) {`;

if (
  !next.includes("!directConversationIds.has(") &&
  next.includes(memberLoopMarker)
) {
  next = next.replace(memberLoopMarker, memberLoopReplacement);
}

// 2. Realtime INSERT handling must not create a private contact for a group
// message. Check the conversation type before looking for the "other" member.
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
              console.error(
                "Incoming conversation type error:",
                conversationTypeError
              );
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

if (
  !next.includes("Incoming conversation type error:") &&
  next.includes(realtimeMembersMarker)
) {
  next = next.replace(
    realtimeMembersMarker,
    realtimeMembersReplacement
  );
}

if (next !== source) {
  fs.writeFileSync(filePath, next, "utf8");
  console.log(
    "Banda Chat: group conversations are now excluded from private-chat contacts."
  );
} else {
  console.log(
    "Banda Chat: group/private contact filter already applied or source pattern not found."
  );
}
