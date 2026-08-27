const fs = require("fs");
const path = require("path");

const filePath = path.join(process.cwd(), "app", "chat", "grup", "page.tsx");
if (!fs.existsSync(filePath)) process.exit(0);

const source = fs.readFileSync(filePath, "utf8");
let next = source;

if (!next.includes("banda-group-clear-all-v1")) {
  next = next.replace(
    `  const [editAvatarPreview, setEditAvatarPreview] = useState<string | null>(null);`,
    `  const [editAvatarPreview, setEditAvatarPreview] = useState<string | null>(null);\n  // banda-group-clear-all-v1\n  const [clearingAllMessages, setClearingAllMessages] = useState(false);`
  );

  const functionMarker = `  async function copyInvite() {`;
  const clearFunction = `  async function clearAllGroupMessages() {\n    if (!selectedGroup || !isAdmin || clearingAllMessages) return;\n    if (!window.confirm("Hapus semua pesan/postingan di grup ini? Tindakan ini tidak dapat dibatalkan.")) return;\n    setClearingAllMessages(true);\n    setError("");\n    try {\n      const { error: deleteError } = await supabase\n        .from("messages")\n        .delete()\n        .eq("conversation_id", selectedGroup.id);\n      if (deleteError) throw new Error(deleteError.message);\n      setMessages([]);\n    } catch (err) {\n      setError(err instanceof Error ? err.message : "Semua pesan gagal dihapus.");\n    } finally {\n      setClearingAllMessages(false);\n    }\n  }\n\n`;

  if (next.includes(functionMarker)) {
    next = next.replace(functionMarker, clearFunction + functionMarker);
  }

  const desktopMarker = `<div className="flex gap-2 group-desktop-actions">`;
  const desktopNeedle = `<button onClick={() => setShowMembers(true)} className="px-3 py-2 rounded-xl border text-sm">👤 Anggota</button>`;
  const desktopReplacement = `${desktopNeedle}{isAdmin && <button onClick={() => void clearAllGroupMessages()} disabled={clearingAllMessages} className="px-3 py-2 rounded-xl border text-sm text-red-600 disabled:opacity-50">{clearingAllMessages ? "Menghapus..." : "🗑️ Hapus Semua"}</button>}`;
  if (next.includes(desktopMarker) && next.includes(desktopNeedle) && !next.includes("Hapus Semua")) {
    next = next.replace(desktopNeedle, desktopReplacement);
  }

  const mobileNeedle = `<button onClick={() => { setShowMobileGroupMenu(false); setShowMembers(true); }} className="w-full text-left rounded-lg px-3 py-2 text-xs hover:bg-slate-50">👤 Anggota</button>`;
  const mobileReplacement = `${mobileNeedle}{isAdmin && <button onClick={() => { setShowMobileGroupMenu(false); void clearAllGroupMessages(); }} disabled={clearingAllMessages} className="w-full text-left rounded-lg px-3 py-2 text-xs text-red-600 hover:bg-red-50 disabled:opacity-50">{clearingAllMessages ? "Menghapus..." : "🗑️ Hapus Semua Pesan"}</button>`;
  if (next.includes(mobileNeedle) && !next.includes("Hapus Semua Pesan")) {
    next = next.replace(mobileNeedle, mobileReplacement);
  }

  fs.writeFileSync(filePath, next, "utf8");
  console.log("Banda Chat: admin clear-all group messages action restored.");
} else {
  console.log("Banda Chat: admin clear-all group messages action already present.");
}
