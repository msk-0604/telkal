import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "TELKAL", template: "%s | TELKAL" },
  description: "建設業向け 顧客情報・工事履歴管理システム",
  applicationName: "TELKAL",
  robots: { index: false, follow: false },
  appleWebApp: { capable: true, title: "TELKAL", statusBarStyle: "default" },
};

export const viewport: Viewport = {
  themeColor: "#ffffff",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ja" className="h-full antialiased">
      <body className="flex min-h-full flex-col bg-white text-slate-800">{children}</body>
    </html>
  );
}
