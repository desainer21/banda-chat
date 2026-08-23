"use client";

import { useEffect, useState } from "react";
import CallOverlay from "@/components/CallOverlay";
import { supabase } from "@/lib/supabase";

type Profile = {
  id: string;
  full_name: string;
  username: string | null;
  avatar_url: string | null;
};

const EMOJIS = ["😀","😂","🤣","😊","😍","🥰","😘","😎","🤔","😮","😢","😭","😡","👍","👎","👏","🙏","❤️","🔥","🎉","💯","✨","😴","🤗"];

function insertEmoji(emoji: string) {
  const el = document.querySelector("textarea") as HTMLTextAreaElement | null;
  if (!el) return;
  const start = el.selectionStart ?? el.value.length;
  const end = el.selectionEnd ?? el.value.length;
  const value = el.value;
  const next = value.slice(0, start) + emoji + value.slice(end);
  const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")?.set;
  setter?.call(el, next);
  el.dispatchEvent(new Event("input", { bubbles: true }));
  el.focus();
  const pos = start + emoji.length;
  requestAnimationFrame(() => el.setSelectionRange(pos, pos));
}

export default function GlobalChatFeatures() {
  const [userId, setUserId] = useState("");
  const [users, setUsers] = useState<Profile[]>([]);
  const [selectedUser, setSelectedUser] = useState<Profile | null>(null);
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [callOpen, setCallOpen] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      const { data } = await supabase.auth.getSession();
      if (!active || !data.session?.user) return;
      const id = data.session.user.id;
      setUserId(id);
      const { data: rows } = await supabase
        .from("profiles")
        .select("id, full_name, username, avatar_url")
        .neq("id", id)
        .order("full_name");
      if (active) setUsers((rows || []) as Profile[]);
    })();
    return () => { active = false; };
  }, []);

  if (!userId) return null;

  return (
    <>
      <div className="fixed bottom-4 right-4 z-[100] flex flex-col items-end gap-2">
        {emojiOpen && (
          <div className="grid w-72 grid-cols-8 gap-1 rounded-2xl border border-slate-200 bg-white p-3 shadow-2xl">
            {EMOJIS.map((emoji) => (
              <button key={emoji} type="button" onClick={() => insertEmoji(emoji)} className="flex h-8 w-8 items-center justify-center rounded-lg text-xl hover:bg-slate-100" title={emoji}>{emoji}</button>
            ))}
          </div>
        )}
        {callOpen && (
          <div className="w-72 rounded-2xl border border-slate-200 bg-white p-3 shadow-2xl">
            <div className="mb-2 flex items-center justify-between">
              <b className="text-sm text-slate-800">Pilih pengguna untuk panggilan</b>
              <button type="button" onClick={() => setCallOpen(false)} className="text-slate-400">✕</button>
            </div>
            <div className="max-h-48 space-y-1 overflow-y-auto">
              {users.length === 0 ? <p className="py-3 text-center text-xs text-slate-500">Belum ada pengguna lain.</p> : users.map((user) => (
                <button key={user.id} type="button" onClick={() => setSelectedUser(user)} className={`flex w-full items-center gap-2 rounded-xl p-2 text-left hover:bg-slate-100 ${selectedUser?.id === user.id ? "bg-blue-50" : ""}`}>
                  {user.avatar_url ? <img src={user.avatar_url} alt="" className="h-9 w-9 rounded-full object-cover" /> : <div className="flex h-9 w-9 items-center justify-center rounded-full bg-blue-100 font-bold text-blue-700">{(user.full_name || "U").charAt(0).toUpperCase()}</div>}
                  <span className="min-w-0"><span className="block truncate text-sm font-medium">{user.full_name}</span><span className="block truncate text-xs text-slate-500">@{user.username || "pengguna"}</span></span>
                </button>
              ))}
            </div>
            {selectedUser && <p className="mt-2 text-center text-xs text-slate-500">Gunakan tombol 📞/🎥 pada panel panggilan.</p>}
          </div>
        )}
        <div className="flex gap-2">
          <button type="button" onClick={() => setEmojiOpen((v) => !v)} className="flex h-12 w-12 items-center justify-center rounded-full bg-white text-2xl shadow-lg ring-1 ring-slate-200" title="Emoji">😊</button>
          <button type="button" onClick={() => setCallOpen((v) => !v)} className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500 text-xl text-white shadow-lg" title="Panggilan">📞</button>
        </div>
      </div>
      <CallOverlay currentUserId={userId} selectedUser={selectedUser} />
    </>
  );
}
