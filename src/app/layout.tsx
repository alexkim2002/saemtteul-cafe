import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "샘뜰 카페 포스 | 봉원교회",
  description: "샘뜰 카페(봉원교회 카페) 주문·매출 관리 포스",
  // iOS에서 "홈 화면에 추가"했을 때 주소창 없이 앱처럼 열립니다
  appleWebApp: {
    capable: true,
    title: "샘뜰 포스",
    statusBarStyle: "default",
  },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  // 모바일 브라우저 주소창/상태바를 배경색과 맞춰 앱처럼 보이게
  themeColor: "#fefdf9",
  // 노치 있는 기기에서 화면 끝까지 쓰되, 확대 기능은 막지 않습니다(접근성)
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko" className="h-full antialiased">
      <body className="min-h-full bg-cream text-ink">{children}</body>
    </html>
  );
}
