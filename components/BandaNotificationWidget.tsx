"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

type NotificationItem = { id: string; source: "chat" | "group"; sourceId: string; senderId: string; title: string; preview: string; createdAt: string; href: string };
type Conversation = { id: string; type: string; name: string | null };
type Profile = { id: string; full_name: string | null; username: string | null };
const DISMISSED_KEY = "banda-chat-dismissed-notifications-v2";
function readDismissed(): string[] { try { const raw = window.localStorage.getItem(DISMISSED_KEY); return raw ? (JSON.parse(raw) as string[]) : []; } catch { return []; } }
function saveDismissed(ids: string[]) { try { window.localStorage.setItem(DISMISSED_KEY, JSON.stringify(ids.slice(-500))); } catch {} }

export default function BandaNotificationWidget({ mode = "all" }: { mode?: "chat" | "group" | "all" }) {
  const router = useRouter();
  const pathname = usePathname();
  const allowedPage = pathname === "/chat" || pathname.startsWith("/chat/");
  const [userId, setUserId] = useState("");
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [dismissed, setDismissed] = useState<string[]>([]);
  const visibleItems = useMemo(() => items.filter((n) => (mode === "all" || n.source === mode) && !dismissed.includes(n.id)), [items, mode, dismissed]);

  useEffect(() => {
    if (!allowedPage) { setUserId(""); setItems([]); setOpen(false); return; }
    let active = true;
    void (async () => { const { data } = await supabase.auth.getSession(); if (!active || !data.session?.user) return; setUserId(data.session.user.id); setDismissed(readDismissed()); })();
    return () => { active = false; };
  }, [allowedPage]);

  async function loadUnreadNotifications(uid: string) {
    if (!uid) return;
    setLoading(true);
    try {
      const { data: memberships, error: membershipError } = await supabase.from("conversation_members").select("conversation_id").eq("user_id", uid);
      if (membershipError) throw membershipError;
      const conversationIds = [...new Set((memberships || []).map((row: { conversation_id: string }) => row.conversation_id))];
      if (!conversationIds.length) { setItems([]); return; }
      const { data: conversations, error: conversationError } = await supabase.from("conversations").select("id,type,name").in("id", conversationIds);
      if (conversationError) throw conversationError;
      const convMap = new Map<string, Conversation>((conversations || []).map((c) => [c.id, c as Conversation]));
      const directIds = (conversations || []).filter((c) => c.type !== "group").map((c) => c.id);
      const groupIds = (conversations || []).filter((c) => c.type === "group").map((c) => c.id);
      const result: NotificationItem[] = [];

      if (directIds.length) {
        const { data: directMessages, error } = await supabase.from("messages").select("id,conversation_id,sender_id,content,created_at").in("conversation_id", directIds).neq("sender_id", uid).is("read_at", null).order("created_at", { ascending: false }).limit(100);
        if (error) throw error;
        const senderIds = [...new Set((directMessages || []).map((m) => m.sender_id))];
        const { data: senders } = senderIds.length ? await supabase.from("profiles").select("id,full_name,username").in("id", senderIds) : { data: [] as Profile[] };
        const senderMap = new Map<string, Profile>((senders || []).map((p) => [p.id, p as Profile]));
        for (const m of directMessages || []) {
          const p = senderMap.get(m.sender_id); const name = p?.full_name?.trim() || p?.username || "Pengguna baru";
          result.push({ id: m.id, source: "chat", sourceId: m.conversation_id, senderId: m.sender_id, title: name, preview: m.content?.trim() || "Mengirim pesan baru", createdAt: m.created_at, href: `/chat?conversation=${encodeURIComponent(m.conversation_id)}` });
        }
      }

      if (groupIds.length) {
        const { data: groupMessages, error } = await supabase.from("messages").select("id,conversation_id,sender_id,content,created_at").in("conversation_id", groupIds).neq("sender_id", uid).order("created_at", { ascending: false }).limit(200);
        if (error) throw error;
        const messageIds = (groupMessages || []).map((m) => m.id);
        const { data: reads } = messageIds.length ? await supabase.from("group_message_reads").select("message_id").eq("user_id", uid).in("message_id", messageIds) : { data: [] as { message_id: string }[] };
        const readIds = new Set((reads || []).map((r) => r.message_id));
        for (const m of groupMessages || []) {
          if (readIds.has(m.id)) continue;
          const conv = convMap.get(m.conversation_id); if (!conv) continue;
          result.push({ id: m.id, source: "group", sourceId: m.conversation_id, senderId: m.sender_id, title: conv.name || "Grup Banda Chat", preview: m.content?.trim() || "Mengirim pesan baru", createdAt: m.created_at, href: `/chat/grup?group=${encodeURIComponent(m.conversation_id)}` });
        }
      }
      result.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      setItems(result.slice(0, 100));
    } catch (error) { console.error("Load notification error:", error); }
    finally { setLoading(false); }
  }

  useEffect(() => {
    if (!allowedPage || !userId) return;
    void loadUnreadNotifications(userId);
    const timer = window.setInterval(() => void loadUnreadNotifications(userId), 3000);
    const channel = supabase.channel(`banda-notifications-${userId}`).on("postgres_changes", { event: "INSERT", schema: "public", table: "messages" }, () => void loadUnreadNotifications(userId)).on("postgres_changes", { event: "UPDATE", schema: "public", table: "messages" }, () => void loadUnreadNotifications(userId)).subscribe();
    return () => { window.clearInterval(timer); void supabase.removeChannel(channel); };
  }, [allowedPage, userId]);

  if (!allowedPage || !userId) return null;
  function dismiss(id: string) { setDismissed((prev) => { const next = prev.includes(id) ? prev : [...prev, id]; saveDismissed(next); return next; }); }
  function clearAll() { const ids = visibleItems.map((item) => item.id); setDismissed((prev) => { const next = [...new Set([...prev, ...ids])]; saveDismissed(next); return next; }); }
  function openNotification(item: NotificationItem) { dismiss(item.id); setOpen(false); router.push(item.href); }

  return <div className="fixed bottom-20 right-4 z-[60]">
    {open && <div className="mb-2 w-[min(92vw,360px)] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl"><div className="flex items-center justify-between border-b p-3"><div><div className="font-bold text-sm">Notifikasi</div><div className="text-[11px] text-slate-500">Pesan pribadi dan grup</div></div>{visibleItems.length > 0 && <button type="button" onClick={clearAll} className="text-xs text-red-600">Hapus semua</button>}</div><div className="max-h-[55vh] overflow-y-auto">{loading && !visibleItems.length ? <div className="p-6 text-center text-sm text-slate-500">Memeriksa pesan baru...</div> : !visibleItems.length ? <div className="p-6 text-center text-sm text-slate-500">Belum ada notifikasi baru.</div> : visibleItems.map((item) => <div key={item.id} className="flex items-start gap-2 border-b p-3 hover:bg-slate-50"><button type="button" onClick={() => openNotification(item)} className="min-w-0 flex-1 text-left"><div className="flex items-center gap-2"><span>{item.source === "group" ? "👥" : "💬"}</span><span className="font-semibold text-sm truncate">{item.title}</span></div><div className="mt-1 text-xs text-slate-600 line-clamp-2">{item.preview}</div><div className="mt-1 text-[10px] text-slate-400">{new Date(item.createdAt).toLocaleString("id-ID")}</div></button><button type="button" onClick={() => dismiss(item.id)} aria-label="Hapus notifikasi" className="shrink-0 px-1 text-slate-400 hover:text-red-600">✕</button></div>)}</div></div>}
    <button type="button" onClick={() => setOpen((value) => !value)} aria-label="Notifikasi" className="relative h-12 w-12 rounded-full bg-blue-600 text-white shadow-lg flex items-center justify-center border-2 border-white">🔔{visibleItems.length > 0 && <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">{visibleItems.length > 99 ? "99+" : visibleItems.length}</span>}</button>
  </div>;
}
