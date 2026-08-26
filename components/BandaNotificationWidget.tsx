"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

type NotificationItem = {
  id: string;
  source: "chat" | "group";
  sourceId: string;
  senderId: string;
  title: string;
  preview: string;
  createdAt: string;
  href: string;
};

type Profile = { id: string; full_name: string | null; username: string | null };
type Conversation = { id: string; type: string; name: string | null };

type Props = { mode?: "chat" | "group" | "all" };

const STORAGE_KEY = "banda-chat-notifications-v1";

function readStored(): NotificationItem[] {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as NotificationItem[]) : [];
  } catch { return []; }
}

export default function BandaNotificationWidget({ mode = "all" }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [open, setOpen] = useState(false);
  const [userId, setUserId] = useState("");

  const visibleItems = useMemo(() => items.filter((n) => mode === "all" || n.source === mode), [items, mode]);

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase.auth.getSession();
      if (!data.session?.user) return;
      setUserId(data.session.user.id);
      setItems(readStored());
    };
    void load();
  }, []);

  useEffect(() => {
    if (!userId) return;
    const save = () => window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    save();
  }, [items, userId]);

  useEffect(() => {
    if (!userId) return;

    const channel = supabase.channel(`banda-notifications-${userId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages" }, async (payload) => {
        const message = payload.new as { id: string; conversation_id: string; sender_id: string; content: string; created_at: string };
        if (!message.id || message.sender_id === userId) return;

        const [{ data: membership }, { data: conversation }] = await Promise.all([
          supabase.from("conversation_members").select("user_id").eq("conversation_id", message.conversation_id).eq("user_id", userId).maybeSingle(),
          supabase.from("conversations").select("id,type,name").eq("id", message.conversation_id).maybeSingle(),
        ]);
        if (!membership || !conversation) return;
        const conv = conversation as Conversation;
        const source: "chat" | "group" = conv.type === "group" ? "group" : "chat";
        const [{ data: sender }] = await Promise.all([
          supabase.from("profiles").select("id,full_name,username").eq("id", message.sender_id).maybeSingle(),
        ]);
        const p = sender as Profile | null;
        const senderName = p?.full_name?.trim() || p?.username || "Pengguna baru";
        const title = source === "group" ? (conv.name || "Grup Banda Chat") : senderName;
        const item: NotificationItem = {
          id: message.id,
          source,
          sourceId: message.conversation_id,
          senderId: message.sender_id,
          title,
          preview: message.content?.trim() || "Mengirim pesan baru",
          createdAt: message.created_at,
          href: source === "group" ? `/chat/grup?group=${encodeURIComponent(message.conversation_id)}` : `/chat?conversation=${encodeURIComponent(message.conversation_id)}`,
        };
        setItems((prev) => [item, ...prev.filter((x) => x.id !== item.id)].slice(0, 100));
      })
      .subscribe();

    return () => { void supabase.removeChannel(channel); };
  }, [userId]);

  useEffect(() => {
    if (!userId) return;
    const onStorage = () => setItems(readStored());
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [userId]);

  if (!userId || !visibleItems.length && !open) return (
    <button
      type="button"
      onClick={() => setOpen(true)}
      aria-label="Notifikasi"
      className="fixed bottom-4 right-4 z-50 h-12 w-12 rounded-full bg-blue-600 text-white shadow-lg flex items-center justify-center border-2 border-white"
    >
      🔔
    </button>
  );

  function remove(id: string) {
    setItems((prev) => prev.filter((n) => n.id !== id));
  }

  function clearAll() {
    setItems((prev) => mode === "all" ? [] : prev.filter((n) => n.source !== mode));
  }

  function openNotification(item: NotificationItem) {
    remove(item.id);
    setOpen(false);
    if (pathname === item.href.split("?")[0]) router.push(item.href);
    else router.push(item.href);
  }

  return (
    <div className="fixed bottom-4 right-4 z-50">
      {open && (
        <div className="mb-2 w-[min(92vw,360px)] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
          <div className="flex items-center justify-between border-b p-3">
            <div>
              <div className="font-bold text-sm">Notifikasi</div>
              <div className="text-[11px] text-slate-500">Pesan pribadi dan grup yang masuk</div>
            </div>
            {visibleItems.length > 0 && <button type="button" onClick={clearAll} className="text-xs text-red-600">Hapus semua</button>}
          </div>
          <div className="max-h-[55vh] overflow-y-auto">
            {!visibleItems.length ? (
              <div className="p-6 text-center text-sm text-slate-500">Belum ada notifikasi baru.</div>
            ) : visibleItems.map((item) => (
              <div key={item.id} className="flex items-start gap-2 border-b p-3 hover:bg-slate-50">
                <button type="button" onClick={() => openNotification(item)} className="min-w-0 flex-1 text-left">
                  <div className="flex items-center gap-2"><span>{item.source === "group" ? "👥" : "💬"}</span><span className="font-semibold text-sm truncate">{item.title}</span></div>
                  <div className="mt-1 text-xs text-slate-600 line-clamp-2">{item.preview}</div>
                  <div className="mt-1 text-[10px] text-slate-400">{new Date(item.createdAt).toLocaleString("id-ID")}</div>
                </button>
                <button type="button" onClick={() => remove(item.id)} aria-label="Hapus notifikasi" className="shrink-0 px-1 text-slate-400 hover:text-red-600">✕</button>
              </div>
            ))}
          </div>
        </div>
      )}
      <button type="button" onClick={() => setOpen((v) => !v)} aria-label="Notifikasi" className="relative h-12 w-12 rounded-full bg-blue-600 text-white shadow-lg flex items-center justify-center border-2 border-white">
        🔔
        {visibleItems.length > 0 && <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">{visibleItems.length > 99 ? "99+" : visibleItems.length}</span>}
      </button>
    </div>
  );
}
