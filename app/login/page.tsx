"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  async function handleLogin(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();

    setErrorMessage("");
    setSuccessMessage("");

    if (!email.trim()) {
      setErrorMessage("Email wajib diisi.");
      return;
    }

    if (!password) {
      setErrorMessage("Password wajib diisi.");
      return;
    }

    setLoading(true);

    try {
      console.log("1. Memulai login...");

      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      console.log("2. Hasil login:", data, error);

      if (error) {
        console.error("Login error:", error);

        const message = error.message.toLowerCase();

        if (message.includes("email not confirmed")) {
          setErrorMessage(
            "Email Anda belum dikonfirmasi. Silakan cek email Anda terlebih dahulu."
          );
        } else if (message.includes("invalid login credentials")) {
          setErrorMessage("Email atau password salah.");
        } else {
          setErrorMessage(error.message);
        }

        setLoading(false);
        return;
      }

      if (!data.user) {
        setErrorMessage("Login gagal. Data pengguna tidak ditemukan.");
        setLoading(false);
        return;
      }

      console.log("3. Login berhasil:", data.user.id);

      setSuccessMessage("Login berhasil! Membuka Banda Chat...");

      await new Promise((resolve) => setTimeout(resolve, 500));

      console.log("4. Mengarahkan ke halaman chat...");

      window.location.href = "/chat";
    } catch (error) {
      console.error("Login exception:", error);

      if (error instanceof Error) {
        setErrorMessage(error.message);
      } else {
        setErrorMessage("Terjadi kesalahan saat login.");
      }

      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-white px-4 py-10">
      <div className="mx-auto w-full max-w-md">

        {/* Kembali ke Beranda */}
        <Link
          href="/"
          className="mb-8 inline-flex items-center text-sm font-medium text-gray-600 transition hover:text-blue-600"
        >
          ← Kembali ke Beranda
        </Link>

        {/* Header */}
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-blue-600 text-2xl font-bold text-white shadow-lg">
            B
          </div>

          <h1 className="text-3xl font-bold text-gray-900">
            Selamat Datang
          </h1>

          <p className="mt-2 text-gray-500">
            Masuk ke akun Banda Chat Anda
          </p>
        </div>

        {/* Form Login */}
        <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm sm:p-8">
          <form onSubmit={handleLogin} className="space-y-5">

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
                placeholder="Masukkan password"
                autoComplete="current-password"
                disabled={loading}
                className="w-full rounded-xl border border-gray-300 px-4 py-3 text-gray-900 outline-none transition placeholder:text-gray-400 focus:border-blue-600 focus:ring-2 focus:ring-blue-100 disabled:bg-gray-100"
              />
            </div>

            {/* Error */}
            {errorMessage && (
              <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm leading-5 text-red-700">
                {errorMessage}
              </div>
            )}

            {/* Success */}
            {successMessage && (
              <div className="rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm leading-5 text-green-700">
                {successMessage}
              </div>
            )}

            {/* Tombol Masuk */}
            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-xl bg-blue-600 px-4 py-3.5 font-semibold text-white transition hover:bg-blue-700 focus:outline-none focus:ring-4 focus:ring-blue-100 disabled:cursor-not-allowed disabled:bg-blue-400"
            >
              {loading ? "Memproses..." : "Masuk"}
            </button>

          </form>

          {/* Daftar */}
          <div className="mt-6 border-t border-gray-100 pt-6 text-center">
            <p className="text-sm text-gray-500">
              Belum memiliki akun?{" "}
              <Link
                href="/daftar"
                className="font-semibold text-blue-600 hover:text-blue-700 hover:underline"
              >
                Daftar sekarang
              </Link>
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}