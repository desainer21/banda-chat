"use client";

import { ChangeEvent, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import BandaLogo from "@/components/BandaLogo";
import { supabase } from "@/lib/supabase";

type Profile = { id: string; full_name: string; username: string | null; avatar_url: string | null };
type Group = { id: string; type: string; name: string | null; created_by: string | null; created_at: string; invite_code?: string | null; members_can_post?: boolean; group_description?: string | null; group_avatar_url?: string | null };
type Message = { id: string; conversation_id: string; sender_id: string; content: string; created_at: string; updated_at?: string | null };

export default function GroupsPage() {
  const router = useRouter();
  const [userId, setUserId] = useState("");
  const [groups, setGroups] = useState<Group[]>([]);
  const [contacts, setContacts] = useState<Profile[]>([]);
  const [selectedGroup, setSelectedGroup] = useState<Group | null>(null);
  const [members, setMembers] = useState<Profile[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [groupUnread, setGroupUnread] = useState<Record<string, number>>({});
  const [groupOnlineUserIds, setGroupOnlineUserIds] = useState<string[]>([]);
  const [typingUserIds, setTypingUserIds] = useState<string[]>([]);
  const [text, setText] = useState("");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [showMembers, setShowMembers] = useState(false);
  const [showInvite, setShowInvite] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [showMobileGroupMenu, setShowMobileGroupMenu] = useState(false);
  const [groupName, setGroupName] = useState("");
  const [groupDescription, setGroupDescription] = useState("");
  const [allowPosts, setAllowPosts] = useState(true);
  const [creating, setCreating] = useState(false);
  const [savingEdit, setSavingEdit] = useState(false);
  const [inviteCopied, setInviteCopied] = useState(false);
  const [addingId, setAddingId] = useState<string | null>(null);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [editAvatarFile, setEditAvatarFile] = useState<File | null>(null);
  const [editAvatarPreview, setEditAvatarPreview] = useState<string | null>(null);
  const typingChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const typingStopTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const remoteTypingTimersRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  const isAdmin = !!selectedGroup && selectedGroup.created_by === userId;
  const availableContacts = useMemo(() => contacts.filter((c) => !members.some((m) => m.id === c.id)), [contacts, members]);
  const onlineMembers = useMemo(() => members.filter((m) => groupOnlineUserIds.includes(m.id)), [members, groupOnlineUserIds]);
  const typingMembers = useMemo(() => members.filter((m) => typingUserIds.includes(m.id)), [members, typingUserIds]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      const { data } = await supabase.auth.getSession();
      if (!data.session?.user) { router.replace("/login"); return; }
      if (!mounted) return;
      const uid = data.session.user.id;
      setUserId(uid);
      await Promise.all([loadGroups(), loadContacts(uid), loadUnreadCounts()]);
      if (mounted) {
        const requestedGroupId = new URLSearchParams(window.location.search).get("group");
        if (requestedGroupId) {
          const { data: requestedGroup } = await supabase.from("conversations").select("id,type,name,created_by,created_at,invite_code,members_can_post,group_description,group_avatar_url").eq("id", requestedGroupId).eq("type", "group").maybeSingle();
          if (requestedGroup) { setSelectedGroup(requestedGroup as Group); await markGroupRead(requestedGroup.id); }
        }
        setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, [router]);

  useEffect(() => {
    if (!selectedGroup || !userId) { setGroupOnlineUserIds([]); return; }
    let mounted = true;
    const presenceChannel = supabase.channel(`group-presence-${selectedGroup.id}`, { config: { presence: { key: userId } } });
    const updatePresence = () => {
      if (!mounted) return;
      const state = presenceChannel.presenceState<{ user_id: string }>();
      const ids = Object.values(state).flatMap((entries) => entries.map((entry) => entry.user_id).filter(Boolean));
      setGroupOnlineUserIds([...new Set(ids)]);
    };
    presenceChannel.on("presence", { event: "sync" }, updatePresence).on("presence", { event: "join" }, updatePresence).on("presence", { event: "leave" }, updatePresence).subscribe(async (status) => {
      if (status === "SUBSCRIBED") { await presenceChannel.track({ user_id: userId, group_id: selectedGroup.id }); updatePresence(); }
    });
    return () => { mounted = false; setGroupOnlineUserIds([]); void presenceChannel.untrack(); void supabase.removeChannel(presenceChannel); };
  }, [selectedGroup?.id, userId]);

  useEffect(() => {
    if (!selectedGroup || !userId) { setTypingUserIds([]); return; }
    const channel = supabase.channel(`group-typing-${selectedGroup.id}`);
    typingChannelRef.current = channel;
    channel.on("broadcast", { event: "typing" }, ({ payload }) => {
      const senderId = typeof payload?.user_id === "string" ? payload.user_id : "";
      if (!senderId || senderId === userId) return;
      if (remoteTypingTimersRef.current[senderId]) { clearTimeout(remoteTypingTimersRef.current[senderId]); delete remoteTypingTimersRef.current[senderId]; }
      setTypingUserIds((prev) => payload?.is_typing === true ? (prev.includes(senderId) ? prev : [...prev, senderId]) : prev.filter((id) => id !== senderId));
      if (payload?.is_typing === true) remoteTypingTimersRef.current[senderId] = setTimeout(() => { setTypingUserIds((prev) => prev.filter((id) => id !== senderId)); delete remoteTypingTimersRef.current[senderId]; }, 2500);
    }).subscribe();
    return () => {
      if (typingStopTimerRef.current) clearTimeout(typingStopTimerRef.current);
      typingStopTimerRef.current = null;
      Object.values(remoteTypingTimersRef.current).forEach((timer) => clearTimeout(timer));
      remoteTypingTimersRef.current = {};
      setTypingUserIds([]);
      if (typingChannelRef.current === channel) typingChannelRef.current = null;
      void channel.send({ type: "broadcast", event: "typing", payload: { user_id: userId, is_typing: false } });
      void supabase.removeChannel(channel);
    };
  }, [selectedGroup?.id, userId]);

  useEffect(() => {
    if (!selectedGroup) return;
    loadMembers(selectedGroup.id); loadMessages(selectedGroup.id); void markGroupRead(selectedGroup.id); setGroupUnread((prev) => ({ ...prev, [selectedGroup.id]: 0 }));
    const channel = supabase.channel(`group-messages-${selectedGroup.id}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages", filter: `conversation_id=eq.${selectedGroup.id}` }, async (payload) => {
        const message = payload.new as Message;
        setMessages((prev) => prev.some((m) => m.id === message.id) ? prev : [...prev, message]);
        if (message.sender_id !== userId) {
          if (remoteTypingTimersRef.current[message.sender_id]) { clearTimeout(remoteTypingTimersRef.current[message.sender_id]); delete remoteTypingTimersRef.current[message.sender_id]; }
          setTypingUserIds((prev) => prev.filter((id) => id !== message.sender_id));
          await markGroupRead(selectedGroup.id); void loadUnreadCounts();
        }
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "messages", filter: `conversation_id=eq.${selectedGroup.id}` }, (payload) => {
        const message = payload.new as Message;
        setMessages((prev) => prev.map((m) => m.id === message.id ? message : m));
      }).subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [selectedGroup?.id, userId]);

  useEffect(() => {
    if (!selectedGroup) return;
    const timer = setInterval(() => { void loadMessages(selectedGroup.id); }, 2000);
    return () => clearInterval(timer);
  }, [selectedGroup?.id]);

  async function loadGroups() {
    const { data, error } = await supabase.from("conversations").select("id,type,name,created_by,created_at,invite_code,members_can_post,group_description,group_avatar_url").eq("type", "group").order("created_at", { ascending: false });
    if (error) { setError(error.message); return; }
    setGroups((data || []) as Group[]);
  }
  async function loadUnreadCounts() {
    const { data, error: unreadError } = await supabase.rpc("get_banda_group_unread_counts");
    if (unreadError) { console.error("Load group unread error:", unreadError); return; }
    const next: Record<string, number> = {};
    (data || []).forEach((row: { conversation_id: string; unread_count: number | string }) => { next[row.conversation_id] = Number(row.unread_count) || 0; });
    setGroupUnread(next);
  }
  async function markGroupRead(groupId: string) { const { error: readError } = await supabase.rpc("mark_banda_group_read", { p_conversation_id: groupId }); if (readError) console.error("Mark group read error:", readError); }
  async function loadContacts(uid: string) {
    const { data: mine } = await supabase.from("conversation_members").select("conversation_id").eq("user_id", uid);
    const ids = (mine || []).map((x: any) => x.conversation_id); if (!ids.length) { setContacts([]); return; }
    const { data: directs } = await supabase.from("conversations").select("id").in("id", ids).eq("type", "direct");
    const directIds = (directs || []).map((x: any) => x.id); if (!directIds.length) { setContacts([]); return; }
    const { data: otherMembers } = await supabase.from("conversation_members").select("user_id,conversation_id").in("conversation_id", directIds).neq("user_id", uid);
    const userIds = [...new Set((otherMembers || []).map((x: any) => x.user_id))]; if (!userIds.length) { setContacts([]); return; }
    const { data: profiles } = await supabase.from("profiles").select("id,full_name,username,avatar_url").in("id", userIds); setContacts((profiles || []) as Profile[]);
  }
  async function loadMembers(groupId: string) {
    const { data: rows, error: memberError } = await supabase.from("conversation_members").select("user_id").eq("conversation_id", groupId);
    if (memberError) { setError(memberError.message); return; }
    const ids = (rows || []).map((x: any) => x.user_id); if (!ids.length) { setMembers([]); return; }
    const { data: profiles } = await supabase.from("profiles").select("id,full_name,username,avatar_url").in("id", ids); setMembers((profiles || []) as Profile[]);
  }
  async function loadMessages(groupId: string) {
    const { data, error: messageError } = await supabase.from("messages").select("id,conversation_id,sender_id,content,created_at,updated_at").eq("conversation_id", groupId).order("created_at", { ascending: true }).limit(200);
    if (messageError) { console.error("Load group messages error:", messageError); return; }
    setMessages((data || []) as Message[]);
  }
  async function createGroup() {
    if (!groupName.trim() || creating) return;
    setCreating(true); setError("");
    const { data, error: rpcError } = await supabase.rpc("create_banda_group", { p_name: groupName.trim(), p_description: groupDescription.trim() || null, p_members_can_post: allowPosts });
    if (rpcError) setError(rpcError.message); else { const group = data as Group; setGroups((prev) => [group, ...prev]); setSelectedGroup(group); setGroupName(""); setGroupDescription(""); setAllowPosts(true); setShowCreate(false); await loadUnreadCounts(); }
    setCreating(false);
  }
  function openEditGroup() {
    if (!selectedGroup || !isAdmin) return;
    setGroupName(selectedGroup.name || ""); setGroupDescription(selectedGroup.group_description || ""); setEditAvatarFile(null); setEditAvatarPreview(selectedGroup.group_avatar_url || null); setError(""); setShowEdit(true);
  }
  function handleEditAvatarChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]; event.target.value = ""; if (!file) return;
    if (!file.type.startsWith("image/")) { setError("Foto grup harus berupa gambar."); return; }
    if (file.size > 5 * 1024 * 1024) { setError("Ukuran foto grup maksimal 5 MB."); return; }
    if (editAvatarPreview?.startsWith("blob:")) URL.revokeObjectURL(editAvatarPreview);
    setEditAvatarFile(file); setEditAvatarPreview(URL.createObjectURL(file));
  }
  async function uploadGroupAvatar(file: File, groupId: string) {
    const extension = file.name.split(".").pop()?.toLowerCase() || "jpg";
    const path = `${groupId}/group-${Date.now()}.${extension}`;
    const { error: uploadError } = await supabase.storage.from("group-avatars").upload(path, file, { cacheControl: "3600", upsert: false });
    if (uploadError) throw new Error("Upload foto grup gagal: " + uploadError.message);
    const { data } = supabase.storage.from("group-avatars").getPublicUrl(path); if (!data.publicUrl) throw new Error("URL foto grup tidak ditemukan."); return data.publicUrl;
  }
  async function saveGroupEdit() {
    if (!selectedGroup || !isAdmin || savingEdit) return;
    if (!groupName.trim()) { setError("Nama grup wajib diisi."); return; }
    setSavingEdit(true); setError("");
    try {
      let avatarUrl = selectedGroup.group_avatar_url || null; if (editAvatarFile) avatarUrl = await uploadGroupAvatar(editAvatarFile, selectedGroup.id);
      const { data, error: rpcError } = await supabase.rpc("update_banda_group", { p_conversation_id: selectedGroup.id, p_name: groupName.trim(), p_description: groupDescription.trim() || null, p_avatar_url: avatarUrl });
      if (rpcError) throw new Error(rpcError.message);
      const updated = data as Group; setSelectedGroup(updated); setGroups((prev) => prev.map((g) => g.id === updated.id ? updated : g)); setEditAvatarFile(null); setShowEdit(false);
    } catch (err) { setError(err instanceof Error ? err.message : "Grup gagal diperbarui."); } finally { setSavingEdit(false); }
  }
  async function addMember(profile: Profile) {
    if (!selectedGroup || !isAdmin) return; setAddingId(profile.id); setError("");
    const { error: rpcError } = await supabase.rpc("add_banda_group_member", { p_conversation_id: selectedGroup.id, p_user_id: profile.id });
    if (rpcError) setError(rpcError.message); else await loadMembers(selectedGroup.id); setAddingId(null);
  }
  async function removeMember(profile: Profile) {
    if (!selectedGroup || !isAdmin || profile.id === userId) return;
    if (!window.confirm(`Keluarkan ${profile.full_name || profile.username || "anggota"} dari grup?`)) return;
    setRemovingId(profile.id); setError("");
    const { error: rpcError } = await supabase.rpc("remove_banda_group_member", { p_conversation_id: selectedGroup.id, p_user_id: profile.id });
    if (rpcError) setError(rpcError.message); else await loadMembers(selectedGroup.id); setRemovingId(null);
  }
  async function togglePosts() {
    if (!selectedGroup || !isAdmin) return;
    const next = !(selectedGroup.members_can_post ?? true);
    const { error: rpcError } = await supabase.rpc("set_banda_group_post_permission", { p_conversation_id: selectedGroup.id, p_allowed: next });
    if (rpcError) setError(rpcError.message); else { const updated = { ...selectedGroup, members_can_post: next }; setSelectedGroup(updated); setGroups((prev) => prev.map((g) => g.id === updated.id ? updated : g)); }
  }
  async function broadcastTyping(isTyping: boolean) { const channel = typingChannelRef.current; if (!channel || !userId) return; await channel.send({ type: "broadcast", event: "typing", payload: { user_id: userId, is_typing: isTyping } }); }
  function handleTextChange(value: string) {
    setText(value); if (!selectedGroup || !userId || (selectedGroup.members_can_post === false && !isAdmin)) return;
    if (typingStopTimerRef.current) clearTimeout(typingStopTimerRef.current); void broadcastTyping(value.trim().length > 0);
    if (value.trim().length > 0) typingStopTimerRef.current = setTimeout(() => { void broadcastTyping(false); }, 1500);
  }
  async function sendMessage() {
    if (!selectedGroup || !text.trim() || sending) return;
    if (typingStopTimerRef.current) clearTimeout(typingStopTimerRef.current); void broadcastTyping(false); setSending(true); setError("");
    const { data, error: rpcError } = await supabase.rpc("send_banda_group_message", { p_conversation_id: selectedGroup.id, p_content: text.trim() });
    if (rpcError) setError(rpcError.message); else if (data) { const message = data as Message; setMessages((prev) => prev.some((m) => m.id === message.id) ? prev : [...prev, message]); setText(""); void loadUnreadCounts(); }
    setSending(false);
  }
  async function copyInvite() {
    if (!selectedGroup?.invite_code) return;
    const link = `${window.location.origin}/chat/grup/join?code=${encodeURIComponent(selectedGroup.invite_code)}`; await navigator.clipboard.writeText(link); setInviteCopied(true); setTimeout(() => setInviteCopied(false), 1800);
  }
  function selectGroup(group: Group) { setSelectedGroup(group); setShowMobileGroupMenu(false); setGroupUnread((prev) => ({ ...prev, [group.id]: 0 })); void markGroupRead(group.id); }
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
              {!groups.length ? <div className="p-6 text-center text-sm text-slate-500">Belum ada grup. Buat grup atau bergabung melalui link undangan.</div> : groups.map((g) => <button key={g.id} onClick={() => selectGroup(g)} className={`w-full text-left p-4 border-b hover:bg-slate-50 ${selectedGroup?.id === g.id ? "bg-blue-50" : ""}`}><div className="flex items-center gap-3"><div className="h-10 w-10 shrink-0 overflow-hidden rounded-full bg-green-100 flex items-center justify-center">{g.group_avatar_url ? <img src={g.group_avatar_url} alt={g.name || "Grup"} className="h-full w-full object-cover" /> : <span className="text-lg">👥</span>}</div><div className="min-w-0 flex-1"><div className="flex items-center justify-between gap-2"><div className="font-semibold truncate">{g.name || "Grup"}</div>{(groupUnread[g.id] || 0) > 0 && <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-green-500 px-1 text-[10px] font-bold text-white">{groupUnread[g.id] > 99 ? "99+" : groupUnread[g.id]}</span>}</div><div className="text-xs text-slate-500 mt-1">{g.members_can_post === false ? "Hanya admin yang dapat posting" : "Anggota dapat posting"}</div></div></div></button>)}
            </div>
          </aside>
          <section className="bg-white border border-slate-200 rounded-2xl min-h-[70vh] flex flex-col overflow-hidden">
            {!selectedGroup ? <div className="flex-1 flex flex-col items-center justify-center text-center p-8 text-slate-500"><div className="text-5xl mb-3">👥</div><h2 className="font-bold text-lg text-slate-700">Pilih grup</h2><p className="text-sm mt-1">Atau buat grup baru untuk mulai mengobrol bersama beberapa teman.</p></div> : <>
              <div className="p-4 border-b flex items-center justify-between gap-3 group-mobile-header"><div className="flex items-center gap-3 min-w-0"><div className="h-12 w-12 shrink-0 overflow-hidden rounded-full bg-green-100 flex items-center justify-center">{selectedGroup.group_avatar_url ? <img src={selectedGroup.group_avatar_url} alt={selectedGroup.name || "Grup"} className="h-full w-full object-cover" /> : <span className="text-xl">👥</span>}</div><div className="min-w-0"><h2 className="font-bold truncate">{selectedGroup.name}</h2><p className="text-xs text-slate-500">{members.length} anggota{onlineMembers.length ? ` • ${onlineMembers.length} online` : ""}{isAdmin ? " • Anda admin" : ""}</p></div></div>
                <div className="flex gap-2 group-desktop-actions"><button onClick={() => setShowInvite(true)} className="px-3 py-2 rounded-xl border text-sm">🔗 Undang</button>{isAdmin && <button onClick={openEditGroup} className="px-3 py-2 rounded-xl border text-sm">✏️ Edit Grup</button>}<button onClick={() => setShowMembers(true)} className="px-3 py-2 rounded-xl border text-sm">👤 Anggota</button></div>
                <div className="hidden group-mobile-actions relative">
                  <button aria-label="Menu grup" onClick={() => setShowMobileGroupMenu((v) => !v)} className="h-8 w-8 rounded-full border flex items-center justify-center text-lg leading-none">⋮</button>
                  {showMobileGroupMenu && <div className="absolute right-0 top-10 z-40 w-40 rounded-xl border bg-white shadow-lg p-1">
                    <button onClick={() => { setShowMobileGroupMenu(false); setShowInvite(true); }} className="w-full text-left rounded-lg px-3 py-2 text-xs hover:bg-slate-50">🔗 Undang</button>
                    <button onClick={() => { setShowMobileGroupMenu(false); setShowMembers(true); }} className="w-full text-left rounded-lg px-3 py-2 text-xs hover:bg-slate-50">👤 Anggota</button>
                    {isAdmin && <button onClick={() => { setShowMobileGroupMenu(false); openEditGroup(); }} className="w-full text-left rounded-lg px-3 py-2 text-xs hover:bg-slate-50">✏️ Edit Grup</button>}
                  </div>}
                </div>
              </div>
              <div className="flex-1 p-4 overflow-y-auto space-y-3 bg-slate-50 min-h-[48vh]">{!messages.length && <div className="text-center text-sm text-slate-500 py-10">Belum ada postingan di grup ini.</div>}{messages.map((m) => { const sender = members.find((x) => x.id === m.sender_id); return <div key={m.id} className={`flex ${m.sender_id === userId ? "justify-end" : "justify-start"}`}><div className={`max-w-[85%] rounded-2xl px-4 py-2 ${m.sender_id === userId ? "bg-blue-600 text-white" : "bg-white border"}`}><div className={`text-[11px] mb-1 ${m.sender_id === userId ? "text-blue-100" : "text-slate-500"}`}>{m.sender_id === userId ? "Anda" : displayName(sender || { id: m.sender_id, full_name: "Pengguna", username: null, avatar_url: null })}</div><div className="whitespace-pre-wrap break-words text-sm">{m.content}</div><div className={`text-[10px] text-right mt-1 ${m.sender_id === userId ? "text-blue-100" : "text-slate-400"}`}>{formatTime(m.created_at)}{m.updated_at && m.updated_at !== m.created_at ? " • diedit" : ""}</div></div></div>})}</div>
              {typingMembers.length > 0 && <div className="px-4 py-1.5 bg-slate-50 border-t border-slate-100 min-h-8"><div className="flex items-center gap-2 text-xs text-slate-500"><span className="inline-flex gap-0.5 items-end h-4"><span className="h-1.5 w-1.5 rounded-full bg-slate-400 animate-bounce [animation-delay:-0.3s]" /><span className="h-1.5 w-1.5 rounded-full bg-slate-400 animate-bounce [animation-delay:-0.15s]" /><span className="h-1.5 w-1.5 rounded-full bg-slate-400 animate-bounce" /></span><span>{typingMembers.length === 1 ? `${displayName(typingMembers[0])} sedang menulis...` : typingMembers.length === 2 ? `${displayName(typingMembers[0])} dan ${displayName(typingMembers[1])} sedang menulis...` : `${displayName(typingMembers[0])}, ${displayName(typingMembers[1])} dan ${typingMembers.length - 2} lainnya sedang menulis...`}</span></div></div>}
              <div className="p-3 border-t">{selectedGroup.members_can_post === false && !isAdmin && <div className="text-xs text-amber-700 bg-amber-50 rounded-xl p-2 mb-2">Admin sedang membatasi postingan. Hanya admin yang dapat mengirim.</div>}<div className="flex gap-2"><textarea value={text} onChange={(e) => handleTextChange(e.target.value)} onBlur={() => void broadcastTyping(false)} onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void sendMessage(); } }} disabled={selectedGroup.members_can_post === false && !isAdmin} placeholder="Tulis pesan/postingan..." className="flex-1 min-h-11 max-h-32 resize-none rounded-xl border px-3 py-2 outline-none focus:ring-2 focus:ring-blue-200" /><button onClick={() => void sendMessage()} disabled={!text.trim() || sending || (selectedGroup.members_can_post === false && !isAdmin)} className="px-4 rounded-xl bg-blue-600 text-white font-semibold disabled:opacity-50">Kirim</button></div></div>
            </>}
          </section>
        </div>
      </div>

      {showCreate && <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50"><div className="bg-white rounded-2xl w-full max-w-md p-5"><div className="flex justify-between items-center"><h3 className="font-bold text-lg">Buat Grup</h3><button onClick={() => setShowCreate(false)}>✕</button></div><input value={groupName} onChange={(e) => setGroupName(e.target.value)} placeholder="Nama grup" className="w-full border rounded-xl px-3 py-2 mt-4" /><textarea value={groupDescription} onChange={(e) => setGroupDescription(e.target.value)} placeholder="Deskripsi grup (opsional)" className="w-full border rounded-xl px-3 py-2 mt-3 min-h-20" /><label className="flex items-center gap-2 mt-4 text-sm"><input type="checkbox" checked={allowPosts} onChange={(e) => setAllowPosts(e.target.checked)} /> Izinkan semua anggota mengirim pesan/postingan</label><button onClick={() => void createGroup()} disabled={!groupName.trim() || creating} className="w-full mt-4 bg-blue-600 text-white rounded-xl py-2 font-semibold disabled:opacity-50">{creating ? "Membuat..." : "Buat Grup"}</button></div></div>}
      {showEdit && selectedGroup && isAdmin && <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50"><div className="bg-white rounded-2xl w-full max-w-md max-h-[90vh] overflow-y-auto p-5"><div className="flex justify-between items-center"><div><h3 className="font-bold text-lg">Edit Grup</h3><p className="text-xs text-slate-500 mt-1">Hanya admin yang dapat mengubah profil grup.</p></div><button onClick={() => setShowEdit(false)} disabled={savingEdit}>✕</button></div><div className="mt-5 flex flex-col items-center"><div className="h-28 w-28 overflow-hidden rounded-full border-4 border-white bg-green-100 shadow-lg ring-1 ring-slate-200 flex items-center justify-center">{editAvatarPreview ? <img src={editAvatarPreview} alt="Preview foto grup" className="h-full w-full object-cover" /> : <span className="text-4xl">👥</span>}</div><input id="groupAvatarInput" type="file" accept="image/*" onChange={handleEditAvatarChange} className="hidden" /><label htmlFor="groupAvatarInput" className="mt-3 cursor-pointer rounded-xl bg-blue-50 px-4 py-2 text-sm font-bold text-blue-600 hover:bg-blue-100">📷 Ganti Foto Grup</label><p className="mt-1 text-[11px] text-slate-400">JPG, PNG, WebP · maksimal 5 MB</p></div><label className="mt-5 block text-sm font-semibold">Nama Grup<input value={groupName} onChange={(e) => setGroupName(e.target.value)} disabled={savingEdit} className="mt-2 w-full border rounded-xl px-3 py-2" /></label><label className="mt-4 block text-sm font-semibold">Deskripsi<textarea value={groupDescription} onChange={(e) => setGroupDescription(e.target.value)} disabled={savingEdit} className="mt-2 w-full border rounded-xl px-3 py-2 min-h-24" /></label><div className="mt-5 flex gap-2"><button onClick={() => setShowEdit(false)} disabled={savingEdit} className="flex-1 rounded-xl border py-2 font-semibold">Batal</button><button onClick={() => void saveGroupEdit()} disabled={savingEdit || !groupName.trim()} className="flex-1 rounded-xl bg-blue-600 py-2 font-semibold text-white disabled:opacity-50">{savingEdit ? "Menyimpan..." : "Simpan Perubahan"}</button></div></div></div>}
      {showInvite && selectedGroup && <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50"><div className="bg-white rounded-2xl w-full max-w-md p-5"><div className="flex justify-between"><h3 className="font-bold">Undang ke grup</h3><button onClick={() => setShowInvite(false)}>✕</button></div><p className="text-sm text-slate-500 mt-2">Kirim link ini kepada pengguna yang ingin bergabung. Grup tidak akan terlihat sebelum mereka membuka link dan bergabung.</p><div className="mt-4 p-3 rounded-xl bg-slate-100 text-xs break-all">{window.location.origin}/chat/grup/join?code={selectedGroup.invite_code}</div><div className="flex gap-2 mt-3"><button onClick={() => void copyInvite()} className="flex-1 bg-blue-600 text-white rounded-xl py-2 font-semibold">{inviteCopied ? "Tersalin ✓" : "Salin Link"}</button><button onClick={() => setShowInvite(false)} className="px-4 border rounded-xl">Tutup</button></div></div></div>}
      {showMembers && selectedGroup && <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50"><div className="bg-white rounded-2xl w-full max-w-lg max-h-[85vh] overflow-y-auto p-5"><div className="flex justify-between items-center"><div><h3 className="font-bold text-lg">Anggota Grup</h3><p className="text-xs text-slate-500">{members.length} anggota • {onlineMembers.length} sedang online di grup</p></div><button onClick={() => setShowMembers(false)}>✕</button></div>{isAdmin && <div className="mt-4 p-3 rounded-xl bg-slate-50 border"><div className="font-semibold text-sm">Pengaturan postingan</div><label className="flex items-center gap-2 mt-2 text-sm"><input type="checkbox" checked={selectedGroup.members_can_post !== false} onChange={() => void togglePosts()} /> Izinkan anggota mengirim pesan/postingan</label></div>}<div className="mt-4"><div className="font-semibold text-sm mb-2">Status anggota</div>{members.map((m) => { const isOnline = groupOnlineUserIds.includes(m.id); return <div key={m.id} className="flex items-center justify-between py-2 border-b"><div className="flex items-center gap-3 min-w-0"><div className="relative h-9 w-9 shrink-0 overflow-hidden rounded-full bg-slate-200 flex items-center justify-center">{m.avatar_url ? <img src={m.avatar_url} alt={displayName(m)} className="h-full w-full object-cover" /> : <span className="text-sm font-bold text-slate-500">{displayName(m).charAt(0).toUpperCase()}</span>}<span className={`absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-white ${isOnline ? "bg-green-500" : "bg-slate-300"}`} /></div><div className="min-w-0"><div className="font-medium text-sm truncate">{displayName(m)} {m.id === selectedGroup.created_by && <span className="text-xs text-blue-600">• Admin</span>}</div><div className={`text-xs ${isOnline ? "text-green-600" : "text-slate-400"}`}>{isOnline ? "Online di grup" : "Offline"}</div>{m.username && <div className="text-xs text-slate-500">@{m.username}</div>}</div></div>{isAdmin && m.id !== userId && <button disabled={removingId === m.id} onClick={() => void removeMember(m)} className="text-xs text-red-600">{removingId === m.id ? "..." : "Keluarkan"}</button>}</div>})}</div>{isAdmin && <div className="mt-5"><div className="font-semibold text-sm mb-2">Tambahkan dari kontak</div><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Cari nama kontak" className="w-full border rounded-xl px-3 py-2 mb-2" />{availableContacts.filter((c) => `${c.full_name} ${c.username || ""}`.toLowerCase().includes(search.toLowerCase())).slice(0, 20).map((c) => <div key={c.id} className="flex items-center justify-between py-2 border-b"><div><div className="text-sm font-medium">{displayName(c)}</div>{c.username && <div className="text-xs text-slate-500">@{c.username}</div>}</div><button disabled={addingId === c.id} onClick={() => void addMember(c)} className="px-3 py-1 rounded-lg bg-blue-600 text-white text-xs">{addingId === c.id ? "..." : "Tambah"}</button></div>)}</div>}</div></div>}
    </main>
  );
}
