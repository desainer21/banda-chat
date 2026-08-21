"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

export default function DaftarPage() {
  const router = useRouter();

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  async function handleRegister(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();

    setErrorMessage("");
    setSuccessMessage("");

    // Validasi nama
    if (!fullName.trim()) {
      setErrorMessage("Nama lengkap wajib diisi.");
      return;
    }

    // Validasi email
    if (!email.trim()) {
      setErrorMessage("Email wajib diisi.");
      return;
    }

    // Validasi nomor telepon
    if (!phone.trim()) {
      setErrorMessage("Nomor telepon wajib diisi.");
      return;
    }

    // Validasi password
    if (!password) {
      setErrorMessage("Password wajib diisi.");
      return;
    }

    if (password.length < 6) {
      setErrorMessage("Password minimal 6 karakter.");
      return;
    }

    // Validasi konfirmasi password
    if (password !== confirmPassword) {
      setErrorMessage("Konfirmasi password tidak sama.");
      return;
    }

    setLoading(true);

    try {
      /*
       * 1. Membuat akun di Supabase Auth
       */
      const { data: authData, error: authError } =
        await supabase.auth.signUp({
          email: email.trim(),
          password: password,
        });

      if (authError) {
        throw new Error(authError.message);
      }

      if (!authData.user) {
        throw new Error("Akun gagal dibuat. Silakan coba lagi.");
      }

      const userId = authData.user.id;

      /*
       * 2. Membuat username otomatis
       *
       * Username dibuat dari bagian depan email.
       * Contoh:
       * banda@gmail.com
       * menjadi:
       * banda
       */
      const emailUsername =
        email
          .trim()
          .toLowerCase()
          .split("@")[0]
          .replace(/[^a-z0-9_]/g, "")
          .slice(0, 20) || "user";

      const username = `${emailUsername}_${userId.slice(0, 6)}`;

      /*
       * 3. Menyimpan data tambahan pengguna
       *    ke tabel profiles
       */
      const { error: profileError } = await supabase
        .from("profiles")
        .insert({
          id: userId,
          full_name: fullName.trim(),
          username: username,
          phone: phone.trim(),
        });

      if (profileError) {
        console.error("Profile error:", profileError);

        /*
         * Akun Auth sudah berhasil dibuat.
         * Jika profile gagal dibuat, kita tetap beri
         * informasi yang jelas kepada pengguna.
         */
        throw new Error(
          "Akun berhasil dibuat, tetapi profil gagal disimpan. Silakan hubungi admin."
        );
      }

      /*
       * 4. Jika Supabase meminta konfirmasi email,
       *    user belum langsung login.
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
       * 5. Jika email confirmation tidak diwajibkan,
       *    langsung masuk ke halaman utama.
       */
      setSuccessMessage("Akun berhasil dibuat. Mengarahkan ke halaman utama...");

      setTimeout(() => {
        router.push("/");
        router.refresh();
      }, 1000);
    } catch (error) {
      console.error("Register error:", error);

      if (error instanceof Error) {
        setErrorMessage(error.message);
      } else {
        setErrorMessage("Terjadi kesalahan. Silakan coba lagi.");
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-white px-4 py-10">
      <div className="mx-auto w-full max-w-md">
        {/* Kembali */}
        <Link
          href="/"
          className="mb-8 inline-flex items-center text-sm font-medium text-gray-600 transition hover:text-blue-600"
        >
          ← Kembali ke Beranda
        </Link>

        {/* Logo */}
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-blue-600 text-2xl font-bold text-white shadow-lg">
            B
          </div>

          <h1 className="text-3xl font-bold text-gray-900">
            Buat Akun Baru
          </h1>

          <p className="mt-2 text-gray-500">
            Daftar untuk mulai menggunakan Banda Chat
          </p>
        </div>

        {/* Form */}
        <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm sm:p-8">
          <form onSubmit={handleRegister} className="space-y-5">
            {/* Nama Lengkap */}
            <div>
              <label
                htmlFor="fullName"
                className="mb-2 block text-sm font-semibold text-gray-700"
              >
                Nama Lengkap
              </label>

              <input
                id="fullName"
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Masukkan nama lengkap"
                autoComplete="name"
                disabled={loading}
                className="w-full rounded-xl border border-gray-300 px-4 py-3 text-gray-900 outline-none transition placeholder:text-gray-400 focus:border-blue-600 focus:ring-2 focus:ring-blue-100 disabled:bg-gray-100"
              />
            </div>

            {/* Email */}
            <div>
              <label
                htmlFor="email"
                className="mb-2 block text-sm font-semibold text-gray-700"
              >
                Email
              </label>

              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="contoh@email.com"
                autoComplete="email"
                disabled={loading}
                className="w-full rounded-xl border border-gray-300 px-4 py-3 text-gray-900 outline-none transition placeholder:text-gray-400 focus:border-blue-600 focus:ring-2 focus:ring-blue-100 disabled:bg-gray-100"
              />
            </div>

            {/* Nomor Telepon */}
            <div>
              <label
                htmlFor="phone"
                className="mb-2 block text-sm font-semibold text-gray-700"
              >
                Nomor Telepon
              </label>

              <input
                id="phone"
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="08xxxxxxxxxx"
                autoComplete="tel"
                disabled={loading}
                className="w-full rounded-xl border border-gray-300 px-4 py-3 text-gray-900 outline-none transition placeholder:text-gray-400 focus:border-blue-600 focus:ring-2 focus:ring-blue-100 disabled:bg-gray-100"
              />
            </div>

            {/* Password */}
            <div>
              <label
                htmlFor="password"
                className="mb-2 block text-sm font-semibold text-gray-700"
              >
                Password
              </label>

              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Minimal 6 karakter"
                autoComplete="new-password"
                disabled={loading}
                className="w-full rounded-xl border border-gray-300 px-4 py-3 text-gray-900 outline-none transition placeholder:text-gray-400 focus:border-blue-600 focus:ring-2 focus:ring-blue-100 disabled:bg-gray-100"
              />
            </div>

            {/* Konfirmasi Password */}
            <div>
              <label
                htmlFor="confirmPassword"
                className="mb-2 block text-sm font-semibold text-gray-700"
              >
                Konfirmasi Password
              </label>

              <input
                id="confirmPassword"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Masukkan kembali password"
                autoComplete="new-password"
                disabled={loading}
                className="w-full rounded-xl border border-gray-300 px-4 py-3 text-gray-900 outline-none transition placeholder:text-gray-400 focus:border-blue-600 focus:ring-2 focus:ring-blue-100 disabled:bg-gray-100"
              />
            </div>

            {/* Pesan Error */}
            {errorMessage && (
              <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {errorMessage}
              </div>
            )}

            {/* Pesan Berhasil */}
            {successMessage && (
              <div className="rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
                {successMessage}
              </div>
            )}

            {/* Tombol Daftar */}
            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-xl bg-blue-600 px-4 py-3.5 font-semibold text-white transition hover:bg-blue-700 focus:outline-none focus:ring-4 focus:ring-blue-100 disabled:cursor-not-allowed disabled:bg-blue-400"
            >
              {loading ? "Membuat Akun..." : "Buat Akun"}
            </button>
          </form>

          {/* Link Login */}
          <div className="mt-6 border-t border-gray-100 pt-6 text-center">
            <p className="text-sm text-gray-500">
              Sudah memiliki akun?{" "}
              <Link
                href="/login"
                className="font-semibold text-blue-600 hover:text-blue-700 hover:underline"
              >
                Masuk sekarang
              </Link>
            </p>
          </div>
        </div>

        {/* Informasi */}
        <p className="mt-6 text-center text-xs leading-5 text-gray-400">
          Dengan membuat akun, Anda dapat menggunakan fitur Banda Chat dan
          menyimpan informasi akun Anda dengan aman.
        </p>
      </div>
    </main>
  );
}