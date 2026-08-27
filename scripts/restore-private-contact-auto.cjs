const fs = require("fs");
const path = require("path");

const filePath = path.join(process.cwd(), "app", "chat", "page.tsx");
if (!fs.existsSync(filePath)) process.exit(0);

const source = fs.readFileSync(filePath, "utf8");
let next = source;

// The previous isolation patch incorrectly required a localStorage contact
// list, which blocked a brand-new user who had just sent a private message.
// Restore the original conversation-based contact detection. The separate
// group-contact filter still guarantees that only DIRECT conversations enter
// contactInfo.
const start = next.indexOf("        let savedContactIds: string[] = [];\n");
const end = next.indexOf("        const isContact = savedContactIds.includes(user.id);", start);

if (start >= 0 && end >= start) {
  next = next.slice(0, start) + "        const isContact =\n          Boolean(contactInfo[user.id]?.conversationId);" + next.slice(end + "        const isContact = savedContactIds.includes(user.id);".length);
}

if (next !== source) {
  fs.writeFileSync(filePath, next, "utf8");
  console.log("Banda Chat: automatic private contacts restored; group filtering remains active.");
} else {
  console.log("Banda Chat: automatic private contact restoration already applied.");
}
