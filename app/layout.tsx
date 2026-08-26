import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import GlobalChatFeatures from "@/components/GlobalChatFeatures";
import BandaNotificationWidget from "@/components/BandaNotificationWidget";
import ChatNotificationBridge from "@/components/ChatNotificationBridge";
import PWARegister from "@/components/PWARegister";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Banda Chat",
  description: "Banda Chat - aplikasi pesan dan panggilan",
  applicationName: "Banda Chat",
  manifest: "/manifest.webmanifest",
  themeColor: "#00C853",
  icons: {
    icon: [
      { url: "/icon-192.svg", type: "image/svg+xml" },
      { url: "/icon-512.svg", type: "image/svg+xml" },
    ],
    apple: "/icon-192.svg",
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="id"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        {children}
        <GlobalChatFeatures />
        <BandaNotificationWidget />
        <ChatNotificationBridge />
        <PWARegister />
      </body>
    </html>
  );
}
