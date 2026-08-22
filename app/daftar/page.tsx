"use client";

import {
  FormEvent,
  useState,
} from "react";

import Link from "next/link";
import { useRouter } from "next/navigation";

import { supabase } from "@/lib/supabase";

export default function DaftarPage() {
  const router = useRouter();

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] =
    useState("");

  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] =
    useState("");
  const [successMessage, setSuccessMessage] =
    useState("");

  async function handleRegister(
    e: FormEvent<HTMLFormElement>
  ) {
    e.preventDefault();

    if (loading) {
      return;
    }

    setErrorMessage("");
    setSuccessMessage("");

    /*
     * Validasi nama.
     * Tetap seperti kode sebelumnya.
     */
    if (!fullName.trim()) {
      setErrorMessage(
        "Nama lengkap wajib diisi."
      );
      return;
    }

    /*
     * Validasi email.
     */
    if (!email.trim()) {
      setErrorMessage(
        "Email wajib diisi."
      );
      return;
    }

    /*
     * Validasi nomor telepon.
     */
    if (!phone.trim()) {
      setErrorMessage(
        "Nomor telepon wajib diisi."
      );
      return;
    }

    /*
     * Validasi password.
     */
    if (!password) {
      setErrorMessage(
        "Password wajib diisi."
      );
      return;
    }

    if (password.length < 6) {
      setErrorMessage(
        "Password minimal 6 karakter."
      );
      return;
    }

    /*
     * Validasi konfirmasi password.
     */
    if (password !== confirmPassword) {
      setErrorMessage(
        "Konfirmasi password tidak sama."
      );
      return;
    }

    setLoading(true);

    try {
      /*
       * 1. Membuat akun di Supabase Auth.
       *
       * Logika lama yang sudah berhasil
       * tidak diubah.
       */
      const {
        data: authData,
        error: authError,
      } = await supabase.auth.signUp({
        email: email.trim(),
        password: password,
      });

      if (authError) {
        throw new Error(
          authError.message
        );
      }

      if (!authData.user) {
        throw new Error(
          "Akun gagal dibuat. Silakan coba lagi."
        );
      }

      const userId = authData.user.id;

      /*
       * 2. Membuat username otomatis.
       */
      const emailUsername =
        email
          .trim()
          .toLowerCase()
          .split("@")[0]
          .replace(/[^a-z0-9_]/g, "")
          .slice(0, 20) || "user";

      const username =
        `${emailUsername}_${userId.slice(0, 6)}`;

      /*
       * 3. Menyimpan profil ke tabel profiles.
       *
       * Struktur insert tetap dipertahankan.
       */
      const { error: profileError } =
        await supabase
          .from("profiles")
          .insert({
            id: userId,
            full_name: fullName.trim(),
            username: username,
            phone: phone.trim(),
          });

      if (profileError) {
        console.error(
          "Profile error:",
          profileError
        );

        throw new Error(
          "Akun berhasil dibuat, tetapi profil gagal disimpan. Silakan hubungi admin."
        );
      }

      /*
       * 4. Jika konfirmasi email diperlukan.
       */
      if (!authData.session) {
        setSuccessMessage(
          "Pendaftaran berhasil! Silakan cek email Anda untuk melakukan konfirmasi akun."
        );

        setFullName("");
        setEmail("");
        setPhone("");
        setPassword("");
        setConfirmPassword("");

        return;
      }

      /*
       * 5. Jika session langsung tersedia,
       * masuk ke chat.
       */
      setSuccessMessage(
        "Akun berhasil dibuat. Mengarahkan ke Banda Chat..."
      );

      setTimeout(() => {
        router.replace("/chat");
        router.refresh();
      }, 1000);
    } catch (error) {
      console.error(
        "Register error:",
        error
      );

      if (error instanceof Error) {
        setErrorMessage(
          error.message
        );
      } else {
        setErrorMessage(
          "Terjadi kesalahan. Silakan coba lagi."
        );
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-slate-100">
      {/* HEADER */}
      <header className="border-b border-blue-700 bg-blue-600 shadow-sm">
        <div className="mx-auto flex min-h-[68px] w-full max-w-5xl items-center justify-center px-4">
          <Link
            href="/login"
            className="flex items-center gap-3"
          >
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
                Buat akun baru
              </p>
            </div>
          </Link>
        </div>
      </header>

      {/* HALAMAN DAFTAR */}
      <section className="px-4 py-8">
        <div className="mx-auto w-full max-w-md">
          {/* KEMBALI LOGIN */}
          <Link
            href="/login"
            className="mb-5 inline-flex items-center gap-2 text-sm font-medium text-slate-600 transition hover:text-blue-600"
          >
            ← Kembali ke Login
          </Link>

          <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-xl shadow-slate-200/70">
            {/* BAGIAN ATAS */}
            <div className="border-b border-slate-100 px-6 pb-6 pt-8 text-center sm:px-8">
              {/* LOGO */}
              <div className="relative mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-green-500 text-3xl font-bold text-white shadow-lg shadow-green-500/20">
                B

                <span className="absolute bottom-0 left-2 h-5 w-5 -translate-x-1/2 rotate-45 bg-green-500" />
              </div>

              <h2 className="mt-6 text-2xl font-bold text-slate-900">
                Buat Akun Baru
              </h2>

              <p className="mt-2 text-sm leading-6 text-slate-500">
                Daftar untuk mulai menggunakan
                Banda Chat.
              </p>
            </div>

            {/* FORM */}
            <div className="p-6 sm:p-8">
              <form
                onSubmit={handleRegister}
                className="space-y-5"
              >
                {/* NAMA LENGKAP */}
                <div>
                  <label
                    htmlFor="fullName"
                    className="mb-2 block text-sm font-semibold text-slate-700"
                  >
                    Nama Lengkap
                  </label>

                  <input
                    id="fullName"
                    type="text"
                    value={fullName}
                    onChange={(e) =>
                      setFullName(
                        e.target.value
                      )
                    }
                    placeholder="Masukkan nama lengkap"
                    autoComplete="name"
                    disabled={loading}
                    className="h-12 w-full rounded-xl border border-slate-300 bg-white px-4 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-600 focus:ring-4 focus:ring-blue-100 disabled:cursor-not-allowed disabled:bg-slate-100"
                  />
                </div>

                {/* EMAIL */}
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
                    value={email}
                    onChange={(e) =>
                      setEmail(
                        e.target.value
                      )
                    }
                    placeholder="contoh@email.com"
                    autoComplete="email"
                    disabled={loading}
                    className="h-12 w-full rounded-xl border border-slate-300 bg-white px-4 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-600 focus:ring-4 focus:ring-blue-100 disabled:cursor-not-allowed disabled:bg-slate-100"
                  />
                </div>

                {/* NOMOR TELEPON */}
                <div>
                  <label
                    htmlFor="phone"
                    className="mb-2 block text-sm font-semibold text-slate-700"
                  >
                    Nomor Telepon
                  </label>

                  <input
                    id="phone"
                    type="tel"
                    value={phone}
                    onChange={(e) =>
                      setPhone(
                        e.target.value
                      )
                    }
                    placeholder="08xxxxxxxxxx"
                    autoComplete="tel"
                    disabled={loading}
                    className="h-12 w-full rounded-xl border border-slate-300 bg-white px-4 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-600 focus:ring-4 focus:ring-blue-100 disabled:cursor-not-allowed disabled:bg-slate-100"
                  />
                </div>

                {/* PASSWORD */}
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
                    value={password}
                    onChange={(e) =>
                      setPassword(
                        e.target.value
                      )
                    }
                    placeholder="Minimal 6 karakter"
                    autoComplete="new-password"
                    disabled={loading}
                    className="h-12 w-full rounded-xl border border-slate-300 bg-white px-4 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-600 focus:ring-4 focus:ring-blue-100 disabled:cursor-not-allowed disabled:bg-slate-100"
                  />
                </div>

                {/* KONFIRMASI PASSWORD */}
                <div>
                  <label
                    htmlFor="confirmPassword"
                    className="mb-2 block text-sm font-semibold text-slate-700"
                  >
                    Konfirmasi Password
                  </label>

                  <input
                    id="confirmPassword"
                    type="password"
                    value={confirmPassword}
                    onChange={(e) =>
                      setConfirmPassword(
                        e.target.value
                      )
                    }
                    placeholder="Masukkan kembali password"
                    autoComplete="new-password"
                    disabled={loading}
                    className="h-12 w-full rounded-xl border border-slate-300 bg-white px-4 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-600 focus:ring-4 focus:ring-blue-100 disabled:cursor-not-allowed disabled:bg-slate-100"
                  />
                </div>

                {/* ERROR */}
                {errorMessage && (
                  <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                    {errorMessage}
                  </div>
                )}

                {/* BERHASIL */}
                {successMessage && (
                  <div className="rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
                    {successMessage}
                  </div>
                )}

                {/* TOMBOL */}
                <button
                  type="submit"
                  disabled={loading}
                  className="flex h-12 w-full items-center justify-center rounded-xl bg-blue-600 px-4 text-sm font-bold text-white shadow-md shadow-blue-600/20 transition hover:bg-blue-700 focus:outline-none focus:ring-4 focus:ring-blue-100 disabled:cursor-not-allowed disabled:bg-blue-400"
                >
                  {loading
                    ? "Membuat Akun..."
                    : "Buat Akun"}
                </button>
              </form>

              {/* LOGIN */}
              <div className="mt-7 border-t border-slate-100 pt-6 text-center">
                <p className="text-sm text-slate-500">
                  Sudah memiliki akun?
                </p>

                <Link
                  href="/login"
                  className="mt-2 inline-block text-sm font-bold text-blue-600 transition hover:text-blue-800 hover:underline"
                >
                  Masuk sekarang
                </Link>
              </div>
            </div>
          </div>

          <p className="mt-6 text-center text-xs leading-5 text-slate-400">
            Dengan membuat akun, Anda dapat menggunakan
            fitur Banda Chat dan menyimpan informasi akun
            Anda.
          </p>
        </div>
      </section>
    </main>
  );
}