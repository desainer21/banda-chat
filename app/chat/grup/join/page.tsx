"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import BandaLogo from "@/components/BandaLogo";

export default function JoinGroupPage() {
  const router = useRouter();
  const params = useSearchParams();
  const [status, setStatus] = useState("Menghubungkan Anda ke grup...");
  const [error, setError] = useState("");

  useEffect(() => {
    (async () => {
      const code = params.get("code")?.trim();
      if (!code) { setError("Link undangan grup tidak lengkap."); return; }
      const { data: session } = await supabase.auth.getSession();
      if (!session.session?.user) { router.replace(`/login?redirect=/chat/grup/join?code=${encodeURIComponent(code)}`); return; }
      const { data, error: rpcError } = await supabase.rpc("join_banda_group_by_invite", { p_invite_code: code });
      if (rpcError) { setError(rpcError.message); return; }
      setStatus("Berhasil bergabung. Membuka grup...");
      const group = data as { id: string };
      setTimeout(() => router.replace(`/chat/grup?group=${group.id}`), 300);
    })();
  }, [params, router]);

  return <main className="min-h-screen bg-slate-50 flex items-center justify-center p-4"><div className="bg-white rounded-2xl border shadow-sm p-7 max-w-md w-full text-center"><BandaLogo size={56} /><h1 className="font-bold text-xl mt-4">Gabung Grup Banda Chat</h1>{error ? <div className="mt-4 text-red-600 text-sm bg-red-50 p-3 rounded-xl">{error}</div> : <p className="mt-3 text-slate-500 text-sm">{status}</p>}<button onClick={() => router.replace("/chat/grup")} className="mt-5 px-4 py-2 rounded-xl border text-sm">Buka Grup</button></div></main>;
}
