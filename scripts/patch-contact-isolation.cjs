const fs = require("fs");
const path = require("path");

const filePath = path.join(process.cwd(), "app", "chat", "page.tsx");
const source = fs.readFileSync(filePath, "utf8");
let next = source;

// 1. Reset in-memory chat state when the authenticated user really changes.
const loadChatTarget = `      const authUserId =\n        session.user.id;\n\n      setCurrentUserId(authUserId);`;
const loadChatReplacement = `      const authUserId =\n        session.user.id;\n\n      // Jangan membawa state kontak/chat dari akun sebelumnya.\n      if (currentUserId && currentUserId !== authUserId) {\n        setUsers([]);\n        setContactInfo({});\n        setSelectedUser(null);\n        setSelectedConversation(null);\n        setMessages([]);\n        setSearch("");\n        setMobileChatOpen(false);\n      }\n\n      setCurrentUserId(authUserId);`;
if (!next.includes("// Jangan membawa state kontak/chat dari akun sebelumnya.")) {
  if (next.includes(loadChatTarget)) {
    next = next.replace(loadChatTarget, loadChatReplacement);
  }
}

// 2. Contacts on the home screen are scoped to the currently logged-in account.
// Existing database conversations are intentionally NOT enough to make an account
// appear on the home screen. A contact becomes visible after that account has been
// explicitly selected from the exact-name search and startChat() is invoked.
const contactTarget = `        const isContact =\n          Boolean(contactInfo[user.id]?.conversationId);`;
const contactReplacement = `        let savedContactIds: string[] = [];\n\n        if (typeof window !== "undefined" && currentUserId) {\n          try {\n            const raw = window.localStorage.getItem(\n              \`banda-chat-contacts-\${currentUserId}\`\n            );\n            const parsed = raw ? JSON.parse(raw) : [];\n            if (Array.isArray(parsed)) {\n              savedContactIds = parsed.filter(\n                (id): id is string => typeof id === "string"\n              );\n            }\n          } catch {\n            savedContactIds = [];\n          }\n        }\n\n        const isContact = savedContactIds.includes(user.id);`;
if (!next.includes("banda-chat-contacts-${currentUserId}")) {
  if (next.includes(contactTarget)) {
    next = next.replace(contactTarget, contactReplacement);
  }
}

// 3. Make the contact list react to explicit contact creation and preserve it per account.
const startChatTarget = `  async function startChat(\n    user: Profile\n  ) {\n    if (!currentUserId) {`;
const startChatReplacement = `  async function startChat(\n    user: Profile\n  ) {\n    if (!currentUserId) {`;
// The function body is patched at the first safe point after the session check below.
// We add the local contact immediately before the existing conversation creation logic.
const sessionCheckTarget = `    if (!currentUserId) {\n      setErrorMessage(\n        "Sesi pengguna tidak ditemukan."\n      );\n      return;\n    }`;
const sessionCheckReplacement = `    if (!currentUserId) {\n      setErrorMessage(\n        "Sesi pengguna tidak ditemukan."\n      );\n      return;\n    }\n\n    // Menambahkan kontak secara eksplisit setelah pengguna ditemukan melalui pencarian.\n    if (typeof window !== "undefined") {\n      try {\n        const key = \`banda-chat-contacts-\${currentUserId}\`;\n        const raw = window.localStorage.getItem(key);\n        const parsed = raw ? JSON.parse(raw) : [];\n        const ids = Array.isArray(parsed)\n          ? parsed.filter((id): id is string => typeof id === "string")\n          : [];\n        if (!ids.includes(user.id)) {\n          window.localStorage.setItem(key, JSON.stringify([...ids, user.id]));\n        }\n      } catch (error) {\n        console.warn("Gagal menyimpan kontak lokal:", error);\n      }\n    }`;
// Only replace the first matching session guard. startChat is the first occurrence after its declaration.
const startIndex = next.indexOf("  async function startChat(");
if (startIndex >= 0 && !next.slice(startIndex, startIndex + 1200).includes("Menambahkan kontak secara eksplisit")) {
  const before = next.slice(0, startIndex);
  const after = next.slice(startIndex);
  if (after.includes(sessionCheckTarget)) {
    next = before + after.replace(sessionCheckTarget, sessionCheckReplacement, 1);
  }
}

// 4. Show the complete Grup label on phones as well as desktop.
next = next.replace(
  `              <span className="hidden sm:inline">Grup</span>`,
  `              <span>Grup</span>`
);

if (next !== source) {
  fs.writeFileSync(filePath, next, "utf8");
  console.log("Banda Chat: per-account contact isolation and mobile group menu patch applied.");
} else {
  console.log("Banda Chat: patch already present; no source changes needed.");
}
