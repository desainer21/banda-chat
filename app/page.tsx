"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";

export default function HomePage() {
  const [loggedIn, setLoggedIn] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);

  useEffect(() => {
    let mounted = true;

    async function checkSession() {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (mounted) {
          setLoggedIn(!!session?.user);
        }
      } catch (error) {
        console.error("Check session error:", error);
      } finally {
        if (mounted) {
          setCheckingSession(false);
        }
      }
    }

    void checkSession();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        if (mounted) {
          setLoggedIn(!!session?.user);
        }
      }
    );

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  return (
    <main className="min-h-screen bg-slate-950 text-white">
      {/* HEADER */}
      <header className="border-b border-white/10 bg-slate-900">
        <div className="mx-auto flex min-h-[68px] w-full max-w-6xl items-center justify-between gap-3 px-4">
          <Link
            href="/"
            className="flex items-center gap-3"
          >
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-blue-600 text-xl font-bold shadow-lg shadow-blue-600/20">
              B
            </div>

            <div>
              <h1 className="font-bold">
                Banda Chat
              </h1>

              <p className="text-xs text-slate-500">
                Chat modern dan realtime
              </p>
            </div>
          </Link>

          {/* LOGIN & DAFTAR SELALU TERLIHAT */}
          <div className="flex shrink-0 items-center gap-2">
            <Link
              href="/login"
              className="rounded-xl border border-white/10 px-3 py-2 text-xs font-semibold text-slate-200 transition hover:bg-white/10 sm:px-4 sm:text-sm"
            >
              Masuk
            </Link>

            <Link
              href="/daftar"
              className="rounded-xl bg-blue-600 px-3 py-2 text-xs font-semibold text-white transition hover:bg-blue-500 sm:px-4 sm:text-sm"
            >
              Daftar
            </Link>
          </div>
        </div>
      </header>

      {/* HERO */}
      <section className="flex min-h-[calc(100vh-69px)] items-center justify-center px-4 py-12">
        <div className="w-full max-w-4xl text-center">
          <div className="mx-auto flex h-24 w-24 items-center justify-center rounded-[28px] bg-blue-600 text-4xl font-bold shadow-2xl shadow-blue-600/20 sm:h-28 sm:w-28 sm:text-5xl">
            B
          </div>

          <h2 className="mt-7 text-3xl font-bold tracking-tight sm:text-5xl">
            Selamat Datang di Banda Chat
          </h2>

          <p className="mx-auto mt-4 max-w-2xl text-sm leading-7 text-slate-400 sm:text-base">
            Berkomunikasi dengan teman secara
            realtime dengan tampilan sederhana,
            cepat, dan nyaman digunakan di HP
            maupun komputer.
          </p>

          {/* TOMBOL UTAMA */}
          <div className="mx-auto mt-8 flex w-full max-w-md flex-col gap-3 sm:flex-row sm:max-w-lg">
            <Link
              href="/login"
              className="flex h-12 flex-1 items-center justify-center rounded-2xl border border-white/10 bg-slate-900 px-6 text-sm font-bold text-white transition hover:bg-slate-800"
            >
              Masuk ke Banda Chat
            </Link>

            <Link
              href="/daftar"
              className="flex h-12 flex-1 items-center justify-center rounded-2xl bg-blue-600 px-6 text-sm font-bold text-white shadow-lg shadow-blue-600/20 transition hover:bg-blue-500"
            >
              Buat Akun Baru
            </Link>
          </div>

          {/* STATUS LOGIN */}
          {!checkingSession && loggedIn && (
            <div className="mx-auto mt-5 w-full max-w-md">
              <Link
                href="/chat"
                className="flex h-11 items-center justify-center rounded-2xl border border-green-500/20 bg-green-500/10 text-sm font-semibold text-green-400 transition hover:bg-green-500/20"
              >
                Anda sudah login — Buka Banda Chat →
              </Link>
            </div>
          )}

          {/* FITUR */}
          <div className="mx-auto mt-12 grid w-full max-w-3xl grid-cols-1 gap-3 text-left sm:grid-cols-3">
            <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
              <div className="text-2xl">
                💬
              </div>

              <h3 className="mt-3 text-sm font-bold">
                Chat Realtime
              </h3>

              <p className="mt-2 text-xs leading-5 text-slate-500">
                Pesan masuk secara realtime tanpa
                harus refresh halaman.
              </p>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
              <div className="text-2xl">
                🟢
              </div>

              <h3 className="mt-3 text-sm font-bold">
                Status Online
              </h3>

              <p className="mt-2 text-xs leading-5 text-slate-500">
                Lihat status teman yang sedang
                online.
              </p>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
              <div className="text-2xl">
                📱
              </div>

              <h3 className="mt-3 text-sm font-bold">
                Nyaman di HP
              </h3>

              <p className="mt-2 text-xs leading-5 text-slate-500">
                Tampilan responsif untuk HP dan
                komputer.
              </p>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}