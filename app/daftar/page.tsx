"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import BandaLogo from "@/components/BandaLogo";
import { supabase } from "@/lib/supabase";

export default function DaftarPage() {
  const router = useRouter();
  const params = useSearchParams();
  const redirect = (() => {
    const value = params.get("redirect");
    return value && value.startsWith("/") ? value : "/chat";
  })();

  const [fullName, setFullName] = useState("");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  async function handleRegister(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (loading) return;

    setErrorMessage("");
    setSuccessMessage("");

    const cleanName = fullName.trim();
    const cleanUsername = username.trim().toLowerCase();
    const cleanEmail = email.trim();

    if (!cleanName) return setErrorMessage("Nama lengkap harus diisi.");
    if (!cleanUsername) return setErrorMessage("Username harus diisi.");
    if (!cleanEmail) return setErrorMessage("Email harus diisi.");
    if (password.length < 6) return setErrorMessage("Password minimal 6 karakter.");
    if (password !== confirmPassword) return setErrorMessage("Konfirmasi password tidak sama.");

    setLoading(true);

    try {
      const { data: existingUsername, error: usernameError } = await supabase
        .from("profiles")
        .select("id")
        .eq("username", cleanUsername)
        .maybeSingle();

      if (usernameError) throw new Error(usernameError.message);
      if (existingUsername) throw new Error("Username sudah digunakan. Silakan pilih username lain.");

      const { data, error } = await supabase.auth.signUp({
        email: cleanEmail,
        password,
      });

      if (error) throw new Error(error.message);
      if (!data.user) throw new Error("Akun belum berhasil dibuat.");

      const { error: profileError } = await supabase.from("profiles").upsert(
        {
          id: data.user.id,
          full_name: cleanName,
          username: cleanUsername,
          avatar_url: null,
        },
        { onConflict: "id" }
      );

      if (profileError) console.error("Create profile error:", profileError);

      // Jika konfirmasi email Supabase NONAKTIF, signUp langsung memberi session.
      // Pertahankan redirect agar pengguna yang datang dari undangan grup
      // kembali ke halaman grup setelah berhasil daftar.
      if (data.session?.user) {
        window.location.href = redirect;
        return;
      }

      // Fallback untuk konfigurasi Supabase yang tidak langsung memberi session.
      // Login otomatis tetap dicoba terlebih dahulu.
      const { data: autoLoginData, error: autoLoginError } =
        await supabase.auth.signInWithPassword({
          email: cleanEmail,
          password,
        });

      if (autoLoginData.session?.user) {
        window.location.href = redirect;
        return;
      }

      // Jangan lagi menampilkan pesan "login otomatis gagal" yang membingungkan.
      // Jika email confirmation aktif, akun memang belum dapat login sebelum
      // email dikonfirmasi. Arahkan pengguna ke login sambil mempertahankan link grup.
      if (autoLoginError) {
        setSuccessMessage(
          "Akun berhasil dibuat. Silakan login setelah akun Anda siap digunakan."
        );
        window.setTimeout(() => {
          router.push(`/login?redirect=${encodeURIComponent(redirect)}`);
        }, 900);
        return;
      }

      throw new Error("Akun berhasil dibuat, tetapi sesi login belum tersedia.");
    } catch (error) {
      console.error("Register error:", error);
      setErrorMessage(
        error instanceof Error ? error.message : "Pendaftaran gagal. Silakan coba lagi."
      );
    } finally {
      setLoading(false);
    }
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
              <div className="mx-auto flex justify-center"><BandaLogo size={82} /></div>
              <h2 className="mt-5 text-2xl font-bold text-slate-900">Buat Akun Baru</h2>
              <p className="mt-2 text-sm leading-6 text-slate-500">Daftar untuk mulai berkomunikasi di Banda Chat.</p>
            </div>

            <div className="p-6 sm:p-8">
              {errorMessage && (
                <div className="mb-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
                  <div className="flex items-start gap-3"><span>⚠️</span><p className="flex-1">{errorMessage}</p><button type="button" onClick={() => setErrorMessage("")} className="font-bold text-red-500">✕</button></div>
                </div>
              )}
              {successMessage && (
                <div className="mb-5 rounded-xl border border-green-200 bg-green-50 p-4 text-sm text-green-700">
                  <div className="flex items-start gap-3"><span>✓</span><p className="flex-1">{successMessage}</p></div>
                </div>
              )}

              <form onSubmit={handleRegister} className="space-y-4">
                <div><label htmlFor="fullName" className="mb-2 block text-sm font-semibold text-slate-700">Nama Lengkap</label><input id="fullName" type="text" autoComplete="name" value={fullName} onChange={(e) => setFullName(e.target.value)} disabled={loading} placeholder="Nama lengkap" className="h-12 w-full rounded-xl border border-slate-300 bg-white px-4 text-sm text-slate-900 outline-none focus:border-blue-600 focus:ring-4 focus:ring-blue-100 disabled:bg-slate-100" /></div>
                <div><label htmlFor="username" className="mb-2 block text-sm font-semibold text-slate-700">Username</label><input id="username" type="text" autoComplete="username" value={username} onChange={(e) => setUsername(e.target.value.replace(/\s/g, ""))} disabled={loading} placeholder="contoh: bandachat" className="h-12 w-full rounded-xl border border-slate-300 bg-white px-4 text-sm text-slate-900 outline-none focus:border-blue-600 focus:ring-4 focus:ring-blue-100 disabled:bg-slate-100" /><p className="mt-1 text-[11px] text-slate-400">Username digunakan sebagai identitas Anda.</p></div>
                <div><label htmlFor="email" className="mb-2 block text-sm font-semibold text-slate-700">Email</label><input id="email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} disabled={loading} placeholder="contoh@email.com" className="h-12 w-full rounded-xl border border-slate-300 bg-white px-4 text-sm text-slate-900 outline-none focus:border-blue-600 focus:ring-4 focus:ring-blue-100 disabled:bg-slate-100" /></div>
                <div><label htmlFor="password" className="mb-2 block text-sm font-semibold text-slate-700">Password</label><input id="password" type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} disabled={loading} placeholder="Minimal 6 karakter" className="h-12 w-full rounded-xl border border-slate-300 bg-white px-4 text-sm text-slate-900 outline-none focus:border-blue-600 focus:ring-4 focus:ring-blue-100 disabled:bg-slate-100" /></div>
                <div><label htmlFor="confirmPassword" className="mb-2 block text-sm font-semibold text-slate-700">Konfirmasi Password</label><input id="confirmPassword" type="password" autoComplete="new-password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} disabled={loading} placeholder="Ulangi password" className="h-12 w-full rounded-xl border border-slate-300 bg-white px-4 text-sm text-slate-900 outline-none focus:border-blue-600 focus:ring-4 focus:ring-blue-100 disabled:bg-slate-100" /></div>
                <button type="submit" disabled={loading || !fullName.trim() || !username.trim() || !email.trim() || !password || !confirmPassword} className="mt-2 flex h-12 w-full items-center justify-center rounded-xl bg-blue-600 px-4 text-sm font-bold text-white shadow-md shadow-blue-600/20 transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50">{loading ? "Membuat akun..." : "Daftar ke Banda Chat"}</button>
              </form>

              <div className="mt-7 border-t border-slate-100 pt-6 text-center">
                <p className="text-sm text-slate-500">Sudah memiliki akun?</p>
                <Link href={`/login?redirect=${encodeURIComponent(redirect)}`} className="mt-2 inline-block text-sm font-bold text-blue-600 hover:text-blue-800 hover:underline">Masuk sekarang</Link>
              </div>
            </div>
          </div>
          <p className="mt-6 text-center text-xs text-slate-400">Banda Chat • Cepat • Sederhana • Realtime</p>
        </div>
      </section>
    </main>
  );
}
