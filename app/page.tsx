"use client";

import { useEffect } from "react";

import { useRouter } from "next/navigation";

export default function HomePage() {
  const router = useRouter();

  useEffect(() => {
    /*
     * Halaman pertama aplikasi langsung
     * membuka halaman login.
     *
     * Dengan demikian pengguna yang membuka:
     * http://localhost:3000/
     *
     * langsung melihat halaman login Banda Chat.
     */
    router.replace("/login");
  }, [router]);

  /*
   * Tampilan sementara selama redirect.
   * Tidak ada halaman beranda lama lagi.
   */
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-100 px-4">
      <div className="text-center">
        {/* LOGO BALON CHAT */}
        <div className="relative mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-green-500 text-3xl font-bold text-white shadow-lg shadow-green-500/20">
          B

          <span className="absolute bottom-0 left-2 h-5 w-5 -translate-x-1/2 rotate-45 bg-green-500" />
        </div>

        <h1 className="mt-5 text-xl font-bold text-slate-900">
          Banda Chat
        </h1>

        <div className="mx-auto mt-5 h-9 w-9 animate-spin rounded-full border-4 border-slate-200 border-t-blue-600" />

        <p className="mt-4 text-sm text-slate-500">
          Membuka halaman login...
        </p>
      </div>
    </main>
  );
}