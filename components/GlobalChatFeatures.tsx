"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import CallOverlay from "@/components/CallOverlay";
import { supabase } from "@/lib/supabase";

type Profile = { id: string; full_name: string; username: string | null; avatar_url: string | null };
const EMOJIS = ["😀","😂","🤣","😊","😍","🥰","😘","😎","🤔","😮","😢","😭","😡","👍","👎","👏","🙏","❤️","🔥","🎉","💯","✨","😴","🤗"];

function insertEmoji(emoji: string) {
  const el = document.querySelector("textarea") as HTMLTextAreaElement | null;
  if (!el) return;
  const start = el.selectionStart ?? el.value.length;
  const end = el.selectionEnd ?? el.value.length;
  const next = el.value.slice(0, start) + emoji + el.value.slice(end);
  const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")?.set;
  setter?.call(el, next);
  el.dispatchEvent(new Event("input", { bubbles: true }));
  el.focus();
  requestAnimationFrame(() => el.setSelectionRange(start + emoji.length, start + emoji.length));
}

export default function GlobalChatFeatures() {
  const [mounted, setMounted] = useState(false);
  const [userId, setUserId] = useState("");
  const [users, setUsers] = useState<Profile[]>([]);
  const [selectedUser, setSelectedUser] = useState<Profile | null>(null);
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [callOpen, setCallOpen] = useState(false);
  const [inputParent, setInputParent] = useState<HTMLElement | null>(null);

  useEffect(() => {
    setMounted(true);
    if (window.location.pathname !== "/chat") return;
    let active = true;
    (async () => {
      const { data } = await supabase.auth.getSession();
      if (!active || !data.session?.user) return;
      const id = data.session.user.id;
      setUserId(id);
      const { data: rows } = await supabase.from("profiles").select("id, full_name, username, avatar_url").neq("id", id).order("full_name");
      if (active) setUsers((rows || []) as Profile[]);
    })();

    const findInput = () => {
      if (window.location.pathname !== "/chat") {
        setInputParent(null);
        return;
      }
      const textarea = document.querySelector("textarea[placeholder='Tulis pesan...']") as HTMLTextAreaElement | null;
      setInputParent(textarea?.parentElement || null);
    };
    findInput();
    const observer = new MutationObserver(findInput);
    observer.observe(document.body, { childList: true, subtree: true });
    const timer = window.setInterval(findInput, 500);
    return () => { active = false; observer.disconnect(); window.clearInterval(timer); };
  }, []);

  if (!mounted || !userId || !inputParent || window.location.pathname !== "/chat") return null;

  const content = (
    <div className="relative flex shrink-0 items-center gap-1">
      {emojiOpen && (
        <div onClick={(e) => e.stopPropagation()} className="absolute bottom-14 right-0 z-[80] grid w-72 grid-cols-8 gap-1 rounded-2xl border border-slate-200 bg-white p-3 shadow-2xl">
          {EMOJIS.map((emoji) => <button key={emoji} type="button" onClick={() => { insertEmoji(emoji); setEmojiOpen(false); }} className="flex h-8 w-8 items-center justify-center rounded-lg text-xl hover:bg-slate-100">{emoji}</button>)}
        </div>
      )}
      {callOpen && (
        <div onClick={(e) => e.stopPropagation()} className="absolute bottom-14 right-0 z-[80] w-72 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
          <div className="flex items-center justify-between border-b border-slate-100 px-3 py-2.5"><b className="text-sm text-slate-800">Pilih pengguna untuk panggilan</b><button type="button" onClick={() => setCallOpen(false)} className="text-slate-400">✕</button></div>
          <div className="max-h-52 overflow-y-auto p-2">
            {users.length === 0 ? <p className="py-4 text-center text-xs text-slate-500">Belum ada pengguna lain.</p> : users.map((user) => (
              <button key={user.id} type="button" onClick={() => setSelectedUser(user)} className={`flex w-full items-center gap-2 rounded-xl p-2 text-left hover:bg-slate-50 ${selectedUser?.id === user.id ? "bg-blue-50" : ""}`}>
                {user.avatar_url ? <img src={user.avatar_url} alt="" className="h-9 w-9 rounded-full object-cover" /> : <div className="flex h-9 w-9 items-center justify-center rounded-full bg-blue-100 font-bold text-blue-700">{(user.full_name || "U").charAt(0).toUpperCase()}</div>}
                <span className="min-w-0 flex-1"><span className="block truncate text-sm font-medium">{user.full_name}</span><span className="block truncate text-xs text-slate-400">@{user.username || "pengguna"}</span></span>
              </button>
            ))}
          </div>
          {selectedUser && <div className="grid grid-cols-2 gap-2 border-t border-slate-100 p-2"><button type="button" onClick={() => setCallOpen(false)} className="rounded-xl bg-emerald-500 px-3 py-2.5 text-sm font-bold text-white">📞 Telepon</button><button type="button" onClick={() => setCallOpen(false)} className="rounded-xl bg-blue-600 px-3 py-2.5 text-sm font-bold text-white">🎥 Video</button></div>}
        </div>
      )}
      <button type="button" onClick={(e) => { e.stopPropagation(); setEmojiOpen(v => !v); setCallOpen(false); }} className="flex h-12 w-11 items-center justify-center rounded-2xl border border-slate-200 bg-white text-2xl text-slate-600 shadow-sm hover:border-blue-300 hover:bg-blue-50" title="Emoji / Prasa">😊</button>
      <button type="button" onClick={(e) => { e.stopPropagation(); setCallOpen(v => !v); setEmojiOpen(false); }} className="flex h-12 w-11 items-center justify-center rounded-2xl border border-slate-200 bg-white text-lg text-slate-600 shadow-sm hover:border-emerald-300 hover:bg-emerald-50" title="Telepon dan video call">📞</button>
    </div>
  );

  return <>{createPortal(content, inputParent)}<CallOverlay currentUserId={userId} selectedUser={selectedUser} /></>;
}
