import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "샘뜰 카페 | 봉원교회",
  description: "샘뜰 카페(봉원교회 카페) 주문 페이지",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko" className="h-full antialiased">
      <body className="min-h-full bg-amber-50 text-gray-900">{children}</body>
    </html>
  );
}
