import type { Metadata } from "next";
import "@fontsource/be-vietnam-pro/400.css";
import "@fontsource/be-vietnam-pro/500.css";
import "@fontsource/be-vietnam-pro/600.css";
import "@fontsource/be-vietnam-pro/700.css";
import "@fontsource/playfair-display/600.css";
import "./globals.css";
import "./horses/horses.css";

export const metadata: Metadata = {
  title: "Equine Sovereign | Racehorse Management",
  description: "Hệ thống quản lý và huấn luyện ngựa đua chuyên nghiệp",
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
