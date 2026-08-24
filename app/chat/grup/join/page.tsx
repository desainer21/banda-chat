"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import BandaLogo from "@/components/BandaLogo";

function JoinGroupContent() {
  const router = useRouter();
  const params = useSearchParams();
  const [status, setStatus] = useState("Menghubungkan Anda ke grup...");
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const code = params.get("code")?.trim();

      if (!code) {
        if (!cancelled) setError("Link undangan grup tidak lengkap.");
        return;
      }

      const { data: session } = await supabase.auth.getSession();

      if (!session.session?.user) {
        router.replace(
          `/login?redirect=/chat/grup/join?code=${encodeURIComponent(code)}`
        );
        return;
      }

      const { data, error: rpcError } = await supabase.rpc(
        "join_banda_group_by_invite",
        { p_invite_code: code }
      );

      if (rpcError) {
        if (!cancelled) setError(rpcError.message);
        return;
      }

      if (!data || typeof data !== "object" || !("id" in data)) {
        if (!cancelled) setError("Data grup tidak valid.");
        return;
      }

      if (!cancelled) setStatus("Berhasil bergabung. Membuka grup...");

      const group = data as { id: string };
      window.setTimeout(() => {
        if (!cancelled) router.replace(`/chat/grup?group=${group.id}`);
      }, 300);
    })();

    return () => {
      cancelled = true;
    };
  }, [params, router]);

  return (
    <main className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl border shadow-sm p-7 max-w-md w-full text-center">
        <BandaLogo size={56} />
        <h1 className="font-bold text-xl mt-4">Gabung Grup Banda Chat</h1>

        {error ? (
          <div className="mt-4 text-red-600 text-sm bg-red-50 p-3 rounded-xl">
            {error}
          </div>
        ) : (
          <p className="mt-3 text-slate-500 text-sm">{status}</p>
        )}

        <button
          type="button"
          onClick={() => router.replace("/chat/grup")}
          className="mt-5 px-4 py-2 rounded-xl border text-sm"
        >
          Buka Grup
        </button>
      </div>
    </main>
  );
}

export default function JoinGroupPage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border shadow-sm p-7 max-w-md w-full text-center">
            <BandaLogo size={56} />
            <h1 className="font-bold text-xl mt-4">Gabung Grup Banda Chat</h1>
            <p className="mt-3 text-slate-500 text-sm">
              Menghubungkan Anda ke grup...
            </p>
          </div>
        </main>
      }
    >
      <JoinGroupContent />
    </Suspense>
  );
}
