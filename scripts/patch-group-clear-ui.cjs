const fs = require("fs");
const path = require("path");

const filePath = path.join(process.cwd(), "app", "chat", "grup", "page.tsx");
if (!fs.existsSync(filePath)) process.exit(0);

const source = fs.readFileSync(filePath, "utf8");
let next = source;

if (!next.includes("banda-group-clear-ui-v2")) {
  const stateMarker = `  const [editAvatarPreview, setEditAvatarPreview] = useState<string | null>(null);`;
  const stateReplacement = `${stateMarker}\n  // banda-group-clear-ui-v2\n  const [clearingAllMessages, setClearingAllMessages] = useState(false);`;

  if (!next.includes(stateMarker)) {
    console.error("Banda Chat: group clear UI state marker not found.");
    process.exit(1);
  }
  next = next.replace(stateMarker, stateReplacement);

  const functionMarker = `  async function copyInvite() {`;
  const functionReplacement = `  async function clearAllGroupMessages() {\n    if (!selectedGroup || !isAdmin || clearingAllMessages) return;\n    if (!window.confirm("Hapus SEMUA pesan dan gambar di grup ini? Tindakan ini tidak dapat dibatalkan.")) return;\n    setClearingAllMessages(true);\n    setError("");\n    try {\n      const { data: deletedCount, error: clearError } = await supabase.rpc(\"clear_banda_group_messages\", { p_conversation_id: selectedGroup.id });\n      if (clearError) throw new Error(clearError.message);\n      setMessages([]);\n      await loadUnreadCounts();\n      setShowMobileGroupMenu(false);\n      const count = Number(deletedCount) || 0;\n      if (count > 0) {\n        console.info(\`Banda Chat: \\${count} pesan grup berhasil dihapus.\`);\n      }\n    } catch (err) {\n      setError(err instanceof Error ? err.message : "Semua pesan gagal dihapus.");\n    } finally {\n      setClearingAllMessages(false);\n    }\n  }\n\n${functionMarker}`;

  if (!next.includes(functionMarker)) {
    console.error("Banda Chat: group clear function marker not found.");
    process.exit(1);
  }
  next = next.replace(functionMarker, functionReplacement);

  const desktopNeedle = `<button onClick={() => setShowMembers(true)} className="px-3 py-2 rounded-xl border text-sm">👤 Anggota</button>`;
  const desktopReplacement = `${desktopNeedle}{isAdmin && <button onClick={() => void clearAllGroupMessages()} disabled={clearingAllMessages} className="px-3 py-2 rounded-xl border text-sm text-red-600 disabled:opacity-50">{clearingAllMessages ? "Menghapus..." : "🗑️ Hapus Semua"}</button>}`;
  if (!next.includes(desktopReplacement)) {
    if (!next.includes(desktopNeedle)) {
      console.error("Banda Chat: desktop member button marker not found.");
      process.exit(1);
    }
    next = next.replace(desktopNeedle, desktopReplacement);
  }

  const mobileNeedle = `<button onClick={() => { setShowMobileGroupMenu(false); setShowMembers(true); }} className="w-full text-left rounded-lg px-3 py-2 text-xs hover:bg-slate-50">👤 Anggota</button>`;
  const mobileReplacement = `${mobileNeedle}{isAdmin && <button onClick={() => { setShowMobileGroupMenu(false); void clearAllGroupMessages(); }} disabled={clearingAllMessages} className="w-full text-left rounded-lg px-3 py-2 text-xs text-red-600 hover:bg-red-50 disabled:opacity-50">{clearingAllMessages ? "Menghapus..." : "🗑️ Hapus Semua Pesan"}</button>`;
  if (!next.includes(mobileReplacement)) {
    if (!next.includes(mobileNeedle)) {
      console.error("Banda Chat: mobile member button marker not found.");
      process.exit(1);
    }
    next = next.replace(mobileNeedle, mobileReplacement);
  }

  fs.writeFileSync(filePath, next, "utf8");
  console.log("Banda Chat: admin group clear-all UI applied.");
}
