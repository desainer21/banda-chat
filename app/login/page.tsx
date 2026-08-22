"use client";

import {
  FormEvent,
  useEffect,
  useState,
} from "react";

import Link from "next/link";
import { useRouter } from "next/navigation";

import { supabase } from "@/lib/supabase";

export default function LoginPage() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [loading, setLoading] = useState(false);
  const [checkingSession, setCheckingSession] =
    useState(true);

  const [errorMessage, setErrorMessage] =
    useState("");

  useEffect(() => {
    let mounted = true;

    async function checkExistingSession() {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (!mounted) {
          return;
        }

        /*
         * Jika pengguna sudah login,
         * langsung masuk ke halaman chat.
         *
         * Logika yang sebelumnya sudah berhasil
         * tetap dipertahankan.
         */
        if (session?.user) {
          router.replace("/chat");
          return;
        }
      } catch (error) {
        console.error(
          "Check login session error:",
          error
        );
      } finally {
        if (mounted) {
          setCheckingSession(false);
        }
      }
    }

    void checkExistingSession();

    return () => {
      mounted = false;
    };
  }, [router]);

  async function handleLogin(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    if (loading) {
      return;
    }

    setErrorMessage("");

    const cleanEmail = email.trim();

    if (!cleanEmail) {
      setErrorMessage(
        "Email harus diisi."
      );
      return;
    }

    if (!password) {
      setErrorMessage(
        "Password harus diisi."
      );
      return;
    }

    setLoading(true);

    try {
      /*
       * Tetap menggunakan sistem login Supabase
       * yang sebelumnya sudah berhasil.
       */
      const {
        data,
        error,
      } = await supabase.auth.signInWithPassword({
        email: cleanEmail,
        password,
      });

      if (error) {
        throw new Error(error.message);
      }

      if (!data.session?.user) {
        throw new Error(
          "Login berhasil tetapi sesi pengguna belum tersedia."
        );
      }

      /*
       * Session berhasil dibuat.
       * Langsung masuk ke chat.
       */
      router.replace("/chat");
      router.refresh();
    } catch (error) {
      console.error(
        "Login error:",
        error
      );

      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Login gagal. Silakan coba lagi."
      );
    } finally {
      setLoading(false);
    }
  }

  if (checkingSession) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-100 px-4">
        <div className="text-center">
          <div className="relative mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-500 text-2xl font-bold text-white shadow-lg">
            B
          </div>

          <div className="mx-auto h-9 w-9 animate-spin rounded-full border-4 border-slate-200 border-t-blue-600" />

          <p className="mt-4 text-sm text-slate-500">
            Memeriksa sesi...
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-100">
      {/* HEADER */}
      <header className="border-b border-blue-700 bg-blue-600 shadow-sm">
        <div className="mx-auto flex min-h-[68px] w-full max-w-5xl items-center justify-center px-4">
          <div className="flex items-center gap-3">
            {/* LOGO BALON CHAT */}
            <div className="relative flex h-11 w-11 items-center justify-center rounded-full bg-green-500 text-xl font-bold text-white shadow-md">
              B

              <span className="absolute bottom-0 left-1 h-4 w-4 -translate-x-1/2 rotate-45 bg-green-500" />
            </div>

            <div>
              <h1 className="text-lg font-bold text-white">
                Banda Chat
              </h1>

              <p className="text-xs text-blue-100">
                Chat modern dan realtime
              </p>
            </div>
          </div>
        </div>
      </header>

      {/* HALAMAN LOGIN */}
      <section className="flex min-h-[calc(100vh-68px)] items-center justify-center px-4 py-8">
        <div className="w-full max-w-md">
          <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-xl shadow-slate-200/70">
            {/* BAGIAN ATAS */}
            <div className="border-b border-slate-100 px-6 pb-6 pt-8 text-center sm:px-8">
              {/* LOGO BESAR */}
              <div className="relative mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-green-500 text-3xl font-bold text-white shadow-lg shadow-green-500/20">
                B

                <span className="absolute bottom-0 left-2 h-5 w-5 -translate-x-1/2 rotate-45 bg-green-500" />
              </div>

              <h2 className="mt-6 text-2xl font-bold text-slate-900">
                Selamat Datang
              </h2>

              <p className="mt-2 text-sm leading-6 text-slate-500">
                Masuk ke akun Banda Chat Anda untuk
                mulai berkomunikasi dengan teman.
              </p>
            </div>

            {/* ISI FORM */}
            <div className="p-6 sm:p-8">
              {/* ERROR */}
              {errorMessage && (
                <div className="mb-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
                  <div className="flex items-start gap-3">
                    <span className="shrink-0">
                      ⚠️
                    </span>

                    <p className="flex-1">
                      {errorMessage}
                    </p>

                    <button
                      type="button"
                      onClick={() =>
                        setErrorMessage("")
                      }
                      className="shrink-0 font-bold text-red-500 transition hover:text-red-700"
                      aria-label="Tutup pesan error"
                    >
                      ✕
                    </button>
                  </div>
                </div>
              )}

              {/* FORM */}
              <form
                onSubmit={handleLogin}
                className="space-y-5"
              >
                <div>
                  <label
                    htmlFor="email"
                    className="mb-2 block text-sm font-semibold text-slate-700"
                  >
                    Email
                  </label>

                  <input
                    id="email"
                    type="email"
                    autoComplete="email"
                    value={email}
                    onChange={(event) =>
                      setEmail(
                        event.target.value
                      )
                    }
                    disabled={loading}
                    placeholder="contoh@email.com"
                    className="h-12 w-full rounded-xl border border-slate-300 bg-white px-4 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-600 focus:ring-4 focus:ring-blue-100 disabled:cursor-not-allowed disabled:bg-slate-100"
                  />
                </div>

                <div>
                  <label
                    htmlFor="password"
                    className="mb-2 block text-sm font-semibold text-slate-700"
                  >
                    Password
                  </label>

                  <input
                    id="password"
                    type="password"
                    autoComplete="current-password"
                    value={password}
                    onChange={(event) =>
                      setPassword(
                        event.target.value
                      )
                    }
                    disabled={loading}
                    placeholder="Masukkan password"
                    className="h-12 w-full rounded-xl border border-slate-300 bg-white px-4 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-600 focus:ring-4 focus:ring-blue-100 disabled:cursor-not-allowed disabled:bg-slate-100"
                  />
                </div>

                <button
                  type="submit"
                  disabled={
                    loading ||
                    !email.trim() ||
                    !password
                  }
                  className="flex h-12 w-full items-center justify-center rounded-xl bg-blue-600 px-4 text-sm font-bold text-white shadow-md shadow-blue-600/20 transition hover:bg-blue-700 focus:outline-none focus:ring-4 focus:ring-blue-100 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {loading
                    ? "Memproses..."
                    : "Masuk ke Banda Chat"}
                </button>
              </form>

              {/* DAFTAR */}
              <div className="mt-7 border-t border-slate-100 pt-6 text-center">
                <p className="text-sm text-slate-500">
                  Belum memiliki akun?
                </p>

                <Link
                  href="/daftar"
                  className="mt-2 inline-block text-sm font-bold text-blue-600 transition hover:text-blue-800 hover:underline"
                >
                  Daftar sekarang
                </Link>
              </div>
            </div>
          </div>

          <p className="mt-6 text-center text-xs text-slate-400">
            Banda Chat • Cepat • Sederhana • Realtime
          </p>
        </div>
      </section>
    </main>
  );
}