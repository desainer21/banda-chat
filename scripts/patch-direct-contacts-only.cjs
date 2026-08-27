const fs = require("fs");
const path = require("path");

const filePath = path.join(process.cwd(), "app", "chat", "page.tsx");
const source = fs.readFileSync(filePath, "utf8");

// Only change the contact-loader scope: group conversations must never create
// private-chat home contacts. Direct-message automatic contacts remain intact.
const marker = "// banda-direct-contacts-only-v1";
if (source.includes(marker)) {
  console.log("Banda Chat: direct-contact-only patch already applied.");
  process.exit(0);
}

const target = `      const conversationIds = (myMemberships || []).map(\n        (item) => item.conversation_id\n      );\n\n      if (conversationIds.length === 0) {`;

const replacement = `      const conversationIds = (myMemberships || []).map(\n        (item) => item.conversation_id\n      );\n\n      // ${marker}\n      // Keep only direct/private conversations for the private-chat home.\n      // Group messages are handled by the separate group page/notification system.\n      if (conversationIds.length > 0) {\n        const { data: directConversations, error: directConversationError } =\n          await supabase\n            .from("conversations")\n            .select("id")\n            .in("id", conversationIds)\n            .neq("type", "group");\n\n        if (directConversationError) {\n          console.error(\n            "Load direct conversation types error:",\n            directConversationError\n          );\n        } else {\n          const directIds = new Set(\n            (directConversations || []).map((conversation) => conversation.id)\n          );\n          for (let index = conversationIds.length - 1; index >= 0; index -= 1) {\n            if (!directIds.has(conversationIds[index])) {\n              conversationIds.splice(index, 1);\n            }\n          }\n        }\n      }\n\n      if (conversationIds.length === 0) {`;

if (!source.includes(target)) {
  throw new Error("Direct-contact patch gagal: blok conversationIds tidak ditemukan.");
}

const next = source.replace(target, replacement, 1);
fs.writeFileSync(filePath, next, "utf8");
console.log("Banda Chat: private-chat home now ignores group conversations; direct automatic contacts preserved.");
