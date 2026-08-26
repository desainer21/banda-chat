"use client";

import { useEffect } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";

/**
 * Opens a private conversation when a notification contains a sender id.
 * This is intentionally isolated from app/chat/page.tsx so the existing chat
 * page layout and messaging logic are not modified.
 */
export default function ChatNotificationBridge() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    if (pathname !== "/chat") return;

    const senderId = searchParams.get("user");
    if (!senderId) return;

    let cancelled = false;
    let timer: number | null = null;
    let timeout: number | null = null;

    const openSender = async () => {
      const { data: profile, error } = await supabase
        .from("profiles")
        .select("id, full_name, username")
        .eq("id", senderId)
        .maybeSingle();

      if (cancelled || error || !profile) return;

      const fullName = (profile.full_name || "").trim().toLowerCase();
      const username = (profile.username || "").trim().toLowerCase();

      let attempts = 0;
      timer = window.setInterval(() => {
        if (cancelled) return;
        attempts += 1;

        const sidebar = document.querySelector("aside");
        if (!sidebar) {
          if (attempts >= 100 && timer !== null) window.clearInterval(timer);
          return;
        }

        const buttons = Array.from(sidebar.querySelectorAll("button"));
        const target = buttons.find((button) => {
          const text = (button.textContent || "").replace(/\s+/g, " ").trim().toLowerCase();
          if (!text) return false;
          return (
            (fullName && text.includes(fullName)) ||
            (username && text.includes(`@${username}`)) ||
            (username && text.includes(username))
          );
        });

        if (target) {
          if (timer !== null) window.clearInterval(timer);
          window.history.replaceState({}, "", "/chat");
          (target as HTMLButtonElement).click();
        } else if (attempts >= 100 && timer !== null) {
          window.clearInterval(timer);
        }
      }, 100);

      timeout = window.setTimeout(() => {
        if (timer !== null) window.clearInterval(timer);
      }, 10000);
    };

    void openSender();

    return () => {
      cancelled = true;
      if (timer !== null) window.clearInterval(timer);
      if (timeout !== null) window.clearTimeout(timeout);
    };
  }, [pathname, searchParams]);

  return null;
}
