const fs = require("fs");
const path = require("path");

const filePath = path.join(process.cwd(), "app", "chat", "page.tsx");
const source = fs.readFileSync(filePath, "utf8");

let next = source;

const loadChatTarget = `      const authUserId =\n        session.user.id;\n\n      setCurrentUserId(authUserId);`;

const loadChatReplacement = `      const authUserId =\n        session.user.id;\n\n      // Jangan membawa daftar kontak dari sesi akun sebelumnya.\n      // Reset hanya ketika benar-benar berpindah pengguna, bukan saat token refresh.\n      if (currentUserId && currentUserId !== authUserId) {\n        setUsers([]);\n        setContactInfo({});\n        setSelectedUser(null);\n        setSelectedConversation(null);\n        setMessages([]);\n        setSearch("");\n        setMobileChatOpen(false);\n      }\n\n      setCurrentUserId(authUserId);`;

if (!next.includes("// Jangan membawa daftar kontak dari sesi akun sebelumnya.")) {
  if (!next.includes(loadChatTarget)) {
    throw new Error("Patch kontak gagal: blok loadChat tidak ditemukan.");
  }
  next = next.replace(loadChatTarget, loadChatReplacement);
}

const groupLabelTarget = `              <span className="hidden sm:inline">Grup</span>`;
const groupLabelReplacement = `              <span>Grup</span>`;

if (next.includes(groupLabelTarget)) {
  next = next.replace(groupLabelTarget, groupLabelReplacement);
}

if (next !== source) {
  fs.writeFileSync(filePath, next, "utf8");
  console.log("Banda Chat: contact isolation + mobile group menu patch applied.");
} else {
  console.log("Banda Chat: contact isolation patch already applied.");
}
