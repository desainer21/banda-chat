const fs = require("fs");
const path = require("path");

const filePath = path.join(process.cwd(), "app", "chat", "grup", "page.tsx");
if (!fs.existsSync(filePath)) process.exit(0);

const source = fs.readFileSync(filePath, "utf8");

// The group page already contains the stable UI structure. Do not inject JSX
// fragments at arbitrary positions: that was the cause of the Turbopack parse
// error. This build patch only adds the clear-all handler/state once and then
// inserts complete, self-contained controls immediately after known buttons.
if (source.includes("banda-group-clear-ui-v4")) {
  console.log("Banda Chat: group clear UI v4 already applied.");
  process.exit(0);
}

let next = source;

const stateMarker = '  const [editAvatarPreview, setEditAvatarPreview] = useState<string | null>(null);';
if (!next.includes(stateMarker)) {
  console.error("Banda Chat: group clear UI state marker not found.");
  process.exit(1);
}
next = next.replace(stateMarker, stateMarker + '\n  // banda-group-clear-ui-v4\n  const [clearingAllMessages, setClearingAllMessages] = useState(false);');

const functionMarker = '  async function copyInvite() {';
if (!next.includes(functionMarker)) {
  console.error("Banda Chat: group clear UI function marker not found.");
  process.exit(1);
}
const clearFunction = `  async function clearAllGroupMessages() {
    if (!selectedGroup || !isAdmin || clearingAllMessages) return;
    if (!window.confirm("Hapus SEMUA pesan dan gambar di grup ini? Tindakan ini tidak dapat dibatalkan.")) return;
    setClearingAllMessages(true);
    setError("");
    try {
      const { data: deletedCount, error: clearError } = await supabase.rpc("clear_banda_group_messages", { p_conversation_id: selectedGroup.id });
      if (clearError) throw new Error(clearError.message);
      setMessages([]);
      await loadUnreadCounts();
      setShowMobileGroupMenu(false);
      console.info("Banda Chat: " + (Number(deletedCount) || 0) + " pesan grup berhasil dihapus.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Semua pesan gagal dihapus.");
    } finally {
      setClearingAllMessages(false);
    }
  }
`;
next = next.replace(functionMarker, clearFunction + functionMarker);

const desktopNeedle = '<button onClick={() => setShowMembers(true)} className="px-3 py-2 rounded-xl border text-sm">👤 Anggota</button>';
if (!next.includes(desktopNeedle)) {
  console.error("Banda Chat: desktop member button marker not found.");
  process.exit(1);
}
const desktopButton = '<button type="button" onClick={() => void clearAllGroupMessages()} disabled={clearingAllMessages} className="px-3 py-2 rounded-xl border text-sm text-red-600 disabled:opacity-50">{clearingAllMessages ? "Menghapus..." : "🗑️ Hapus Semua"}</button>';
next = next.replace(desktopNeedle, desktopNeedle + ("{isAdmin && " + desktopButton + "}"));

const mobileNeedle = '<button onClick={() => { setShowMobileGroupMenu(false); setShowMembers(true); }} className="w-full text-left rounded-lg px-3 py-2 text-xs hover:bg-slate-50">👤 Anggota</button>';
if (!next.includes(mobileNeedle)) {
  console.error("Banda Chat: mobile member button marker not found.");
  process.exit(1);
}
const mobileButton = '<button type="button" onClick={() => { setShowMobileGroupMenu(false); void clearAllGroupMessages(); }} disabled={clearingAllMessages} className="w-full text-left rounded-lg px-3 py-2 text-xs text-red-600 hover:bg-red-50 disabled:opacity-50">{clearingAllMessages ? "Menghapus..." : "🗑️ Hapus Semua Pesan"}</button>';
next = next.replace(mobileNeedle, mobileNeedle + ("{isAdmin && " + mobileButton + "}"));

fs.writeFileSync(filePath, next, "utf8");
console.log("Banda Chat: admin group clear-all UI v4 applied.");
