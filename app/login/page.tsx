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
         * Jika sudah login, langsung ke Chat.
         *
         * Ini tidak memengaruhi halaman utama /.
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
        "Email atau nomor telepon harus diisi."
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
       * Tetap menggunakan login email/password
       * Supabase yang sudah digunakan aplikasi.
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
       * Session sudah terbentuk.
       *
       * Langsung masuk ke Chat.
       * app/chat/page.tsx kemudian mengambil
       * unread dari database secara otomatis.
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
          : "Login gagal."
      );
    } finally {
      setLoading(false);
    }
  }

  if (checkingSession) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-950 px-4 text-white">
        <div className="text-center">
          <div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-4 border-white/10 border-t-blue-500" />

          <p className="text-sm text-slate-500">
            Memeriksa sesi...
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-950 px-4 py-8 text-white">
      <div className="w-full max-w-md">
        {/* KEMBALI */}
        <Link
          href="/"
          className="mb-6 inline-flex items-center text-sm text-slate-400 transition hover:text-white"
        >
          ← Kembali ke Beranda
        </Link>

        <div className="rounded-3xl border border-white/10 bg-slate-900 p-6 shadow-2xl sm:p-8">
          {/* LOGO */}
          <div className="flex justify-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-blue-600 text-3xl font-bold shadow-lg shadow-blue-600/20">
              B
            </div>
          </div>

          <div className="mt-6 text-center">
            <h1 className="text-2xl font-bold">
              Selamat Datang
            </h1>

            <p className="mt-2 text-sm text-slate-500">
              Masuk ke akun Banda Chat Anda
            </p>
          </div>

          {/* ERROR */}
          {errorMessage && (
            <div className="mt-6 rounded-2xl border border-red-500/20 bg-red-950/40 p-4 text-sm text-red-300">
              <div className="flex items-start gap-3">
                <span>⚠️</span>

                <p className="flex-1">
                  {errorMessage}
                </p>

                <button
                  type="button"
                  onClick={() =>
                    setErrorMessage("")
                  }
                  className="text-red-400 hover:text-white"
                >
                  ✕
                </button>
              </div>
            </div>
          )}

          {/* FORM */}
          <form
            onSubmit={handleLogin}
            className="mt-7 space-y-4"
          >
            <div>
              <label
                htmlFor="email"
                className="mb-2 block text-sm font-semibold text-slate-300"
              >
                Email atau Nomor Telepon
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
                placeholder="Masukkan email"
                className="h-12 w-full rounded-xl border border-white/10 bg-slate-800 px-4 text-sm text-white outline-none placeholder:text-slate-500 focus:border-blue-500"
              />
            </div>

            <div>
              <label
                htmlFor="password"
                className="mb-2 block text-sm font-semibold text-slate-300"
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
                placeholder="Masukkan password"
                className="h-12 w-full rounded-xl border border-white/10 bg-slate-800 px-4 text-sm text-white outline-none placeholder:text-slate-500 focus:border-blue-500"
              />
            </div>

            <button
              type="submit"
              disabled={
                loading ||
                !email.trim() ||
                !password
              }
              className="flex h-12 w-full items-center justify-center rounded-xl bg-blue-600 text-sm font-bold text-white transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading
                ? "Memproses..."
                : "Masuk"}
            </button>
          </form>

          {/* DAFTAR */}
          <div className="mt-7 text-center">
            <p className="text-sm text-slate-500">
              Belum memiliki akun?
            </p>

            <Link
              href="/daftar"
              className="mt-2 inline-block text-sm font-bold text-blue-400 transition hover:text-blue-300"
            >
              Daftar sekarang
            </Link>
          </div>

          {/* BERANDA */}
          <div className="mt-6 border-t border-white/10 pt-5 text-center">
            <Link
              href="/"
              className="text-xs text-slate-500 transition hover:text-white"
            >
              ← Kembali ke Beranda
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}