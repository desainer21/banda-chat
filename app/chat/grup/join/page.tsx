"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import BandaLogo from "@/components/BandaLogo";

type GroupPreview = {
  id: string;
  name: string | null;
  group_avatar_url: string | null;
  member_count: number | string;
};

function JoinGroupContent() {
  const router = useRouter();
  const params = useSearchParams();
  const [group, setGroup] = useState<GroupPreview | null>(null);
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState("");
  const [showLoginPrompt, setShowLoginPrompt] = useState(false);

  const inviteCode = params.get("code")?.trim() || "";

  useEffect(() => {
    let cancelled = false;

    async function loadInvite() {
      if (!inviteCode) {
        if (!cancelled) {
          setError("Link undangan grup tidak lengkap.");
          setLoading(false);
        }
        return;
      }

      const { data, error: previewError } = await supabase.rpc(
        "get_banda_group_invite_preview",
        { p_invite_code: inviteCode }
      );

      if (cancelled) return;

      if (previewError) {
        setError(previewError.message);
        setLoading(false);
        return;
      }

      const preview = Array.isArray(data) ? data[0] : data;

      if (!preview?.id) {
        setError("Link undangan grup tidak valid atau sudah tidak tersedia.");
        setLoading(false);
        return;
      }

      setGroup(preview as GroupPreview);
      setLoading(false);
    }

    void loadInvite();

    return () => {
      cancelled = true;
    };
  }, [inviteCode]);

  async function joinGroup() {
    if (!inviteCode || joining) return false;

    setJoining(true);
    setError("");

    const { data: sessionData, error: sessionError } =
      await supabase.auth.getSession();

    if (sessionError || !sessionData.session?.user) {
      setJoining(false);
      return false;
    }

    const { data, error: rpcError } = await supabase.rpc(
      "join_banda_group_by_invite",
      { p_invite_code: inviteCode }
    );

    if (rpcError) {
      console.error("Join group error:", rpcError);
      setError(rpcError.message);
      setJoining(false);
      return false;
    }

    if (!data || typeof data !== "object" || !("id" in data)) {
      setError("Data grup tidak valid.");
      setJoining(false);
      return false;
    }

    const joinedGroup = data as { id: string };

    // Setelah berhasil menjadi anggota, langsung buka grup.
    // Halaman grup tetap menyediakan navigasi kembali ke chat utama.
    router.replace(`/chat/grup?group=${encodeURIComponent(joinedGroup.id)}`);
    return true;
  }

  useEffect(() => {
    let cancelled = false;

    async function autoJoinAfterAuth() {
      if (!inviteCode || !group) return;

      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (cancelled || !session?.user) return;

      // Jika pengguna baru saja kembali dari /daftar atau /login,
      // jangan meminta tombol Bergabung lagi. Langsung masukkan ke grup.
      await joinGroup();
    }

    void autoJoinAfterAuth();

    return () => {
      cancelled = true;
    };
    // joinGroup sengaja tidak dimasukkan ke dependency karena fungsi dibuat
    // ulang setiap render dan dapat memicu auto-join berulang.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inviteCode, group]);

  async function handleJoin() {
    const { data: session } = await supabase.auth.getSession();

    if (!session.session?.user) {
      setShowLoginPrompt(true);
      return;
    }

    await joinGroup();
  }

  function goToRegister() {
    const redirect = inviteCode
      ? `/chat/grup/join?code=${encodeURIComponent(inviteCode)}`
      : "/chat/grup";

    router.push(`/daftar?redirect=${encodeURIComponent(redirect)}`);
  }

  function goToLogin() {
    const redirect = inviteCode
      ? `/chat/grup/join?code=${encodeURIComponent(inviteCode)}`
      : "/chat/grup";

    router.push(`/login?redirect=${encodeURIComponent(redirect)}`);
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl border shadow-sm p-7 max-w-md w-full text-center">
          <BandaLogo size={56} />
          <h1 className="font-bold text-xl mt-4">Undangan Grup Banda Chat</h1>
          <p className="mt-3 text-slate-500 text-sm">Memuat informasi grup...</p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl border border-slate-200 shadow-xl p-6 sm:p-8 max-w-md w-full text-center">
        <div className="flex justify-center">
          <BandaLogo size={58} />
        </div>

        {error ? (
          <>
            <h1 className="font-bold text-xl mt-5">Undangan Grup</h1>
            <div className="mt-4 text-red-600 text-sm bg-red-50 p-3 rounded-xl border border-red-100">
              {error}
            </div>
            <Link
              href="/chat"
              className="inline-block mt-5 px-5 py-2.5 rounded-xl bg-blue-600 text-white text-sm font-semibold"
            >
              Kembali ke Chat
            </Link>
          </>
        ) : group ? (
          <>
            <div className="mt-5 flex justify-center">
              <div className="h-28 w-28 overflow-hidden rounded-full bg-green-100 border border-slate-200 flex items-center justify-center">
                {group.group_avatar_url ? (
                  <img
                    src={group.group_avatar_url}
                    alt={group.name || "Grup"}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <span className="text-5xl">👥</span>
                )}
              </div>
            </div>

            <h1 className="font-bold text-2xl mt-5 break-words">
              {group.name || "Grup Banda Chat"}
            </h1>
            <p className="mt-2 text-sm text-slate-500">
              {Number(group.member_count) || 0} anggota
            </p>

            <button
              type="button"
              onClick={() => void handleJoin()}
              disabled={joining}
              className="w-full mt-6 rounded-xl bg-blue-600 px-5 py-3 text-white font-bold hover:bg-blue-700 disabled:opacity-60"
            >
              {joining ? "Bergabung..." : "Bergabung"}
            </button>

            <p className="mt-3 text-xs text-slate-400">
              Bergabung ke grup memerlukan akun Banda Chat.
            </p>

            <Link
              href="/chat"
              className="inline-block mt-5 text-sm font-semibold text-blue-600 hover:underline"
            >
              Kembali ke Chat
            </Link>
          </>
        ) : null}
      </div>

      {showLoginPrompt && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl text-center">
            <h2 className="font-bold text-lg">Silakan daftar atau login dulu</h2>
            <p className="mt-2 text-sm text-slate-500">
              Anda perlu memiliki akun Banda Chat untuk bergabung ke grup ini.
            </p>
            <div className="grid grid-cols-2 gap-2 mt-5">
              <button
                type="button"
                onClick={goToRegister}
                className="rounded-xl bg-blue-600 text-white py-2.5 text-sm font-semibold"
              >
                Daftar
              </button>
              <button
                type="button"
                onClick={goToLogin}
                className="rounded-xl border border-slate-300 py-2.5 text-sm font-semibold"
              >
                Login
              </button>
            </div>
            <button
              type="button"
              onClick={() => setShowLoginPrompt(false)}
              className="mt-3 text-sm text-slate-500"
            >
              Batal
            </button>
          </div>
        </div>
      )}
    </main>
  );
}

export default function JoinGroupPage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border shadow-sm p-7 max-w-md w-full text-center">
            <BandaLogo size={56} />
            <h1 className="font-bold text-xl mt-4">Undangan Grup Banda Chat</h1>
            <p className="mt-3 text-slate-500 text-sm">Memuat informasi grup...</p>
          </div>
        </main>
      }
    >
      <JoinGroupContent />
    </Suspense>
  );
}
