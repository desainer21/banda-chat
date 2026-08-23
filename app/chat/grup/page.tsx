"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import BandaLogo from "@/components/BandaLogo";
import { supabase } from "@/lib/supabase";

type Profile = { id: string; full_name: string; username: string | null; avatar_url: string | null };
type Group = { id: string; type: string; name: string | null; created_by: string | null; created_at: string; invite_code?: string | null; members_can_post?: boolean; group_description?: string | null };
type Message = { id: string; conversation_id: string; sender_id: string; content: string; created_at: string; updated_at?: string | null };

export default function GroupsPage() {
  const router = useRouter();
  const [userId, setUserId] = useState("");
  const [groups, setGroups] = useState<Group[]>([]);
  const [contacts, setContacts] = useState<Profile[]>([]);
  const [selectedGroup, setSelectedGroup] = useState<Group | null>(null);
  const [members, setMembers] = useState<Profile[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState("");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [showMembers, setShowMembers] = useState(false);
  const [showInvite, setShowInvite] = useState(false);
  const [groupName, setGroupName] = useState("");
  const [groupDescription, setGroupDescription] = useState("");
  const [allowPosts, setAllowPosts] = useState(true);
  const [creating, setCreating] = useState(false);
  const [inviteCopied, setInviteCopied] = useState(false);
  const [addingId, setAddingId] = useState<string | null>(null);
  const [removingId, setRemovingId] = useState<string | null>(null);

  const isAdmin = !!selectedGroup && selectedGroup.created_by === userId;
  const availableContacts = useMemo(() => contacts.filter((c) => !members.some((m) => m.id === c.id)), [contacts, members]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      const { data } = await supabase.auth.getSession();
      if (!data.session?.user) { router.replace("/login"); return; }
      if (!mounted) return;
      setUserId(data.session.user.id);
      await Promise.all([loadGroups(), loadContacts(data.session.user.id)]);
      if (mounted) {
        const requestedGroupId = new URLSearchParams(window.location.search).get("group");
        if (requestedGroupId) {
          const { data: requestedGroup } = await supabase.from("conversations").select("id,type,name,created_by,created_at,invite_code,members_can_post,group_description").eq("id", requestedGroupId).eq("type", "group").maybeSingle();
          if (requestedGroup) setSelectedGroup(requestedGroup as Group);
        }
        setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, [router]);

  useEffect(() => {
    if (!selectedGroup) return;
    loadMembers(selectedGroup.id);
    loadMessages(selectedGroup.id);
    const channel = supabase.channel(`group-messages-${selectedGroup.id}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages", filter: `conversation_id=eq.${selectedGroup.id}` }, (payload) => {
        const message = payload.new as Message;
        setMessages((prev) => prev.some((m) => m.id === message.id) ? prev : [...prev, message]);
      }).subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [selectedGroup?.id]);

  async function loadGroups() {
    const { data, error } = await supabase.from("conversations").select("id,type,name,created_by,created_at,invite_code,members_can_post,group_description").eq("type", "group").order("created_at", { ascending: false });
    if (error) { setError(error.message); return; }
    setGroups((data || []) as Group[]);
  }

  async function loadContacts(uid: string) {
    const { data: mine } = await supabase.from("conversation_members").select("conversation_id").eq("user_id", uid);
    const ids = (mine || []).map((x: any) => x.conversation_id);
    if (!ids.length) { setContacts([]); return; }
    const { data: directs } = await supabase.from("conversations").select("id").in("id", ids).eq("type", "direct");
    const directIds = (directs || []).map((x: any) => x.id);
    if (!directIds.length) { setContacts([]); return; }
    const { data: otherMembers } = await supabase.from("conversation_members").select("user_id,conversation_id").in("conversation_id", directIds).neq("user_id", uid);
    const userIds = [...new Set((otherMembers || []).map((x: any) => x.user_id))];
    if (!userIds.length) { setContacts([]); return; }
    const { data: profiles } = await supabase.from("profiles").select("id,full_name,username,avatar_url").in("id", userIds);
    setContacts((profiles || []) as Profile[]);
  }

  async function loadMembers(groupId: string) {
    const { data: rows, error: memberError } = await supabase.from("conversation_members").select("user_id").eq("conversation_id", groupId);
    if (memberError) { setError(memberError.message); return; }
    const ids = (rows || []).map((x: any) => x.user_id);
    if (!ids.length) { setMembers([]); return; }
    const { data: profiles } = await supabase.from("profiles").select("id,full_name,username,avatar_url").in("id", ids);
    setMembers((profiles || []) as Profile[]);
  }

  async function loadMessages(groupId: string) {
    const { data, error: messageError } = await supabase.from("messages").select("id,conversation_id,sender_id,content,created_at,updated_at").eq("conversation_id", groupId).order("created_at", { ascending: true }).limit(200);
    if (messageError) { setError(messageError.message); return; }
    setMessages((data || []) as Message[]);
  }

  async function createGroup() {
    if (!groupName.trim() || creating) return;
    setCreating(true); setError("");
    const { data, error: rpcError } = await supabase.rpc("create_banda_group", { p_name: groupName.trim(), p_description: groupDescription.trim() || null, p_members_can_post: allowPosts });
    if (rpcError) setError(rpcError.message);
    else {
      const group = data as Group;
      setGroups((prev) => [group, ...prev]);
      setSelectedGroup(group);
      setGroupName(""); setGroupDescription(""); setAllowPosts(true); setShowCreate(false);
    }
    setCreating(false);
  }

  async function addMember(profile: Profile) {
    if (!selectedGroup || !isAdmin) return;
    setAddingId(profile.id); setError("");
    const { error: rpcError } = await supabase.rpc("add_banda_group_member", { p_conversation_id: selectedGroup.id, p_user_id: profile.id });
    if (rpcError) setError(rpcError.message); else await loadMembers(selectedGroup.id);
    setAddingId(null);
  }

  async function removeMember(profile: Profile) {
    if (!selectedGroup || !isAdmin || profile.id === userId) return;
    if (!window.confirm(`Keluarkan ${profile.full_name || profile.username || "anggota"} dari grup?`)) return;
    setRemovingId(profile.id); setError("");
    const { error: rpcError } = await supabase.rpc("remove_banda_group_member", { p_conversation_id: selectedGroup.id, p_user_id: profile.id });
    if (rpcError) setError(rpcError.message); else await loadMembers(selectedGroup.id);
    setRemovingId(null);
  }

  async function togglePosts() {
    if (!selectedGroup || !isAdmin) return;
    const next = !(selectedGroup.members_can_post ?? true);
    const { error: rpcError } = await supabase.rpc("set_banda_group_post_permission", { p_conversation_id: selectedGroup.id, p_allowed: next });
    if (rpcError) setError(rpcError.message); else {
      const updated = { ...selectedGroup, members_can_post: next };
      setSelectedGroup(updated); setGroups((prev) => prev.map((g) => g.id === updated.id ? updated : g));
    }
  }

  async function sendMessage() {
    if (!selectedGroup || !text.trim() || sending) return;
    setSending(true); setError("");
    const { data, error: rpcError } = await supabase.rpc("send_banda_group_message", { p_conversation_id: selectedGroup.id, p_content: text.trim() });
    if (rpcError) setError(rpcError.message); else if (data) {
      const message = data as Message;
      setMessages((prev) => prev.some((m) => m.id === message.id) ? prev : [...prev, message]);
      setText("");
    }
    setSending(false);
  }

  async function copyInvite() {
    if (!selectedGroup?.invite_code) return;
    const link = `${window.location.origin}/chat/grup/join?code=${encodeURIComponent(selectedGroup.invite_code)}`;
    await navigator.clipboard.writeText(link);
    setInviteCopied(true); setTimeout(() => setInviteCopied(false), 1800);
  }

  function formatTime(value: string) { return new Date(value).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" }); }
  function displayName(p: Profile) { return p.full_name?.trim() || p.username || "Pengguna"; }

  if (loading) return <main className="min-h-screen bg-slate-50 flex items-center justify-center text-slate-600">Memuat grup...</main>;

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      <div className="max-w-7xl mx-auto p-3 sm:p-5">
        <header className="bg-white rounded-2xl shadow-sm border border-slate-200 p-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3"><BandaLogo size={44} /><div><h1 className="font-bold text-lg">Grup Banda Chat</h1><p className="text-xs text-slate-500">Grup hanya terlihat oleh anggota yang sudah bergabung.</p></div></div>
          <div className="flex gap-2"><Link href="/chat" className="px-3 py-2 rounded-xl border text-sm">← Chat</Link><button onClick={() => setShowCreate(true)} className="px-3 py-2 rounded-xl bg-blue-600 text-white text-sm font-semibold">＋ Buat Grup</button></div>
        </header>

        {error && <div className="mt-3 p-3 rounded-xl bg-red-50 text-red-700 border border-red-200 text-sm">{error}</div>}

        <div className="grid lg:grid-cols-[320px_1fr] gap-4 mt-4">
          <aside className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
            <div className="p-4 border-b"><div className="font-bold">Grup Saya</div><div className="text-xs text-slate-500 mt-1">Hanya grup yang sudah Anda ikuti.</div></div>
            <div className="max-h-[70vh] overflow-y-auto">
              {!groups.length ? <div className="p-6 text-center text-sm text-slate-500">Belum ada grup. Buat grup atau bergabung melalui link undangan.</div> : groups.map((g) => <button key={g.id} onClick={() => setSelectedGroup(g)} className={`w-full text-left p-4 border-b hover:bg-slate-50 ${selectedGroup?.id === g.id ? "bg-blue-50" : ""}`}><div className="font-semibold">👥 {g.name || "Grup"}</div><div className="text-xs text-slate-500 mt-1">{g.members_can_post === false ? "Hanya admin yang dapat posting" : "Anggota dapat posting"}</div></button>)}
            </div>
          </aside>

          <section className="bg-white border border-slate-200 rounded-2xl min-h-[70vh] flex flex-col overflow-hidden">
            {!selectedGroup ? <div className="flex-1 flex flex-col items-center justify-center text-center p-8 text-slate-500"><div className="text-5xl mb-3">👥</div><h2 className="font-bold text-lg text-slate-700">Pilih grup</h2><p className="text-sm mt-1">Atau buat grup baru untuk mulai mengobrol bersama beberapa teman.</p></div> : <>
              <div className="p-4 border-b flex items-center justify-between gap-3"><div><h2 className="font-bold">👥 {selectedGroup.name}</h2><p className="text-xs text-slate-500">{members.length} anggota{isAdmin ? " • Anda admin" : ""}</p></div><div className="flex gap-2"><button onClick={() => setShowInvite(true)} className="px-3 py-2 rounded-xl border text-sm">🔗 Undang</button><button onClick={() => setShowMembers(true)} className="px-3 py-2 rounded-xl border text-sm">👤 Anggota</button></div></div>
              <div className="flex-1 p-4 overflow-y-auto space-y-3 bg-slate-50 min-h-[48vh]">{!messages.length && <div className="text-center text-sm text-slate-500 py-10">Belum ada postingan di grup ini.</div>}{messages.map((m) => { const sender = members.find((x) => x.id === m.sender_id); return <div key={m.id} className={`flex ${m.sender_id === userId ? "justify-end" : "justify-start"}`}><div className={`max-w-[85%] rounded-2xl px-4 py-2 ${m.sender_id === userId ? "bg-blue-600 text-white" : "bg-white border"}`}><div className={`text-[11px] mb-1 ${m.sender_id === userId ? "text-blue-100" : "text-slate-500"}`}>{m.sender_id === userId ? "Anda" : displayName(sender || { id: m.sender_id, full_name: "Pengguna", username: null, avatar_url: null })}</div><div className="whitespace-pre-wrap break-words text-sm">{m.content}</div><div className={`text-[10px] text-right mt-1 ${m.sender_id === userId ? "text-blue-100" : "text-slate-400"}`}>{formatTime(m.created_at)}{m.updated_at ? " • diedit" : ""}</div></div></div>})}</div>
              <div className="p-3 border-t">{selectedGroup.members_can_post === false && !isAdmin && <div className="text-xs text-amber-700 bg-amber-50 rounded-xl p-2 mb-2">Admin sedang membatasi postingan. Hanya admin yang dapat mengirim.</div>}<div className="flex gap-2"><textarea value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); } }} disabled={selectedGroup.members_can_post === false && !isAdmin} placeholder="Tulis pesan/postingan..." className="flex-1 min-h-11 max-h-32 resize-none rounded-xl border px-3 py-2 outline-none focus:ring-2 focus:ring-blue-200" /><button onClick={sendMessage} disabled={!text.trim() || sending || (selectedGroup.members_can_post === false && !isAdmin)} className="px-4 rounded-xl bg-blue-600 text-white font-semibold disabled:opacity-50">Kirim</button></div></div>
            </>}
          </section>
        </div>
      </div>

      {showCreate && <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50"><div className="bg-white rounded-2xl w-full max-w-md p-5"><div className="flex justify-between items-center"><h3 className="font-bold text-lg">Buat Grup</h3><button onClick={() => setShowCreate(false)}>✕</button></div><input value={groupName} onChange={(e) => setGroupName(e.target.value)} placeholder="Nama grup" className="w-full border rounded-xl px-3 py-2 mt-4" /><textarea value={groupDescription} onChange={(e) => setGroupDescription(e.target.value)} placeholder="Deskripsi grup (opsional)" className="w-full border rounded-xl px-3 py-2 mt-3 min-h-20" /><label className="flex items-center gap-2 mt-4 text-sm"><input type="checkbox" checked={allowPosts} onChange={(e) => setAllowPosts(e.target.checked)} /> Izinkan semua anggota mengirim pesan/postingan</label><button onClick={createGroup} disabled={!groupName.trim() || creating} className="w-full mt-4 bg-blue-600 text-white rounded-xl py-2 font-semibold disabled:opacity-50">{creating ? "Membuat..." : "Buat Grup"}</button></div></div>}

      {showInvite && selectedGroup && <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50"><div className="bg-white rounded-2xl w-full max-w-md p-5"><div className="flex justify-between"><h3 className="font-bold">Undang ke grup</h3><button onClick={() => setShowInvite(false)}>✕</button></div><p className="text-sm text-slate-500 mt-2">Kirim link ini kepada pengguna yang ingin bergabung. Grup tidak akan terlihat sebelum mereka membuka link dan bergabung.</p><div className="mt-4 p-3 rounded-xl bg-slate-100 text-xs break-all">{window.location.origin}/chat/grup/join?code={selectedGroup.invite_code}</div><div className="flex gap-2 mt-3"><button onClick={copyInvite} className="flex-1 bg-blue-600 text-white rounded-xl py-2 font-semibold">{inviteCopied ? "Tersalin ✓" : "Salin Link"}</button><button onClick={() => setShowInvite(false)} className="px-4 border rounded-xl">Tutup</button></div></div></div>}

      {showMembers && selectedGroup && <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50"><div className="bg-white rounded-2xl w-full max-w-lg max-h-[85vh] overflow-y-auto p-5"><div className="flex justify-between items-center"><div><h3 className="font-bold text-lg">Anggota Grup</h3><p className="text-xs text-slate-500">{members.length} anggota</p></div><button onClick={() => setShowMembers(false)}>✕</button></div>{isAdmin && <div className="mt-4 p-3 rounded-xl bg-slate-50 border"><div className="font-semibold text-sm">Pengaturan postingan</div><label className="flex items-center gap-2 mt-2 text-sm"><input type="checkbox" checked={selectedGroup.members_can_post !== false} onChange={togglePosts} /> Izinkan anggota mengirim pesan/postingan</label></div>}<div className="mt-4"><div className="font-semibold text-sm mb-2">Anggota</div>{members.map((m) => <div key={m.id} className="flex items-center justify-between py-2 border-b"><div><div className="font-medium text-sm">{displayName(m)} {m.id === selectedGroup.created_by && <span className="text-xs text-blue-600">• Admin</span>}</div>{m.username && <div className="text-xs text-slate-500">@{m.username}</div>}</div>{isAdmin && m.id !== userId && <button disabled={removingId === m.id} onClick={() => removeMember(m)} className="text-xs text-red-600">{removingId === m.id ? "..." : "Keluarkan"}</button>}</div>)}</div>{isAdmin && <div className="mt-5"><div className="font-semibold text-sm mb-2">Tambahkan dari kontak</div><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Cari nama kontak" className="w-full border rounded-xl px-3 py-2 mb-2" />{availableContacts.filter((c) => `${c.full_name} ${c.username || ""}`.toLowerCase().includes(search.toLowerCase())).slice(0, 20).map((c) => <div key={c.id} className="flex items-center justify-between py-2 border-b"><div><div className="text-sm font-medium">{displayName(c)}</div>{c.username && <div className="text-xs text-slate-500">@{c.username}</div>}</div><button disabled={addingId === c.id} onClick={() => addMember(c)} className="px-3 py-1 rounded-lg bg-blue-600 text-white text-xs">{addingId === c.id ? "..." : "Tambah"}</button></div>)}</div>}</div></div>}
    </main>
  );
}
