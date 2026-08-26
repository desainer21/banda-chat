"use client";

import { useEffect } from "react";
import { useParams, useRouter } from "next/navigation";

export default function NotificationChatRedirectPage() {
  const params = useParams<{ conversationId: string }>();
  const router = useRouter();

  useEffect(() => {
    const conversationId = params?.conversationId;
    if (!conversationId) return;

    // Keep this route independent from the large chat page. The existing chat
    // page receives the exact conversation id through the URL when supported.
    router.replace(`/chat?conversation=${encodeURIComponent(conversationId)}`);
  }, [params, router]);

  return (
    <main className="min-h-screen flex items-center justify-center bg-white">
      <p className="text-sm text-slate-500">Membuka percakapan...</p>
    </main>
  );
}
