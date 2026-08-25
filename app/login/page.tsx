"use client";

import {
  FormEvent,
  Suspense,
  useEffect,
  useState,
} from "react";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";

import BandaLogo from "@/components/BandaLogo";
import { supabase } from "@/lib/supabase";

function LoginContent() {
  const router = useRouter();
  const params = useSearchParams();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

  function getRedirectPath() {
    const redirect = params.get("redirect");
    if (!redirect || !redirect.startsWith("/")) {
      return "/chat";
    }
    return redirect;
  }

  useEffect(() => {
    let mounted = true;

    async function checkExistingSession() {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (!mounted) return;

        if (session?.user) {
          router.replace(getRedirectPath());
          return;
        }
      } catch (error) {
        console.error("Check login session error:", error);
      } finally {
        if (mounted) setCheckingSession(false);
      }
    }

    void checkExistingSession();

    return () => {
      mounted = false;
    };
  }, [router, params]);

  async function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (loading) return;

    setErrorMessage("");
    const cleanEmail = email.trim();

    if (!cleanEmail) {
      setErrorMessage("Email harus diisi.");
      return;
    }

    if (!password) {
      setErrorMessage("Password harus diisi.");
      return;
    }

    setLoading(true);

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: cleanEmail,
        password,
      });

      if (error) throw new Error(error.message);
      if (!data.session?.user) {
        throw new Error("Login berhasil tetapi sesi pengguna belum tersedia.");
      }

      window.location.href = getRedirectPath();
    } catch (error) {
      console.error("Login error:", error);
      setErrorMessage(
        error instanceof Error ? error.message : "Login gagal. Silakan coba lagi."
      );
      setLoading(false);
    }
  }

  if (checkingSession) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-100 px-4">
        <div className="text-center">
          <div className="mx-auto mb-5 flex justify-center">
            <BandaLogo size={72} />
          </div>
          <div className="mx-auto h-9 w-9 animate-spin rounded-full border-4 border-slate-200 border-t-blue-600" />
          <p className="mt-4 text-sm text-slate-500">Memeriksa sesi...</p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-100">
      <header className="border-b border-blue-700 bg-blue-600 shadow-sm">
        <div className="mx-auto flex min-h-[68px] w-full max-w-5xl items-center justify-center px-4">
          <div className="text-center">
            <h1 className="text-lg font-bold text-white">Banda Chat</h1>
            <p className="text-xs text-blue-100">Chat modern dan realtime</p>
          </div>
        </div>
      </header>

      <section className="flex min-h-[calc(100vh-68px)] items-center justify-center px-4 py-8">
        <div className="w-full max-w-md">
          <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-xl shadow-slate-200/70">
            <div className="border-b border-slate-100 px-6 pb-6 pt-8 text-center sm:px-8">
              <div className="mx-auto flex justify-center">
                <BandaLogo size={82} />
              </div>
              <h2 className="mt-5 text-2xl font-bold text-slate-900">Selamat Datang</h2>
              <p className="mt-2 text-sm leading-6 text-slate-500">Masuk ke akun Banda Chat Anda</p>
            </div>

            <div className="p-6 sm:p-8">
              {errorMessage && (
                <div className="mb-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
                  <div className="flex items-start gap-3">
                    <span>⚠️</span>
                    <p className="flex-1">{errorMessage}</p>
                    <button type="button" onClick={() => setErrorMessage("")} className="font-bold text-red-500">✕</button>
                  </div>
                </div>
              )}

              <form onSubmit={handleLogin} className="space-y-4">
                <div>
                  <label htmlFor="email" className="mb-2 block text-sm font-semibold text-slate-700">Email</label>
                  <input id="email" type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} disabled={loading} placeholder="contoh@email.com" className="h-12 w-full rounded-xl border border-slate-300 bg-white px-4 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-600 focus:ring-4 focus:ring-blue-100 disabled:bg-slate-100" />
                </div>

                <div>
                  <label htmlFor="password" className="mb-2 block text-sm font-semibold text-slate-700">Password</label>
                  <input id="password" type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} disabled={loading} placeholder="Password" className="h-12 w-full rounded-xl border border-slate-300 bg-white px-4 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-600 focus:ring-4 focus:ring-blue-100 disabled:bg-slate-100" />
                </div>

                <button type="submit" disabled={loading || !email.trim() || !password} className="mt-2 flex h-12 w-full items-center justify-center rounded-xl bg-blue-600 px-4 text-sm font-bold text-white shadow-md shadow-blue-600/20 transition hover:bg-blue-700 focus:outline-none focus:ring-4 focus:ring-blue-100 disabled:cursor-not-allowed disabled:opacity-50">
                  {loading ? "Memproses..." : "Masuk"}
                </button>
              </form>

              <div className="mt-7 border-t border-slate-100 pt-6 text-center">
                <p className="text-sm text-slate-500">Belum memiliki akun?</p>
                <Link href={`/daftar?redirect=${encodeURIComponent(getRedirectPath())}`} className="mt-2 inline-block text-sm font-bold text-blue-600 transition hover:text-blue-800 hover:underline">Daftar sekarang</Link>
              </div>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-screen items-center justify-center bg-slate-100 px-4">
          <div className="text-center">
            <BandaLogo size={72} />
            <p className="mt-4 text-sm text-slate-500">Memuat halaman login...</p>
          </div>
        </main>
      }
    >
      <LoginContent />
    </Suspense>
  );
}
