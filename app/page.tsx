"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

import { supabase } from "@/lib/supabase";
import BandaLogo from "@/components/BandaLogo";

export default function HomePage() {
  const router = useRouter();

  useEffect(() => {
    let active = true;

    async function checkSession() {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!active) {
        return;
      }

      if (session?.user) {
        router.replace("/chat");
      } else {
        router.replace("/login");
      }
    }

    void checkSession();

    return () => {
      active = false;
    };
  }, [router]);

  return (
    <main className="flex min-h-[100dvh] items-center justify-center bg-gradient-to-br from-blue-50 via-white to-sky-100">
      <div className="flex flex-col items-center text-center">
        <BandaLogo size={90} />

        <div className="mt-6 h-8 w-8 animate-spin rounded-full border-4 border-blue-100 border-t-blue-600" />

        <p className="mt-4 text-sm font-medium text-slate-500">
          Membuka Banda Chat...
        </p>
      </div>
    </main>
  );
}