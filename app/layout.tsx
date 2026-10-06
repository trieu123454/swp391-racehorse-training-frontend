import type { Metadata } from "next";
import "@fontsource/be-vietnam-pro/400.css";
import "@fontsource/be-vietnam-pro/500.css";
import "@fontsource/be-vietnam-pro/600.css";
import "@fontsource/be-vietnam-pro/700.css";

import "./globals.css";
import "./horses/horses.css";
import "./design.css";

export const metadata: Metadata = {
  title: "Equine | Racehorse System",
  description: "Hệ thống quản lý, huấn luyện và chăm sóc ngựa đua.",
  referrer: "no-referrer-when-downgrade",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="vi">
      <body>{children}</body>
    </html>
  );
}
