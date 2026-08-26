const fs = require("fs");
const path = require("path");

const filePath = path.join(process.cwd(), "app", "chat", "page.tsx");
const source = fs.readFileSync(filePath, "utf8");
let next = source;

// 1. Reset in-memory chat state when the authenticated user really changes.
const loadChatTarget = `      const authUserId =\n        session.user.id;\n\n      setCurrentUserId(authUserId);`;
const loadChatReplacement = `      const authUserId =\n        session.user.id;\n\n      // Jangan membawa state kontak/chat dari akun sebelumnya.\n      if (currentUserId && currentUserId !== authUserId) {\n        setUsers([]);\n        setContactInfo({});\n        setSelectedUser(null);\n        setSelectedConversation(null);\n        setMessages([]);\n        setSearch("");\n        setMobileChatOpen(false);\n      }\n\n      setCurrentUserId(authUserId);`;
if (!next.includes("// Jangan membawa state kontak/chat dari akun sebelumnya.")) {
  if (next.includes(loadChatTarget)) next = next.replace(loadChatTarget, loadChatReplacement);
}

// 2. Contacts on the home screen are scoped to the currently logged-in account.
const contactTarget = `        const isContact =\n          Boolean(contactInfo[user.id]?.conversationId);`;
const contactReplacement = `        let savedContactIds: string[] = [];\n\n        if (typeof window !== "undefined" && currentUserId) {\n          try {\n            const raw = window.localStorage.getItem(\n              \`banda-chat-contacts-\${currentUserId}\`\n            );\n            const parsed = raw ? JSON.parse(raw) : [];\n            if (Array.isArray(parsed)) {\n              savedContactIds = parsed.filter(\n                (id): id is string => typeof id === "string"\n              );\n            }\n          } catch {\n            savedContactIds = [];\n          }\n        }\n\n        const isContact = savedContactIds.includes(user.id);`;
if (!next.includes("banda-chat-contacts-${currentUserId}")) {
  if (next.includes(contactTarget)) next = next.replace(contactTarget, contactReplacement);
}

// 3. Make the contact list react to explicit contact creation and preserve it per account.
const sessionCheckTarget = `    if (!currentUserId) {\n      setErrorMessage(\n        "Sesi pengguna tidak ditemukan."\n      );\n      return;\n    }`;
const sessionCheckReplacement = `    if (!currentUserId) {\n      setErrorMessage(\n        "Sesi pengguna tidak ditemukan."\n      );\n      return;\n    }\n\n    // Menambahkan kontak secara eksplisit setelah pengguna ditemukan melalui pencarian.\n    if (typeof window !== "undefined") {\n      try {\n        const key = \`banda-chat-contacts-\${currentUserId}\`;\n        const raw = window.localStorage.getItem(key);\n        const parsed = raw ? JSON.parse(raw) : [];\n        const ids = Array.isArray(parsed)\n          ? parsed.filter((id): id is string => typeof id === "string")\n          : [];\n        if (!ids.includes(user.id)) {\n          window.localStorage.setItem(key, JSON.stringify([...ids, user.id]));\n        }\n      } catch (error) {\n        console.warn("Gagal menyimpan kontak lokal:", error);\n      }\n    }`;
const startIndex = next.indexOf("  async function startChat(");
if (startIndex >= 0 && !next.slice(startIndex, startIndex + 1200).includes("Menambahkan kontak secara eksplisit")) {
  const before = next.slice(0, startIndex);
  const after = next.slice(startIndex);
  if (after.includes(sessionCheckTarget)) next = before + after.replace(sessionCheckTarget, sessionCheckReplacement, 1);
}

// 4. Make private-chat notification navigation use the real startChat() flow.
// The notification bridge dispatches the exact sender/conversation. This
// listener waits for the existing user list, finds that sender, and calls the
// same startChat() function used by the normal contact button. No chat UI or
// messaging logic is rewritten.
const notificationListenerMarker = "// banda-notification-open-chat-v1";
if (!next.includes(notificationListenerMarker)) {
  const notificationListener = `\n  /* ============================================================\n     NOTIFICATION -> OPEN PRIVATE CHAT\n     ============================================================ */\n\n  // ${notificationListenerMarker}\n  useEffect(() => {\n    if (!currentUserId || users.length === 0) {\n      return;\n    }\n\n    const handleNotificationOpen = (event: Event) => {\n      const customEvent = event as CustomEvent<{\n        conversationId?: string;\n        senderId?: string | null;\n      }>;\n\n      const senderId = customEvent.detail?.senderId;\n      const conversationId = customEvent.detail?.conversationId;\n\n      if (!senderId && !conversationId) {\n        return;\n      }\n\n      const targetUser = senderId\n        ? users.find((user) => user.id === senderId)\n        : null;\n\n      if (!targetUser) {\n        return;\n      }\n\n      void startChat(targetUser);\n    };\n\n    window.addEventListener(\n      "banda-open-conversation",\n      handleNotificationOpen\n    );\n\n    return () => {\n      window.removeEventListener(\n        "banda-open-conversation",\n        handleNotificationOpen\n      );\n    };\n  }, [currentUserId, users]);\n`;
  const startChatMarker = "  /* ============================================================\n     START CHAT\n     ============================================================ */";
  if (next.includes(startChatMarker)) {
    next = next.replace(startChatMarker, notificationListener + "\n" + startChatMarker);
  }
}

// 5. Show the complete Grup label on phones as well as desktop.
next = next.replace(
  `              <span className="hidden sm:inline">Grup</span>`,
  `              <span>Grup</span>`
);

// 6. Group message edit/delete and a stable chat viewport are applied by the
// prebuild patch so the already-working group page remains otherwise untouched.
const groupFilePath = path.join(process.cwd(), "app", "chat", "grup", "page.tsx");
if (fs.existsSync(groupFilePath)) {
  const groupSource = fs.readFileSync(groupFilePath, "utf8");
  let groupNext = groupSource;

  if (!groupNext.includes("banda-group-edit-delete-v1")) {
    groupNext = groupNext.replace(
      `  const [editAvatarPreview, setEditAvatarPreview] = useState<string | null>(null);`,
      `  const [editAvatarPreview, setEditAvatarPreview] = useState<string | null>(null);\n  // banda-group-edit-delete-v1\n  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);\n  const [editingMessageText, setEditingMessageText] = useState("");\n  const [savingMessageEdit, setSavingMessageEdit] = useState(false);\n  const [deletingMessageId, setDeletingMessageId] = useState<string | null>(null);`
    );

    const messageFunctions = `\n  function startEditMessage(message: Message) {\n    if (message.sender_id !== userId) return;\n    setEditingMessageId(message.id);\n    setEditingMessageText(message.content);\n  }\n\n  function cancelEditMessage() {\n    setEditingMessageId(null);\n    setEditingMessageText("");\n  }\n\n  async function saveMessageEdit() {\n    if (!editingMessageId || !editingMessageText.trim() || savingMessageEdit) return;\n    setSavingMessageEdit(true);\n    setError("");\n    const { data, error: updateError } = await supabase\n      .from("messages")\n      .update({ content: editingMessageText.trim(), updated_at: new Date().toISOString() })\n      .eq("id", editingMessageId)\n      .eq("sender_id", userId)\n      .select("id,conversation_id,sender_id,content,created_at,updated_at")\n      .maybeSingle();\n    if (updateError) {\n      setError(updateError.message);\n    } else if (data) {\n      const updatedMessage = data as Message;\n      setMessages((prev) => prev.map((m) => m.id === updatedMessage.id ? updatedMessage : m));\n      cancelEditMessage();\n    }\n    setSavingMessageEdit(false);\n  }\n\n  async function deleteMessage(message: Message) {\n    if (message.sender_id !== userId || deletingMessageId) return;\n    if (!window.confirm("Hapus pesan ini?")) return;\n    setDeletingMessageId(message.id);\n    setError("");\n    const { error: deleteError } = await supabase\n      .from("messages")\n      .delete()\n      .eq("id", message.id)\n      .eq("sender_id", userId);\n    if (deleteError) {\n      setError(deleteError.message);\n    } else {\n      setMessages((prev) => prev.filter((m) => m.id !== message.id));\n    }\n    setDeletingMessageId(null);\n  }\n`;

    groupNext = groupNext.replace(`  async function copyInvite() {`, messageFunctions + `\n  async function copyInvite() {`);

    const oldMessageMap = `<div className="flex-1 p-4 overflow-y-auto space-y-3 bg-slate-50 min-h-[48vh]">{!messages.length && <div className="text-center text-sm text-slate-500 py-10">Belum ada postingan di grup ini.</div>}{messages.map((m) => { const sender = members.find((x) => x.id === m.sender_id); return <div key={m.id} className={\`flex \${m.sender_id === userId ? "justify-end" : "justify-start"}\`}><div className={\`max-w-[85%] rounded-2xl px-4 py-2 \${m.sender_id === userId ? "bg-blue-600 text-white" : "bg-white border"}\`}><div className={\`text-[11px] mb-1 \${m.sender_id === userId ? "text-blue-100" : "text-slate-500"}\`}>{m.sender_id === userId ? "Anda" : displayName(sender || { id: m.sender_id, full_name: "Pengguna", username: null, avatar_url: null })}</div><div className="whitespace-pre-wrap break-words text-sm">{m.content}</div><div className={\`text-[10px] text-right mt-1 \${m.sender_id === userId ? "text-blue-100" : "text-slate-400"}\`}>{formatTime(m.created_at)}{m.updated_at && m.updated_at !== m.created_at ? " • diedit" : ""}</div></div></div>})}</div>`;

    const newMessageMap = `<div className="flex-1 min-h-0 p-4 overflow-y-auto space-y-3 bg-slate-50">{!messages.length && <div className="text-center text-sm text-slate-500 py-10">Belum ada postingan di grup ini.</div>}{messages.map((m) => { const sender = members.find((x) => x.id === m.sender_id); const own = m.sender_id === userId; const editing = editingMessageId === m.id; return <div key={m.id} className={\`flex \${own ? "justify-end" : "justify-start"}\`}><div className={\`group relative max-w-[85%] rounded-2xl px-4 py-2 \${own ? "bg-blue-600 text-white" : "bg-white border"}\`}><div className={\`text-[11px] mb-1 \${own ? "text-blue-100" : "text-slate-500"}\`}>{own ? "Anda" : displayName(sender || { id: m.sender_id, full_name: "Pengguna", username: null, avatar_url: null })}</div>{editing ? <div className="space-y-2"><textarea autoFocus value={editingMessageText} onChange={(e) => setEditingMessageText(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void saveMessageEdit(); } if (e.key === "Escape") cancelEditMessage(); }} className="w-full min-w-[220px] rounded-lg border border-white/40 bg-white/10 px-2 py-1 text-sm text-white outline-none" /><div className="flex justify-end gap-2"><button onClick={cancelEditMessage} className="text-[11px] text-white/80">Batal</button><button onClick={() => void saveMessageEdit()} disabled={savingMessageEdit || !editingMessageText.trim()} className="rounded-md bg-white/20 px-2 py-1 text-[11px] font-semibold disabled:opacity-50">{savingMessageEdit ? "..." : "Simpan"}</button></div></div> : <div className="whitespace-pre-wrap break-words text-sm">{m.content}</div>}<div className={\`text-[10px] text-right mt-1 \${own ? "text-blue-100" : "text-slate-400"}\`}>{formatTime(m.created_at)}{m.updated_at && m.updated_at !== m.created_at ? " • diedit" : ""}</div>{own && !editing && <div className="mt-1 flex justify-end gap-2 opacity-100 sm:opacity-0 sm:group-hover:opacity-100"><button onClick={() => startEditMessage(m)} className="text-[11px] underline text-white/90">Edit</button><button onClick={() => void deleteMessage(m)} disabled={deletingMessageId === m.id} className="text-[11px] underline text-white/90">{deletingMessageId === m.id ? "..." : "Hapus"}</button></div>}</div></div>})}</div>`;

    if (groupNext.includes(oldMessageMap)) groupNext = groupNext.replace(oldMessageMap, newMessageMap);

    groupNext = groupNext.replace(`<main className="min-h-screen bg-slate-50 text-slate-900">`, `<main className="h-screen overflow-hidden bg-slate-50 text-slate-900">`);
    groupNext = groupNext.replace(`<div className="max-w-7xl mx-auto p-3 sm:p-5">`, `<div className="max-w-7xl mx-auto h-full p-3 sm:p-5 flex flex-col">`);
    groupNext = groupNext.replace(`<div className="grid lg:grid-cols-[320px_1fr] gap-4 mt-4">`, `<div className="grid lg:grid-cols-[320px_1fr] gap-4 mt-4 flex-1 min-h-0">`);
    groupNext = groupNext.replace(`<aside className="bg-white border border-slate-200 rounded-2xl overflow-hidden">`, `<aside className="bg-white border border-slate-200 rounded-2xl overflow-hidden min-h-0">`);
    groupNext = groupNext.replace(`<div className="max-h-[70vh] overflow-y-auto">`, `<div className="h-full overflow-y-auto">`);
    groupNext = groupNext.replace(`<section className="bg-white border border-slate-200 rounded-2xl min-h-[70vh] flex flex-col overflow-hidden">`, `<section className="bg-white border border-slate-200 rounded-2xl h-full min-h-0 flex flex-col overflow-hidden">`);

    fs.writeFileSync(groupFilePath, groupNext, "utf8");
  }
}

if (next !== source) {
  fs.writeFileSync(filePath, next, "utf8");
  console.log("Banda Chat: per-account contact isolation and mobile group menu patch applied.");
} else {
  console.log("Banda Chat: patch already present; no source changes needed.");
}
