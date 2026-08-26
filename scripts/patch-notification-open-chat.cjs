const fs = require("fs");
const path = require("path");

const filePath = path.join(process.cwd(), "app", "chat", "page.tsx");
const source = fs.readFileSync(filePath, "utf8");
const marker = "// banda-notification-open-chat-v2";

if (source.includes(marker)) {
  console.log("Banda Chat: notification open-chat patch already applied.");
  process.exit(0);
}

const listener = `
  /* ============================================================
     NOTIFICATION -> OPEN PRIVATE CHAT
     ============================================================ */

  ${marker}
  useEffect(() => {
    if (!currentUserId) return;

    const handleNotificationOpen = (event: Event) => {
      const customEvent = event as CustomEvent<{
        conversationId?: string;
        senderId?: string | null;
      }>;

      const senderId = customEvent.detail?.senderId;
      if (!senderId) return;

      const targetUser = users.find((user) => user.id === senderId);
      if (!targetUser) return;

      void startChat(targetUser);
    };

    window.addEventListener("banda-open-conversation", handleNotificationOpen);
    return () => {
      window.removeEventListener("banda-open-conversation", handleNotificationOpen);
    };
  }, [currentUserId, users]);
`;

// Insert immediately before the component's final JSX return. This keeps the
// listener inside the existing ChatPage closure, so it can call startChat()
// directly without changing the chat UI or messaging implementation.
const returnIndex = source.lastIndexOf("\n  return (");
if (returnIndex < 0) {
  console.error("Banda Chat: could not locate ChatPage JSX return; no changes made.");
  process.exit(1);
}

const next = source.slice(0, returnIndex) + "\n" + listener + source.slice(returnIndex);
fs.writeFileSync(filePath, next, "utf8");
console.log("Banda Chat: notification private-chat navigation listener applied.");
