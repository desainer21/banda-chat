"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

type Profile = {
  id: string;
  full_name: string;
  username: string | null;
  phone: string | null;
  avatar_url: string | null;
  bio: string | null;
};

export default function Home() {
  const router = useRouter();

  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [loggingOut, setLoggingOut] = useState(false);

  useEffect(() => {
    let mounted = true;

    async function loadUser() {
      try {
        /*
         * Ambil session pengguna
         */
        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (!mounted) return;

        /*
         * Jika belum login
         */
        if (!session?.user) {
          setProfile(null);
          setLoading(false);
          return;
        }

        /*
         * Jika sudah login, ambil profile
         */
        const { data: profileData, error: profileError } = await supabase
          .from("profiles")
          .select(
            "id, full_name, username, phone, avatar_url, bio"
          )
          .eq("id", session.user.id)
          .maybeSingle();

        if (profileError) {
          console.error("Gagal mengambil profile:", profileError);

          /*
           * Tetap tampilkan informasi dari Auth
           * jika profile belum ditemukan.
           */
          if (mounted) {
            setProfile({
              id: session.user.id,
              full_name:
                session.user.user_metadata?.full_name ||
                session.user.email?.split("@")[0] ||
                "Pengguna",
              username: null,
              phone: null,
              avatar_url: null,
              bio: null,
            });
          }
        } else if (mounted) {
          setProfile(profileData);
        }
      } catch (error) {
        console.error("Gagal memuat pengguna:", error);

        if (mounted) {
          setProfile(null);
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    }

    loadUser();

    /*
     * Pantau perubahan status login/logout
     */
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!mounted) return;

      if (event === "SIGNED_OUT" || !session?.user) {
        setProfile(null);
        setLoading(false);
        return;
      }

      /*
       * Jangan melakukan query Supabase langsung
       * secara berantai di dalam callback auth.
       * Ambil profile setelah status session berubah.
       */
      const { data: profileData, error } = await supabase
        .from("profiles")
        .select(
          "id, full_name, username, phone, avatar_url, bio"
        )
        .eq("id", session.user.id)
        .maybeSingle();

      if (!mounted) return;

      if (error) {
        console.error("Gagal mengambil profile:", error);

        setProfile({
          id: session.user.id,
          full_name:
            session.user.user_metadata?.full_name ||
            session.user.email?.split("@")[0] ||
            "Pengguna",
          username: null,
          phone: null,
          avatar_url: null,
          bio: null,
        });
      } else {
        setProfile(profileData);
      }

      setLoading(false);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  /*
   * Logout
   */
  async function handleLogout() {
    setLoggingOut(true);

    try {
      const { error } = await supabase.auth.signOut();

      if (error) {
        console.error("Logout error:", error);
        alert("Gagal keluar dari akun: " + error.message);
        setLoggingOut(false);
        return;
      }

      setProfile(null);

      router.refresh();
    } catch (error) {
      console.error("Logout error:", error);
      alert("Terjadi kesalahan saat keluar dari akun.");
    } finally {
      setLoggingOut(false);
    }
  }

  /*
   * Nama pengguna
   */
  const displayName =
    profile?.full_name ||
    profile?.username ||
    "Pengguna";

  return (
    <main className="min-h-screen bg-slate-950 text-white">
      {/* NAVBAR */}
      <nav className="border-b border-white/10 bg-slate-950/90">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-4">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-600 text-xl font-bold shadow-lg shadow-blue-600/30">
              B
            </div>

            <div>
              <h1 className="text-xl font-bold tracking-tight">
                Banda Chat
              </h1>

              <p className="text-xs text-slate-400">
                Terhubung tanpa batas
              </p>
            </div>
          </Link>

          {/* MENU */}
          <div className="flex items-center gap-3">
            {loading ? (
              /*
               * Saat session sedang diperiksa
               */
              <div className="h-10 w-24 animate-pulse rounded-xl bg-white/10" />
            ) : profile ? (
              /*
               * USER SUDAH LOGIN
               */
              <>
                <div className="hidden items-center gap-3 rounded-xl border border-white/10 bg-white/5 px-4 py-2 sm:flex">
                  {profile.avatar_url ? (
                    <img
                      src={profile.avatar_url}
                      alt={displayName}
                      className="h-9 w-9 rounded-full object-cover"
                    />
                  ) : (
                    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-blue-600 font-bold">
                      {displayName.charAt(0).toUpperCase()}
                    </div>
                  )}

                  <div>
                    <p className="text-sm font-semibold text-white">
                      {displayName}
                    </p>

                    {profile.username && (
                      <p className="text-xs text-slate-400">
                        @{profile.username}
                      </p>
                    )}
                  </div>
                </div>

                <Link
                  href="/chat"
                  className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-blue-600/20 transition hover:bg-blue-500"
                >
                  Buka Chat
                </Link>

                <button
                  type="button"
                  onClick={handleLogout}
                  disabled={loggingOut}
                  className="rounded-xl px-4 py-2 text-sm font-semibold text-slate-300 transition hover:bg-white/10 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {loggingOut ? "Keluar..." : "Keluar"}
                </button>
              </>
            ) : (
              /*
               * USER BELUM LOGIN
               */
              <>
                <Link
                  href="/login"
                  className="rounded-xl px-4 py-2 text-sm font-semibold text-slate-200 transition hover:bg-white/10"
                >
                  Masuk
                </Link>

                <Link
                  href="/daftar"
                  className="rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-blue-600/20 transition hover:bg-blue-500"
                >
                  Daftar
                </Link>
              </>
            )}
          </div>
        </div>
      </nav>

      {/* HERO */}
      <section className="relative overflow-hidden">
        <div className="absolute left-1/2 top-0 h-96 w-96 -translate-x-1/2 rounded-full bg-blue-600/20 blur-3xl" />

        <div className="relative mx-auto grid min-h-[calc(100vh-76px)] max-w-6xl items-center gap-12 px-5 py-16 md:grid-cols-2">
          {/* LEFT */}
          <div>
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-blue-400/20 bg-blue-500/10 px-4 py-2 text-sm text-blue-300">
              <span className="h-2 w-2 animate-pulse rounded-full bg-blue-400" />

              Chat real-time untuk semua perangkat
            </div>

            {profile && (
              <div className="mb-5 rounded-2xl border border-green-400/20 bg-green-500/10 px-4 py-3 text-sm text-green-300">
                👋 Selamat datang kembali,{" "}
                <span className="font-bold text-white">
                  {displayName}
                </span>
              </div>
            )}

            <h2 className="max-w-2xl text-4xl font-bold leading-tight tracking-tight sm:text-5xl lg:text-6xl">
              Berkomunikasi Lebih
              <span className="block text-blue-500">
                {" "}
                Mudah & Aman
              </span>
            </h2>

            <p className="mt-6 max-w-xl text-base leading-8 text-slate-400 sm:text-lg">
              Kirim pesan, gambar, video, audio, file, pesan suara,
              buat grup, berbagi postingan, dan tetap terhubung dengan
              teman Anda melalui Banda Chat.
            </p>

            {/* BUTTON HERO */}
            <div className="mt-8 flex flex-wrap gap-4">
              {profile ? (
                <Link
                  href="/chat"
                  className="rounded-xl bg-blue-600 px-7 py-3.5 font-semibold text-white shadow-lg shadow-blue-600/25 transition hover:bg-blue-500"
                >
                  Buka Banda Chat
                </Link>
              ) : (
                <>
                  <Link
                    href="/daftar"
                    className="rounded-xl bg-blue-600 px-7 py-3.5 font-semibold text-white shadow-lg shadow-blue-600/25 transition hover:bg-blue-500"
                  >
                    Mulai Sekarang
                  </Link>

                  <Link
                    href="/login"
                    className="rounded-xl border border-white/15 bg-white/5 px-7 py-3.5 font-semibold text-white transition hover:bg-white/10"
                  >
                    Saya Sudah Punya Akun
                  </Link>
                </>
              )}
            </div>

            {/* FEATURES */}
            <div className="mt-10 grid grid-cols-3 gap-3 text-center sm:max-w-md">
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <p className="text-xl font-bold text-blue-400">
                  💬
                </p>

                <p className="mt-2 text-xs text-slate-400">
                  Pesan Real-time
                </p>
              </div>

              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <p className="text-xl font-bold text-blue-400">
                  📞
                </p>

                <p className="mt-2 text-xs text-slate-400">
                  Voice & Video
                </p>
              </div>

              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <p className="text-xl font-bold text-blue-400">
                  👥
                </p>

                <p className="mt-2 text-xs text-slate-400">
                  Grup & Komunitas
                </p>
              </div>
            </div>
          </div>

          {/* RIGHT - PREVIEW CHAT */}
          <div className="mx-auto w-full max-w-md">
            <div className="rounded-[2rem] border border-white/10 bg-slate-900 p-3 shadow-2xl shadow-blue-950/50">
              <div className="overflow-hidden rounded-[1.5rem] border border-white/10 bg-slate-950">
                {/* CHAT HEADER */}
                <div className="flex items-center justify-between border-b border-white/10 bg-slate-900 px-5 py-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-11 w-11 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-cyan-400 font-bold">
                      A
                    </div>

                    <div>
                      <p className="font-semibold">
                        Banda Chat
                      </p>

                      <p className="text-xs text-green-400">
                        ● Online
                      </p>
                    </div>
                  </div>

                  <span className="text-xl text-slate-400">
                    ⋮
                  </span>
                </div>

                {/* CHAT BODY */}
                <div className="space-y-4 px-4 py-6">
                  <div className="max-w-[80%] rounded-2xl rounded-tl-sm bg-white/10 px-4 py-3 text-sm text-slate-200">
                    Halo! Selamat datang di Banda Chat 👋
                  </div>

                  <div className="ml-auto max-w-[80%] rounded-2xl rounded-tr-sm bg-blue-600 px-4 py-3 text-sm">
                    Hai! Senang bisa terhubung denganmu 😊
                  </div>

                  <div className="max-w-[80%] rounded-2xl rounded-tl-sm bg-white/10 px-4 py-3 text-sm text-slate-200">
                    Kirim pesan dari perangkat mana saja secara
                    real-time.
                  </div>
                </div>

                {/* INPUT PREVIEW */}
                <div className="flex items-center gap-3 border-t border-white/10 bg-slate-900 p-4">
                  <div className="flex-1 rounded-full bg-slate-800 px-4 py-3 text-sm text-slate-500">
                    Tulis pesan...
                  </div>

                  <div className="flex h-11 w-11 items-center justify-center rounded-full bg-blue-600 text-lg">
                    ➤
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}