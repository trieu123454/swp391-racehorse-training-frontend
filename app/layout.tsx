import type { Metadata } from "next";
import "./globals.css";

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
