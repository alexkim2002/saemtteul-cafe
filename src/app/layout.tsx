import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "샘뜰 카페 | 봉원교회",
  description: "샘뜰 카페(봉원교회 카페) 주문 페이지",
};

export const viewport: Viewport = {
  // 모바일 브라우저 주소창/상태바를 배경색과 맞춰 앱처럼 보이게
  themeColor: "#f3f4f6",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko" className="h-full antialiased">
      <body className="min-h-full bg-gray-100 text-gray-900">{children}</body>
    </html>
  );
}
